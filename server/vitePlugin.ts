import { mkdirSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import {
  ConflictError,
  diagramNameFromPath,
  listDiagrams,
  readDiagram,
  toDiagramName,
  uniqueName,
  writeDiagram,
} from './store';

/**
 * Dev-server side of the diagram workspace:
 *   GET  /api/diagrams          list
 *   GET  /api/diagrams/:name    read
 *   PUT  /api/diagrams/:name    write   { code, baseVersion? }  → 409 on conflict
 *   POST /api/diagrams          create  { name, code }          → picks a free name
 * and pushes `linework:changed` / `linework:removed` to the browser whenever a
 * file in the folder changes, whoever changed it (the app, an agent, an editor).
 */
export function lineworkWorkspace(dir: string): Plugin {
  return {
    name: 'linework-workspace',
    configureServer(server) {
      mkdirSync(dir, { recursive: true });
      server.watcher.add(dir);

      const push = async (file: string) => {
        const name = diagramNameFromPath(dir, file);
        if (!name) return;
        const diagram = await readDiagram(dir, name);
        if (diagram) server.ws.send({ type: 'custom', event: 'linework:changed', data: diagram });
      };
      server.watcher.on('add', push);
      server.watcher.on('change', push);
      server.watcher.on('unlink', (file) => {
        const name = diagramNameFromPath(dir, file);
        if (name) server.ws.send({ type: 'custom', event: 'linework:removed', data: { name } });
      });

      server.middlewares.use('/api/diagrams', (req, res) => {
        handle(dir, req, res).catch((err: unknown) => {
          send(res, 500, { error: err instanceof Error ? err.message : String(err) });
        });
      });
    },
  };
}

async function handle(dir: string, req: IncomingMessage, res: ServerResponse) {
  const name = decodeURIComponent((req.url ?? '/').split('?')[0].replace(/^\/+|\/+$/g, ''));

  if (req.method === 'GET' && !name) return send(res, 200, await listDiagrams(dir));

  if (req.method === 'POST' && !name) {
    const body = await readJson(req);
    const unique = await uniqueName(dir, String(body.name ?? 'untitled'));
    const { version } = await writeDiagram(dir, unique, String(body.code ?? ''), null);
    return send(res, 201, { name: unique, version });
  }

  if (name !== toDiagramName(name)) return send(res, 400, { error: `Invalid diagram name "${name}"` });

  if (req.method === 'GET') {
    const diagram = await readDiagram(dir, name);
    return diagram ? send(res, 200, diagram) : send(res, 404, { error: 'Not found' });
  }

  if (req.method === 'PUT') {
    const body = await readJson(req);
    try {
      const result = await writeDiagram(dir, name, String(body.code ?? ''),
        typeof body.baseVersion === 'string' ? body.baseVersion : undefined,
      );
      return send(res, 200, result);
    } catch (err) {
      if (err instanceof ConflictError) return send(res, 409, { error: err.message, current: err.current });
      throw err;
    }
  }

  send(res, 405, { error: 'Method not allowed' });
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 2_000_000) throw new Error('Request body too large');
  }
  return raw ? JSON.parse(raw) : {};
}

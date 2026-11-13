import { mkdirSync, watch, type FSWatcher } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  ConflictError,
  diagramNameFromPath,
  listDiagrams,
  readDiagram,
  toDiagramName,
  uniqueName,
  writeDiagram,
} from './store';
import path from 'node:path';

/**
 * HTTP API over the diagrams folder, shared by the Vite dev server and the
 * standalone app server:
 *
 *   GET  /api/diagrams          list
 *   GET  /api/diagrams/events   Server-Sent Events: "changed" {name, code, version} / "removed" {name}
 *   GET  /api/diagrams/:name    read
 *   PUT  /api/diagrams/:name    write   { code, baseVersion? }  → 409 on conflict
 *   POST /api/diagrams          create  { name, code }          → picks a free name
 *
 * Changes are detected by watching the folder, so edits from any source (the
 * app, an AI agent through MCP, a text editor) reach every open browser.
 */
export interface WorkspaceApi {
  /** Handles the request if it is for the API; returns false otherwise. */
  handle(req: IncomingMessage, res: ServerResponse): Promise<boolean>;
  close(): void;
}

const PREFIX = '/api/diagrams';

export function createWorkspaceApi(dir: string): WorkspaceApi {
  mkdirSync(dir, { recursive: true });
  const clients = new Set<ServerResponse>();
  const known = new Map<string, string>(); // name → last version broadcast
  void listDiagrams(dir).then((all) => all.forEach((d) => known.set(d.name, d.version)));

  const broadcast = (event: string, data: unknown) => {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of clients) res.write(payload);
  };

  // fs.watch reports renames and partial writes; settle each file briefly, then compare versions.
  const pending = new Map<string, NodeJS.Timeout>();
  const check = async (name: string) => {
    const diagram = await readDiagram(dir, name).catch(() => null);
    if (diagram) {
      if (known.get(name) === diagram.version) return;
      known.set(name, diagram.version);
      broadcast('changed', diagram);
    } else if (known.delete(name)) {
      broadcast('removed', { name });
    }
  };
  let watcher: FSWatcher | undefined;
  try {
    watcher = watch(dir, (_event, filename) => {
      const name = filename && diagramNameFromPath(dir, path.join(dir, filename.toString()));
      if (!name) return;
      clearTimeout(pending.get(name));
      pending.set(name, setTimeout(() => void check(name), 40));
    });
    // Watching alone should never keep a process alive (servers do that themselves).
    watcher.unref();
  } catch (err) {
    console.error(`linework: cannot watch ${dir} for changes:`, err);
  }

  // Keep event streams alive through proxies.
  const ping = setInterval(() => clients.forEach((res) => res.write(': ping\n\n')), 25_000);
  ping.unref?.();

  return {
    async handle(req, res) {
      const url = (req.url ?? '/').split('?')[0];
      if (url !== PREFIX && !url.startsWith(PREFIX + '/')) return false;
      const name = decodeURIComponent(url.slice(PREFIX.length).replace(/^\/+|\/+$/g, ''));
      try {
        await route(dir, name, req, res, clients);
      } catch (err) {
        send(res, 500, { error: err instanceof Error ? err.message : String(err) });
      }
      return true;
    },
    close() {
      watcher?.close();
      clearInterval(ping);
      for (const res of clients) res.end();
      clients.clear();
    },
  };
}

async function route(dir: string, name: string, req: IncomingMessage, res: ServerResponse, clients: Set<ServerResponse>) {
  if (req.method === 'GET' && name === 'events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(': connected\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

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
      const baseVersion = typeof body.baseVersion === 'string' ? body.baseVersion : undefined;
      return send(res, 200, await writeDiagram(dir, name, String(body.code ?? ''), baseVersion));
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

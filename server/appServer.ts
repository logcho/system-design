import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import path from 'node:path';
import { createWorkspaceApi } from './api';

/** Serves the built Linework app plus the workspace API for one diagrams folder. */

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

export interface AppServer {
  url: string;
  close(): Promise<void>;
}

export async function startAppServer(opts: { dir: string; appDir: string; port: number; host?: string }): Promise<AppServer> {
  const root = path.resolve(opts.appDir);
  if (!existsSync(path.join(root, 'index.html'))) {
    throw new Error(`The Linework app is not built (no ${path.join(root, 'index.html')}). Run "npm run build".`);
  }
  const api = createWorkspaceApi(opts.dir);
  const host = opts.host ?? '127.0.0.1';

  const server = createServer((req, res) => {
    void api.handle(req, res).then((handled) => {
      if (handled) return;
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405).end();
        return;
      }
      // Static files, with the app's index.html for any other path.
      const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
      let file = path.resolve(root, '.' + urlPath);
      if (!file.startsWith(root + path.sep) || !existsSync(file) || statSync(file).isDirectory()) {
        file = path.join(root, 'index.html');
      }
      const ext = path.extname(file);
      res.writeHead(200, {
        'Content-Type': TYPES[ext] ?? 'application/octet-stream',
        // Hashed assets never change; the page itself must always be fresh.
        'Cache-Control': file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
      });
      if (req.method === 'HEAD') res.end();
      else createReadStream(file).pipe(res);
    });
  });

  const port = await listen(server, opts.port, host);
  return {
    url: `http://localhost:${port}`,
    close: () =>
      new Promise((resolve) => {
        api.close();
        server.close(() => resolve());
      }),
  };
}

/** Listen on `port`, or the next free one (several agents may each run a viewer). */
async function listen(server: Server, port: number, host: string): Promise<number> {
  for (let p = port; p < port + 20; p++) {
    const ok = await new Promise<boolean>((resolve, reject) => {
      const onError = (err: NodeJS.ErrnoException) => {
        server.off('listening', onListening);
        if (err.code === 'EADDRINUSE') resolve(false);
        else reject(err);
      };
      const onListening = () => {
        server.off('error', onError);
        resolve(true);
      };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(p, host);
    });
    if (ok) return p;
  }
  throw new Error(`No free port between ${port} and ${port + 19}`);
}

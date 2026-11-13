import type { Plugin } from 'vite';
import { createWorkspaceApi } from './api';

/** Serves the diagram workspace API (see server/api.ts) from the Vite dev server. */
export function lineworkWorkspace(dir: string): Plugin {
  return {
    name: 'linework-workspace',
    configureServer(server) {
      const api = createWorkspaceApi(dir);
      server.httpServer?.on('close', () => api.close());
      server.middlewares.use((req, res, next) => {
        api.handle(req, res).then((handled) => handled || next(), next);
      });
    },
  };
}

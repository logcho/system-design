import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { lineworkWorkspace } from './server/vitePlugin';

/** Folder of `.lw` diagram files shared with the MCP server. */
const diagramsDir = process.env.LINEWORK_DIR ?? fileURLToPath(new URL('./diagrams', import.meta.url));

export default defineConfig({
  // Tests load this config too; they don't need the workspace API.
  plugins: [react(), ...(process.env.VITEST ? [] : [lineworkWorkspace(diagramsDir)])],
  // The npm package serves the app from dist/app (see mcp/cli.ts).
  build: { outDir: 'dist/app', emptyOutDir: true },
});

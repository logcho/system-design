import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { lineworkWorkspace } from './server/vitePlugin';

/** Folder of `.lw` diagram files shared with the MCP server. */
const diagramsDir = process.env.LINEWORK_DIR ?? fileURLToPath(new URL('./diagrams', import.meta.url));

export default defineConfig({
  plugins: [react(), lineworkWorkspace(diagramsDir)],
});

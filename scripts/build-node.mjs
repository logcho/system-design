// Bundles the CLI (MCP server + app server) into dist/node/cli.js for the npm package.
// Dependencies stay external: they are installed from package.json "dependencies".
import { build } from 'esbuild';
import { cpSync, chmodSync, mkdirSync } from 'node:fs';

await build({
  entryPoints: ['mcp/cli.ts'],
  outfile: 'dist/node/cli.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  packages: 'external',
  jsx: 'automatic',
  banner: { js: '#!/usr/bin/env node' },
  logLevel: 'warning',
});
chmodSync('dist/node/cli.js', 0o755);

// render.tsx loads fonts from ./fonts next to the bundle.
mkdirSync('dist/node/fonts', { recursive: true });
cpSync('mcp/fonts', 'dist/node/fonts', { recursive: true });
console.log('built dist/node/cli.js');

/**
 * linework-mcp: Linework's MCP server, plus a live viewer for the diagrams.
 *
 *   npx -y linework-mcp            MCP server on stdio, and the app at http://localhost:5173
 *   npx linework-mcp app           just the app, to watch or edit diagrams by hand
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { startAppServer, type AppServer } from '../server/appServer';
import { createLineworkServer, VERSION } from './tools';

const HELP = `linework-mcp ${VERSION}: system design diagrams as code, for AI agents and people

Usage
  linework-mcp [options]        Run the MCP server on stdio and serve the app
  linework-mcp app [options]    Only serve the app

Options
  --dir <path>      Diagrams folder (default: ./diagrams, or LINEWORK_DIR)
  --port <number>   App port; the next free port is used if taken (default: 5173, or LINEWORK_PORT)
  --no-app          MCP server only, without the app
  --app-url <url>   App address to put in tool results when you serve the app yourself (or LINEWORK_URL)
  --no-open         With "app": don't open a browser
  -h, --help        Show this help
  -v, --version     Show the version

Add to Claude Code:
  claude mcp add linework -- npx -y linework-mcp
`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    dir: { type: 'string' },
    port: { type: 'string' },
    'no-app': { type: 'boolean' },
    'app-url': { type: 'string' },
    'no-open': { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
    version: { type: 'boolean', short: 'v' },
  },
});

if (values.help) {
  process.stdout.write(HELP);
  process.exit(0);
}
if (values.version) {
  process.stdout.write(`${VERSION}\n`);
  process.exit(0);
}

const command = positionals[0] ?? 'mcp';
if (command !== 'mcp' && command !== 'app') {
  process.stderr.write(`Unknown command "${command}".\n\n${HELP}`);
  process.exit(1);
}

const dir = path.resolve(values.dir ?? process.env.LINEWORK_DIR ?? 'diagrams');
const port = Number(values.port ?? process.env.LINEWORK_PORT ?? 5173);
if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  process.stderr.write(`Invalid port "${values.port ?? process.env.LINEWORK_PORT}".\n`);
  process.exit(1);
}

/** The built app: next to this file in the package, or dist/app in a checkout. */
function findAppDir(): string | undefined {
  const candidates = ['../app/', '../dist/app/'].map((rel) => fileURLToPath(new URL(rel, import.meta.url)));
  return candidates.find((d) => existsSync(path.join(d, 'index.html')));
}

async function serveApp(): Promise<AppServer | undefined> {
  const appDir = findAppDir();
  if (!appDir) {
    process.stderr.write('linework: the app is not built, so only the MCP server is running. Run "npm run build" to include it.\n');
    return undefined;
  }
  return startAppServer({ dir, appDir, port });
}

function openBrowser(url: string) {
  const [cmd, args] =
    process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]];
  spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
}

if (command === 'app') {
  const app = await serveApp();
  if (!app) process.exit(1);
  process.stdout.write(`Linework is running at ${app.url}\nDiagrams folder: ${dir}\nPress Ctrl+C to stop.\n`);
  if (!values['no-open']) openBrowser(app.url);
} else {
  // stdout carries the MCP protocol: everything else goes to stderr.
  let app: AppServer | undefined;
  if (!values['no-app']) {
    try {
      app = await serveApp();
    } catch (err) {
      process.stderr.write(`linework: could not start the app: ${err instanceof Error ? err.message : err}\n`);
    }
  }
  const appUrl = app?.url ?? values['app-url'] ?? process.env.LINEWORK_URL ?? 'http://localhost:5173';
  const server = createLineworkServer({ dir, appUrl });
  await server.connect(new StdioServerTransport());
  process.stderr.write(`linework MCP server ready; diagrams in ${dir}${app ? `; app at ${app.url}` : ''}\n`);

  const shutdown = () => void Promise.all([server.close(), app?.close()]).finally(() => process.exit(0));
  process.stdin.on('close', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

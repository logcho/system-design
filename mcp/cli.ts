/**
 * Linework's command line: render, check and create diagrams, open the app,
 * and run the MCP server for AI agents. Installed as both `linework` and
 * `linework-mcp`.
 *
 *   linework                       open the app (MCP server when run by an MCP client)
 *   linework render checkout       diagrams/checkout.lw → diagrams/checkout.png
 *   linework check                 report problems in every diagram
 *   linework new checkout --kind sequence
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { startAppServer, type AppServer } from '../server/appServer';
import { CliError, KINDS, check, create, render, resolveInputs, watchAndRender, type Kind } from './commands';
import { createLineworkServer, VERSION } from './tools';

const HELP = `linework ${VERSION}: system design diagrams as code

Usage
  linework                          Open the app on your diagrams folder
  linework new <name>               Start a diagram (--kind flow | sequence | er)
  linework render [diagrams...]     Save diagrams as PNG or SVG images
  linework check [diagrams...]      Report mistakes; exits 1 if there are errors
  linework app                      Open the app (same as no command)
  linework mcp                      MCP server on stdio, for AI agents (serves the app too)

A diagram can be a file (docs/flow.lw), a folder, or a name in the diagrams
folder ("checkout" means diagrams/checkout.lw). render and check with no
diagrams use every .lw file in the diagrams folder.

Render options
  -o, --output <path>   File (one diagram) or folder; default: next to each diagram
  -f, --format <fmt>    png (default) or svg
  -t, --theme <name>    light (default) or dark
  -s, --scale <n>       PNG pixel density (default 2)
  -w, --watch           Render again whenever a diagram changes

Other options
  --dir <path>      Diagrams folder (default: ./diagrams, or LINEWORK_DIR)
  --port <number>   App port; the next free port is used if taken (default: 5173, or LINEWORK_PORT)
  --no-open         Don't open a browser
  --no-app          With "mcp": MCP server only, without the app
  --app-url <url>   With "mcp": app address for tool results when you serve the app yourself (or LINEWORK_URL)
  -h, --help        Show this help
  -v, --version     Show the version

Examples
  linework new checkout --kind sequence
  linework render checkout --theme dark
  linework render -o docs/images        every diagram, into docs/images
  linework render architecture.lw -o docs/architecture.svg --watch

Connect Claude Code:
  claude mcp add linework -- npx -y linework-mcp
`;

const COMMANDS = ['app', 'mcp', 'render', 'check', 'new', 'help'];

const fail = (message: string): never => {
  process.stderr.write(`linework: ${message}\n`);
  process.exit(1);
};

let parsed;
try {
  parsed = parseArgs({
    allowPositionals: true,
    options: {
      dir: { type: 'string' },
      port: { type: 'string' },
      'no-app': { type: 'boolean' },
      'app-url': { type: 'string' },
      'no-open': { type: 'boolean' },
      output: { type: 'string', short: 'o' },
      format: { type: 'string', short: 'f' },
      theme: { type: 'string', short: 't' },
      scale: { type: 'string', short: 's' },
      watch: { type: 'boolean', short: 'w' },
      kind: { type: 'string', short: 'k' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
  });
} catch (err) {
  fail(`${err instanceof Error ? err.message : err}\nRun "linework --help" for usage.`);
}
const { values, positionals } = parsed!;

if (values.help || positionals[0] === 'help') {
  process.stdout.write(HELP);
  process.exit(0);
}
if (values.version) {
  process.stdout.write(`${VERSION}\n`);
  process.exit(0);
}

// MCP clients start this with piped stdio and no arguments; a person typing
// "linework" in a terminal wants the app.
const command = positionals[0] ?? (process.stdin.isTTY ? 'app' : 'mcp');
const args = positionals.slice(1);
if (!COMMANDS.includes(command)) {
  fail(`unknown command "${command}". Commands: ${COMMANDS.filter((c) => c !== 'help').join(', ')}. Run "linework --help" for usage.`);
}

const dir = path.resolve(values.dir ?? process.env.LINEWORK_DIR ?? 'diagrams');
const port = Number(values.port ?? process.env.LINEWORK_PORT ?? 5173);
if (!Number.isInteger(port) || port <= 0 || port > 65535) fail(`invalid port "${values.port ?? process.env.LINEWORK_PORT}".`);

const print = (line: string) => process.stdout.write(line + '\n');

/** The built app: next to this file in the package, or dist/app in a checkout. */
function findAppDir(): string | undefined {
  const candidates = ['../app/', '../dist/app/'].map((rel) => fileURLToPath(new URL(rel, import.meta.url)));
  return candidates.find((d) => existsSync(path.join(d, 'index.html')));
}

async function serveApp(): Promise<AppServer | undefined> {
  const appDir = findAppDir();
  if (!appDir) {
    process.stderr.write('linework: the app is not built. Run "npm run build" to include it.\n');
    return undefined;
  }
  return startAppServer({ dir, appDir, port });
}

function openBrowser(url: string) {
  const [cmd, cmdArgs] =
    process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]];
  spawn(cmd, cmdArgs, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
}

function renderOptions() {
  const { format, theme, scale, output } = values;
  if (format && format !== 'png' && format !== 'svg') fail(`--format must be png or svg, not "${format}".`);
  if (theme && theme !== 'light' && theme !== 'dark') fail(`--theme must be light or dark, not "${theme}".`);
  const n = scale === undefined ? undefined : Number(scale);
  if (n !== undefined && !(n > 0 && n <= 8)) fail(`--scale must be a number from 0.1 to 8, not "${scale}".`);
  return { output, format: format as 'png' | 'svg' | undefined, theme: theme as 'light' | 'dark' | undefined, scale: n };
}

async function run() {
  switch (command) {
    case 'new': {
      if (!args[0]) fail('give the diagram a name, e.g. "linework new checkout".');
      const kind = (values.kind ?? 'flow').toLowerCase().replace(/^erd$/, 'er');
      if (!KINDS.includes(kind as Kind)) fail(`--kind must be one of ${KINDS.join(', ')}, not "${values.kind}".`);
      const file = await create(args.join(' '), kind as Kind, dir);
      print(`Created ${path.relative(process.cwd(), file) || file}`);
      print(`Edit it in your editor or run "linework" to open the app; "linework render ${path.basename(file, '.lw')}" saves an image.`);
      return;
    }
    case 'check': {
      const files = await resolveInputs(args, dir);
      const errors = await check(files, print);
      process.exit(errors ? 1 : 0);
    }
    case 'render': {
      const opts = renderOptions();
      const files = await resolveInputs(args, dir);
      const failed = await render(files, opts, print);
      if (values.watch) return watchAndRender(files, opts, print);
      process.exit(failed ? 1 : 0);
    }
    case 'app': {
      const app = await serveApp();
      if (!app) process.exit(1);
      print(`Linework is running at ${app.url}\nDiagrams folder: ${dir}\nPress Ctrl+C to stop.`);
      if (!values['no-open']) openBrowser(app.url);
      return;
    }
    case 'mcp': {
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
      return;
    }
  }
}

run().catch((err) => fail(err instanceof CliError || err instanceof Error ? err.message : String(err)));

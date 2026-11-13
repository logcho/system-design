/**
 * The Linework MCP tools: let an AI agent create, edit, check and look at
 * diagrams stored as `.lw` files in one folder. See cli.ts for how the server
 * is started.
 */
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ConflictError, listDiagrams, readDiagram, toDiagramName, writeDiagram } from '../server/store';
import { analyze, formatAnalysis } from './analyze';
import { SYNTAX_GUIDE } from './guide';
import { ICON_COUNTS, PACK_LABEL, searchIcons } from './icons';
import { renderDiagram } from './render';

/**
 * The package version, read from package.json so it can never drift from what
 * `npm version` sets. Works from the repo (mcp/tools.ts) and from the bundle
 * (dist/node/cli.js) by walking up to the linework-mcp package.json.
 */
export const VERSION = readVersion();

function readVersion(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (;;) {
    try {
      const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')) as { name?: string; version?: string };
      if (pkg.name === 'linework-mcp' && pkg.version) return pkg.version;
    } catch {
      // no package.json here; keep looking
    }
    const parent = path.dirname(dir);
    if (parent === dir) return '0.0.0';
    dir = parent;
  }
}

const text = (t: string) => ({ content: [{ type: 'text' as const, text: t }] });
const fail = (t: string) => ({ content: [{ type: 'text' as const, text: t }], isError: true });

function nameArg(raw: string): string {
  const name = toDiagramName(raw);
  if (!name) throw new Error(`"${raw}" is not a usable diagram name. Use something like "checkout-flow".`);
  return name;
}

export interface ServerOptions {
  /** Folder holding the `.lw` files. */
  dir: string;
  /** Where the user can watch diagrams, e.g. http://localhost:5173 */
  appUrl: string;
}

export function createLineworkServer({ dir: DIR, appUrl }: ServerOptions): McpServer {
  const APP_URL = appUrl.replace(/\/$/, '');
  const viewUrl = (name: string) => `${APP_URL}/?file=${encodeURIComponent(name)}`;

  const server = new McpServer(
    { name: 'linework', version: VERSION },
    {
      instructions: [
        'Linework draws system design diagrams (architecture/flow diagrams and sequence diagrams) from a small text language, with automatic layout and',
        `official AWS, Azure and Google Cloud icons (${ICON_COUNTS.aws} AWS, ${ICON_COUNTS.azure} Azure, ${ICON_COUNTS.gcp} GCP) plus`,
        `${ICON_COUNTS.tech} technology logos.`,
        'Call get_syntax_guide before writing your first diagram in a session. Use search_icons instead of guessing icon names.',
        'Every write returns problems (syntax errors, unknown icons, undeclared components): fix them before you finish.',
        'After writing, call render_diagram to look at the result and improve the layout (crossings, stray boxes, crowding).',
        'When the user wants an image file (for a README, doc or slide), call export_diagram.',
        `Diagrams are saved as .lw files in ${DIR}; the user can watch them update live at ${APP_URL}.`,
      ].join(' '),
    },
  );

  server.registerTool(
    'get_syntax_guide',
    {
      title: 'Get the diagram language guide',
      description:
        'The Linework diagram language: flow diagrams (components, groups, connections) and sequence diagrams ' +
        '(participants, messages, alt/loop/opt/par blocks, notes), icons, and tips for clear system designs.',
      annotations: { readOnlyHint: true },
    },
    async () => text(SYNTAX_GUIDE),
  );

  server.registerTool(
    'list_diagrams',
    {
      title: 'List diagrams',
      description: 'List the diagrams in the workspace, most recently changed first.',
      annotations: { readOnlyHint: true },
    },
    async () => {
      const all = await listDiagrams(DIR);
      if (!all.length) return text(`No diagrams yet in ${DIR}. Create one with write_diagram.`);
      const rows = await Promise.all(
        all.map(async (d) => {
          const doc = await readDiagram(DIR, d.name);
          const a = doc ? analyze(doc.code) : undefined;
          const title = a?.title ? ` "${a.title}"` : '';
          return `- ${d.name}${title}: ${a?.components ?? 0} components, version ${d.version}, changed ${d.modified}`;
        }),
      );
      return text(rows.join('\n'));
    },
  );

  server.registerTool(
    'read_diagram',
    {
      title: 'Read a diagram',
      description: 'Read a diagram\'s source, its current version (needed to overwrite it), and any problems in it.',
      inputSchema: { name: z.string().describe('Diagram name, e.g. "checkout-flow"') },
      annotations: { readOnlyHint: true },
    },
    async ({ name }) => {
      const n = nameArg(name);
      const doc = await readDiagram(DIR, n);
      if (!doc) return fail(`No diagram named "${n}". Call list_diagrams to see what exists.`);
      return text(`${n} (version ${doc.version})\n\n\`\`\`\n${doc.code}\n\`\`\`\n\n${formatAnalysis(analyze(doc.code))}`);
    },
  );

  server.registerTool(
    'write_diagram',
    {
      title: 'Create or replace a diagram',
      description:
        'Create a new diagram, or replace an existing one in full. To replace an existing diagram, pass the base_version ' +
        'from read_diagram, so edits the user made in the meantime are never overwritten. For small changes prefer ' +
        'edit_diagram. Returns problems to fix and a link the user can open.',
      inputSchema: {
        name: z.string().describe('Diagram name in kebab-case, e.g. "checkout-flow". Becomes <name>.lw'),
        code: z.string().describe('Full diagram source in the Linework language (see get_syntax_guide)'),
        base_version: z
          .string()
          .optional()
          .describe('Version from read_diagram. Required when the diagram already exists.'),
      },
    },
    async ({ name, code, base_version }) => {
      const n = nameArg(name);
      const existing = await readDiagram(DIR, n);
      if (existing && !base_version) {
        return fail(
          `"${n}" already exists (version ${existing.version}). Read it first and pass base_version to replace it, ` +
            'use edit_diagram for a targeted change, or choose another name.',
        );
      }
      try {
        const { version, created } = await writeDiagram(DIR, n, code, existing ? base_version : null);
        const verb = created ? 'Created' : 'Updated';
        return text(`${verb} ${n}.lw (version ${version}). View: ${viewUrl(n)}\n\n${formatAnalysis(analyze(code))}`);
      } catch (err) {
        if (err instanceof ConflictError) {
          return fail(`${err.message} The user may have edited it. Call read_diagram, then apply your change to the latest version.`);
        }
        throw err;
      }
    },
  );

  server.registerTool(
    'edit_diagram',
    {
      title: 'Edit part of a diagram',
      description:
        'Replace an exact piece of text in a diagram with new text, e.g. add a component after a line or rename a ' +
        'connection label. old_text must appear exactly once unless replace_all is true. Returns problems to fix.',
      inputSchema: {
        name: z.string().describe('Diagram name'),
        old_text: z.string().min(1).describe('Exact text to replace, including indentation'),
        new_text: z.string().describe('Replacement text (may be empty to delete)'),
        replace_all: z.boolean().optional().describe('Replace every occurrence instead of exactly one'),
      },
    },
    async ({ name, old_text, new_text, replace_all }) => {
      const n = nameArg(name);
      const doc = await readDiagram(DIR, n);
      if (!doc) return fail(`No diagram named "${n}".`);
      const count = doc.code.split(old_text).length - 1;
      if (count === 0) return fail(`old_text was not found in ${n}. Call read_diagram to see the current source.`);
      if (count > 1 && !replace_all) {
        return fail(`old_text appears ${count} times in ${n}. Include more surrounding text, or set replace_all.`);
      }
      const code = replace_all ? doc.code.split(old_text).join(new_text) : doc.code.replace(old_text, () => new_text);
      try {
        const { version } = await writeDiagram(DIR, n, code, doc.version);
        return text(`Updated ${n}.lw (version ${version}). View: ${viewUrl(n)}\n\n${formatAnalysis(analyze(code))}`);
      } catch (err) {
        if (err instanceof ConflictError) return fail(`${n} changed while editing. Try again.`);
        throw err;
      }
    },
  );

  server.registerTool(
    'search_icons',
    {
      title: 'Search icons',
      description:
        'Find exact icon names among the AWS, Azure, Google Cloud, technology-logo and generic icons. ' +
        'Search by service or product name ("dynamo", "cosmos", "pub sub", "postgres", "load balancer").',
      inputSchema: {
        query: z.string().min(1),
        pack: z.enum(['aws', 'azure', 'gcp', 'tech', 'generic']).optional().describe('Limit to one icon set'),
        limit: z.number().int().min(1).max(50).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ query, pack, limit }) => {
      const hits = searchIcons(query, pack, limit ?? 15);
      if (!hits.length) return text(`No icons match "${query}". Try a shorter or different word.`);
      return text(hits.map((h) => `${h.name}  (${PACK_LABEL[h.pack]})`).join('\n'));
    },
  );

  server.registerTool(
    'render_diagram',
    {
      title: 'Render a diagram to an image',
      description:
        'Render a diagram exactly as the app draws it and return a PNG, so you can check the layout: crossing ' +
        'connections, components far from their neighbours, crowded groups, unreadable labels. Also reports the number ' +
        'of crossing connections. Typical fixes: reorder declarations or connections, change direction, regroup ' +
        'components, or split a large diagram.',
      inputSchema: {
        name: z.string().describe('Diagram name'),
        theme: z.enum(['light', 'dark']).optional().describe('Color theme (default light)'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ name, theme }) => {
      const n = nameArg(name);
      const doc = await readDiagram(DIR, n);
      if (!doc) return fail(`No diagram named "${n}".`);
      const r = await renderDiagram(doc.code, { theme: theme ?? 'light' });
      const a = analyze(doc.code);
      const crossings =
        r.layout.kind !== 'sequence' ? `, ${r.crossings} crossing connection pair${r.crossings === 1 ? '' : 's'}` : '';
      const summary = [
        `${n} (version ${doc.version}): ${Math.round(r.width)}×${Math.round(r.height)} px${crossings}.`,
        formatAnalysis(a),
        `View live: ${viewUrl(n)}`,
      ].join('\n');
      return {
        content: [
          { type: 'image' as const, data: r.png.toString('base64'), mimeType: 'image/png' },
          { type: 'text' as const, text: summary },
        ],
      };
    },
  );

  server.registerTool(
    'export_diagram',
    {
      title: 'Save a diagram as an image',
      description:
        'Save a diagram as a PNG (crisp, 2x) or SVG file, e.g. to put in a README, doc or slide. By default it is ' +
        'saved next to the diagram as <name>.png or <name>.svg; pass path to save it elsewhere in the project.',
      inputSchema: {
        name: z.string().describe('Diagram name'),
        format: z.enum(['png', 'svg']).optional().describe('Image format (default png)'),
        theme: z.enum(['light', 'dark']).optional().describe('Color theme (default light)'),
        path: z
          .string()
          .optional()
          .describe('Where to save, relative to the project folder, e.g. "docs/architecture.png". Default: next to the diagram.'),
      },
    },
    async ({ name, format, theme, path: target }) => {
      const n = nameArg(name);
      const doc = await readDiagram(DIR, n);
      if (!doc) return fail(`No diagram named "${n}".`);
      const ext = format ?? (target?.toLowerCase().endsWith('.svg') ? 'svg' : 'png');
      // Saving is limited to the project: the folder that holds the diagrams folder.
      const root = path.dirname(DIR);
      const file = target ? path.resolve(root, target) : path.join(DIR, `${n}.${ext}`);
      if (file !== root && !file.startsWith(root + path.sep)) {
        return fail(`"${target}" is outside the project folder (${root}). Use a path inside it, e.g. "docs/${n}.${ext}".`);
      }
      if (path.extname(file).toLowerCase() !== `.${ext}`) {
        return fail(`The path should end in .${ext} for a ${ext.toUpperCase()} export.`);
      }
      const r = await renderDiagram(doc.code, { theme: theme ?? 'light', scale: 2 });
      await mkdir(path.dirname(file), { recursive: true });
      if (ext === 'png') await writeFile(file, r.png);
      else await writeFile(file, `<?xml version="1.0" encoding="UTF-8"?>\n${r.svg}`);
      const size =
        ext === 'png'
          ? `${Math.round(r.width * r.scale)}×${Math.round(r.height * r.scale)} px`
          : `${Math.round(r.width)}×${Math.round(r.height)} (scalable)`;
      return text(`Saved ${path.relative(root, file) || file} (${size}, ${theme ?? 'light'} theme).`);
    },
  );

  return server;
}

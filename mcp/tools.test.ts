import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parse } from '../src/dsl/parser';
import { SYNTAX_GUIDE } from './guide';
import { analyze } from './analyze';
import { countCrossings } from './render';
import type { LayoutResult } from '../src/layout/core';

const root = fileURLToPath(new URL('..', import.meta.url));
let dir: string;
let client: Client;

type ToolResult = { content: { type: string; text: string }[]; isError?: boolean };
const call = async (name: string, args: Record<string, unknown> = {}) =>
  (await client.callTool({ name, arguments: args })) as ToolResult;
const textOf = (r: ToolResult) => r.content.map((c) => c.text).join('\n');

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'linework-mcp-'));
  client = new Client({ name: 'test', version: '0' });
  await client.connect(
    new StdioClientTransport({
      command: path.join(root, 'node_modules/.bin/tsx'),
      args: [path.join(root, 'mcp/cli.ts'), '--no-app'],
      env: { ...(process.env as Record<string, string>), LINEWORK_DIR: dir, LINEWORK_URL: 'http://localhost:5173' },
      stderr: 'ignore',
    }),
  );
}, 30_000);

afterAll(async () => {
  await client?.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('linework MCP server', () => {
  it('lists its tools and gives instructions', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'edit_diagram',
      'get_syntax_guide',
      'list_diagrams',
      'read_diagram',
      'render_diagram',
      'search_icons',
      'write_diagram',
    ]);
    expect(client.getInstructions()).toMatch(/get_syntax_guide/);
    // The server reports the package.json version (not a hard-coded copy).
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as { version: string };
    expect(client.getServerVersion()?.version).toBe(pkg.version);
  });

  it('creates a diagram, reports problems, and writes the file', async () => {
    const r = await call('write_diagram', {
      name: 'Checkout Flow',
      code: 'title Checkout\nAPI [icon: aws-lambda]\nDB [icon: aws-dynamo-database]\nAPI > DB\nAPI > Paymnets',
    });
    const t = textOf(r);
    expect(r.isError).toBeFalsy();
    expect(t).toMatch(/Created checkout-flow\.lw/);
    expect(t).toMatch(/\?file=checkout-flow/);
    expect(t).toMatch(/Unknown icon "aws-dynamo-database"/);
    expect(t).toMatch(/Close matches: aws-dynamo-?db/);
    expect(t).toMatch(/never declared.*Paymnets/);
    expect(readFileSync(path.join(dir, 'checkout-flow.lw'), 'utf8')).toMatch(/^title Checkout/);
  });

  it('refuses to overwrite without the current version', async () => {
    const r = await call('write_diagram', { name: 'checkout-flow', code: 'A > B' });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toMatch(/already exists \(version [0-9a-f]{12}\)/);

    const stale = await call('write_diagram', { name: 'checkout-flow', code: 'A > B', base_version: '000000000000' });
    expect(stale.isError).toBe(true);
    expect(textOf(stale)).toMatch(/read_diagram/);
  });

  it('reads, then replaces with the right version', async () => {
    const read = textOf(await call('read_diagram', { name: 'checkout-flow' }));
    const version = /version ([0-9a-f]{12})/.exec(read)![1];
    const r = await call('write_diagram', {
      name: 'checkout-flow',
      code: 'title Checkout\nAPI [icon: aws-lambda]\nDB [icon: aws-dynamodb]\nAPI > DB',
      base_version: version,
    });
    expect(textOf(r)).toMatch(/Updated checkout-flow\.lw/);
    expect(textOf(r)).toMatch(/No problems found/);
  });

  it('edits exact text and rejects ambiguous edits', async () => {
    const ok = await call('edit_diagram', { name: 'checkout-flow', old_text: 'API > DB', new_text: 'API > DB: put item' });
    expect(textOf(ok)).toMatch(/Updated/);
    expect(readFileSync(path.join(dir, 'checkout-flow.lw'), 'utf8')).toMatch(/API > DB: put item/);

    const missing = await call('edit_diagram', { name: 'checkout-flow', old_text: 'nope', new_text: 'x' });
    expect(missing.isError).toBe(true);

    const ambiguous = await call('edit_diagram', { name: 'checkout-flow', old_text: 'API', new_text: 'Api' });
    expect(ambiguous.isError).toBe(true);
    expect(textOf(ambiguous)).toMatch(/appears \d+ times/);
  });

  it('lists diagrams', async () => {
    expect(textOf(await call('list_diagrams'))).toMatch(/checkout-flow "Checkout": 2 components/);
  });

  it('finds icons by product name', async () => {
    expect((await call('search_icons', { query: 'dynamo' })).content[0].text.split('\n')[0]).toMatch(/^aws-dynamodb/);
    expect(textOf(await call('search_icons', { query: 'cosmos' }))).toMatch(/azure-cosmos-db/);
    expect(textOf(await call('search_icons', { query: 'pub sub', pack: 'gcp' }))).toMatch(/gcp-pub-sub/);
    expect(textOf(await call('search_icons', { query: 'postgres' }))).toMatch(/postgresql/);
  });

  it('renders a diagram to a PNG and counts crossings', async () => {
    const r = (await client.callTool({ name: 'render_diagram', arguments: { name: 'checkout-flow', theme: 'dark' } })) as {
      content: ({ type: 'image'; data: string; mimeType: string } | { type: 'text'; text: string })[];
    };
    const image = r.content.find((c) => c.type === 'image') as { data: string; mimeType: string };
    expect(image.mimeType).toBe('image/png');
    const png = Buffer.from(image.data, 'base64');
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(png.length).toBeGreaterThan(5_000);
    const t = r.content.find((c) => c.type === 'text') as { text: string };
    expect(t.text).toMatch(/\d+×\d+ px, 0 crossing connection pairs/);

    const missing = await call('render_diagram', { name: 'nope' });
    expect(missing.isError).toBe(true);
  });

  it('writes, validates and renders sequence diagrams', async () => {
    const r = await call('write_diagram', {
      name: 'login',
      code: 'diagram sequence\ntitle Login\nUser [icon: user]\nAPI [icon: aws-lambda]\nUser > API: POST /login\nalt [label: ok] {\n  API --> User: 200\n} else {\n  API --> Usr: 401\n}',
    });
    const t = textOf(r);
    expect(t).toMatch(/Sequence diagram: 3 participants, 3 messages, 1 blocks/);
    expect(t).toMatch(/never declared \(no icon\): Usr/);

    const img = (await client.callTool({ name: 'render_diagram', arguments: { name: 'login' } })) as {
      content: ({ type: 'image'; data: string } | { type: 'text'; text: string })[];
    };
    expect(img.content.some((c) => c.type === 'image')).toBe(true);
    const summary = (img.content.find((c) => c.type === 'text') as { text: string }).text;
    expect(summary).toMatch(/\d+×\d+ px\./);
    expect(summary).not.toMatch(/crossing/);
  });

  it('writes, validates and renders ER diagrams', async () => {
    const r = await call('write_diagram', {
      name: 'schema',
      code: 'diagram er\nusers {\n  id uuid pk\n}\norders {\n  id uuid pk\n  user_id uuid fk\n}\norders.user_id > users.id\norders.coupon_id > coupons.id',
    });
    const t = textOf(r);
    expect(t).toMatch(/ER diagram: 3 tables, 3 columns, 2 relationships/);
    expect(t).toMatch(/Table "coupons" is not declared/);
    expect(t).toMatch(/never declared with \{ \}: coupons/);

    const img = (await client.callTool({ name: 'render_diagram', arguments: { name: 'schema' } })) as {
      content: ({ type: 'image'; data: string } | { type: 'text'; text: string })[];
    };
    expect(img.content.some((c) => c.type === 'image')).toBe(true);
    expect((img.content.find((c) => c.type === 'text') as { text: string }).text).toMatch(/crossing connection pair/);
  });

  it('rejects names that escape the folder', async () => {
    const r = await call('write_diagram', { name: '../../etc/passwd', code: 'A' });
    expect(textOf(r)).toMatch(/etc-passwd\.lw/);
    expect(readFileSync(path.join(dir, 'etc-passwd.lw'), 'utf8')).toBe('A');
  });
});

describe('syntax guide', () => {
  it('has a working example', () => {
    const example = SYNTAX_GUIDE.slice(SYNTAX_GUIDE.indexOf('## Example (flow)') + '## Example (flow)'.length);
    expect(parse(example).errors).toEqual([]);
    const a = analyze(example);
    expect(a.problems).toEqual([]);
    expect(a.undeclared).toEqual([]);
  });
});

describe('countCrossings', () => {
  const edge = (from: string, to: string, points: [number, number][]) =>
    ({ def: { id: from + to, from, to, arrow: 'forward', dashed: false, line: 1 }, points: points.map(([x, y]) => ({ x, y })) }) as LayoutResult['edges'][number];

  it('counts pairs of connections that cross, ignoring ones that share a component', () => {
    const layout = {
      width: 100,
      height: 100,
      nodes: [],
      edges: [
        edge('A', 'B', [[0, 50], [100, 50]]),
        edge('C', 'D', [[50, 0], [50, 100]]), // crosses A>B
        edge('A', 'E', [[0, 50], [50, 0]]), // touches A>B at A only
        edge('F', 'G', [[0, 80], [100, 80]]), // crosses C>D
      ],
    } satisfies LayoutResult;
    expect(countCrossings(layout)).toBe(2);
  });
});

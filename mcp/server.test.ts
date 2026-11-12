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
      args: [path.join(root, 'mcp/server.ts')],
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
      'search_icons',
      'write_diagram',
    ]);
    expect(client.getInstructions()).toMatch(/get_syntax_guide/);
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

  it('rejects names that escape the folder', async () => {
    const r = await call('write_diagram', { name: '../../etc/passwd', code: 'A' });
    expect(textOf(r)).toMatch(/etc-passwd\.lw/);
    expect(readFileSync(path.join(dir, 'etc-passwd.lw'), 'utf8')).toBe('A');
  });
});

describe('syntax guide', () => {
  it('has a working example', () => {
    const example = SYNTAX_GUIDE.slice(SYNTAX_GUIDE.indexOf('## Example') + '## Example'.length);
    expect(parse(example).errors).toEqual([]);
    const a = analyze(example);
    expect(a.problems).toEqual([]);
    expect(a.undeclared).toEqual([]);
  });
});

import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { check, create, render, resolveInputs } from './commands';

const tmp = () => mkdtemp(path.join(os.tmpdir(), 'linework-cli-'));

describe('cli commands', () => {
  it('creates starter diagrams of each kind that check clean', async () => {
    const dir = path.join(await tmp(), 'diagrams');
    const files = [await create('Checkout Flow', 'flow', dir), await create('login', 'sequence', dir), await create('db', 'er', dir)];
    expect(files.map((f) => path.basename(f))).toEqual(['checkout-flow.lw', 'login.lw', 'db.lw']);
    expect(await readFile(files[1], 'utf8')).toMatch(/^diagram sequence\ntitle Login/);
    const lines: string[] = [];
    expect(await check(files, (l) => lines.push(l))).toBe(0);
    expect(lines.filter((l) => l.includes(': ok'))).toHaveLength(3);
    await expect(create('login', 'flow', dir)).rejects.toThrow('already exists');
  });

  it('resolves names, files and folders', async () => {
    const root = await tmp();
    const dir = path.join(root, 'diagrams');
    const a = await create('a', 'flow', dir);
    const b = await create('b', 'er', dir);
    expect(await resolveInputs([], dir)).toEqual([a, b]);
    expect(await resolveInputs(['b'], dir)).toEqual([b]);
    expect(await resolveInputs([a, dir], dir)).toEqual([a, b]);
    await expect(resolveInputs(['nope'], dir)).rejects.toThrow("Can't find");
  });

  it('reports errors with file and line, and refuses to render them', async () => {
    const dir = await tmp();
    const file = path.join(dir, 'bad.lw');
    await writeFile(file, 'G {\n  A\n');
    const lines: string[] = [];
    expect(await check([file], (l) => lines.push(l))).toBe(1);
    expect(lines[0]).toMatch(/bad\.lw:1: error: /);
    expect(await render([file], {}, () => {})).toBe(1);
    expect(existsSync(path.join(dir, 'bad.png'))).toBe(false);
  });

  it('renders PNG next to the diagram and SVG to a chosen path', async () => {
    const dir = await tmp();
    const file = await create('arch', 'flow', dir);
    expect(await render([file], {}, () => {})).toBe(0);
    expect((await readFile(path.join(dir, 'arch.png'))).subarray(1, 4).toString()).toBe('PNG');
    const svg = path.join(dir, 'out', 'arch.svg');
    await render([file], { output: svg, theme: 'dark' }, () => {});
    expect(await readFile(svg, 'utf8')).toMatch(/^<\?xml[\s\S]*<svg/);
  }, 30_000);
});

import { existsSync, statSync, watch } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ThemeName } from '../src/render/theme';
import { EXT, toDiagramName } from '../server/store';
import { analyze } from './analyze';
import { renderDiagram } from './render';

/**
 * The command-line side of Linework: render diagrams to images, check them for
 * mistakes, and start new ones, without an AI agent or the app.
 */

export class CliError extends Error {}

type Out = (line: string) => void;

/**
 * Turn command arguments into .lw files. Each argument can be a file, a folder
 * (every .lw file in it) or a diagram name in the diagrams folder ("checkout"
 * for diagrams/checkout.lw). No arguments means every diagram in the folder.
 */
export async function resolveInputs(args: string[], dir: string): Promise<string[]> {
  const listLw = async (folder: string) =>
    (await readdir(folder))
      .filter((f) => f.endsWith(EXT))
      .sort()
      .map((f) => path.join(folder, f));

  if (!args.length) {
    if (!existsSync(dir)) throw new CliError(`No diagrams folder at ${dir}. Create a diagram with "linework new <name>".`);
    const all = await listLw(dir);
    if (!all.length) throw new CliError(`No .lw files in ${dir}. Create one with "linework new <name>".`);
    return all;
  }
  const files: string[] = [];
  for (const arg of args) {
    const candidates = [path.resolve(arg), path.join(dir, arg.endsWith(EXT) ? arg : arg + EXT)];
    const hit = candidates.find((c) => existsSync(c));
    if (!hit) throw new CliError(`Can't find "${arg}" (looked for ${candidates.map((c) => path.relative('.', c) || c).join(' and ')}).`);
    if (statSync(hit).isDirectory()) files.push(...(await listLw(hit)));
    else files.push(hit);
  }
  return [...new Set(files)];
}

const rel = (file: string) => {
  const r = path.relative(process.cwd(), file);
  return r && !r.startsWith('..') ? r : file;
};

// ---------------------------------------------------------------- check

/** Print problems in each file, compiler style. Returns the number of errors. */
export async function check(files: string[], out: Out): Promise<number> {
  let errors = 0;
  let warnings = 0;
  for (const file of files) {
    const a = analyze(await readFile(file, 'utf8'));
    const problems = a.problems;
    for (const p of problems) out(`${rel(file)}:${p.line}: ${p.severity}: ${p.message}`);
    if (a.undeclared.length) {
      out(`${rel(file)}: warning: never declared (typo?): ${a.undeclared.join(', ')}`);
      warnings++;
    }
    errors += problems.filter((p) => p.severity === 'error').length;
    warnings += problems.filter((p) => p.severity === 'warning').length;
    if (!problems.length && !a.undeclared.length) out(`${rel(file)}: ok (${a.summary.replace(/\.$/, '')})`);
  }
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
  if (files.length > 1 || errors || warnings) {
    out(`\n${plural(files.length, 'diagram')} checked: ${plural(errors, 'error')}, ${plural(warnings, 'warning')}.`);
  }
  return errors;
}

// ---------------------------------------------------------------- render

export interface RenderCommandOptions {
  /** Output file (one input) or folder. Default: next to each diagram. */
  output?: string;
  format?: 'png' | 'svg';
  theme?: ThemeName;
  scale?: number;
}

function outputFor(file: string, files: string[], { output, format }: RenderCommandOptions): string {
  const base = path.basename(file, EXT);
  if (!output) return path.join(path.dirname(file), `${base}.${format ?? 'png'}`);
  const ext = path.extname(output).toLowerCase();
  const isFile = (ext === '.png' || ext === '.svg') && !(existsSync(output) && statSync(output).isDirectory());
  if (isFile) {
    if (files.length > 1) throw new CliError(`-o ${output} is one file, but there are ${files.length} diagrams. Pass a folder instead.`);
    return path.resolve(output);
  }
  return path.resolve(output, `${base}.${format ?? 'png'}`);
}

/** Render diagrams to PNG or SVG. Returns how many failed. */
export async function render(files: string[], opts: RenderCommandOptions, out: Out): Promise<number> {
  let failed = 0;
  for (const file of files) {
    const target = outputFor(file, files, opts);
    const format = target.toLowerCase().endsWith('.svg') ? 'svg' : 'png';
    if (opts.format && opts.format !== format) throw new CliError(`--format ${opts.format} doesn't match ${rel(target)}.`);
    const code = await readFile(file, 'utf8');
    const errs = analyze(code).problems.filter((p) => p.severity === 'error');
    if (errs.length) {
      for (const p of errs) out(`${rel(file)}:${p.line}: error: ${p.message}`);
      out(`${rel(file)}: not rendered (fix the errors above, or run "linework check").`);
      failed++;
      continue;
    }
    const r = await renderDiagram(code, { theme: opts.theme ?? 'light', scale: opts.scale ?? 2 });
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, format === 'png' ? r.png : `<?xml version="1.0" encoding="UTF-8"?>\n${r.svg}`);
    const size =
      format === 'png' ? `${Math.round(r.width * r.scale)}×${Math.round(r.height * r.scale)} px` : `${Math.round(r.width)}×${Math.round(r.height)}`;
    out(`${rel(file)} → ${rel(target)} (${size})`);
  }
  return failed;
}

/** Re-render each diagram whenever it changes, until the process is stopped. */
export function watchAndRender(files: string[], opts: RenderCommandOptions, out: Out): void {
  const timers = new Map<string, NodeJS.Timeout>();
  for (const file of files) {
    watch(file, () => {
      clearTimeout(timers.get(file));
      timers.set(
        file,
        setTimeout(() => {
          render([file], opts, out).catch((err) =>
            out(`${rel(file)}: ${err instanceof Error ? err.message : err}`),
          );
        }, 80),
      );
    });
  }
  out(`Watching ${files.length === 1 ? rel(files[0]) : `${files.length} diagrams`} for changes. Press Ctrl+C to stop.`);
}

// ---------------------------------------------------------------- new

export const KINDS = ['flow', 'sequence', 'er'] as const;
export type Kind = (typeof KINDS)[number];

const TEMPLATES: Record<Kind, (title: string) => string> = {
  flow: (title) => `title ${title}
direction right

// Components: Name [icon: ..., color: ...]. Groups use { }.
Client [icon: user, color: blue]

Cloud [color: orange] {
  API [icon: server]
  Database [icon: postgresql]
}

// Connections: >  <  <>  -  and dashed -->
Client > API: HTTPS
API > Database: SQL
`,
  sequence: (title) => `diagram sequence
title ${title}
autonumber

Client [icon: user]
API [icon: server]
Database [icon: postgresql]

Client > API: GET /items
API > Database: SELECT items
Database --> API: rows
API --> Client: 200 OK
`,
  er: (title) => `diagram er
title ${title}

users [icon: user] {
  id int pk
  email string unique
  created_at timestamp
}

posts {
  id int pk
  user_id int fk
  body text
}

// > many-to-one, < one-to-many, - one-to-one, <> many-to-many
posts.user_id > users.id: written by
`,
};

/** Create diagrams/<name>.lw from a starter template. Returns the new file. */
export async function create(name: string, kind: Kind, dir: string): Promise<string> {
  const fileName = toDiagramName(name);
  if (!fileName) throw new CliError(`"${name}" doesn't make a usable file name. Try letters and digits, e.g. "checkout-flow".`);
  const file = path.join(dir, fileName + EXT);
  if (existsSync(file)) throw new CliError(`${rel(file)} already exists.`);
  const title = name.replace(/\.lw$/, '').replace(/[-_]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  await mkdir(dir, { recursive: true });
  await writeFile(file, TEMPLATES[kind](title));
  return file;
}

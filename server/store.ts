import { createHash, randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Diagrams live as plain `.lw` files in one folder, so the browser (through
 * the dev server) and AI agents (through the MCP server) share one source of
 * truth, and diagrams can be committed and reviewed like code.
 */

export const EXT = '.lw';
const NAME_RE = /^[a-z0-9][a-z0-9_-]{0,79}$/;

export interface DiagramMeta {
  name: string;
  version: string;
  modified: string;
  bytes: number;
}

export interface Diagram {
  name: string;
  code: string;
  version: string;
}

export class ConflictError extends Error {
  constructor(
    message: string,
    readonly current: Diagram | null,
  ) {
    super(message);
  }
}

/** Content hash, so "has this changed since I read it?" is exact. */
export const versionOf = (code: string) => createHash('sha256').update(code).digest('hex').slice(0, 12);

/** Turn any title into a safe file name: "Photo Sharing (v2)" → "photo-sharing-v2". */
export function toDiagramName(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\.lw$/, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, 80);
}

export function assertName(name: string): string {
  if (!NAME_RE.test(name)) {
    throw new Error(`Invalid diagram name "${name}". Use lowercase letters, digits, "-" and "_".`);
  }
  return name;
}

const fileFor = (dir: string, name: string) => path.join(dir, assertName(name) + EXT);

/** Name of the diagram a path refers to, or undefined if it isn't one of ours. */
export function diagramNameFromPath(dir: string, file: string): string | undefined {
  if (path.dirname(path.resolve(file)) !== path.resolve(dir)) return undefined;
  const base = path.basename(file);
  if (!base.endsWith(EXT)) return undefined;
  const name = base.slice(0, -EXT.length);
  return NAME_RE.test(name) ? name : undefined;
}

export async function listDiagrams(dir: string): Promise<DiagramMeta[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  const out: DiagramMeta[] = [];
  for (const entry of entries) {
    const name = diagramNameFromPath(dir, path.join(dir, entry));
    if (!name) continue;
    const file = path.join(dir, entry);
    const [stat, code] = await Promise.all([fs.stat(file), fs.readFile(file, 'utf8')]);
    out.push({ name, version: versionOf(code), modified: stat.mtime.toISOString(), bytes: stat.size });
  }
  return out.sort((a, b) => b.modified.localeCompare(a.modified));
}

export async function readDiagram(dir: string, name: string): Promise<Diagram | null> {
  try {
    const code = await fs.readFile(fileFor(dir, name), 'utf8');
    return { name, code, version: versionOf(code) };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

/**
 * Write a diagram atomically.
 * `expectedVersion`: undefined = overwrite whatever is there; null = the file
 * must not exist yet; a string = the file must still be at that version.
 */
export async function writeDiagram(
  dir: string,
  name: string,
  code: string,
  expectedVersion?: string | null,
): Promise<{ version: string; created: boolean }> {
  const file = fileFor(dir, name);
  await fs.mkdir(dir, { recursive: true });
  const current = await readDiagram(dir, name);
  if (expectedVersion === null && current) {
    throw new ConflictError(`"${name}" already exists.`, current);
  }
  if (typeof expectedVersion === 'string' && current?.version !== expectedVersion) {
    throw new ConflictError(
      current ? `"${name}" changed since version ${expectedVersion} (now ${current.version}).` : `"${name}" no longer exists.`,
      current,
    );
  }
  const tmp = path.join(dir, `.${name}.${randomBytes(4).toString('hex')}.tmp`);
  await fs.writeFile(tmp, code, 'utf8');
  await fs.rename(tmp, file);
  return { version: versionOf(code), created: !current };
}

/** A name that isn't taken yet: "photo-sharing", then "photo-sharing-2"... */
export async function uniqueName(dir: string, wanted: string): Promise<string> {
  const base = toDiagramName(wanted) || 'untitled';
  const taken = new Set((await listDiagrams(dir)).map((d) => d.name));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

/**
 * Browser client for the diagram workspace served by the dev server
 * (server/vitePlugin.ts). Without a dev server (a static build), the app falls
 * back to keeping a single diagram in local storage.
 */

export interface DiagramMeta {
  name: string;
  version: string;
  modified: string;
}

export interface DiagramFile {
  name: string;
  code: string;
  version: string;
}

const API = '/api/diagrams';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? res.statusText);
  return res.json() as Promise<T>;
}

/** The list of diagrams, or null when no workspace is available. */
export async function listDiagrams(): Promise<DiagramMeta[] | null> {
  if (!import.meta.hot) return null;
  try {
    const res = await fetch(API);
    if (!res.ok || !res.headers.get('content-type')?.includes('json')) return null;
    return (await res.json()) as DiagramMeta[];
  } catch {
    return null;
  }
}

export async function readDiagram(name: string): Promise<DiagramFile> {
  return json(await fetch(`${API}/${encodeURIComponent(name)}`));
}

/** Create a diagram; the server picks a free name based on `name`. */
export async function createDiagram(name: string, code: string): Promise<{ name: string; version: string }> {
  return json(
    await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, code }) }),
  );
}

export type SaveResult = { ok: true; version: string } | { ok: false; current: DiagramFile | null };

export async function saveDiagram(name: string, code: string, baseVersion: string | undefined): Promise<SaveResult> {
  const res = await fetch(`${API}/${encodeURIComponent(name)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, baseVersion }),
  });
  if (res.status === 409) return { ok: false, current: ((await res.json()) as { current: DiagramFile | null }).current };
  return { ok: true, version: (await json<{ version: string }>(res)).version };
}

export function onDiagramChanged(cb: (d: DiagramFile) => void): () => void {
  const hot = import.meta.hot;
  if (!hot) return () => {};
  hot.on('linework:changed', cb);
  return () => hot.off?.('linework:changed', cb);
}

export function onDiagramRemoved(cb: (d: { name: string }) => void): () => void {
  const hot = import.meta.hot;
  if (!hot) return () => {};
  hot.on('linework:removed', cb);
  return () => hot.off?.('linework:removed', cb);
}

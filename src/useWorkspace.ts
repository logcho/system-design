import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createDiagram,
  listDiagrams,
  onDiagramChanged,
  onDiagramRemoved,
  readDiagram,
  saveDiagram,
  type DiagramFile,
  type DiagramMeta,
} from './workspace';

export type SaveStatus = 'local' | 'saved' | 'saving' | 'error';

interface Options {
  code: string;
  setCode: (code: string) => void;
  /**
   * The editor content was replaced from outside (file switch, agent edit), or,
   * with `replaced` false, another diagram changed and only a notice is due.
   */
  onReplaced: (message?: string, replaced?: boolean) => void;
  /** Skip the workspace, e.g. when opening a shared link. */
  disabled?: boolean;
}

const SAVE_DELAY = 450;
const titleOf = (code: string) => /^\s*title\s+(.+)$/m.exec(code)?.[1]?.trim();

/**
 * Keeps the editor in sync with a `.lw` file in the diagrams folder: loads it,
 * autosaves edits, and follows changes other editors (like an AI agent working
 * through the MCP server) make to the folder.
 */
export function useWorkspace({ code, setCode, onReplaced, disabled }: Options) {
  const [enabled, setEnabled] = useState(false);
  const [file, setFile] = useState<string | null>(null);
  const [files, setFiles] = useState<DiagramMeta[]>([]);
  const [status, setStatus] = useState<SaveStatus>('local');

  const fileRef = useRef<string | null>(null);
  const versionRef = useRef<string>();
  /** Content known to match the file on disk. */
  const syncedRef = useRef<string>();
  /** Content of the save request most recently sent, to recognize its echo. */
  const sentRef = useRef<string>();
  const codeRef = useRef(code);
  codeRef.current = code;
  const callbacks = useRef({ setCode, onReplaced });
  callbacks.current = { setCode, onReplaced };

  const refresh = useCallback(async () => {
    const list = await listDiagrams();
    if (list) setFiles(list);
  }, []);

  const adopt = useCallback((d: DiagramFile, message?: string) => {
    fileRef.current = d.name;
    versionRef.current = d.version;
    syncedRef.current = d.code;
    setFile(d.name);
    setStatus('saved');
    const url = new URL(window.location.href);
    url.searchParams.set('file', d.name);
    url.hash = '';
    window.history.replaceState(null, '', url);
    if (d.code !== codeRef.current) callbacks.current.setCode(d.code);
    callbacks.current.onReplaced(message);
  }, []);

  const save = useCallback(async () => {
    const name = fileRef.current;
    const content = codeRef.current;
    if (!name || content === syncedRef.current) return;
    sentRef.current = content;
    try {
      const res = await saveDiagram(name, content, versionRef.current);
      if (fileRef.current !== name) return;
      if (res.ok) {
        versionRef.current = res.version;
        syncedRef.current = content;
        setStatus(codeRef.current === content ? 'saved' : 'saving');
      } else if (res.current) {
        adopt(res.current, `${name}.lw was changed elsewhere; showing the latest version`);
      }
    } catch {
      setStatus('error');
    }
  }, [adopt]);

  const open = useCallback(
    async (name: string) => {
      await save();
      adopt(await readDiagram(name));
    },
    [adopt, save],
  );

  const create = useCallback(
    async (name: string, content: string) => {
      await save();
      const { name: created, version } = await createDiagram(name, content);
      adopt({ name: created, code: content, version });
      void refresh();
    },
    [adopt, refresh, save],
  );

  // Open the workspace once. (StrictMode runs effects twice; guard creation.)
  const started = useRef(false);
  useEffect(() => {
    if (disabled || started.current) return;
    started.current = true;
    void (async () => {
      const list = await listDiagrams();
      if (!list) return;
      setEnabled(true);
      setFiles(list);
      const wanted = new URL(window.location.href).searchParams.get('file');
      const pick = list.find((d) => d.name === wanted) ?? list[0];
      if (pick) adopt(await readDiagram(pick.name));
      else await create(titleOf(codeRef.current) ?? 'untitled', codeRef.current);
    })();
  }, [adopt, create, disabled]);

  // Autosave.
  useEffect(() => {
    if (!enabled || !fileRef.current) return;
    if (code === syncedRef.current) {
      setStatus('saved');
      return;
    }
    setStatus('saving');
    const t = setTimeout(() => void save(), SAVE_DELAY);
    return () => clearTimeout(t);
  }, [code, enabled, save]);

  // Follow changes made by others.
  useEffect(() => {
    if (!enabled) return;
    const offChanged = onDiagramChanged((d) => {
      void refresh();
      if (d.name === fileRef.current) {
        if (d.version === versionRef.current || d.code === sentRef.current) return; // our own save
        adopt(d);
      } else if (codeRef.current !== syncedRef.current) {
        callbacks.current.onReplaced(`${d.name}.lw was updated`, false);
      } else {
        adopt(d, `Showing ${d.name}.lw`);
      }
    });
    const offRemoved = onDiagramRemoved(() => void refresh());
    return () => {
      offChanged();
      offRemoved();
    };
  }, [adopt, enabled, refresh]);

  return { enabled, file, files, status, open, create };
}

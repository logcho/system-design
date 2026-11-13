import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseDocument } from './dsl/document';
import { allMessages } from './dsl/sequence';
import { layoutDocument, type DocumentLayout } from './layout/layout';
import { DocumentSvg } from './render/DocumentSvg';
import { Editor, type EditorHandle } from './components/Editor';
import { Canvas, type CanvasHandle } from './components/Canvas';
import { HelpPanel } from './components/HelpPanel';
import { DEFAULT_CODE, EXAMPLES } from './examples';
import { codeFromHash, copyPng, exportPng, exportSvg, shareUrl, slugify } from './export';
import type { ThemeName } from './render/theme';
import { resolveIcon } from './render/icons';
import { useWorkspace } from './useWorkspace';
import { IconDrawerContext } from './render/iconContext';
import { drawBrowserIcon } from './render/browserIcons';

const LS_CODE = 'linework:code';
const LS_THEME = 'linework:theme';
const LS_SPLIT = 'linework:split';

const store = {
  get(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, v: string) {
    try {
      localStorage.setItem(key, v);
    } catch {
      /* storage unavailable */
    }
  },
};

const SAVE_LABEL = {
  local: 'Saved in this browser',
  saved: 'Saved',
  saving: 'Saving…',
  error: 'Not saved',
} as const;

function initialTheme(): ThemeName {
  const saved = store.get(LS_THEME);
  if (saved === 'light' || saved === 'dark') return saved;
  return 'dark';
}

export default function App() {
  const [sharedCode] = useState(codeFromHash);
  const [code, setCode] = useState(() => sharedCode ?? store.get(LS_CODE) ?? DEFAULT_CODE);
  const [theme, setTheme] = useState<ThemeName>(initialTheme);
  const [layout, setLayout] = useState<DocumentLayout>();
  const [layoutError, setLayoutError] = useState<string>();
  const [selectedLine, setSelectedLine] = useState<number>();
  const [showHelp, setShowHelp] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [toast, setToast] = useState<string>();
  const [split, setSplit] = useState(() => Number(store.get(LS_SPLIT)) || 34);

  const editorRef = useRef<EditorHandle>(null);
  const canvasRef = useRef<CanvasHandle>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const exportSvgRef = useRef<SVGSVGElement>(null);
  const pendingFit = useRef(false);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? undefined : t)), 2200);
  }, []);

  const workspace = useWorkspace({
    code,
    setCode,
    disabled: sharedCode !== undefined,
    onReplaced: (message, replaced = true) => {
      if (replaced) {
        pendingFit.current = true;
        setSelectedLine(undefined);
      }
      if (message) flash(message);
    },
  });

  const doc = useMemo(() => {
    const d = parseDocument(code);
    const withIcons = d.kind === 'flow' ? d.diagram.nodes : d.diagram.participants;
    for (const n of withIcons) {
      if (n.icon && !resolveIcon(n.icon)) {
        d.diagram.errors.push({ line: n.line, severity: 'warning', message: `Unknown icon "${n.icon}" (open Syntax to browse icons)` });
      }
    }
    d.diagram.errors.sort((a, b) => a.line - b.line);
    return d;
  }, [code]);
  const diagram = doc.diagram;
  const counts =
    doc.kind === 'flow'
      ? `${doc.diagram.nodes.length} nodes, ${doc.diagram.edges.length} connections`
      : `${doc.diagram.participants.length} participants, ${allMessages(doc.diagram.items).length} messages`;
  const hardErrors = diagram.errors.filter((e) => e.severity === 'error');

  useEffect(() => {
    if (!workspace.enabled) store.set(LS_CODE, code);
  }, [code, workspace.enabled]);
  useEffect(() => {
    store.set(LS_THEME, theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => store.set(LS_SPLIT, String(split)), [split]);

  // Debounced async layout; drop results from stale runs.
  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(() => {
      layoutDocument(doc)
        .then((res) => {
          if (cancelled) return;
          setLayout(res);
          setLayoutError(undefined);
          if (pendingFit.current) {
            pendingFit.current = false;
            requestAnimationFrame(() => canvasRef.current?.fit());
          }
        })
        .catch((err: unknown) => {
          if (!cancelled) setLayoutError(err instanceof Error ? err.message : String(err));
        });
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [doc]);

  const loadExample = (name: string) => {
    const ex = EXAMPLES.find((e) => e.name === name);
    if (!ex) return;
    if (workspace.enabled) {
      // Examples open as new files so they never overwrite your work.
      void workspace.create(ex.name, ex.code);
      return;
    }
    pendingFit.current = true;
    setCode(ex.code);
    setSelectedLine(undefined);
  };

  const onShare = async () => {
    const url = shareUrl(code);
    window.history.replaceState(null, '', url);
    try {
      await navigator.clipboard.writeText(url);
      flash('Link copied to clipboard');
    } catch {
      flash('Link is in the address bar');
    }
  };

  const doExport = async (kind: 'svg' | 'png' | 'copy-png' | 'copy-code') => {
    setExportOpen(false);
    const svg = exportSvgRef.current;
    const name = slugify(diagram.title);
    try {
      if (kind === 'copy-code') {
        await navigator.clipboard.writeText(code);
        flash('Code copied');
        return;
      }
      if (!svg) return;
      if (kind === 'svg') exportSvg(svg, name);
      else if (kind === 'png') await exportPng(svg, name);
      else {
        await copyPng(svg);
        flash('Image copied');
      }
    } catch (err) {
      flash(`Export failed: ${err instanceof Error ? err.message : err}`);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (e.shiftKey && e.code === 'Digit1' && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        canvasRef.current?.fit();
      } else if (mod && e.key === 's') {
        e.preventDefault();
        void onShare();
      } else if (e.key === 'Escape') {
        setExportOpen(false);
        setSelectedLine(undefined);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Splitter drag
  const mainRef = useRef<HTMLDivElement>(null);
  const startSplitDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    const rect = mainRef.current!.getBoundingClientRect();
    const move = (ev: PointerEvent) => setSplit(Math.min(70, Math.max(18, ((ev.clientX - rect.left) / rect.width) * 100)));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.classList.remove('resizing');
    };
    document.body.classList.add('resizing');
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const svgW = layout ? Math.ceil(layout.layout.width + 64) : 0;
  const svgH = layout ? Math.ceil(layout.layout.height + 64 + (diagram.title ? 40 : 0)) : 0;
  const isEmpty =
    !!layout && (layout.kind === 'flow' ? layout.layout.nodes.length === 0 : layout.layout.participants.length === 0);

  return (
    <IconDrawerContext.Provider value={drawBrowserIcon}>
      <div className="app" style={{ '--split': `${split}%` } as React.CSSProperties}>
        <header className="topbar">
          <span className="brand">linework</span>
          <span className="doc-title">{diagram.title ?? 'Untitled diagram'}</span>
          <div className="spacer" />
          <label className="select" title="Load an example">
            <span>Examples</span>
            <select value="" onChange={(e) => loadExample(e.target.value)} aria-label="Load example">
              <option value="" disabled>
                Load example…
              </option>
              {EXAMPLES.map((ex) => (
                <option key={ex.name}>{ex.name}</option>
              ))}
            </select>
          </label>
          <button className={`btn ghost ${showHelp ? 'active' : ''}`} onClick={() => setShowHelp((s) => !s)}>
            Syntax
          </button>
          <button className="btn ghost" onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}>
            {theme === 'light' ? 'Dark' : 'Light'}
          </button>
          <button className="btn ghost" onClick={onShare} title="Copy share link (⌘S)">
            Share
          </button>
          <div className="menu-wrap">
            <button className="btn primary" onClick={() => setExportOpen((o) => !o)} disabled={!layout}>
              Export
            </button>
            {exportOpen && (
              <>
                <div className="menu-scrim" onClick={() => setExportOpen(false)} />
                <div className="menu" role="menu">
                  <button onClick={() => doExport('png')}>Download PNG</button>
                  <button onClick={() => doExport('svg')}>Download SVG</button>
                  <button onClick={() => doExport('copy-png')}>Copy image</button>
                  <button onClick={() => doExport('copy-code')}>Copy code</button>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="main" ref={mainRef}>
          <section className="pane editor-pane">
            <div className="pane-header">
              {workspace.enabled ? (
                <label className="file-picker">
                  <span className="file-name">{workspace.file ?? '…'}.lw</span>
                  <select
                    value={workspace.file ?? ''}
                    aria-label="Open diagram"
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '__new') {
                        const name = window.prompt('Name the new diagram');
                        if (name?.trim()) void workspace.create(name, `title ${name.trim()}\ndirection right\n\n`);
                      } else void workspace.open(v);
                    }}
                  >
                    {workspace.files.map((f) => (
                      <option key={f.name} value={f.name}>
                        {f.name}.lw
                      </option>
                    ))}
                    <option value="__new">New diagram…</option>
                  </select>
                </label>
              ) : (
                <span className="file-name">{slugify(diagram.title)}.lw</span>
              )}
              <span>{SAVE_LABEL[workspace.status]}</span>
            </div>
            <Editor ref={editorRef} value={code} onChange={setCode} errors={diagram.errors} />
            <div className={`status ${hardErrors.length ? 'has-errors' : diagram.errors.length ? 'has-warnings' : ''}`}>
              {diagram.errors.length === 0 && !layoutError ? (
                <span className="ok">
                  <span>
                    {counts}
                  </span>
                  <span className="status-clean">No issues</span>
                </span>
              ) : (
                <ul>
                  {layoutError && (
                    <li className="error">
                      Layout failed: {layoutError}
                    </li>
                  )}
                  {diagram.errors.slice(0, 4).map((e, i) => (
                    <li key={i} className={e.severity} onClick={() => editorRef.current?.revealLine(e.line)}>
                      <b>Line {e.line}</b> {e.message}
                    </li>
                  ))}
                  {diagram.errors.length > 4 && <li className="more">+{diagram.errors.length - 4} more</li>}
                </ul>
              )}
            </div>
          </section>

          <div className="splitter" onPointerDown={startSplitDrag} role="separator" aria-orientation="vertical" />

          <section className="pane canvas-pane">
            <Canvas
              ref={canvasRef}
              contentWidth={svgW}
              contentHeight={svgH}
              onBackgroundClick={() => setSelectedLine(undefined)}
            >
              {layout && (
                <DocumentSvg
                  ref={svgRef}
                  layout={layout}
                  theme={theme}
                  title={diagram.title}
                  selectedLine={selectedLine}
                  onNodeClick={(line) => {
                    setSelectedLine(line);
                    editorRef.current?.revealLine(line);
                  }}
                />
              )}
            </Canvas>
            {isEmpty && (
              <div className="empty">
                <p>Start typing on the left to draw.</p>
                <code>Client &gt; Server &gt; Database</code>
              </div>
            )}
            {showHelp && <HelpPanel theme={theme} onClose={() => setShowHelp(false)} />}
          </section>
        </main>

        {/* Off-screen copy with a solid background, used for exports. */}
        <div className="export-host" aria-hidden>
          {layout && <DocumentSvg ref={exportSvgRef} layout={layout} theme={theme} title={diagram.title} withBackground />}
        </div>

        {toast && <div className="toast">{toast}</div>}
      </div>
    </IconDrawerContext.Provider>
  );
}

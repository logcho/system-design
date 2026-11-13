import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import type { ParseError } from '../dsl/types';

export interface EditorHandle {
  revealLine: (line: number) => void;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  errors: ParseError[];
  /** Diagram kind, for kind-specific highlighting (ER column lines). */
  kind?: string;
}

const LINE_HEIGHT = 21;
const CONNECTOR = /(\s)(<-->|<--|-->|<->|<>|->|<-|--|>|<|-)(?=\s)/g;

/** Tiny line-oriented highlighter for the diagram language. */
const ER_MODIFIER = /^(pk|fk|unique|null|nullable)$/i;

/** ER column line inside a table: name, type, then modifiers like pk/fk. */
function highlightColumn(line: string, key: number): React.ReactNode | undefined {
  const m = /^(\s+)(\S+)((?:\s+\S+)*)(\s*(?:\/\/.*)?)$/.exec(line);
  if (!m || /[{}]/.test(line) || /\s(<-->|<--|-->|<->|<>|->|<-|--|>|<|-)\s/.test(` ${line} `)) return undefined;
  const words = m[3].split(/(\s+)/);
  let typed = false;
  return (
    <div key={key}>
      {m[1]}
      <span className="tk-name">{m[2]}</span>
      {words.map((w, i) => {
        if (!w.trim()) return w;
        if (ER_MODIFIER.test(w)) return <span key={i} className="tk-kw">{w}</span>;
        if (!typed) {
          typed = true;
          return <span key={i} className="tk-attr">{w}</span>;
        }
        return w;
      })}
      {m[4] && <span className="tk-comment">{m[4]}</span>}
    </div>
  );
}

function highlightLine(line: string, key: number, kind?: string): React.ReactNode {
  // Zero-width space keeps empty rows at full line height.
  if (!line) return <div key={key}>{'​'}</div>;
  if (kind === 'er') {
    const column = highlightColumn(line, key);
    if (column) return column;
  }
  const out: React.ReactNode[] = [];
  let rest = line;
  let comment = '';
  const cm = /(^|[^:])\/\//.exec(rest);
  if (cm) {
    comment = rest.slice(cm.index + cm[1].length);
    rest = rest.slice(0, cm.index + cm[1].length);
  }

  const directive = /^(\s*)(direction|title|diagram|autonumber)(\s+.*)?$/i.exec(rest);
  const note = /^(\s*)(note)(\s+)(over|left of|right of)(\s+[^:]*)(:.*)?$/i.exec(rest);
  if (directive) {
    out.push(directive[1], <span key="k" className="tk-kw">{directive[2]}</span>, <span key="v" className="tk-val">{directive[3] ?? ''}</span>);
  } else if (note) {
    out.push(
      note[1],
      <span key="k" className="tk-kw">{note[2]}</span>,
      note[3],
      <span key="w" className="tk-kw">{note[4]}</span>,
      <span key="t" className="tk-name">{note[5]}</span>,
      <span key="l" className="tk-label">{note[6] ?? ''}</span>,
    );
  } else {
    // Sequence blocks: "loop ... {", "} else ... {"
    const block = /\{\s*$/.test(rest) ? /^(\s*)(\}\s*)?(alt|loop|opt|par|critical|break|else|and)\b/i.exec(rest) : null;
    if (block) {
      out.push(block[1]);
      if (block[2]) out.push(<span key="cb" className="tk-brace">{block[2]}</span>);
      out.push(<span key="bk" className="tk-kw">{block[3]}</span>);
      rest = rest.slice(block[0].length);
    }
    let attrs = '';
    const am = /\[[^\]]*\]\s*(\{)?\s*$/.exec(rest);
    if (am) {
      attrs = rest.slice(am.index);
      rest = rest.slice(0, am.index);
    }
    let brace = '';
    if (!am && /\{\s*$/.test(rest)) {
      const i = rest.lastIndexOf('{');
      brace = rest.slice(i);
      rest = rest.slice(0, i);
    }

    // Edge label after the last connector's ':'
    const parts: React.ReactNode[] = [];
    let lastIdx = 0;
    let sawConnector = false;
    let i = 0;
    for (const m of rest.matchAll(CONNECTOR)) {
      sawConnector = true;
      parts.push(<span key={`n${i}`} className="tk-name">{rest.slice(lastIdx, m.index! + m[1].length)}</span>);
      parts.push(<span key={`c${i}`} className="tk-conn">{m[2]}</span>);
      lastIdx = m.index! + m[1].length + m[2].length;
      i++;
    }
    let tail = rest.slice(lastIdx);
    let label = '';
    if (sawConnector) {
      const c = tail.indexOf(':');
      if (c !== -1) {
        label = tail.slice(c);
        tail = tail.slice(0, c);
      }
    }
    if (/^\s*\}\s*$/.test(tail)) parts.push(<span key="cb" className="tk-brace">{tail}</span>);
    else parts.push(<span key="t" className="tk-name">{tail}</span>);
    if (label) parts.push(<span key="l" className="tk-label">{label}</span>);
    out.push(...parts);

    if (attrs) {
      const inner = attrs.replace(/(\w[\w-]*)(\s*:)/g, '\u0000$1\u0001$2');
      out.push(
        <span key="a" className="tk-attr">
          {inner.split(/\u0000/).map((seg, j) => {
            if (j === 0) return seg;
            const [k, v] = seg.split('\u0001');
            return (
              <span key={j}>
                <span className="tk-key">{k}</span>
                {v.replace(/\{\s*$/, '')}
                {/\{\s*$/.test(v) && <span className="tk-brace">{'{'}</span>}
              </span>
            );
          })}
        </span>,
      );
    }
    if (brace) out.push(<span key="b" className="tk-brace">{brace}</span>);
  }
  if (comment) out.push(<span key="cm" className="tk-comment">{comment}</span>);
  return <div key={key}>{out.length ? out : '​'}</div>;
}

export const Editor = forwardRef<EditorHandle, Props>(function Editor({ value, onChange, errors, kind }, ref) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lines = useMemo(() => value.split('\n'), [value]);
  const errorByLine = useMemo(() => {
    const m = new Map<number, ParseError>();
    for (const e of errors) if (!m.has(e.line) || e.severity === 'error') m.set(e.line, e);
    return m;
  }, [errors]);

  useImperativeHandle(ref, () => ({
    revealLine(line: number) {
      const ta = taRef.current;
      const sc = scrollRef.current;
      if (!ta || !sc) return;
      let start = 0;
      for (let i = 0; i < line - 1 && i < lines.length; i++) start += lines[i].length + 1;
      const end = start + (lines[line - 1]?.length ?? 0);
      ta.focus({ preventScroll: true });
      ta.setSelectionRange(start, end);
      const top = (line - 1) * LINE_HEIGHT;
      if (top < sc.scrollTop || top > sc.scrollTop + sc.clientHeight - LINE_HEIGHT * 3) {
        sc.scrollTo({ top: Math.max(0, top - sc.clientHeight / 3), behavior: 'smooth' });
      }
    },
  }));

  const insert = (text: string) => {
    // execCommand keeps the browser's native undo stack intact.
    if (!document.execCommand('insertText', false, text)) {
      const ta = taRef.current!;
      const { selectionStart: s, selectionEnd: e } = ta;
      onChange(value.slice(0, s) + text + value.slice(e));
    }
  };

  const onKeyDown = (ev: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = ev.currentTarget;
    if (ev.key === 'Tab' && !ev.metaKey && !ev.ctrlKey) {
      ev.preventDefault();
      insert('  ');
    } else if (ev.key === 'Enter' && !ev.metaKey && !ev.ctrlKey) {
      const before = value.slice(0, ta.selectionStart);
      const cur = before.slice(before.lastIndexOf('\n') + 1);
      const indent = /^\s*/.exec(cur)![0] + (/\{\s*$/.test(cur) ? '  ' : '');
      ev.preventDefault();
      insert('\n' + indent);
    } else if (ev.key === '/' && (ev.metaKey || ev.ctrlKey)) {
      ev.preventDefault();
      toggleComment(ta);
    }
  };

  const toggleComment = (ta: HTMLTextAreaElement) => {
    const { selectionStart: s, selectionEnd: e } = ta;
    const lineStart = value.lastIndexOf('\n', s - 1) + 1;
    let lineEnd = value.indexOf('\n', e === s ? e : e - 1);
    if (lineEnd === -1) lineEnd = value.length;
    const block = value.slice(lineStart, lineEnd).split('\n');
    const allCommented = block.every((l) => !l.trim() || /^\s*\/\//.test(l));
    const next = block
      .map((l) => (!l.trim() ? l : allCommented ? l.replace(/^(\s*)\/\/ ?/, '$1') : l.replace(/^(\s*)/, '$1// ')))
      .join('\n');
    ta.setSelectionRange(lineStart, lineEnd);
    insert(next);
    ta.setSelectionRange(lineStart, lineStart + next.length);
  };

  return (
    <div className="editor" ref={scrollRef}>
      <div className="editor-inner" style={{ minHeight: lines.length * LINE_HEIGHT + 24 }}>
        <div className="gutter" aria-hidden>
          {lines.map((_, i) => {
            const err = errorByLine.get(i + 1);
            return (
              <div key={i} className={err ? `gutter-line ${err.severity}` : 'gutter-line'} title={err?.message}>
                {i + 1}
              </div>
            );
          })}
        </div>
        <div className="code">
          <pre className="highlight" aria-hidden>
            {lines.map((l, i) => (
              <div key={i} className={errorByLine.has(i + 1) ? `hl-row ${errorByLine.get(i + 1)!.severity}` : 'hl-row'}>
                {highlightLine(l, i, kind)}
              </div>
            ))}
          </pre>
          <textarea
            ref={taRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            aria-label="Diagram source"
          />
        </div>
      </div>
    </div>
  );
});

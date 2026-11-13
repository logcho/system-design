import { useMemo, useState } from 'react';
import { ALL_ICON_NAMES, ICON_ALIASES, resolveIcon } from '../render/icons';
import { BRAND_ICON_NAMES } from '../render/brandIcons';
import { NodeIcon } from '../render/NodeIcon';
import { COLOR_NAMES, resolveColor, type ThemeName } from '../render/theme';

const TABS = [
  { id: 'aws', label: 'AWS', names: BRAND_ICON_NAMES.aws },
  { id: 'azure', label: 'Azure', names: BRAND_ICON_NAMES.azure },
  { id: 'gcp', label: 'GCP', names: BRAND_ICON_NAMES.gcp },
  { id: 'tech', label: 'Tech', names: BRAND_ICON_NAMES.tech },
  { id: 'generic', label: 'Generic', names: [...ICON_ALIASES, ...ALL_ICON_NAMES] },
] as const;
type TabId = (typeof TABS)[number]['id'];
const TOTAL = TABS.reduce((n, t) => n + t.names.length, 0);
const MAX_SHOWN = 300;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const SYNTAX: [string, string][] = [
  ['Node [icon: server, color: blue]', 'Declare a node with attributes'],
  ['Name [shape: cylinder]', 'Shapes: rect, oval, diamond, cylinder'],
  ['Group [icon: cloud] {\n  A\n  B\n}', 'Groups nest with { }'],
  ['A > B', 'Arrow'],
  ['A < B', 'Reverse arrow'],
  ['A <> B', 'Bidirectional'],
  ['A - B', 'Line, no arrow'],
  ['A --> B', 'Dashed (also <--, <-->, --)'],
  ['A > B: label', 'Connection label'],
  ['A > B, C', 'Fan out to many'],
  ['A > B > C', 'Chain'],
  ['A > B [color: red]', 'Colored connection'],
  ['direction down', 'right | down | left | up'],
  ['title My diagram', 'Title shown above the diagram'],
  ['// comment', 'Comments (⌘/ toggles)'],
];

const SEQUENCE: [string, string][] = [
  ['diagram sequence', 'First line: makes a sequence diagram'],
  ['User [icon: user]', 'Participant, in order of first use'],
  ['A > B: request', 'Call'],
  ['B --> A: response', 'Reply (dashed)'],
  ['A > A: think', 'Self call'],
  ['alt [label: ok] {\n  …\n} else {\n  …\n}', 'Alternatives'],
  ['loop every 5s {\n  …\n}', 'Also opt, par (} and {), critical, break'],
  ['note over A, B: text', 'Also note left of / right of'],
  ['autonumber', 'Number every message'],
];

function SyntaxTable({ rows }: { rows: [string, string][] }) {
  return (
    <table className="syntax">
      <tbody>
        {rows.map(([code, desc]) => (
          <tr key={code}>
            <td>
              <code>{code}</code>
            </td>
            <td>{desc}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function HelpPanel({ theme, onClose }: { theme: ThemeName; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<TabId>('aws');
  const [copied, setCopied] = useState<string>();
  const { icons, total } = useMemo(() => {
    // Compare without punctuation so "dynamodb" finds "aws-dynamo-db".
    const query = norm(q);
    const pool = query ? TABS.flatMap((t) => t.names) : TABS.find((t) => t.id === tab)!.names;
    const matches = query ? [...new Set(pool.filter((n) => norm(n).includes(query)))] : pool;
    return { icons: matches.slice(0, MAX_SHOWN), total: matches.length };
  }, [q, tab]);

  const copy = (name: string) => {
    navigator.clipboard?.writeText(`icon: ${name}`);
    setCopied(name);
    setTimeout(() => setCopied((c) => (c === name ? undefined : c)), 1200);
  };

  return (
    <aside className="help">
      <header>
        <h2>Syntax</h2>
        <button className="btn ghost" onClick={onClose}>
          Close
        </button>
      </header>
      <div className="help-body">
        <SyntaxTable rows={SYNTAX} />

        <h3>Sequence diagrams</h3>
        <SyntaxTable rows={SEQUENCE} />

        <h3>Colors</h3>
        <div className="swatches">
          {COLOR_NAMES.map((c) => (
            <span key={c} className="swatch">
              <i style={{ background: resolveColor(c, theme) }} />
              {c}
            </span>
          ))}
          <span className="swatch muted">or any #hex</span>
        </div>

        <h3>Icons</h3>
        <input
          className="icon-search"
          placeholder={`Search ${TOTAL.toLocaleString()} icons (e.g. lambda, cosmos, postgres)`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {!q && (
          <div className="tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
                {t.label}
                <small>{t.names.length}</small>
              </button>
            ))}
          </div>
        )}
        <div className="icon-grid">
          {icons.map((name) => {
            const icon = resolveIcon(name);
            if (!icon) return null;
            return (
              <button key={name} className="icon-cell" onClick={() => copy(name)} title={`Copy "icon: ${name}"`}>
                <svg width={28} height={28} viewBox="0 0 28 28">
                  {icon.kind === 'brand' ? (
                    <NodeIcon icon={icon} size={28} color="currentColor" />
                  ) : (
                    <NodeIcon icon={icon} x={3} y={3} size={22} color="currentColor" />
                  )}
                </svg>
                <span>{copied === name ? 'copied!' : name}</span>
              </button>
            );
          })}
        </div>
        {total > icons.length && (
          <p className="more-hint">
            Showing {icons.length} of {total.toLocaleString()}. Search to narrow down.
          </p>
        )}
        {total === 0 && <p className="more-hint">No icons match "{q}".</p>}
      </div>
    </aside>
  );
}

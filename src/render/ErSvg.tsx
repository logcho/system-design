import { forwardRef, useContext } from 'react';
import type { Cardinality } from '../dsl/er';
import type { Point } from '../layout/core';
import { NODE_METRICS } from '../layout/core';
import { ER_METRICS, columnBadges, columnType, type ErEntityBox, type ErLayout, type ErRelationPath } from '../layout/er';
import { PAD, roundedPath } from './DiagramSvg';
import { IconDrawerContext } from './iconContext';
import { THEMES, resolveColor, tint, type DiagramTheme, type ThemeName } from './theme';

interface Props {
  layout: ErLayout;
  theme: ThemeName;
  title?: string;
  selectedLine?: number;
  onNodeClick?: (line: number) => void;
  withBackground?: boolean;
}

type Click = ((line: number) => void) | undefined;
const clickProps = (onClick: Click, line: number) =>
  onClick
    ? {
        onClick: (ev: React.MouseEvent) => {
          ev.stopPropagation();
          onClick(line);
        },
        style: { cursor: 'pointer' },
      }
    : {};

export const ErSvg = forwardRef<SVGSVGElement, Props>(function ErSvg(
  { layout, theme, title, selectedLine, onNodeClick, withBackground },
  ref,
) {
  const t = THEMES[theme];
  const titleH = title ? 40 : 0;
  const width = Math.ceil(layout.width + PAD * 2);
  const height = Math.ceil(layout.height + PAD * 2 + titleH);
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fontFamily={t.font}
      style={{ overflow: 'visible', display: 'block' }}
    >
      {withBackground && <rect width={width} height={height} fill={t.background} />}
      {title && (
        <text x={PAD} y={PAD + 14} fontSize={22} fontWeight={t.weights.title} letterSpacing={-0.4} fill={t.text}>
          {title}
        </text>
      )}
      <g transform={`translate(${PAD}, ${PAD + titleH})`}>
        {layout.relations.map((r) => (
          <RelationLine key={r.def.id} r={r} t={t} selected={r.def.line === selectedLine} onClick={onNodeClick} />
        ))}
        {layout.entities.map((e) => (
          <Table key={e.def.id} e={e} t={t} selectedLine={selectedLine} onClick={onNodeClick} />
        ))}
        {layout.relations.map((r) => (
          <RelationLabel key={r.def.id} r={r} t={t} />
        ))}
      </g>
    </svg>
  );
});

function Table({ e, t, selectedLine, onClick }: { e: ErEntityBox; t: DiagramTheme; selectedLine?: number; onClick: Click }) {
  const icon = useContext(IconDrawerContext)(e.def.icon);
  const accent = resolveColor(e.def.color, t.mode);
  const { x, y, width: w, height: h } = e;
  const r = Math.min(t.radius, 10);
  const H = ER_METRICS.header;
  const selected = e.def.line === selectedLine;
  const headerFill = accent ? tint(accent, t.mode === 'light' ? 0.12 : 0.2) : t.entityHeader;
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect width={w} height={h} rx={r} fill={t.nodeFill} />
      <path
        d={`M0,${H} V${r} Q0,0 ${r},0 H${w - r} Q${w},0 ${w},${r} V${H} Z`}
        fill={headerFill}
        {...clickProps(onClick, e.def.line)}
      />
      {icon &&
        icon.draw({
          x: icon.kind === 'brand' ? 12 : 14,
          y: icon.kind === 'brand' ? 10 : 12,
          size: icon.kind === 'brand' ? 20 : 16,
          color: accent ?? t.text,
          strokeWidth: 2,
        })}
      <text
        x={icon ? 40 : 14}
        y={H / 2 + 4.5}
        fontSize={ER_METRICS.fontSize + 0.5}
        fontWeight={500}
        fill={accent ?? t.text}
        style={{ pointerEvents: 'none' }}
      >
        {e.def.label}
      </text>
      <line x1={0} x2={w} y1={H} y2={H} stroke={accent ? tint(accent, 0.4) : t.nodeStroke} strokeWidth={1} />

      {e.def.columns.map((c, i) => {
        const top = H + i * ER_METRICS.row;
        const mid = top + ER_METRICS.row / 2;
        const badges = columnBadges(c);
        const rowSelected = c.line === selectedLine;
        return (
          <g key={c.name + i} {...clickProps(onClick, c.line)}>
            <rect x={0} y={top} width={w} height={ER_METRICS.row} fill={rowSelected ? tint(t.selection, 0.12) : 'transparent'} />
            {i > 0 && <line x1={10} x2={w - 10} y1={top} y2={top} stroke={t.nodeStroke} strokeOpacity={0.55} strokeWidth={1} />}
            <text x={14} y={mid + 4.5} fontSize={12.5} fontWeight={c.pk ? 500 : t.weights.node} fill={t.text}>
              {c.name}
            </text>
            {badges.map((b, j) => {
              const bx = 14 + e.nameWidth + 8 + j * 24;
              const color = b === 'PK' ? t.selection : t.mutedText;
              return (
                <g key={b}>
                  <rect x={bx} y={mid - 7.5} width={20} height={15} rx={3.5} fill={tint(color.startsWith('#') ? color : '#8e94a0', 0.14)} />
                  <text x={bx + 10} y={mid + 3.5} textAnchor="middle" fontSize={8.5} fontWeight={600} letterSpacing={0.3} fill={color}>
                    {b}
                  </text>
                </g>
              );
            })}
            <text x={w - 14} y={mid + 4} textAnchor="end" fontSize={ER_METRICS.smallFont} fill={t.mutedText}>
              {columnType(c)}
            </text>
          </g>
        );
      })}

      <rect
        width={w}
        height={h}
        rx={r}
        fill="none"
        stroke={selected ? t.selection : accent ?? t.nodeStroke}
        strokeWidth={selected ? 2 : 1.25}
        style={{ pointerEvents: 'none' }}
      />
    </g>
  );
}

const FOOT = 12;
const SPREAD = 6;

/** Crow's-foot mark at `tip` (on the table edge), approached from `from`. */
function endMark(tip: Point, from: Point, card: Cardinality, color: string, width: number) {
  const len = Math.hypot(tip.x - from.x, tip.y - from.y) || 1;
  const u = { x: (tip.x - from.x) / len, y: (tip.y - from.y) / len };
  const v = { x: -u.y, y: u.x };
  const at = (back: number, side: number) => `${tip.x - u.x * back + v.x * side},${tip.y - u.y * back + v.y * side}`;
  const common = { stroke: color, strokeWidth: width, fill: 'none', strokeLinecap: 'round' as const };
  if (card === 'many') {
    return (
      <>
        <polyline points={`${at(0, SPREAD)} ${at(FOOT, 0)} ${at(0, -SPREAD)}`} {...common} />
        <line x1={tip.x - u.x * FOOT} y1={tip.y - u.y * FOOT} x2={tip.x} y2={tip.y} {...common} />
        <polyline points={`${at(FOOT + 5, SPREAD)} ${at(FOOT + 5, -SPREAD)}`} {...common} />
      </>
    );
  }
  return (
    <>
      <polyline points={`${at(8, SPREAD)} ${at(8, -SPREAD)}`} {...common} />
      <polyline points={`${at(13, SPREAD)} ${at(13, -SPREAD)}`} {...common} />
    </>
  );
}

function RelationLine({ r, t, selected, onClick }: { r: ErRelationPath; t: DiagramTheme; selected: boolean; onClick: Click }) {
  const color = selected ? t.selection : resolveColor(r.def.color, t.mode) ?? t.edge;
  const width = t.edgeWidth + (selected ? 0.75 : 0);
  const pts = r.points;
  if (pts.length < 2) return null;
  const d = roundedPath(pts, 8);
  return (
    <g {...clickProps(onClick, r.def.line)}>
      <path d={d} fill="none" stroke="transparent" strokeWidth={12} />
      <path d={d} fill="none" stroke={color} strokeWidth={width} strokeDasharray={r.def.dashed ? '6 5' : undefined} strokeLinejoin="round" />
      {endMark(pts[0], pts[1], r.def.from.cardinality, color, width)}
      {endMark(pts[pts.length - 1], pts[pts.length - 2], r.def.to.cardinality, color, width)}
    </g>
  );
}

function RelationLabel({ r, t }: { r: ErRelationPath; t: DiagramTheme }) {
  if (!r.def.label || !r.labelPos) return null;
  const w = r.labelSize?.width ?? r.def.label.length * 6.4 + 12;
  const h = r.labelSize?.height ?? 21;
  const accent = resolveColor(r.def.color, t.mode);
  return (
    <g transform={`translate(${r.labelPos.x - w / 2}, ${r.labelPos.y - h / 2})`} style={{ pointerEvents: 'none' }}>
      <rect width={w} height={h} rx={5} fill={t.labelBg} stroke={accent ? tint(accent, 0.35) : t.nodeStroke} strokeWidth={0.75} />
      <text x={w / 2} y={h / 2 + 4} textAnchor="middle" fontSize={NODE_METRICS.labelFontSize} fill={accent ?? t.mutedText}>
        {r.def.label}
      </text>
    </g>
  );
}

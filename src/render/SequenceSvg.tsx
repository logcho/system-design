import { forwardRef, useContext } from 'react';
import type { Point } from '../layout/core';
import { NODE_METRICS } from '../layout/core';
import {
  SEQUENCE_METRICS,
  type SeqFragmentBox,
  type SeqMessageRow,
  type SeqNoteBox,
  type SeqParticipantBox,
  type SequenceLayout,
} from '../layout/sequence';
import { ARROW_LEN, PAD, arrowHead, retreat } from './DiagramSvg';
import { IconDrawerContext } from './iconContext';
import { THEMES, resolveColor, tint, type DiagramTheme, type ThemeName } from './theme';

interface Props {
  layout: SequenceLayout;
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

export const SequenceSvg = forwardRef<SVGSVGElement, Props>(function SequenceSvg(
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
        {layout.fragments.map((f, i) => (
          <FragmentBox key={i} f={f} t={t} />
        ))}
        {layout.participants.map((p) => (
          <line
            key={p.def.id}
            x1={p.x}
            x2={p.x}
            y1={layout.lifelineTop}
            y2={layout.lifelineBottom}
            stroke={t.nodeStroke}
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        ))}
        {layout.participants.map((p) => (
          <ParticipantHeader
            key={p.def.id}
            p={p}
            t={t}
            height={layout.headerHeight}
            selected={p.def.line === selectedLine}
            onClick={onNodeClick}
          />
        ))}
        {layout.messages.map((m, i) => (
          <MessageArrow key={i} m={m} t={t} selected={m.def.line === selectedLine} onClick={onNodeClick} />
        ))}
        {layout.notes.map((n, i) => (
          <NoteBox key={i} n={n} t={t} selected={n.def.line === selectedLine} onClick={onNodeClick} />
        ))}
      </g>
    </svg>
  );
});

function ParticipantHeader({
  p,
  t,
  height,
  selected,
  onClick,
}: {
  p: SeqParticipantBox;
  t: DiagramTheme;
  height: number;
  selected: boolean;
  onClick: Click;
}) {
  const icon = useContext(IconDrawerContext)(p.def.icon);
  const accent = resolveColor(p.def.color, t.mode);
  const tile = NODE_METRICS.iconTile;
  const stroke = selected ? t.selection : accent ? tint(accent, 0.45) : t.nodeStroke;
  const fill = accent ? tint(accent, t.mode === 'light' ? 0.1 : 0.16) : t.nodeFill;

  if (icon) {
    const left = p.x - tile / 2;
    return (
      <g {...clickProps(onClick, p.def.line)}>
        <rect x={p.x - p.width / 2} y={0} width={p.width} height={height} fill="transparent" />
        {icon.kind === 'brand' ? (
          <>
            {(selected || accent) && (
              <rect x={left - 4} y={-4} width={tile + 8} height={tile + 8} rx={12} fill="none" stroke={selected ? t.selection : accent} strokeWidth={selected ? 2 : 1.5} />
            )}
            {icon.draw({ x: left, y: 0, size: tile, color: accent ?? t.text })}
          </>
        ) : (
          <>
            <rect x={left} y={0} width={tile} height={tile} rx={11} fill={fill} stroke={stroke} strokeWidth={selected ? 2 : 1} />
            {icon.draw({ x: left + 11, y: 11, size: 22, color: accent ?? t.text })}
          </>
        )}
        <text x={p.x} y={tile + 19} textAnchor="middle" fontSize={NODE_METRICS.fontSize} fontWeight={t.weights.node} fill={t.text}>
          {p.def.label}
        </text>
      </g>
    );
  }
  const boxH = 40;
  return (
    <g {...clickProps(onClick, p.def.line)}>
      <rect
        x={p.x - p.width / 2}
        y={height - boxH}
        width={p.width}
        height={boxH}
        rx={t.radius - 2}
        fill={fill}
        stroke={selected ? t.selection : accent ?? t.nodeStroke}
        strokeWidth={selected ? 2 : 1.25}
      />
      <text x={p.x} y={height - boxH / 2 + 4.5} textAnchor="middle" fontSize={NODE_METRICS.fontSize} fontWeight={t.weights.node} fill={t.text}>
        {p.def.label}
      </text>
    </g>
  );
}

function MessageArrow({ m, t, selected, onClick }: { m: SeqMessageRow; t: DiagramTheme; selected: boolean; onClick: Click }) {
  const color = selected ? t.selection : resolveColor(m.def.color, t.mode) ?? t.edge;
  const labelColor = resolveColor(m.def.color, t.mode) ?? t.mutedText;
  const dash = m.def.dashed ? '6 5' : undefined;
  const width = t.edgeWidth + (selected ? 0.75 : 0);

  if (m.self) {
    const w = SEQUENCE_METRICS.selfLoopWidth;
    const h = SEQUENCE_METRICS.selfLoopHeight;
    const pts: Point[] = [
      { x: m.x1, y: m.y },
      { x: m.x1 + w, y: m.y },
      { x: m.x1 + w, y: m.y + h },
      { x: m.x1, y: m.y + h },
    ];
    const head = arrowHead(pts[2], pts[3]);
    pts[3] = retreat(pts[2], pts[3], ARROW_LEN - 1);
    return (
      <g {...clickProps(onClick, m.def.line)}>
        <polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="transparent" strokeWidth={12} />
        <polyline
          points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke={color}
          strokeWidth={width}
          strokeDasharray={dash}
          strokeLinejoin="round"
        />
        <polygon points={head.map((p) => `${p.x},${p.y}`).join(' ')} fill={color} />
        {m.labelText && (
          <text x={m.x1 + w + 8} y={m.y + h / 2 + 4} fontSize={NODE_METRICS.labelFontSize} fill={labelColor}>
            {m.labelText}
          </text>
        )}
      </g>
    );
  }

  let a: Point = { x: m.x1, y: m.y };
  let b: Point = { x: m.x2, y: m.y };
  const heads: Point[][] = [];
  if (m.def.arrow === 'forward' || m.def.arrow === 'both') {
    heads.push(arrowHead(a, b));
    b = retreat(a, b, ARROW_LEN - 1);
  }
  if (m.def.arrow === 'both') {
    heads.push(arrowHead({ x: m.x2, y: m.y }, { x: m.x1, y: m.y }));
    a = retreat(b, a, ARROW_LEN - 1);
  }
  return (
    <g {...clickProps(onClick, m.def.line)}>
      <line x1={m.x1} y1={m.y} x2={m.x2} y2={m.y} stroke="transparent" strokeWidth={12} />
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={width} strokeDasharray={dash} strokeLinecap="round" />
      {heads.map((h, i) => (
        <polygon key={i} points={h.map((p) => `${p.x},${p.y}`).join(' ')} fill={color} />
      ))}
      {m.labelText && (
        <text x={(m.x1 + m.x2) / 2} y={m.y - 7} textAnchor="middle" fontSize={NODE_METRICS.labelFontSize} fill={labelColor}>
          {m.labelText}
        </text>
      )}
    </g>
  );
}

function NoteBox({ n, t, selected, onClick }: { n: SeqNoteBox; t: DiagramTheme; selected: boolean; onClick: Click }) {
  const fold = 8;
  const { x, y, width: w, height: h } = n;
  return (
    <g {...clickProps(onClick, n.def.line)}>
      <path
        d={`M${x},${y} H${x + w - fold} L${x + w},${y + fold} V${y + h} H${x} Z`}
        fill={t.noteFill}
        stroke={selected ? t.selection : t.noteStroke}
        strokeWidth={selected ? 2 : 1}
      />
      <path d={`M${x + w - fold},${y} V${y + fold} H${x + w}`} fill="none" stroke={t.noteStroke} strokeWidth={1} />
      <text x={x + w / 2} y={y + h / 2 + 4} textAnchor="middle" fontSize={NODE_METRICS.labelFontSize} fill={t.text}>
        {n.def.text}
      </text>
    </g>
  );
}

function FragmentBox({ f, t }: { f: SeqFragmentBox; t: DiagramTheme }) {
  const accent = resolveColor(f.def.color, t.mode);
  const stroke = accent ?? t.groupStroke;
  const kind = f.def.kind;
  const tabW = kind.length * 7 + 20;
  const tabH = 20;
  const first = f.sections[0];
  return (
    <g>
      <rect
        x={f.x}
        y={f.y}
        width={f.width}
        height={f.height}
        rx={6}
        fill={accent ? tint(accent, t.mode === 'light' ? 0.04 : 0.06) : t.groupFill}
        stroke={stroke}
        strokeWidth={1}
      />
      <path
        d={`M${f.x + 6},${f.y} H${f.x + tabW} V${f.y + tabH - 6} L${f.x + tabW - 6},${f.y + tabH} H${f.x} V${f.y + 6} Q${f.x},${f.y} ${f.x + 6},${f.y} Z`}
        fill={accent ? tint(accent, 0.18) : t.nodeStroke}
      />
      <text x={f.x + 9} y={f.y + 14} fontSize={11.5} fontWeight={500} fill={accent ?? t.text}>
        {kind}
      </text>
      {first.label && (
        <text x={f.x + tabW + 8} y={f.y + 14} fontSize={NODE_METRICS.labelFontSize} fill={t.mutedText}>
          [{first.label}]
        </text>
      )}
      {f.sections.slice(1).map((s, i) => (
        <g key={i}>
          <line x1={f.x} x2={f.x + f.width} y1={s.y} y2={s.y} stroke={stroke} strokeWidth={1} strokeDasharray="5 4" />
          <text x={f.x + 10} y={s.y + 16} fontSize={NODE_METRICS.labelFontSize} fill={t.mutedText}>
            {s.label ? `[${s.label}]` : kind === 'par' ? '[and]' : '[else]'}
          </text>
        </g>
      ))}
    </g>
  );
}

import { forwardRef, useContext } from 'react';
import type { LayoutResult, Point, PositionedEdge, PositionedNode } from '../layout/core';
import { NODE_METRICS, midpoint } from '../layout/core';
import { IconDrawerContext } from './iconContext';
import { THEMES, resolveColor, tint, type DiagramTheme, type ThemeName } from './theme';

export const PAD = 32;
export const ARROW_LEN = 9;
const ARROW_HALF = 4.5;

interface Props {
  layout: LayoutResult;
  theme: ThemeName;
  title?: string;
  selectedLine?: number;
  onNodeClick?: (line: number) => void;
  /** When true, renders a solid background (used for export). */
  withBackground?: boolean;
}

export const DiagramSvg = forwardRef<SVGSVGElement, Props>(function DiagramSvg(
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
        <text x={PAD} y={PAD + 14} fontSize={t.weights.title < 400 ? 22 : 18} fontWeight={t.weights.title} letterSpacing={t.weights.title < 400 ? -0.4 : 0} fill={t.text}>
          {title}
        </text>
      )}
      <g transform={`translate(${PAD}, ${PAD + titleH})`}>
        {layout.nodes
          .filter((n) => n.def.isGroup)
          .map((n) => (
            <Group key={n.def.id} n={n} t={t} selected={n.def.line === selectedLine} onClick={onNodeClick} />
          ))}
        {layout.edges.map((e) => (
          <Edge key={e.def.id} e={e} t={t} />
        ))}
        {layout.nodes
          .filter((n) => !n.def.isGroup)
          .map((n) => (
            <Node key={n.def.id} n={n} t={t} selected={n.def.line === selectedLine} onClick={onNodeClick} />
          ))}
        {layout.edges.map((e) => (
          <EdgeLabel key={e.def.id} e={e} t={t} />
        ))}
      </g>
    </svg>
  );
});

function Group({
  n,
  t,
  selected,
  onClick,
}: {
  n: PositionedNode;
  t: DiagramTheme;
  selected: boolean;
  onClick?: (line: number) => void;
}) {
  const accent = resolveColor(n.def.color, t.mode);
  const icon = useContext(IconDrawerContext)(n.def.icon);
  const stroke = accent ?? t.groupStroke;
  return (
    <g
      transform={`translate(${n.x}, ${n.y})`}
      onClick={onClick && ((ev) => (ev.stopPropagation(), onClick(n.def.line)))}
      style={{ cursor: onClick ? 'pointer' : undefined }}
    >
      <rect
        width={n.width}
        height={n.height}
        rx={12}
        fill={accent ? tint(accent, t.mode === 'light' ? 0.05 : 0.07) : t.groupFill}
        stroke={selected ? t.selection : stroke}
        strokeWidth={selected ? 2 : 1.25}
        strokeDasharray={accent ? undefined : '5 4'}
      />
      {icon && (
        icon.draw({
          x: icon.kind === 'brand' ? 10 : 12,
          y: icon.kind === 'brand' ? 8 : 11,
          size: icon.kind === 'brand' ? 20 : 16,
          color: accent ?? t.mutedText,
          strokeWidth: 2,
        })
      )}
      <text
        x={icon ? 36 : 14}
        y={24}
        fontSize={NODE_METRICS.fontSize}
        fontWeight={t.weights.group}
        fill={accent ?? t.mutedText}
      >
        {n.def.label}
      </text>
    </g>
  );
}

function Node({
  n,
  t,
  selected,
  onClick,
}: {
  n: PositionedNode;
  t: DiagramTheme;
  selected: boolean;
  onClick?: (line: number) => void;
}) {
  const accent = resolveColor(n.def.color, t.mode);
  const icon = useContext(IconDrawerContext)(n.def.icon);
  const { width: w, height: h } = n;
  const selStroke = t.selection;
  const common = {
    onClick: onClick && ((ev: React.MouseEvent) => (ev.stopPropagation(), onClick(n.def.line))),
    style: { cursor: onClick ? 'pointer' : undefined },
  };

  if (n.def.icon) {
    const tile = NODE_METRICS.iconTile;
    const tx = (w - tile) / 2;
    const color = accent ?? t.text;
    return (
      <g transform={`translate(${n.x}, ${n.y})`} {...common}>
        <rect width={w} height={h} fill="transparent" />
        {icon?.kind === 'brand' ? (
          // Vendor icons carry their own colors and backgrounds: draw them bare.
          <>
            {(selected || accent) && (
              <rect
                x={tx - 4}
                y={-4}
                width={tile + 8}
                height={tile + 8}
                rx={12}
                fill="none"
                stroke={selected ? selStroke : accent}
                strokeWidth={selected ? 2 : 1.5}
              />
            )}
            {icon.draw({ x: tx, y: 0, size: tile, color })}
          </>
        ) : (
          <>
            <rect
              x={tx}
              y={0}
              width={tile}
              height={tile}
              rx={11}
              fill={accent ? tint(accent, t.mode === 'light' ? 0.1 : 0.16) : t.nodeFill}
              stroke={selected ? selStroke : accent ? tint(accent, 0.45) : t.nodeStroke}
              strokeWidth={selected ? 2 : 1}
            />
            {icon ? (
              icon.draw({ x: tx + 11, y: 11, size: 22, color })
            ) : (
              <text x={w / 2} y={tile / 2 + 5} textAnchor="middle" fontSize={14} fill={t.mutedText}>
                ?
              </text>
            )}
          </>
        )}
        <text x={w / 2} y={tile + 19} textAnchor="middle" fontSize={NODE_METRICS.fontSize} fontWeight={t.weights.node} fill={t.text}>
          {n.def.label}
        </text>
      </g>
    );
  }

  const fill = accent ? tint(accent, t.mode === 'light' ? 0.1 : 0.16) : t.nodeFill;
  const stroke = selected ? selStroke : accent ?? t.nodeStroke;
  const sw = selected ? 2 : 1.25;
  let shape: React.ReactNode;
  switch (n.def.shape) {
    case 'oval':
      shape = <rect width={w} height={h} rx={h / 2} fill={fill} stroke={stroke} strokeWidth={sw} />;
      break;
    case 'diamond':
      shape = (
        <polygon
          points={`${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`}
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
          strokeLinejoin="round"
        />
      );
      break;
    case 'cylinder': {
      const ry = 7;
      shape = (
        <>
          <path
            d={`M0,${ry} A${w / 2},${ry} 0 0 1 ${w},${ry} V${h - ry} A${w / 2},${ry} 0 0 1 0,${h - ry} Z`}
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
          />
          <path d={`M0,${ry} A${w / 2},${ry} 0 0 0 ${w},${ry}`} fill="none" stroke={stroke} strokeWidth={sw} />
        </>
      );
      break;
    }
    default:
      shape = <rect width={w} height={h} rx={t.radius} fill={fill} stroke={stroke} strokeWidth={sw} />;
  }
  return (
    <g transform={`translate(${n.x}, ${n.y})`} {...common}>
      {shape}
      <text
        x={w / 2}
        y={h / 2 + (n.def.shape === 'cylinder' ? 7 : 4.5)}
        textAnchor="middle"
        fontSize={NODE_METRICS.fontSize}
        fontWeight={t.weights.node}
        fill={t.text}
      >
        {n.def.label}
      </text>
    </g>
  );
}

function Edge({ e, t }: { e: PositionedEdge; t: DiagramTheme }) {
  const color = resolveColor(e.def.color, t.mode) ?? t.edge;
  const pts = e.points.map((p) => ({ ...p }));
  const heads: Point[][] = [];
  const { arrow } = e.def;

  if (pts.length >= 2 && (arrow === 'forward' || arrow === 'both')) {
    heads.push(arrowHead(pts[pts.length - 2], pts[pts.length - 1]));
    pts[pts.length - 1] = retreat(pts[pts.length - 2], pts[pts.length - 1], ARROW_LEN - 1);
  }
  if (pts.length >= 2 && (arrow === 'back' || arrow === 'both')) {
    heads.push(arrowHead(pts[1], pts[0]));
    pts[0] = retreat(pts[1], pts[0], ARROW_LEN - 1);
  }

  return (
    <g>
      <path
        d={roundedPath(pts, 8)}
        fill="none"
        stroke={color}
        strokeWidth={t.edgeWidth}
        strokeDasharray={e.def.dashed ? '6 5' : undefined}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {heads.map((h, i) => (
        <polygon key={i} points={h.map((p) => `${p.x},${p.y}`).join(' ')} fill={color} />
      ))}
    </g>
  );
}

function EdgeLabel({ e, t }: { e: PositionedEdge; t: DiagramTheme }) {
  if (!e.def.label) return null;
  const pos = e.labelPos ?? midpoint(e.points);
  const w = e.labelSize?.width ?? e.def.label.length * 6.4 + 12;
  const h = e.labelSize?.height ?? 21;
  const accent = resolveColor(e.def.color, t.mode);
  return (
    <g transform={`translate(${pos.x - w / 2}, ${pos.y - h / 2})`}>
      <rect width={w} height={h} rx={5} fill={t.labelBg} stroke={accent ? tint(accent, 0.35) : t.nodeStroke} strokeWidth={0.75} />
      <text x={w / 2} y={h / 2 + 4} textAnchor="middle" fontSize={NODE_METRICS.labelFontSize} fill={accent ?? t.mutedText}>
        {e.def.label}
      </text>
    </g>
  );
}

export function arrowHead(from: Point, tip: Point): Point[] {
  const len = Math.hypot(tip.x - from.x, tip.y - from.y) || 1;
  const ux = (tip.x - from.x) / len;
  const uy = (tip.y - from.y) / len;
  const bx = tip.x - ux * ARROW_LEN;
  const by = tip.y - uy * ARROW_LEN;
  return [
    tip,
    { x: bx - uy * ARROW_HALF, y: by + ux * ARROW_HALF },
    { x: bx + uy * ARROW_HALF, y: by - ux * ARROW_HALF },
  ];
}

export function retreat(from: Point, to: Point, by: number): Point {
  const len = Math.hypot(to.x - from.x, to.y - from.y);
  if (len <= by) return from;
  return { x: to.x - ((to.x - from.x) / len) * by, y: to.y - ((to.y - from.y) / len) * by };
}

/** Polyline with rounded corners at each bend. */
function roundedPath(pts: Point[], r: number): string {
  if (pts.length < 2) return '';
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const d1 = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const d2 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const rr = Math.min(r, d1 / 2, d2 / 2);
    const a = { x: p1.x - ((p1.x - p0.x) / (d1 || 1)) * rr, y: p1.y - ((p1.y - p0.y) / (d1 || 1)) * rr };
    const b = { x: p1.x + ((p2.x - p1.x) / (d2 || 1)) * rr, y: p1.y + ((p2.y - p1.y) / (d2 || 1)) * rr };
    d += ` L${a.x},${a.y} Q${p1.x},${p1.y} ${b.x},${b.y}`;
  }
  const last = pts[pts.length - 1];
  return d + ` L${last.x},${last.y}`;
}

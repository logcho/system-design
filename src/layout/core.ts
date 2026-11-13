import type { ElkExtendedEdge, ElkNode } from 'elkjs/lib/elk-api';
import type { Diagram, EdgeDef, NodeDef } from '../dsl/types';

export interface Point {
  x: number;
  y: number;
}

export interface PositionedNode {
  def: NodeDef;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
}

export interface PositionedEdge {
  def: EdgeDef;
  points: Point[];
  labelPos?: Point;
  labelSize?: { width: number; height: number };
}

export interface LayoutResult {
  width: number;
  height: number;
  nodes: PositionedNode[];
  edges: PositionedEdge[];
}

/** Anything that runs ELK: a Web Worker in the browser, the bundled build in Node. */
export interface LayoutEngine {
  layout(graph: ElkNode): Promise<ElkNode>;
}

const FONT_SIZE = 13;
const CHAR_W = 7.2; // average glyph width at 13px for the UI font
const LABEL_FONT = 11.5;
const LABEL_CHAR_W = 6.4;

export const textWidth = (s: string, charW = CHAR_W) => Math.ceil(s.length * charW);

export const NODE_METRICS = {
  fontSize: FONT_SIZE,
  labelFontSize: LABEL_FONT,
  iconTile: 44,
  groupHeader: 34,
};

function measureNode(n: NodeDef): { width: number; height: number } {
  const tw = textWidth(n.label);
  if (n.icon) {
    // Icon tile on top, label underneath.
    return { width: Math.max(72, tw + 16), height: NODE_METRICS.iconTile + 28 };
  }
  switch (n.shape) {
    case 'diamond':
      return { width: Math.max(110, tw * 1.5 + 32), height: Math.max(64, 52) };
    case 'oval':
      return { width: Math.max(100, tw + 44), height: 44 };
    case 'cylinder':
      return { width: Math.max(90, tw + 32), height: 64 };
    default:
      return { width: Math.max(90, tw + 32), height: 42 };
  }
}

const ELK_DIRECTION = { right: 'RIGHT', down: 'DOWN', left: 'LEFT', up: 'UP' } as const;

export async function layoutWith(elk: LayoutEngine, diagram: Diagram): Promise<LayoutResult> {
  const byId = new Map(diagram.nodes.map((n) => [n.id, n]));
  const elkNodes = new Map<string, ElkNode>();
  const root: ElkNode = {
    id: '__root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': ELK_DIRECTION[diagram.direction],
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.spacing.nodeNodeBetweenLayers': '70',
      'elk.layered.spacing.edgeNodeBetweenLayers': '24',
      'elk.spacing.nodeNode': '36',
      'elk.spacing.edgeNode': '20',
      'elk.spacing.edgeEdge': '14',
      'elk.spacing.edgeLabel': '6',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.edgeLabels.placement': 'CENTER',
      'elk.edgeLabels.inline': 'true',
      'elk.padding': '[top=24,left=24,bottom=24,right=24]',
    },
    children: [],
    edges: [],
  };

  for (const n of diagram.nodes) {
    const en: ElkNode = n.isGroup
      ? {
          id: n.id,
          children: [],
          edges: [],
          layoutOptions: {
            'elk.padding': `[top=${NODE_METRICS.groupHeader + 14},left=20,bottom=20,right=20]`,
            'elk.nodeSize.constraints': 'MINIMUM_SIZE',
            'elk.nodeSize.minimum': `(${textWidth(n.label) + (n.icon ? 64 : 40)}, 60)`,
          },
        }
      : { id: n.id, ...measureNode(n) };
    elkNodes.set(n.id, en);
  }
  for (const n of diagram.nodes) {
    const parent = n.parent ? elkNodes.get(n.parent) : root;
    (parent ?? root).children!.push(elkNodes.get(n.id)!);
  }

  // Edges belong in the lowest common ancestor container.
  const ancestors = (id: string): string[] => {
    const chain: string[] = [];
    let cur = byId.get(id)?.parent;
    while (cur) {
      chain.unshift(cur);
      cur = byId.get(cur)?.parent;
    }
    return chain;
  };
  for (const e of diagram.edges) {
    const a = ancestors(e.from);
    const b = ancestors(e.to);
    let lca: ElkNode = root;
    for (let i = 0; i < Math.min(a.length, b.length) && a[i] === b[i]; i++) lca = elkNodes.get(a[i])!;
    const elkEdge: ElkExtendedEdge = {
      id: e.id,
      sources: [e.from],
      targets: [e.to],
      labels: e.label
        ? [{ text: e.label, width: textWidth(e.label, LABEL_CHAR_W) + 12, height: LABEL_FONT + 10 }]
        : [],
    };
    lca.edges!.push(elkEdge);
  }

  const result = await elk.layout(root);

  const nodes: PositionedNode[] = [];
  const edges: PositionedEdge[] = [];
  const edgeDefs = new Map(diagram.edges.map((e) => [e.id, e]));

  // elkjs reports child positions relative to their parent, and edge/label
  // coordinates relative to the container the edge was declared in.
  const walk = (n: ElkNode, depth: number, ox: number, oy: number) => {
    for (const c of n.children ?? []) {
      const x = ox + (c.x ?? 0);
      const y = oy + (c.y ?? 0);
      nodes.push({
        def: byId.get(c.id)!,
        x,
        y,
        width: c.width ?? 0,
        height: c.height ?? 0,
        depth,
      });
      walk(c, depth + 1, x, y);
    }
    for (const e of (n.edges ?? []) as ElkExtendedEdge[]) {
      const def = edgeDefs.get(e.id);
      const s = e.sections?.[0];
      if (!def || !s) continue;
      const points = [s.startPoint, ...(s.bendPoints ?? []), s.endPoint].map((p) => ({ x: ox + p.x, y: oy + p.y }));
      const lbl = e.labels?.[0];
      edges.push({
        def,
        points,
        // Keep ELK's chosen spot along the edge, but snap it onto the line.
        labelPos:
          lbl && lbl.x != null && lbl.y != null
            ? nearestOnPolyline(points, { x: ox + lbl.x + (lbl.width ?? 0) / 2, y: oy + lbl.y + (lbl.height ?? 0) / 2 })
            : def.label
              ? midpoint(points)
              : undefined,
        labelSize: lbl ? { width: lbl.width ?? 0, height: lbl.height ?? 0 } : undefined,
      });
    }
  };
  walk(result, 0, 0, 0);

  // Draw outer groups first so children sit on top.
  nodes.sort((a, b) => (a.def.isGroup === b.def.isGroup ? a.depth - b.depth : a.def.isGroup ? -1 : 1));
  edges.sort((a, b) => a.def.line - b.def.line);

  return { width: result.width ?? 0, height: result.height ?? 0, nodes, edges };
}

/** Midpoint along a polyline, measured by length. */
export function midpoint(points: Point[]): Point {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1], points[i]);
  let half = total / 2;
  for (let i = 1; i < points.length; i++) {
    const d = dist(points[i - 1], points[i]);
    if (half <= d) {
      const t = d === 0 ? 0 : half / d;
      return {
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * t,
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * t,
      };
    }
    half -= d;
  }
  return points[0];
}

export function nearestOnPolyline(points: Point[], p: Point): Point {
  let best = points[0];
  let bestD = Infinity;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
    const q = { x: a.x + dx * t, y: a.y + dy * t };
    const d = dist(p, q);
    if (d < bestD) {
      bestD = d;
      best = q;
    }
  }
  return best;
}

const dist = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

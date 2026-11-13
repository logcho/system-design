import type { ElkExtendedEdge, ElkNode, ElkPort } from 'elkjs/lib/elk-api';
import type { Column, Entity, ErDiagram, Relation } from '../dsl/er';
import { midpoint, nearestOnPolyline, textWidth, type LayoutEngine, type Point } from './core';

/**
 * ER layout: tables are ELK nodes whose size comes from their columns. Every
 * column row has a fixed port on the table's left and right edges, so
 * relationship lines meet the exact rows they reference.
 */

export const ER_METRICS = {
  header: 40,
  row: 26,
  bottomPad: 6,
  fontSize: 13,
  smallFont: 11.5,
};

const LABEL_CHAR_W = 6.4;
const BADGE_W = 24;

export interface ErEntityBox {
  def: Entity;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Width of the column-name area, so types line up in one column. */
  nameWidth: number;
}

export interface ErRelationPath {
  def: Relation;
  points: Point[];
  labelPos?: Point;
  labelSize?: { width: number; height: number };
}

export interface ErLayout {
  width: number;
  height: number;
  entities: ErEntityBox[];
  relations: ErRelationPath[];
}

const ELK_DIRECTION = { right: 'RIGHT', down: 'DOWN', left: 'LEFT', up: 'UP' } as const;

export const columnType = (c: Column) => (c.type ? `${c.type}${c.nullable ? '?' : ''}` : c.nullable ? '?' : '');
export const columnBadges = (c: Column) => [c.pk && 'PK', c.fk && 'FK', c.unique && 'UQ'].filter(Boolean) as string[];

/** Y of a column row's center, relative to the table's top. Header center for table-level ends. */
export function rowCenter(entity: Entity, column: string | undefined): number {
  const i = column ? entity.columns.findIndex((c) => c.name === column) : -1;
  return i < 0 ? ER_METRICS.header / 2 : ER_METRICS.header + i * ER_METRICS.row + ER_METRICS.row / 2;
}

function measure(e: Entity): { width: number; height: number; nameWidth: number } {
  const nameWidth = Math.max(0, ...e.columns.map((c) => textWidth(c.name)));
  const rest = Math.max(
    0,
    ...e.columns.map((c) => textWidth(columnType(c), LABEL_CHAR_W) + columnBadges(c).length * BADGE_W),
  );
  const header = textWidth(e.label) + (e.icon ? 28 : 0) + 32;
  const width = Math.max(180, header, nameWidth + rest + 52);
  const rows = Math.max(1, e.columns.length);
  return { width, height: ER_METRICS.header + rows * ER_METRICS.row + ER_METRICS.bottomPad, nameWidth };
}

export async function layoutEr(elk: LayoutEngine, d: ErDiagram): Promise<ErLayout> {
  const horizontal = d.direction === 'right' || d.direction === 'left';
  // Which side lines leave from and arrive at, following the layout direction.
  const out = { right: 'EAST', left: 'WEST', down: 'SOUTH', up: 'NORTH' }[d.direction];
  const into = { right: 'WEST', left: 'EAST', down: 'NORTH', up: 'SOUTH' }[d.direction];

  const sizes = new Map(d.entities.map((e) => [e.id, measure(e)]));
  const portId = (table: string, column: string | undefined, side: string) => `${table}\u0000${column ?? ''}\u0000${side}`;

  const children: ElkNode[] = d.entities.map((e) => {
    const { width, height } = sizes.get(e.id)!;
    const ports: ElkPort[] = [];
    const add = (column: string | undefined, side: string) => {
      const y = side === 'NORTH' ? 0 : side === 'SOUTH' ? height : rowCenter(e, column);
      const x = side === 'WEST' ? 0 : side === 'EAST' ? width : width / 2;
      ports.push({ id: portId(e.id, column, side), x, y, width: 0, height: 0, layoutOptions: { 'elk.port.side': side } });
    };
    if (horizontal) {
      for (const side of ['WEST', 'EAST']) {
        add(undefined, side);
        for (const c of e.columns) add(c.name, side);
      }
    } else {
      // Top-to-bottom layouts connect tables at their top and bottom edges.
      add(undefined, 'NORTH');
      add(undefined, 'SOUTH');
    }
    return { id: e.id, width, height, ports, layoutOptions: { 'elk.portConstraints': 'FIXED_POS' } };
  });

  const known = (table: string, column?: string) =>
    column && d.entities.find((e) => e.id === table)?.columns.some((c) => c.name === column) ? column : undefined;
  const edges: ElkExtendedEdge[] = d.relations.map((r) => ({
    id: r.id,
    sources: [portId(r.from.table, horizontal ? known(r.from.table, r.from.column) : undefined, out)],
    targets: [portId(r.to.table, horizontal ? known(r.to.table, r.to.column) : undefined, into)],
    labels: r.label ? [{ text: r.label, width: textWidth(r.label, LABEL_CHAR_W) + 12, height: 21 }] : [],
  }));

  const result = await elk.layout({
    id: '__root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': ELK_DIRECTION[d.direction],
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.spacing.nodeNodeBetweenLayers': '90',
      'elk.spacing.nodeNode': '48',
      'elk.spacing.edgeNode': '24',
      'elk.spacing.edgeEdge': '14',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.edgeLabels.placement': 'CENTER',
      'elk.edgeLabels.inline': 'true',
      'elk.padding': '[top=24,left=24,bottom=24,right=24]',
    },
    children,
    edges,
  });

  const byId = new Map(d.entities.map((e) => [e.id, e]));
  const relById = new Map(d.relations.map((r) => [r.id, r]));
  const entities: ErEntityBox[] = (result.children ?? []).map((c) => ({
    def: byId.get(c.id)!,
    x: c.x ?? 0,
    y: c.y ?? 0,
    width: c.width ?? 0,
    height: c.height ?? 0,
    nameWidth: sizes.get(c.id)!.nameWidth,
  }));
  const relations: ErRelationPath[] = [];
  for (const e of (result.edges ?? []) as ElkExtendedEdge[]) {
    const def = relById.get(e.id);
    const s = e.sections?.[0];
    if (!def || !s) continue;
    const points = [s.startPoint, ...(s.bendPoints ?? []), s.endPoint].map((p) => ({ x: p.x, y: p.y }));
    const lbl = e.labels?.[0];
    relations.push({
      def,
      points,
      labelPos:
        lbl && lbl.x != null && lbl.y != null
          ? nearestOnPolyline(points, { x: lbl.x + (lbl.width ?? 0) / 2, y: lbl.y + (lbl.height ?? 0) / 2 })
          : def.label
            ? midpoint(points)
            : undefined,
      labelSize: lbl ? { width: lbl.width ?? 0, height: lbl.height ?? 0 } : undefined,
    });
  }
  return { width: result.width ?? 0, height: result.height ?? 0, entities, relations };
}

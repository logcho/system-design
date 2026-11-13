import { CONNECTOR_RE, CONNECTOR_SPLIT_RE, CONNECTORS, splitAttrs, stripComment } from './parser';
import type { Direction, ParseError } from './types';

/**
 * Entity-relationship diagrams: tables, their columns, and how rows relate.
 *
 *   diagram er
 *   title Shop
 *   direction right                  // right (default) | down | left | up
 *
 *   users [icon: user, color: blue] {
 *     id int pk
 *     email string unique
 *     deleted_at timestamp null
 *   }
 *
 *   orders.user_id > users.id: placed by    // many-to-one
 *   users.id - profiles.user_id             // one-to-one
 *   users < orders                          // one-to-many, table to table
 *   students.id <> courses.id               // many-to-many
 *   orders.coupon_id --> coupons.id         // dashed: optional relationship
 *
 * Column lines are `name [type] [pk] [fk] [unique] [null]`.
 */

export type Cardinality = 'one' | 'many';

export interface Column {
  name: string;
  type?: string;
  pk: boolean;
  fk: boolean;
  unique: boolean;
  nullable: boolean;
  line: number;
}

export interface Entity {
  id: string;
  label: string;
  icon?: string;
  color?: string;
  columns: Column[];
  line: number;
  /** Only named in a relationship, never declared with a { } block. */
  implicit: boolean;
}

export interface RelationEnd {
  table: string;
  column?: string;
  cardinality: Cardinality;
}

export interface Relation {
  id: string;
  from: RelationEnd;
  to: RelationEnd;
  label?: string;
  /** Dashed: an optional (non-identifying) relationship. */
  dashed: boolean;
  color?: string;
  line: number;
}

export interface ErDiagram {
  title?: string;
  direction: Direction;
  entities: Entity[];
  relations: Relation[];
  errors: ParseError[];
}

const MODIFIERS = new Set(['pk', 'fk', 'unique', 'null', 'nullable']);
const ENTITY_KEYS = new Set(['icon', 'color', 'label']);
const DIRECTIONS: Direction[] = ['right', 'down', 'left', 'up'];

/** `>` many-to-one, `<` one-to-many, `-` one-to-one, `<>` many-to-many (left side first). */
const CARDINALITY: Record<'forward' | 'back' | 'none' | 'both', [Cardinality, Cardinality]> = {
  forward: ['many', 'one'],
  back: ['one', 'many'],
  none: ['one', 'one'],
  both: ['many', 'many'],
};

/** `table.column` (the column may not contain dots; table names may contain spaces). */
function endpoint(text: string): { table: string; column?: string } | undefined {
  const t = text.trim();
  if (!t) return undefined;
  const dot = t.lastIndexOf('.');
  if (dot <= 0 || dot === t.length - 1) return { table: t };
  return { table: t.slice(0, dot).trim(), column: t.slice(dot + 1).trim() };
}

export function parseEr(source: string): ErDiagram {
  const errors: ParseError[] = [];
  const err = (line: number, message: string, severity: ParseError['severity'] = 'error') =>
    errors.push({ line, message, severity });

  const entities = new Map<string, Entity>();
  const pending: { line: number; text: string }[] = [];
  let open: Entity | undefined;
  let title: string | undefined;
  let direction: Direction = 'right';

  source.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1;
    const text = stripComment(raw).trim();
    if (!text) return;

    if (open) {
      if (text === '}') {
        open = undefined;
        return;
      }
      if (text.includes('{') || text.includes('}')) {
        err(line, 'Tables cannot be nested; close this table with "}" first');
        return;
      }
      const [name, ...rest] = text.split(/\s+/);
      const col: Column = { name, pk: false, fk: false, unique: false, nullable: false, line };
      for (const word of rest) {
        const w = word.toLowerCase();
        if (w === 'pk') col.pk = true;
        else if (w === 'fk') col.fk = true;
        else if (w === 'unique') col.unique = true;
        else if (w === 'null' || w === 'nullable') col.nullable = true;
        else if (!col.type) col.type = word;
        else err(line, `Unexpected "${word}" (columns are: name type pk fk unique null)`, 'warning');
      }
      if (open.columns.some((c) => c.name === name)) err(line, `Column "${name}" is already in "${open.id}"`, 'warning');
      open.columns.push(col);
      return;
    }

    const directive = /^(diagram|title|direction)\b\s*(.*)$/i.exec(text);
    if (directive && !CONNECTOR_RE.test(` ${text} `) && !text.endsWith('{')) {
      const key = directive[1].toLowerCase();
      const value = directive[2].trim();
      if (key === 'title') title = value || undefined;
      else if (key === 'direction') {
        if (DIRECTIONS.includes(value.toLowerCase() as Direction)) direction = value.toLowerCase() as Direction;
        else err(line, `Unknown direction "${value}" (expected ${DIRECTIONS.join(', ')})`);
      }
      return;
    }

    if (text === '}') {
      err(line, 'Unexpected "}" with no open table');
      return;
    }

    if (text.endsWith('{')) {
      const { body, attrs } = splitAttrs(text.slice(0, -1).trim());
      if (!body) {
        err(line, 'Missing table name');
        return;
      }
      if (entities.has(body)) err(line, `Table "${body}" is already declared on line ${entities.get(body)!.line}`);
      const entity: Entity = { id: body, label: body, columns: [], line, implicit: false };
      for (const [k, v] of Object.entries(attrs)) {
        if (!ENTITY_KEYS.has(k)) err(line, `Unknown table attribute "${k}" (expected icon, color or label)`, 'warning');
        else if (k === 'icon') entity.icon = v.toLowerCase();
        else if (k === 'color') entity.color = v;
        else entity.label = v;
      }
      entities.set(body, entity);
      open = entity;
      return;
    }

    if (CONNECTOR_RE.test(` ${text} `)) {
      pending.push({ line, text });
      return;
    }

    err(line, 'Expected a table ("name {"), a relationship ("a.id > b.id") or a directive');
  });

  if (open) err(open.line, `Table "${open.id}" is never closed with "}"`);

  // Relationships, after every table is known.
  const relations: Relation[] = [];
  for (const { line, text } of pending) {
    const { body, attrs } = splitAttrs(text);
    const parts = body.split(CONNECTOR_SPLIT_RE);
    let label: string | undefined;
    const last = parts[parts.length - 1];
    const colon = last.indexOf(':');
    if (colon !== -1) {
      label = last.slice(colon + 1).trim() || undefined;
      parts[parts.length - 1] = last.slice(0, colon);
    }
    if (attrs.label) label = attrs.label;

    for (let p = 0; p + 2 < parts.length; p += 2) {
      const conn = CONNECTORS[parts[p + 1]];
      const [fromCard, toCard] = CARDINALITY[conn.arrow];
      const lefts = parts[p].split(',').map(endpoint);
      const rights = parts[p + 2].split(',').map(endpoint);
      for (const a of lefts) {
        for (const b of rights) {
          if (!a || !b) {
            err(line, 'Missing table name in relationship');
            continue;
          }
          for (const end of [a, b]) {
            let entity = entities.get(end.table);
            if (!entity) {
              err(line, `Table "${end.table}" is not declared`, 'warning');
              entity = { id: end.table, label: end.table, columns: [], line, implicit: true };
              entities.set(end.table, entity);
            }
            if (end.column && !entity.implicit && !entity.columns.some((c) => c.name === end.column)) {
              err(line, `Table "${end.table}" has no column "${end.column}"`, 'warning');
            }
          }
          relations.push({
            id: `r${relations.length}`,
            from: { ...a, cardinality: fromCard },
            to: { ...b, cardinality: toCard },
            label: p + 3 >= parts.length ? label : undefined,
            dashed: conn.dashed,
            color: attrs.color,
            line,
          });
        }
      }
    }
  }

  return {
    title,
    direction,
    entities: [...entities.values()],
    relations,
    errors: errors.sort((a, b) => a.line - b.line),
  };
}

export const ER_MODIFIERS = MODIFIERS;

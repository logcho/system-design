import type { ArrowKind, Diagram, Direction, EdgeDef, NodeDef, ParseError, Shape } from './types';

/**
 * Linework diagram language
 *
 *   direction right            // right | down | left | up
 *   title My system
 *
 *   Client [icon: user, color: blue]
 *   Backend [icon: cloud] {    // a group; children are indented inside { }
 *     API [icon: server]
 *     DB [icon: database, shape: cylinder]
 *   }
 *
 *   Client > API: HTTPS        // connectors must be surrounded by spaces
 *   API <> DB, Cache           // fan-out with commas
 *   API --> Worker [color: red]
 *
 * Connectors: >  <  <>  -   (solid)   -->  <--  <-->  --  (dashed)   ->  <-  (aliases)
 */

const CONNECTOR_RE = /\s+(<-->|<--|-->|<->|<>|->|<-|--|>|<|-)\s+/;
const CONNECTOR_SPLIT_RE = /\s+(<-->|<--|-->|<->|<>|->|<-|--|>|<|-)\s+/g;

const CONNECTORS: Record<string, { arrow: ArrowKind; dashed: boolean }> = {
  '>': { arrow: 'forward', dashed: false },
  '->': { arrow: 'forward', dashed: false },
  '<': { arrow: 'back', dashed: false },
  '<-': { arrow: 'back', dashed: false },
  '<>': { arrow: 'both', dashed: false },
  '<->': { arrow: 'both', dashed: false },
  '-': { arrow: 'none', dashed: false },
  '-->': { arrow: 'forward', dashed: true },
  '<--': { arrow: 'back', dashed: true },
  '<-->': { arrow: 'both', dashed: true },
  '--': { arrow: 'none', dashed: true },
};

const DIRECTIONS: Direction[] = ['right', 'down', 'left', 'up'];
const SHAPES: Shape[] = ['rect', 'oval', 'diamond', 'cylinder'];
const NODE_KEYS = new Set(['icon', 'color', 'shape', 'label']);
const EDGE_KEYS = new Set(['color', 'label']);

type Attrs = Record<string, string>;

function stripComment(line: string): string {
  // `//` starts a comment unless it's part of a URL like https://
  const m = /(^|[^:])\/\//.exec(line);
  return m ? line.slice(0, m.index + m[1].length) : line;
}

/** Split `Name [a: b, c: d]` into name + attrs. Brackets must be at the end. */
function splitAttrs(text: string): { body: string; attrs: Attrs; raw?: string } {
  const m = /\[([^\]]*)\]\s*$/.exec(text);
  if (!m) return { body: text.trim(), attrs: {} };
  const attrs: Attrs = {};
  for (const part of m[1].split(',')) {
    const idx = part.indexOf(':');
    if (idx === -1) {
      const k = part.trim();
      if (k) attrs[k.toLowerCase()] = 'true';
      continue;
    }
    const k = part.slice(0, idx).trim().toLowerCase();
    const v = part.slice(idx + 1).trim();
    if (k) attrs[k] = v;
  }
  return { body: text.slice(0, m.index).trim(), attrs, raw: m[1] };
}

interface Group {
  id: string;
  line: number;
}

export function parse(source: string): Diagram {
  const errors: ParseError[] = [];
  const nodes = new Map<string, NodeDef>();
  const pendingEdges: { line: number; text: string; parent?: string }[] = [];
  const stack: Group[] = [];
  let direction: Direction = 'right';
  let title: string | undefined;

  const err = (line: number, message: string, severity: ParseError['severity'] = 'error') =>
    errors.push({ line, message, severity });

  const applyNodeAttrs = (node: NodeDef, attrs: Attrs, line: number) => {
    for (const [k, v] of Object.entries(attrs)) {
      if (!NODE_KEYS.has(k)) {
        err(line, `Unknown attribute "${k}" (expected icon, color, shape or label)`, 'warning');
        continue;
      }
      if (k === 'shape') {
        if (SHAPES.includes(v as Shape)) node.shape = v as Shape;
        else err(line, `Unknown shape "${v}" (expected ${SHAPES.join(', ')})`, 'warning');
      } else if (k === 'icon') node.icon = v.toLowerCase();
      else if (k === 'color') node.color = v;
      else if (k === 'label') node.label = v;
    }
  };

  const defineNode = (raw: string, line: number, isGroup: boolean) => {
    const { body, attrs } = splitAttrs(raw);
    if (!body) {
      err(line, 'Missing node name');
      return undefined;
    }
    const parent = stack.length ? stack[stack.length - 1].id : undefined;
    let node = nodes.get(body);
    if (node) {
      if (node.parent !== parent || node.isGroup !== isGroup) {
        err(line, `"${body}" is already defined on line ${node.line}`);
        return undefined;
      }
      // Redeclaring at the same level merges attributes.
    } else {
      node = { id: body, label: body, shape: 'rect', parent, isGroup, line, implicit: false };
      nodes.set(body, node);
    }
    applyNodeAttrs(node, attrs, line);
    return node;
  };

  // ---- Pass 1: declarations, groups, directives. Edges are deferred so that
  // nodes declared later (or inside groups) resolve correctly.
  const lines = source.split(/\r?\n/);
  lines.forEach((rawLine, i) => {
    const line = i + 1;
    const text = stripComment(rawLine).trim();
    if (!text) return;

    const directive = /^(direction|title)\s+(.+)$/i.exec(text);
    if (directive && !CONNECTOR_RE.test(` ${text} `)) {
      const key = directive[1].toLowerCase();
      const value = directive[2].trim();
      if (key === 'direction') {
        const d = value.toLowerCase() as Direction;
        if (DIRECTIONS.includes(d)) direction = d;
        else err(line, `Unknown direction "${value}" (expected ${DIRECTIONS.join(', ')})`);
      } else {
        title = value;
      }
      return;
    }

    if (text === '}') {
      if (!stack.length) err(line, 'Unexpected "}" with no open group');
      else stack.pop();
      return;
    }

    if (text.endsWith('{')) {
      const head = text.slice(0, -1).trim();
      if (CONNECTOR_RE.test(` ${head} `)) {
        err(line, 'A connection cannot open a group');
        stack.push({ id: `__invalid_${line}`, line });
        return;
      }
      const node = defineNode(head, line, true);
      stack.push({ id: node?.id ?? `__invalid_${line}`, line });
      return;
    }

    if (text.includes('{') || text.includes('}')) {
      err(line, 'Braces must be at the end of a group line or alone on their own line');
      return;
    }

    if (CONNECTOR_RE.test(` ${text} `)) {
      pendingEdges.push({ line, text, parent: stack[stack.length - 1]?.id });
      return;
    }

    defineNode(text, line, false);
  });

  for (const g of stack) err(g.line, 'Group is never closed with "}"');

  // ---- Pass 2: connections
  const edges: EdgeDef[] = [];
  const resolve = (name: string, line: number): string | undefined => {
    const id = name.trim();
    if (!id) {
      err(line, 'Missing node name in connection');
      return undefined;
    }
    if (!nodes.has(id)) {
      nodes.set(id, { id, label: id, shape: 'rect', isGroup: false, line, implicit: true });
    }
    return id;
  };

  for (const { line, text } of pendingEdges) {
    let { body, attrs } = splitAttrs(text);
    let label: string | undefined;

    // Label lives after the first ':' that follows the last connector.
    const parts = body.split(CONNECTOR_SPLIT_RE);
    // parts = [seg, conn, seg, conn, seg, ...]
    const last = parts[parts.length - 1];
    const colon = last.indexOf(':');
    if (colon !== -1) {
      label = last.slice(colon + 1).trim() || undefined;
      parts[parts.length - 1] = last.slice(0, colon);
    }

    for (const k of Object.keys(attrs)) {
      if (!EDGE_KEYS.has(k)) err(line, `Unknown connection attribute "${k}" (expected color or label)`, 'warning');
    }
    if (attrs.label) label = attrs.label;

    for (let p = 0; p + 2 < parts.length; p += 2) {
      const conn = CONNECTORS[parts[p + 1]];
      const lefts = parts[p].split(',').map((s) => resolve(s, line));
      const rights = parts[p + 2].split(',').map((s) => resolve(s, line));
      const isLastHop = p + 3 >= parts.length;
      for (const from of lefts) {
        for (const to of rights) {
          if (!from || !to) continue;
          edges.push({
            id: `e${edges.length}`,
            from,
            to,
            arrow: conn.arrow,
            dashed: conn.dashed,
            color: attrs.color,
            label: isLastHop ? label : undefined,
            line,
          });
        }
      }
    }
  }

  // Edges into the node's own group are almost always a mistake and break layout.
  const isAncestor = (maybeAncestor: string, id: string) => {
    let cur = nodes.get(id)?.parent;
    while (cur) {
      if (cur === maybeAncestor) return true;
      cur = nodes.get(cur)?.parent;
    }
    return false;
  };
  const validEdges = edges.filter((e) => {
    if (isAncestor(e.from, e.to) || isAncestor(e.to, e.from)) {
      err(e.line, `Cannot connect "${e.from}" and "${e.to}": one contains the other`);
      return false;
    }
    return true;
  });

  return {
    title,
    direction,
    nodes: [...nodes.values()].filter((n) => !n.id.startsWith('__invalid_')),
    edges: validEdges,
    errors: errors.sort((a, b) => a.line - b.line),
  };
}

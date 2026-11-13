import { CONNECTOR_RE, CONNECTOR_SPLIT_RE, CONNECTORS, splitAttrs, stripComment, type Attrs } from './parser';
import type { ParseError } from './types';

/**
 * Sequence diagrams: participants exchanging messages over time.
 *
 *   diagram sequence
 *   title Checkout
 *   autonumber
 *
 *   Browser [icon: browser]          // participants, in order of first appearance
 *   API [icon: aws-api-gateway]
 *
 *   Browser > API: POST /checkout    // call
 *   API --> Browser: 201 Created     // reply (dashed)
 *   API > API: validate              // self call
 *
 *   alt [label: card declined] {     // alt / else, loop, opt, par / and, critical, break
 *     API --> Browser: 402
 *   } else [label: ok] {
 *     API --> Browser: 201
 *   }
 *   note over Browser, API: TLS everywhere      // over / left of / right of
 */

export interface Participant {
  id: string;
  label: string;
  icon?: string;
  color?: string;
  line: number;
  implicit: boolean;
}

export interface Message {
  type: 'message';
  from: string;
  to: string;
  label?: string;
  /** Number shown before the label when `autonumber` is on. */
  number?: number;
  arrow: 'forward' | 'both' | 'none';
  dashed: boolean;
  color?: string;
  line: number;
}

export interface Note {
  type: 'note';
  position: 'over' | 'left' | 'right';
  targets: string[];
  text: string;
  line: number;
}

export const FRAGMENT_KINDS = ['alt', 'loop', 'opt', 'par', 'critical', 'break'] as const;
export type FragmentKind = (typeof FRAGMENT_KINDS)[number];

export interface Fragment {
  type: 'fragment';
  kind: FragmentKind;
  color?: string;
  sections: { label?: string; line: number; items: SequenceItem[] }[];
  line: number;
}

export type SequenceItem = Message | Note | Fragment;

export interface SequenceDiagram {
  title?: string;
  participants: Participant[];
  items: SequenceItem[];
  errors: ParseError[];
}

const PARTICIPANT_KEYS = new Set(['icon', 'color', 'label']);
const FRAGMENT_RE = new RegExp(`^(${FRAGMENT_KINDS.join('|')})\\b(.*)\\{\\s*$`, 'i');
const SECTION_RE = /^\}\s*(else|and)\b(.*)\{\s*$/i;
const NOTE_RE = /^note\s+(over|left of|right of)\s+(.+?)\s*:\s*(.*)$/i;

/** Label of a fragment or section header: `[label: x]` or plain text. */
function headerLabel(rest: string): { label?: string; attrs: Attrs } {
  const { body, attrs } = splitAttrs(rest.trim());
  return { label: attrs.label ?? (body || undefined), attrs };
}

export function parseSequence(source: string): SequenceDiagram {
  const errors: ParseError[] = [];
  const err = (line: number, message: string, severity: ParseError['severity'] = 'error') =>
    errors.push({ line, message, severity });

  const participants = new Map<string, Participant>();
  const root: SequenceItem[] = [];
  /** Open fragments; items go into the last section of the innermost one. */
  const stack: Fragment[] = [];
  const target = () => (stack.length ? stack[stack.length - 1].sections.at(-1)!.items : root);
  let title: string | undefined;
  let autonumber = false;

  const participant = (name: string, line: number): string | undefined => {
    const id = name.trim();
    if (!id) {
      err(line, 'Missing participant name');
      return undefined;
    }
    if (!participants.has(id)) participants.set(id, { id, label: id, line, implicit: true });
    return id;
  };

  source.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1;
    const text = stripComment(raw).trim();
    if (!text) return;

    const directive = /^(diagram|title|autonumber|direction)\b\s*(.*)$/i.exec(text);
    if (directive && !CONNECTOR_RE.test(` ${text} `) && !text.includes('[')) {
      const key = directive[1].toLowerCase();
      const value = directive[2].trim();
      if (key === 'title') title = value || undefined;
      else if (key === 'autonumber') autonumber = true;
      else if (key === 'direction') err(line, 'Sequence diagrams always run top to bottom; "direction" is ignored', 'warning');
      return;
    }

    if (text === '}') {
      if (stack.length) stack.pop();
      else err(line, 'Unexpected "}" with no open block');
      return;
    }

    const section = SECTION_RE.exec(text);
    if (section) {
      const frag = stack.at(-1);
      const word = section[1].toLowerCase();
      if (!frag) err(line, `"${word}" must follow an alt or par block`);
      else {
        if (word === 'else' && frag.kind !== 'alt') err(line, '"else" only belongs in an alt block', 'warning');
        if (word === 'and' && frag.kind !== 'par') err(line, '"and" only belongs in a par block', 'warning');
        frag.sections.push({ label: headerLabel(section[2]).label, line, items: [] });
      }
      return;
    }

    const open = FRAGMENT_RE.exec(text);
    if (open) {
      const { label, attrs } = headerLabel(open[2]);
      const frag: Fragment = {
        type: 'fragment',
        kind: open[1].toLowerCase() as FragmentKind,
        color: attrs.color,
        sections: [{ label, line, items: [] }],
        line,
      };
      target().push(frag);
      stack.push(frag);
      return;
    }

    // Braces inside a connection's label (e.g. a JSON payload) are just text.
    if ((text.includes('{') || text.includes('}')) && !CONNECTOR_RE.test(` ${text} `)) {
      err(line, `Blocks start with ${FRAGMENT_KINDS.join(', ')} and end with "}"`);
      return;
    }

    const note = NOTE_RE.exec(text);
    if (note) {
      const where = note[1].toLowerCase();
      const targets = note[2]
        .split(',')
        .map((t) => participant(t, line))
        .filter((t): t is string => !!t);
      if (where !== 'over' && targets.length > 1) err(line, `"note ${where}" takes one participant`, 'warning');
      target().push({
        type: 'note',
        position: where === 'over' ? 'over' : where === 'left of' ? 'left' : 'right',
        targets: where === 'over' ? targets : targets.slice(0, 1),
        text: note[3].trim(),
        line,
      });
      return;
    }

    if (CONNECTOR_RE.test(` ${text} `)) {
      const { body, attrs } = splitAttrs(text);
      const parts = body.split(CONNECTOR_SPLIT_RE);
      const last = parts[parts.length - 1];
      const colon = last.indexOf(':');
      let label: string | undefined;
      if (colon !== -1) {
        label = last.slice(colon + 1).trim() || undefined;
        parts[parts.length - 1] = last.slice(0, colon);
      }
      if (attrs.label) label = attrs.label;
      for (const k of Object.keys(attrs)) {
        if (k !== 'color' && k !== 'label') err(line, `Unknown message attribute "${k}" (expected color or label)`, 'warning');
      }
      for (let p = 0; p + 2 < parts.length; p += 2) {
        const conn = CONNECTORS[parts[p + 1]];
        const lefts = parts[p].split(',').map((s) => participant(s, line));
        const rights = parts[p + 2].split(',').map((s) => participant(s, line));
        const lastHop = p + 3 >= parts.length;
        for (const a of lefts) {
          for (const b of rights) {
            if (!a || !b) continue;
            // "A < B" is B calling A: store every message in the direction it travels.
            const back = conn.arrow === 'back';
            target().push({
              type: 'message',
              from: back ? b : a,
              to: back ? a : b,
              arrow: back ? 'forward' : (conn.arrow as Message['arrow']),
              dashed: conn.dashed,
              color: attrs.color,
              label: lastHop ? label : undefined,
              line,
            });
          }
        }
      }
      return;
    }

    // A participant declaration.
    const { body, attrs } = splitAttrs(text);
    const id = participant(body, line);
    if (!id) return;
    const p = participants.get(id)!;
    if (!p.implicit && p.line !== line) err(line, `"${id}" is already declared on line ${p.line}`, 'warning');
    p.implicit = false;
    p.line = Math.min(p.line, line);
    for (const [k, v] of Object.entries(attrs)) {
      if (!PARTICIPANT_KEYS.has(k)) err(line, `Unknown participant attribute "${k}" (expected icon, color or label)`, 'warning');
      else if (k === 'icon') p.icon = v.toLowerCase();
      else if (k === 'color') p.color = v;
      else p.label = v;
    }
  });

  for (const f of stack) err(f.line, `"${f.kind}" block is never closed with "}"`);

  if (autonumber) {
    let n = 0;
    const number = (items: SequenceItem[]) => {
      for (const it of items) {
        if (it.type === 'message') it.number = ++n;
        else if (it.type === 'fragment') for (const s of it.sections) number(s.items);
      }
    };
    number(root);
  }

  return { title, participants: [...participants.values()], items: root, errors: errors.sort((a, b) => a.line - b.line) };
}

/** Every message in time order, descending into fragments. */
export function allMessages(items: SequenceItem[]): Message[] {
  return items.flatMap((it) =>
    it.type === 'message' ? [it] : it.type === 'fragment' ? it.sections.flatMap((s) => allMessages(s.items)) : [],
  );
}

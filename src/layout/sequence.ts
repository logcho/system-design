import type { Fragment, Message, Note, Participant, SequenceDiagram, SequenceItem } from '../dsl/sequence';
import { NODE_METRICS, textWidth } from './core';

/**
 * Sequence diagram layout. Unlike flow diagrams this needs no graph layout:
 * participants are columns spaced so every message label fits, and items are
 * rows down the page in the order they were written.
 */

const LABEL_CHAR_W = 6.4;
const MIN_PARTICIPANT_W = 96;
const COLUMN_GAP = 40;
const ROW = 40;
const SELF_LOOP_W = 36;
const SELF_LOOP_H = 22;
const NOTE_H = 30;
const NOTE_PAD = 10;
const FRAGMENT_HEADER = 30;
const FRAGMENT_PAD_X = 16;
const SECTION_HEADER = 26;

export interface SeqParticipantBox {
  def: Participant;
  /** Center of the lifeline. */
  x: number;
  width: number;
}
export interface SeqMessageRow {
  def: Message;
  y: number;
  x1: number;
  x2: number;
  self: boolean;
  labelText?: string;
}
export interface SeqNoteBox {
  def: Note;
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface SeqFragmentBox {
  def: Fragment;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
  /** Section headers: the first sits at the top edge, others draw a divider at `y`. */
  sections: { label?: string; y: number; line: number }[];
}

export interface SequenceLayout {
  width: number;
  height: number;
  headerHeight: number;
  lifelineTop: number;
  lifelineBottom: number;
  participants: SeqParticipantBox[];
  messages: SeqMessageRow[];
  notes: SeqNoteBox[];
  fragments: SeqFragmentBox[];
}

const messageText = (m: Message) =>
  m.number !== undefined ? `${m.number}. ${m.label ?? ''}`.trim() : (m.label ?? '');
const labelW = (s: string) => (s ? textWidth(s, LABEL_CHAR_W) : 0);

export function layoutSequence(d: SequenceDiagram): SequenceLayout {
  const hasIcons = d.participants.some((p) => p.icon);
  const headerHeight = hasIcons ? NODE_METRICS.iconTile + 28 : 40;
  const widths = d.participants.map((p) => Math.max(MIN_PARTICIPANT_W, textWidth(p.label) + 28));
  const index = new Map(d.participants.map((p, i) => [p.id, i]));
  const n = d.participants.length;

  // ---- Horizontal: gaps between neighbouring lifelines.
  const gaps = Array.from({ length: Math.max(0, n - 1) }, (_, i) => widths[i] / 2 + widths[i + 1] / 2 + COLUMN_GAP);
  let trailing = widths[n - 1] / 2 || 0; // room right of the last lifeline
  const spans: { from: number; to: number; need: number }[] = [];
  const visit = (items: SequenceItem[]) => {
    for (const it of items) {
      if (it.type === 'message') {
        const a = index.get(it.from)!;
        const b = index.get(it.to)!;
        const w = labelW(messageText(it));
        if (a === b) {
          const need = SELF_LOOP_W + 8 + w + 16;
          if (a < n - 1) spans.push({ from: a, to: a + 1, need: need + widths[a + 1] / 2 });
          else trailing = Math.max(trailing, need);
        } else {
          spans.push({ from: Math.min(a, b), to: Math.max(a, b), need: w + 32 });
        }
      } else if (it.type === 'note') {
        const w = labelW(it.text) + NOTE_PAD * 2;
        const cols = it.targets.map((t) => index.get(t)!);
        if (it.position === 'over' && cols.length > 1) {
          spans.push({ from: Math.min(...cols), to: Math.max(...cols), need: w - 40 });
        } else if (it.position === 'right' && cols[0] < n - 1) {
          spans.push({ from: cols[0], to: cols[0] + 1, need: w + 12 + widths[cols[0] + 1] / 2 });
        } else if (it.position === 'left' && cols[0] > 0) {
          spans.push({ from: cols[0] - 1, to: cols[0], need: w + 12 + widths[cols[0] - 1] / 2 });
        }
      } else {
        for (const s of it.sections) visit(s.items);
      }
    }
  };
  visit(d.items);
  // Satisfy narrow spans first, then spread any shortfall of wider ones evenly.
  spans.sort((a, b) => a.to - a.from - (b.to - b.from));
  for (const s of spans) {
    const have = gaps.slice(s.from, s.to).reduce((x, y) => x + y, 0);
    if (have < s.need) {
      const add = (s.need - have) / (s.to - s.from);
      for (let g = s.from; g < s.to; g++) gaps[g] += add;
    }
  }
  const xs: number[] = [];
  d.participants.forEach((_, i) => xs.push(i === 0 ? widths[0] / 2 : xs[i - 1] + gaps[i - 1]));
  const colX = (id: string) => xs[index.get(id)!];

  // ---- Vertical: walk the items in order.
  const messages: SeqMessageRow[] = [];
  const notes: SeqNoteBox[] = [];
  const fragments: SeqFragmentBox[] = [];
  let y = headerHeight + 24;

  /** Lays out items and returns their horizontal extent. */
  const place = (items: SequenceItem[], depth: number): { left: number; right: number } => {
    let left = Infinity;
    let right = -Infinity;
    const grow = (l: number, r: number) => {
      left = Math.min(left, l);
      right = Math.max(right, r);
    };
    for (const it of items) {
      if (it.type === 'message') {
        const x1 = colX(it.from);
        const x2 = colX(it.to);
        const text = messageText(it);
        if (x1 === x2) {
          messages.push({ def: it, y: y + 18, x1, x2, self: true, labelText: text || undefined });
          grow(x1 - 12, x1 + SELF_LOOP_W + 8 + labelW(text));
          y += ROW + SELF_LOOP_H - 8;
        } else {
          messages.push({ def: it, y: y + 22, x1, x2, self: false, labelText: text || undefined });
          const mid = (x1 + x2) / 2;
          grow(Math.min(x1, x2, mid - labelW(text) / 2) - 12, Math.max(x1, x2, mid + labelW(text) / 2) + 12);
          y += ROW;
        }
      } else if (it.type === 'note') {
        const w = labelW(it.text) + NOTE_PAD * 2;
        const cols = it.targets.map(colX);
        let x: number;
        let width = w;
        if (it.position === 'over') {
          const lo = Math.min(...cols);
          const hi = Math.max(...cols);
          width = Math.max(w, hi - lo + 60);
          x = (lo + hi) / 2 - width / 2;
        } else if (it.position === 'left') x = cols[0] - 12 - w;
        else x = cols[0] + 12;
        y += 6;
        notes.push({ def: it, x, y, width, height: NOTE_H });
        grow(x, x + width);
        y += NOTE_H + 10;
      } else {
        const top = y;
        y += FRAGMENT_HEADER;
        const sections: SeqFragmentBox['sections'] = [];
        let inner = { left: Infinity, right: -Infinity };
        it.sections.forEach((s, i) => {
          if (i > 0) y += SECTION_HEADER;
          sections.push({ label: s.label, y: i === 0 ? top : y - SECTION_HEADER + 4, line: s.line });
          const b = place(s.items, depth + 1);
          inner = { left: Math.min(inner.left, b.left), right: Math.max(inner.right, b.right) };
        });
        y += 10;
        if (!Number.isFinite(inner.left)) inner = { left: xs[0] ?? 0, right: (xs[0] ?? 0) + 120 };
        const headerW = labelW(it.kind) + 24 + labelW(sections[0].label ? `[${sections[0].label}]` : '') + 16;
        const x = inner.left - FRAGMENT_PAD_X;
        const width = Math.max(inner.right + FRAGMENT_PAD_X - x, headerW);
        fragments.push({ def: it, x, y: top, width, height: y - top, depth, sections });
        grow(x, x + width);
        y += 12;
      }
    }
    return { left, right };
  };
  place(d.items, 0);
  const lifelineBottom = y + 16;

  // ---- Normalize so everything starts at x = 0.
  let minX = 0;
  let maxX = (xs[n - 1] ?? 0) + trailing;
  for (let i = 0; i < n; i++) {
    minX = Math.min(minX, xs[i] - widths[i] / 2);
    maxX = Math.max(maxX, xs[i] + widths[i] / 2);
  }
  for (const b of [...notes, ...fragments]) {
    minX = Math.min(minX, b.x);
    maxX = Math.max(maxX, b.x + b.width);
  }
  for (const m of messages) if (m.self) maxX = Math.max(maxX, m.x1 + SELF_LOOP_W + 8 + labelW(m.labelText ?? ''));
  const dx = -minX;
  // Draw outer fragments first so nested ones paint on top.
  fragments.sort((a, b) => a.depth - b.depth);

  return {
    width: maxX - minX,
    height: lifelineBottom,
    headerHeight,
    lifelineTop: headerHeight,
    lifelineBottom,
    participants: d.participants.map((def, i) => ({ def, x: xs[i] + dx, width: widths[i] })),
    messages: messages.map((m) => ({ ...m, x1: m.x1 + dx, x2: m.x2 + dx })),
    notes: notes.map((b) => ({ ...b, x: b.x + dx })),
    fragments: fragments.map((b) => ({ ...b, x: b.x + dx })),
  };
}

export const SEQUENCE_METRICS = { selfLoopWidth: SELF_LOOP_W, selfLoopHeight: SELF_LOOP_H, labelCharWidth: LABEL_CHAR_W };

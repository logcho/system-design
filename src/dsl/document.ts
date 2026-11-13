import { parse } from './parser';
import { parseEr, type ErDiagram } from './er';
import { parseSequence, type SequenceDiagram } from './sequence';
import type { Diagram, ParseError } from './types';

/** A Linework file is a flow diagram (the default), a sequence diagram or an ER diagram. */
export type Document =
  | { kind: 'flow'; diagram: Diagram }
  | { kind: 'sequence'; diagram: SequenceDiagram }
  | { kind: 'er'; diagram: ErDiagram };

export type DiagramKind = Document['kind'];

// [ \t] rather than \s so a match never spans lines (line numbers must not shift).
const KIND_RE = /^[ \t]*diagram[ \t]+(flow|sequence|er|erd)[ \t]*$/im;

/**
 * The kind named by a `diagram <kind>` line. An unknown kind is only reported
 * when it is the first line of the file, so a component named e.g.
 * "Diagram Service" is never mistaken for the directive.
 */
export function detectKind(source: string): { kind: DiagramKind; error?: ParseError } {
  const m = KIND_RE.exec(source);
  if (m) {
    const kind = m[1].toLowerCase();
    return { kind: kind === 'erd' ? 'er' : (kind as DiagramKind) };
  }
  const lines = source.split(/\r?\n/);
  const first = lines.findIndex((l) => l.trim() && !l.trim().startsWith('//'));
  const unknown = first >= 0 ? /^\s*diagram\s+(\S+)\s*$/i.exec(lines[first]) : null;
  if (!unknown) return { kind: 'flow' };
  return {
    kind: 'flow',
    error: { line: first + 1, severity: 'error', message: `Unknown diagram kind "${unknown[1]}" (expected flow, sequence or er)` },
  };
}

export function parseDocument(source: string): Document {
  const { kind, error } = detectKind(source);
  if (kind === 'sequence') return { kind, diagram: parseSequence(source) };
  if (kind === 'er') return { kind, diagram: parseEr(source) };
  // Blank out the directive line (keeping line numbers) so the flow parser never sees it.
  const lines = source.split('\n');
  if (error) lines[error.line - 1] = '';
  const diagram = parse(lines.join('\n').replace(KIND_RE, ''));
  if (error) {
    diagram.errors.push(error);
    diagram.errors.sort((a, b) => a.line - b.line);
  }
  return { kind: 'flow', diagram };
}

/** Everything in a document that can carry an `icon:` attribute. */
export function iconHolders(doc: Document): { icon?: string; line: number }[] {
  switch (doc.kind) {
    case 'flow':
      return doc.diagram.nodes;
    case 'sequence':
      return doc.diagram.participants;
    case 'er':
      return doc.diagram.entities;
  }
}

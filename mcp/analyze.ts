import { parseDocument, type DiagramKind } from '../src/dsl/document';
import { allMessages, type SequenceItem } from '../src/dsl/sequence';
import { resolveIcon, suggestIcons } from './icons';

export interface Analysis {
  kind: DiagramKind;
  title?: string;
  /** Components (flow) or participants (sequence). */
  components: number;
  /** One line of counts, e.g. "12 components, 3 groups, 14 connections." */
  summary: string;
  problems: { line: number; severity: 'error' | 'warning'; message: string }[];
  /** Names that only appear in connections or messages: often typos. */
  undeclared: string[];
}

const countFragments = (items: SequenceItem[]): number =>
  items.reduce((n, it) => (it.type === 'fragment' ? n + 1 + it.sections.reduce((m, s) => m + countFragments(s.items), 0) : n), 0);

/** Everything an agent needs to know to fix a diagram it just wrote. */
export function analyze(code: string): Analysis {
  const doc = parseDocument(code);
  const d = doc.diagram;
  const problems = d.errors.map((e) => ({ line: e.line, severity: e.severity, message: e.message }));
  const withIcons = doc.kind === 'flow' ? doc.diagram.nodes : doc.diagram.participants;
  for (const n of withIcons) {
    if (n.icon && !resolveIcon(n.icon)) {
      const close = suggestIcons(n.icon);
      problems.push({
        line: n.line,
        severity: 'warning',
        message: `Unknown icon "${n.icon}"` + (close.length ? `. Close matches: ${close.join(', ')}` : '. Try search_icons.'),
      });
    }
  }
  problems.sort((a, b) => a.line - b.line);

  if (doc.kind === 'flow') {
    const nodes = doc.diagram.nodes;
    const components = nodes.filter((n) => !n.isGroup).length;
    const groups = nodes.filter((n) => n.isGroup).length;
    return {
      kind: 'flow',
      title: d.title,
      components,
      summary: `${components} components, ${groups} groups, ${doc.diagram.edges.length} connections.`,
      problems,
      undeclared: nodes.filter((n) => n.implicit).map((n) => n.id),
    };
  }
  const { participants, items } = doc.diagram;
  return {
    kind: 'sequence',
    title: d.title,
    components: participants.length,
    summary: `Sequence diagram: ${participants.length} participants, ${allMessages(items).length} messages, ${countFragments(items)} blocks.`,
    problems,
    undeclared: participants.filter((p) => p.implicit).map((p) => p.id),
  };
}

export function formatAnalysis(a: Analysis): string {
  const lines = [a.summary];
  if (a.problems.length) {
    lines.push('', 'Problems:');
    for (const p of a.problems) lines.push(`- line ${p.line} (${p.severity}): ${p.message}`);
  } else {
    lines.push('No problems found.');
  }
  if (a.undeclared.length) {
    lines.push(
      '',
      a.kind === 'flow'
        ? `Used in connections but never declared (no icon or group): ${a.undeclared.join(', ')}. ` +
            'If any of these is a typo of a declared name, it shows up as a stray box.'
        : `Participants only named in messages, never declared (no icon): ${a.undeclared.join(', ')}. ` +
            'If any of these is a typo of a declared name, it shows up as an extra lifeline.',
    );
  }
  return lines.join('\n');
}

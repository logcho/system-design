import { parse } from '../src/dsl/parser';
import { resolveIcon, suggestIcons } from './icons';

export interface Analysis {
  title?: string;
  components: number;
  groups: number;
  connections: number;
  problems: { line: number; severity: 'error' | 'warning'; message: string }[];
  /** Components that only appear in connections: often typos. */
  undeclared: string[];
}

/** Everything an agent needs to know to fix a diagram it just wrote. */
export function analyze(code: string): Analysis {
  const d = parse(code);
  const problems = d.errors.map((e) => ({ line: e.line, severity: e.severity, message: e.message }));
  for (const n of d.nodes) {
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
  return {
    title: d.title,
    components: d.nodes.filter((n) => !n.isGroup).length,
    groups: d.nodes.filter((n) => n.isGroup).length,
    connections: d.edges.length,
    problems,
    undeclared: d.nodes.filter((n) => n.implicit).map((n) => n.id),
  };
}

export function formatAnalysis(a: Analysis): string {
  const lines = [`${a.components} components, ${a.groups} groups, ${a.connections} connections.`];
  if (a.problems.length) {
    lines.push('', 'Problems:');
    for (const p of a.problems) lines.push(`- line ${p.line} (${p.severity}): ${p.message}`);
  } else {
    lines.push('No problems found.');
  }
  if (a.undeclared.length) {
    lines.push(
      '',
      `Used in connections but never declared (no icon or group): ${a.undeclared.join(', ')}. ` +
        'If any of these is a typo of a declared name, it shows up as a stray box.',
    );
  }
  return lines.join('\n');
}

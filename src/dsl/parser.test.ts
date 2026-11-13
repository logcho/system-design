import { describe, expect, it } from 'vitest';
import { parse } from './parser';

describe('parse', () => {
  it('parses nodes with attributes', () => {
    const d = parse('Client [icon: user, color: blue]\nDB [shape: cylinder]');
    expect(d.errors).toEqual([]);
    expect(d.nodes).toMatchObject([
      { id: 'Client', icon: 'user', color: 'blue', shape: 'rect' },
      { id: 'DB', shape: 'cylinder' },
    ]);
  });

  it('parses directives', () => {
    const d = parse('direction down\ntitle My System');
    expect(d.direction).toBe('down');
    expect(d.title).toBe('My System');
  });

  it('parses groups and nesting', () => {
    const d = parse('Cloud {\n  VPC [icon: shield] {\n    API\n  }\n}');
    expect(d.errors).toEqual([]);
    const byId = Object.fromEntries(d.nodes.map((n) => [n.id, n]));
    expect(byId.Cloud.isGroup).toBe(true);
    expect(byId.VPC).toMatchObject({ isGroup: true, parent: 'Cloud', icon: 'shield' });
    expect(byId.API.parent).toBe('VPC');
  });

  it('parses connections with labels, chains, and fan-out', () => {
    const d = parse('A > B > C: hello\nA <--> D, E [color: red]');
    expect(d.errors).toEqual([]);
    expect(d.edges.map((e) => [e.from, e.to, e.arrow, e.dashed, e.label ?? null, e.color ?? null])).toEqual([
      ['A', 'B', 'forward', false, null, null],
      ['B', 'C', 'forward', false, 'hello', null],
      ['A', 'D', 'both', true, null, 'red'],
      ['A', 'E', 'both', true, null, 'red'],
    ]);
  });

  it('creates implicit nodes but resolves later declarations inside groups', () => {
    const d = parse('A > B\nG {\n  B [icon: server]\n}');
    expect(d.errors).toEqual([]);
    const b = d.nodes.find((n) => n.id === 'B')!;
    expect(b).toMatchObject({ parent: 'G', implicit: false, icon: 'server' });
    expect(d.nodes.find((n) => n.id === 'A')!.implicit).toBe(true);
  });

  it('keeps hyphenated names and URLs intact', () => {
    const d = parse('auth-service > user-db: https://example.com // note');
    expect(d.edges[0]).toMatchObject({ from: 'auth-service', to: 'user-db', label: 'https://example.com' });
  });

  it('allows braces in connection labels', () => {
    const d = parse('A > B: {"event": "created"}');
    expect(d.errors).toEqual([]);
    expect(d.edges[0].label).toBe('{"event": "created"}');
  });

  it('reports structural errors with line numbers', () => {
    const d = parse('G {\n  A\n}\n}\nH {\n  B');
    expect(d.errors.map((e) => [e.line, e.severity])).toEqual([
      [4, 'error'],
      [5, 'error'],
    ]);
  });

  it('rejects edges between a group and its descendants', () => {
    const d = parse('G {\n  A\n}\nG > A');
    expect(d.edges).toEqual([]);
    expect(d.errors[0].line).toBe(4);
  });

  it('warns on unknown attributes', () => {
    const d = parse('A [colour: red]');
    expect(d.errors[0]).toMatchObject({ line: 1, severity: 'warning' });
  });
});

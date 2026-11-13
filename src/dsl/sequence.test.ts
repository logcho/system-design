import { describe, expect, it } from 'vitest';
import { parseDocument } from './document';
import { allMessages, parseSequence, type Fragment } from './sequence';

const seq = (src: string) => parseSequence(`diagram sequence\n${src}`);

describe('parseDocument', () => {
  it('defaults to flow and switches on "diagram sequence"', () => {
    expect(parseDocument('A > B').kind).toBe('flow');
    expect(parseDocument('// hi\ndiagram sequence\nA > B').kind).toBe('sequence');
    expect(parseDocument('diagram flow\nA > B').kind).toBe('flow');
  });

  it('keeps flow line numbers when stripping the directive', () => {
    const doc = parseDocument('diagram flow\n\nA [colour: red]');
    expect(doc.diagram.errors[0].line).toBe(3);
  });

  it('reports an unknown kind only on the first line', () => {
    const bad = parseDocument('diagram sequnce\nA > B');
    expect(bad.kind).toBe('flow');
    expect(bad.diagram.errors).toMatchObject([{ line: 1, severity: 'error' }]);
    const node = parseDocument('A > B\nDiagram Service');
    expect(node.diagram.errors).toEqual([]);
  });
});

describe('parseSequence', () => {
  it('orders participants by first appearance and merges declarations', () => {
    const d = seq('API > DB: query\nClient [icon: browser]\nClient > API\nDB [icon: postgres]');
    expect(d.errors).toEqual([]);
    expect(d.participants.map((p) => [p.id, p.icon ?? null, p.implicit])).toEqual([
      ['API', null, true],
      ['DB', 'postgres', false],
      ['Client', 'browser', false],
    ]);
  });

  it('parses calls, replies, reverse arrows, self calls, chains and fan-out', () => {
    const d = seq('A > B: call\nB --> A: reply\nA < C: from C\nA > A: think\nA > B > C\nA > B, C: both');
    expect(allMessages(d.items).map((m) => [m.from, m.to, m.dashed, m.label ?? null])).toEqual([
      ['A', 'B', false, 'call'],
      ['B', 'A', true, 'reply'],
      ['C', 'A', false, 'from C'],
      ['A', 'A', false, 'think'],
      ['A', 'B', false, null],
      ['B', 'C', false, null],
      ['A', 'B', false, 'both'],
      ['A', 'C', false, 'both'],
    ]);
  });

  it('parses nested fragments with sections', () => {
    const d = seq(
      'loop [label: every 5s] {\n  A > B: poll\n  alt [label: ready] {\n    B --> A: data\n  } else {\n    B --> A: empty\n  }\n}',
    );
    expect(d.errors).toEqual([]);
    const loop = d.items[0] as Fragment;
    expect(loop).toMatchObject({ kind: 'loop', sections: [{ label: 'every 5s' }] });
    const alt = loop.sections[0].items[1] as Fragment;
    expect(alt.kind).toBe('alt');
    expect(alt.sections.map((s) => [s.label ?? null, s.items.length])).toEqual([
      ['ready', 1],
      [null, 1],
    ]);
  });

  it('accepts plain-text fragment labels', () => {
    const d = seq('opt user is signed in {\n  A > B\n}');
    expect((d.items[0] as Fragment).sections[0].label).toBe('user is signed in');
  });

  it('parses notes', () => {
    const d = seq('A > B\nnote over A, B: shared secret\nnote left of A: client\nnote right of B: server');
    expect(d.items.slice(1)).toMatchObject([
      { type: 'note', position: 'over', targets: ['A', 'B'], text: 'shared secret' },
      { type: 'note', position: 'left', targets: ['A'], text: 'client' },
      { type: 'note', position: 'right', targets: ['B'], text: 'server' },
    ]);
  });

  it('numbers messages with autonumber, in time order across fragments', () => {
    const d = seq('autonumber\nA > B\nloop {\n  B > C\n}\nC --> A');
    expect(allMessages(d.items).map((m) => m.number)).toEqual([1, 2, 3]);
  });

  it('reports structural problems with line numbers', () => {
    const d = seq('A > B\n}\nloop {\n  A > B\n} and {\nalt {');
    expect(d.errors.map((e) => [e.line, e.severity])).toEqual([
      [3, 'error'], // "}" with nothing open (line numbers include the diagram line)
      [4, 'error'], // loop never closed
      [6, 'warning'], // "and" outside par
      [7, 'error'], // alt never closed
    ]);
  });
});

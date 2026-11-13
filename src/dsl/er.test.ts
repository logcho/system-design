import { describe, expect, it } from 'vitest';
import { parseDocument } from './document';
import { parseEr } from './er';

const er = (src: string) => parseEr(`diagram er\n${src}`);

describe('parseEr', () => {
  it('is selected by "diagram er" (and "diagram erd")', () => {
    expect(parseDocument('diagram er\nusers {\n  id int pk\n}').kind).toBe('er');
    expect(parseDocument('diagram erd\nusers {\n}').kind).toBe('er');
  });

  it('parses tables, columns, types and modifiers', () => {
    const d = er('title Shop\nusers [icon: user, color: blue] {\n  id int pk\n  email string unique\n  deleted_at timestamp null\n  org_id uuid fk\n  notes\n}');
    expect(d.errors).toEqual([]);
    expect(d.title).toBe('Shop');
    const users = d.entities[0];
    expect(users).toMatchObject({ id: 'users', icon: 'user', color: 'blue', implicit: false });
    expect(users.columns.map((c) => [c.name, c.type ?? null, c.pk, c.fk, c.unique, c.nullable])).toEqual([
      ['id', 'int', true, false, false, false],
      ['email', 'string', false, false, true, false],
      ['deleted_at', 'timestamp', false, false, false, true],
      ['org_id', 'uuid', false, true, false, false],
      ['notes', null, false, false, false, false],
    ]);
  });

  it('maps connectors to cardinalities', () => {
    const d = er(
      'a {\n  id int\n}\nb {\n  a_id int\n}\nb.a_id > a.id\na.id < b.a_id\na.id - b.a_id\na <> b\nb.a_id --> a.id: optional',
    );
    expect(d.errors).toEqual([]);
    expect(d.relations.map((r) => [r.from.table, r.from.column ?? null, r.from.cardinality, r.to.table, r.to.cardinality, r.dashed, r.label ?? null])).toEqual([
      ['b', 'a_id', 'many', 'a', 'one', false, null],
      ['a', 'id', 'one', 'b', 'many', false, null],
      ['a', 'id', 'one', 'b', 'one', false, null],
      ['a', null, 'many', 'b', 'many', false, null],
      ['b', 'a_id', 'many', 'a', 'one', true, 'optional'],
    ]);
  });

  it('allows table names with spaces', () => {
    const d = er('order items {\n  id int pk\n}\norders {\n  id int pk\n}\norder items.order_id > orders.id');
    expect(d.relations[0].from).toMatchObject({ table: 'order items', column: 'order_id' });
    expect(d.errors.map((e) => e.message)).toEqual(['Table "order items" has no column "order_id"']);
  });

  it('warns about undeclared tables and missing columns', () => {
    const d = er('users {\n  id int pk\n}\norders.user_id > users.uid');
    expect(d.errors.map((e) => [e.line, e.severity, e.message])).toEqual([
      [5, 'warning', 'Table "orders" is not declared'],
      [5, 'warning', 'Table "users" has no column "uid"'],
    ]);
    expect(d.entities.find((e) => e.id === 'orders')).toMatchObject({ implicit: true });
  });

  it('reports structural errors', () => {
    const d = er('users {\n  id int\n  nested {\n}\n}\nloose line\nposts {\n  id int');
    expect(d.errors.map((e) => [e.line, e.severity])).toEqual([
      [4, 'error'], // table inside a table
      [6, 'error'], // "}" with nothing open
      [7, 'error'], // not a table or relationship
      [8, 'error'], // posts never closed
    ]);
  });
});

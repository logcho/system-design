export type Direction = 'right' | 'down' | 'left' | 'up';
export type Shape = 'rect' | 'oval' | 'diamond' | 'cylinder';
export type ArrowKind = 'forward' | 'back' | 'both' | 'none';

export interface NodeDef {
  id: string;
  label: string;
  icon?: string;
  color?: string;
  shape: Shape;
  /** id of the enclosing group, if any */
  parent?: string;
  isGroup: boolean;
  /** 1-based source line where the node was defined (or first referenced) */
  line: number;
  /** true when the node only appears in a connection and was never declared */
  implicit: boolean;
}

export interface EdgeDef {
  id: string;
  from: string;
  to: string;
  label?: string;
  arrow: ArrowKind;
  dashed: boolean;
  color?: string;
  line: number;
}

export interface ParseError {
  line: number;
  message: string;
  severity: 'error' | 'warning';
}

export interface Diagram {
  title?: string;
  direction: Direction;
  nodes: NodeDef[];
  edges: EdgeDef[];
  errors: ParseError[];
}

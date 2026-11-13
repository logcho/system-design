import type { Document } from '../dsl/document';
import { layoutWith, type LayoutEngine, type LayoutResult } from './core';
import { layoutEr, type ErLayout } from './er';
import { layoutSequence, type SequenceLayout } from './sequence';

export type DocumentLayout =
  | { kind: 'flow'; layout: LayoutResult }
  | { kind: 'sequence'; layout: SequenceLayout }
  | { kind: 'er'; layout: ErLayout };

/** Flow and ER diagrams go through ELK; sequence diagrams use their own row layout. */
export async function layoutDocumentWith(elk: LayoutEngine, doc: Document): Promise<DocumentLayout> {
  switch (doc.kind) {
    case 'flow':
      return { kind: 'flow', layout: await layoutWith(elk, doc.diagram) };
    case 'sequence':
      return { kind: 'sequence', layout: layoutSequence(doc.diagram) };
    case 'er':
      return { kind: 'er', layout: await layoutEr(elk, doc.diagram) };
  }
}

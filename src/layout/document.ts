import type { Document } from '../dsl/document';
import { layoutWith, type LayoutEngine, type LayoutResult } from './core';
import { layoutSequence, type SequenceLayout } from './sequence';

export type DocumentLayout = { kind: 'flow'; layout: LayoutResult } | { kind: 'sequence'; layout: SequenceLayout };

/** Flow diagrams go through ELK; sequence diagrams use their own row layout. */
export async function layoutDocumentWith(elk: LayoutEngine, doc: Document): Promise<DocumentLayout> {
  return doc.kind === 'flow'
    ? { kind: 'flow', layout: await layoutWith(elk, doc.diagram) }
    : { kind: 'sequence', layout: layoutSequence(doc.diagram) };
}

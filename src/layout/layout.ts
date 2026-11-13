import ELK from 'elkjs/lib/elk-api';
import elkWorkerUrl from 'elkjs/lib/elk-worker.min.js?url';
import type { Document } from '../dsl/document';
import type { Diagram } from '../dsl/types';
import { layoutWith, type LayoutResult } from './core';
import { layoutDocumentWith, type DocumentLayout } from './document';

export * from './core';
export type { DocumentLayout } from './document';

// Run ELK in a Web Worker: it is ~1.4 MB and layout can take a while on big diagrams.
const elk = new ELK({ workerUrl: elkWorkerUrl });

export function layout(diagram: Diagram): Promise<LayoutResult> {
  return layoutWith(elk, diagram);
}

export function layoutDocument(doc: Document): Promise<DocumentLayout> {
  return layoutDocumentWith(elk, doc);
}

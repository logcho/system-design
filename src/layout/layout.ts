import ELK from 'elkjs/lib/elk-api';
import elkWorkerUrl from 'elkjs/lib/elk-worker.min.js?url';
import type { Diagram } from '../dsl/types';
import { layoutWith, type LayoutResult } from './core';

export * from './core';

// Run ELK in a Web Worker: it is ~1.4 MB and layout can take a while on big diagrams.
const elk = new ELK({ workerUrl: elkWorkerUrl });

export function layout(diagram: Diagram): Promise<LayoutResult> {
  return layoutWith(elk, diagram);
}

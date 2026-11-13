import { forwardRef } from 'react';
import type { DocumentLayout } from '../layout/document';
import { DiagramSvg } from './DiagramSvg';
import { SequenceSvg } from './SequenceSvg';
import type { ThemeName } from './theme';

interface Props {
  layout: DocumentLayout;
  theme: ThemeName;
  title?: string;
  selectedLine?: number;
  onNodeClick?: (line: number) => void;
  withBackground?: boolean;
}

/** Draws any kind of Linework diagram. */
export const DocumentSvg = forwardRef<SVGSVGElement, Props>(function DocumentSvg({ layout, ...rest }, ref) {
  return layout.kind === 'flow' ? (
    <DiagramSvg ref={ref} layout={layout.layout} {...rest} />
  ) : (
    <SequenceSvg ref={ref} layout={layout.layout} {...rest} />
  );
});

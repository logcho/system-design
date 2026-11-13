import { forwardRef } from 'react';
import type { DocumentLayout } from '../layout/document';
import { DiagramSvg } from './DiagramSvg';
import { ErSvg } from './ErSvg';
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
  switch (layout.kind) {
    case 'flow':
      return <DiagramSvg ref={ref} layout={layout.layout} {...rest} />;
    case 'sequence':
      return <SequenceSvg ref={ref} layout={layout.layout} {...rest} />;
    case 'er':
      return <ErSvg ref={ref} layout={layout.layout} {...rest} />;
  }
});

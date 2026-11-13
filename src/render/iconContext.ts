import { createContext, type ReactNode } from 'react';

/**
 * How the diagram renderer draws icons. The browser lazy-loads vendor icons;
 * the MCP server preloads them before rendering to a PNG. Keeping this behind
 * a context lets DiagramSvg run in both places.
 */

export interface IconDrawProps {
  x?: number;
  y?: number;
  size: number;
  /** Stroke color for monochrome icons; vendor icons keep their own colors. */
  color: string;
  strokeWidth?: number;
}

export interface DrawableIcon {
  kind: 'generic' | 'brand';
  draw: (props: IconDrawProps) => ReactNode;
}

export type IconDrawer = (name: string | undefined) => DrawableIcon | undefined;

export const IconDrawerContext = createContext<IconDrawer>(() => undefined);

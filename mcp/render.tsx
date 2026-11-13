import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import type { ComponentType, SVGProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Resvg } from '@resvg/resvg-js';
import ELK from 'elkjs/lib/elk.bundled.js';
import { icons as lucideIcons } from 'lucide-react';
import { iconHolders, parseDocument } from '../src/dsl/document';
import type { LayoutResult, Point } from '../src/layout/core';
import { layoutDocumentWith, type DocumentLayout } from '../src/layout/document';
import { DocumentSvg } from '../src/render/DocumentSvg';
import { IconDrawerContext, type IconDrawer } from '../src/render/iconContext';
import type { ThemeName } from '../src/render/theme';
import { iconsRoot, resolveIcon } from './icons';

/**
 * Server-side rendering of a diagram to PNG, using the same layout and SVG
 * renderer as the app, so what the agent sees is what the user sees.
 */

type SvgComponent = ComponentType<SVGProps<SVGSVGElement>>;

const elk = new ELK();
const FONT_DIR = fileURLToPath(new URL('./fonts/', import.meta.url));
const FONT_FILES = ['UltraLight', 'Light', 'Regular', 'Medium', 'SemiBold'].map((w) => path.join(FONT_DIR, `Geist-${w}.ttf`));
const lucide = lucideIcons as Record<string, SvgComponent>;

const brandCache = new Map<string, SvgComponent>();
async function loadBrand(pack: string, file: string): Promise<SvgComponent> {
  const key = `${pack}/${file}`;
  let comp = brandCache.get(key);
  if (!comp) {
    comp = ((await import(pathToFileURL(path.join(iconsRoot, pack, `${file}.js`)).href)) as { default: SvgComponent }).default;
    brandCache.set(key, comp);
  }
  return comp;
}

export interface RenderOptions {
  theme?: ThemeName;
  /** Longest side of the PNG in pixels; small diagrams render at up to 2x. */
  maxSize?: number;
  /** Fixed zoom (e.g. 2 for a crisp export) instead of fitting into maxSize; capped at 8000 px. */
  scale?: number;
}

export interface RenderResult {
  png: Buffer;
  svg: string;
  /** Diagram size in CSS pixels, before scaling. */
  width: number;
  height: number;
  scale: number;
  layout: DocumentLayout;
  /** Crossing connection pairs (flow and ER diagrams; 0 for sequence diagrams). */
  crossings: number;
}

export async function renderDiagram(
  code: string,
  { theme = 'light', maxSize = 1600, scale: fixedScale }: RenderOptions = {},
): Promise<RenderResult> {
  const doc = parseDocument(code);
  const layout = await layoutDocumentWith(elk, doc);

  // Vendor icons are separate modules: load the ones this diagram uses up front,
  // because static rendering cannot wait for them.
  const loaded = new Map<string, SvgComponent>();
  for (const n of iconHolders(doc)) {
    const ref = n.icon ? resolveIcon(n.icon) : undefined;
    if (ref?.kind === 'brand' && !loaded.has(ref.name)) loaded.set(ref.name, await loadBrand(ref.pack, ref.file));
  }

  const drawIcon: IconDrawer = (name) => {
    const ref = name ? resolveIcon(name) : undefined;
    if (!ref) return undefined;
    if (ref.kind === 'generic') {
      const Icon = lucide[ref.lucide];
      return {
        kind: 'generic',
        draw: ({ x = 0, y = 0, size, color, strokeWidth = 1.75 }) => (
          <Icon x={x} y={y} width={size} height={size} color={color} stroke={color} strokeWidth={strokeWidth} />
        ),
      };
    }
    const Icon = loaded.get(ref.name)!;
    return { kind: 'brand', draw: ({ x = 0, y = 0, size }) => <Icon x={x} y={y} width={size} height={size} /> };
  };

  const svg = renderToStaticMarkup(
    <IconDrawerContext.Provider value={drawIcon}>
      <DocumentSvg layout={layout} theme={theme} title={doc.diagram.title} withBackground />
    </IconDrawerContext.Provider>,
  );

  const width = Number(/width="([\d.]+)"/.exec(svg)?.[1] ?? 0);
  const height = Number(/height="([\d.]+)"/.exec(svg)?.[1] ?? 0);
  const longest = Math.max(width, height, 1);
  const scale = fixedScale ? Math.min(fixedScale, 8000 / longest) : Math.min(2, maxSize / longest);
  const png = new Resvg(svg, {
    fitTo: { mode: 'zoom', value: scale },
    font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: 'Geist' },
  })
    .render()
    .asPng();

  const crossings = crossingsOf(layout);
  return { png, svg, width, height, scale, layout, crossings };
}

/** Pairs of connections whose lines cross: a quick measure of how tangled a layout is. */
export function countCrossings(layout: LayoutResult): number {
  return countLineCrossings(layout.edges.map((e) => ({ ends: [e.def.from, e.def.to], points: e.points })));
}

function crossingsOf(layout: DocumentLayout): number {
  if (layout.kind === 'flow') return countCrossings(layout.layout);
  if (layout.kind === 'er') {
    return countLineCrossings(layout.layout.relations.map((r) => ({ ends: [r.def.from.table, r.def.to.table], points: r.points })));
  }
  return 0;
}

/** Pairs of lines that cross; lines that share an endpoint component meet there by design. */
function countLineCrossings(lines: { ends: string[]; points: Point[] }[]): number {
  const edges = lines.map((l) => ({ ends: l.ends, segs: segments(l.points) }));
  let count = 0;
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const a = edges[i];
      const b = edges[j];
      const shared = a.ends.some((n) => b.ends.includes(n));
      if (shared) continue;
      if (a.segs.some(([p, q]) => b.segs.some(([r, s]) => intersects(p, q, r, s)))) count++;
    }
  }
  return count;
}

const segments = (pts: Point[]) => pts.slice(1).map((p, i) => [pts[i], p] as const);

function intersects(p: Point, q: Point, r: Point, s: Point): boolean {
  const d = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d1 = d(r, s, p);
  const d2 = d(r, s, q);
  const d3 = d(p, q, r);
  const d4 = d(p, q, s);
  // Strict crossing only: touching or running alongside does not count.
  return d1 * d2 < -1e-6 && d3 * d4 < -1e-6;
}

import type { ComponentType, SVGProps } from 'react';
import { createBrandCatalog, PACKS, type BrandRef, type Pack } from '../icons/catalog';

/**
 * Browser loader for vendor icons. Every icon is its own module, so a diagram
 * only downloads the icons it actually uses.
 */

export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;
type Loader = () => Promise<{ default: IconComponent }>;

const GLOBS: Record<Pack, Record<string, Loader>> = {
  aws: import.meta.glob<{ default: IconComponent }>(['/node_modules/@likec4/icons/aws/*.js', '!**/index.js']),
  azure: import.meta.glob<{ default: IconComponent }>(['/node_modules/@likec4/icons/azure/*.js', '!**/index.js']),
  gcp: import.meta.glob<{ default: IconComponent }>(['/node_modules/@likec4/icons/gcp/*.js', '!**/index.js']),
  tech: import.meta.glob<{ default: IconComponent }>(['/node_modules/@likec4/icons/tech/*.js', '!**/index.js']),
};

const fileOf = (path: string) => path.slice(path.lastIndexOf('/') + 1, -3);

const loaders = new Map<string, Loader>();
const files = {} as Record<Pack, string[]>;
for (const pack of PACKS) {
  files[pack] = [];
  for (const [path, load] of Object.entries(GLOBS[pack])) {
    files[pack].push(fileOf(path));
    loaders.set(`${pack}/${fileOf(path)}`, load);
  }
}

export const brandCatalog = createBrandCatalog(files);
export const BRAND_ICON_NAMES = brandCatalog.names;

export interface BrandIconEntry extends BrandRef {
  load: Loader;
}

export function brandEntry(ref: BrandRef): BrandIconEntry {
  return { ...ref, load: loaders.get(`${ref.pack}/${ref.file}`)! };
}

// ---- Loading cache shared by every renderer (canvas, export, help panel).

const cache = new Map<string, IconComponent>();
const inflight = new Map<string, Promise<IconComponent>>();

export function getLoadedBrandIcon(name: string): IconComponent | undefined {
  return cache.get(name);
}

export function loadBrandIcon(entry: BrandIconEntry): Promise<IconComponent> {
  const hit = cache.get(entry.name);
  if (hit) return Promise.resolve(hit);
  let p = inflight.get(entry.name);
  if (!p) {
    p = entry.load().then((m) => {
      cache.set(entry.name, m.default);
      inflight.delete(entry.name);
      return m.default;
    });
    inflight.set(entry.name, p);
  }
  return p;
}

import type { DrawableIcon, IconDrawer } from './iconContext';
import { resolveIcon } from './icons';
import { NodeIcon } from './NodeIcon';

const cache = new Map<string, DrawableIcon | undefined>();

/** Icon drawer for the app: generic icons inline, vendor icons loaded on demand. */
export const drawBrowserIcon: IconDrawer = (name) => {
  if (!name) return undefined;
  if (!cache.has(name)) {
    const icon = resolveIcon(name);
    cache.set(name, icon && { kind: icon.kind, draw: (p) => <NodeIcon icon={icon} {...p} /> });
  }
  return cache.get(name);
};

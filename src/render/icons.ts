import { icons, type LucideIcon } from 'lucide-react';
import { GENERIC_ALIASES, resolveIconRef, toKebab } from '../icons/catalog';
import { brandCatalog, brandEntry, type BrandIconEntry } from './brandIcons';

const lucide = icons as Record<string, LucideIcon>;

export type ResolvedIcon =
  | { kind: 'generic'; name: string; Icon: LucideIcon }
  | { kind: 'brand'; name: string; entry: BrandIconEntry };

/** Resolve an `icon:` value to something drawable (see resolveIconRef for the order). */
export function resolveIcon(name: string | undefined): ResolvedIcon | undefined {
  const ref = resolveIconRef(name, brandCatalog, (pascal) => pascal in lucide);
  if (!ref) return undefined;
  if (ref.kind === 'generic') return { kind: 'generic', name: ref.name, Icon: lucide[ref.lucide] };
  return { kind: 'brand', name: ref.name, entry: brandEntry(ref) };
}

export const ICON_ALIASES = Object.keys(GENERIC_ALIASES).sort();
export const ALL_ICON_NAMES = Object.keys(icons).map(toKebab).sort();

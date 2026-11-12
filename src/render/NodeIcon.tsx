import { useEffect, useState } from 'react';
import { getLoadedBrandIcon, loadBrandIcon, type BrandIconEntry } from './brandIcons';
import type { ResolvedIcon } from './icons';

interface Props {
  icon: ResolvedIcon;
  x?: number;
  y?: number;
  size: number;
  /** Stroke color for monochrome icons; vendor icons keep their own colors. */
  color: string;
  strokeWidth?: number;
}

/** Draws a resolved icon inside an SVG, loading vendor icons on demand. */
export function NodeIcon({ icon, x = 0, y = 0, size, color, strokeWidth = 1.75 }: Props) {
  if (icon.kind === 'generic') {
    const { Icon } = icon;
    return <Icon x={x} y={y} width={size} height={size} color={color} strokeWidth={strokeWidth} />;
  }
  return <BrandIcon entry={icon.entry} x={x} y={y} size={size} />;
}

function BrandIcon({ entry, x, y, size }: { entry: BrandIconEntry; x: number; y: number; size: number }) {
  const Icon = useBrandIcon(entry);
  if (!Icon) return <rect x={x} y={y} width={size} height={size} rx={size / 5} fill="currentColor" opacity={0.08} />;
  return <Icon x={x} y={y} width={size} height={size} />;
}

export function useBrandIcon(entry: BrandIconEntry) {
  const [Icon, setIcon] = useState(() => getLoadedBrandIcon(entry.name));
  useEffect(() => {
    let live = true;
    const hit = getLoadedBrandIcon(entry.name);
    if (hit) setIcon(() => hit);
    else {
      setIcon(undefined);
      loadBrandIcon(entry).then((c) => live && setIcon(() => c));
    }
    return () => {
      live = false;
    };
  }, [entry]);
  return Icon;
}

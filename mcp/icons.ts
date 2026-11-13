import { readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { icons as lucideIcons } from 'lucide-react';
import {
  BRAND_ALIAS_NAMES,
  createBrandCatalog,
  GENERIC_ALIASES,
  norm,
  PACKS,
  resolveIconRef,
  toKebab,
  type IconRef,
  type Pack,
} from '../src/icons/catalog';

/** Node-side icon catalog: same resolution rules as the browser, read from disk. */

const require = createRequire(import.meta.url);
export const iconsRoot = path.dirname(path.dirname(require.resolve('@likec4/icons/aws/lambda')));

const files = {} as Record<Pack, string[]>;
for (const pack of PACKS) {
  files[pack] = readdirSync(path.join(iconsRoot, pack))
    .filter((f) => f.endsWith('.js'))
    .map((f) => f.slice(0, -3));
}
const brand = createBrandCatalog(files);
const hasLucide = (pascal: string) => pascal in lucideIcons;

export function resolveIcon(name: string): IconRef | undefined {
  return resolveIconRef(name, brand, hasLucide);
}

export type SearchPack = Pack | 'generic';
export const PACK_LABEL: Record<SearchPack, string> = {
  aws: 'AWS',
  azure: 'Azure',
  gcp: 'Google Cloud',
  tech: 'Tech logo',
  generic: 'Generic',
};

interface Entry {
  name: string;
  pack: SearchPack;
  key: string;
  /** Key without the vendor prefix, so "lambda" matches "aws-lambda" fully. */
  bare: string;
  /** The name's words ("aws-api-gateway" → aws, api, gateway), for multi-word queries. */
  words: string[];
}

const entries: Entry[] = [];
const add = (name: string, pack: SearchPack) => {
  const key = norm(name);
  entries.push({ name, pack, key, bare: key.replace(/^(aws|azure|gcp)/, ''), words: name.toLowerCase().split(/[^a-z0-9]+/) });
};
for (const pack of PACKS) for (const name of brand.names[pack]) add(name, pack);
for (const alias of BRAND_ALIAS_NAMES) {
  const ref = brand.find(alias);
  if (ref) add(alias, ref.pack);
}
for (const alias of Object.keys(GENERIC_ALIASES)) add(alias, 'generic');
for (const pascal of Object.keys(lucideIcons)) add(toKebab(pascal), 'generic');

export const ICON_COUNTS = Object.fromEntries(
  (['aws', 'azure', 'gcp', 'tech'] as Pack[]).map((p) => [p, brand.names[p].length]),
) as Record<Pack, number>;

/** Rank icon names for a free-text query ("dynamo", "message queue", "azure sql"). */
export function searchIcons(query: string, pack?: SearchPack, limit = 15): { name: string; pack: SearchPack }[] {
  const q = norm(query);
  const tokens = query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (!q) return [];
  const seen = new Set<string>();
  const scored: { e: Entry; score: number }[] = [];
  for (const e of entries) {
    if (pack && e.pack !== pack) continue;
    let score = 0;
    if (e.key === q || e.bare === q) score = 100;
    else if (e.key.startsWith(q) || e.bare.startsWith(q)) score = 80;
    else if (e.key.includes(q)) score = 60;
    else if (tokens.length > 1 && tokens.every((t) => e.key.includes(t))) score = 40;
    else if (tokens.length > 1) {
      // Some of the words match ("websocket api", "push notification"): rank by how many
      // query words start one of the name's words, so "api" finds api-gateway, not data-pipeline.
      const hits = tokens.filter((t) => e.words.some((w) => w.startsWith(t))).length;
      if (hits) score = (30 * hits) / tokens.length;
    }
    if (!score) continue;
    scored.push({ e, score: score - e.name.length / 100 });
  }
  scored.sort((a, b) => b.score - a.score);
  const out: { name: string; pack: SearchPack }[] = [];
  for (const { e } of scored) {
    if (seen.has(e.name)) continue;
    seen.add(e.name);
    out.push({ name: e.name, pack: e.pack });
    if (out.length >= limit) break;
  }
  return out;
}

/** Close matches for a mistyped icon name, e.g. "aws-dynamo-database" → aws-dynamodb. */
export function suggestIcons(name: string, limit = 4): string[] {
  const out: string[] = [];
  const take = (hits: { name: string }[]) => {
    for (const h of hits) if (!out.includes(h.name) && out.length < limit) out.push(h.name);
  };
  take(searchIcons(name, undefined, limit));
  const words = name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const vendor = (['aws', 'azure', 'gcp'] as const).find((p) => p === words[0]);
  const rest = vendor ? words.slice(1) : words;
  // Longest runs of words first: "dynamo database", then "dynamo", "database".
  for (let len = rest.length; len >= 1 && out.length < limit; len--) {
    for (let i = 0; i + len <= rest.length && out.length < limit; i++) {
      take(searchIcons(rest.slice(i, i + len).join(' '), vendor, limit));
    }
  }
  return out;
}

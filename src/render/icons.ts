import { icons, type LucideIcon } from 'lucide-react';
import { findBrandIcon, type BrandIconEntry } from './brandIcons';

/** Friendly aliases for common system-design concepts → Lucide icon names. */
const ALIASES: Record<string, string> = {
  db: 'database',
  sql: 'database',
  nosql: 'database',
  cache: 'zap',
  queue: 'list-ordered',
  'message-queue': 'list-ordered',
  pubsub: 'radio',
  topic: 'radio',
  stream: 'activity',
  storage: 'hard-drive',
  disk: 'hard-drive',
  bucket: 'archive',
  blob: 'archive',
  cdn: 'globe',
  dns: 'globe',
  internet: 'globe',
  web: 'globe',
  browser: 'app-window',
  frontend: 'app-window',
  mobile: 'smartphone',
  phone: 'smartphone',
  desktop: 'monitor',
  client: 'monitor',
  api: 'webhook',
  gateway: 'door-open',
  'api-gateway': 'door-open',
  'load-balancer': 'split',
  lb: 'split',
  proxy: 'shuffle',
  function: 'square-function',
  serverless: 'square-function',
  service: 'server',
  microservice: 'server',
  vm: 'server',
  compute: 'cpu',
  worker: 'cog',
  job: 'cog',
  cron: 'clock',
  scheduler: 'clock',
  auth: 'key-round',
  identity: 'fingerprint',
  security: 'shield',
  firewall: 'brick-wall',
  vpc: 'shield',
  network: 'network',
  email: 'mail',
  notification: 'bell',
  push: 'bell',
  analytics: 'chart-line',
  metrics: 'gauge',
  monitoring: 'activity',
  logs: 'scroll-text',
  logging: 'scroll-text',
  search: 'search',
  ml: 'brain',
  ai: 'sparkles',
  llm: 'sparkles',
  model: 'brain',
  payment: 'credit-card',
  payments: 'credit-card',
  admin: 'user-cog',
  team: 'users',
  people: 'users',
  warehouse: 'warehouse',
  'data-warehouse': 'warehouse',
  etl: 'workflow',
  pipeline: 'workflow',
  repo: 'git-branch',
  git: 'git-branch',
  ci: 'git-pull-request',
  config: 'settings',
  secrets: 'lock',
  file: 'file',
  files: 'files',
  image: 'image',
  video: 'video',
  chat: 'message-square',
  websocket: 'radio-tower',
};

const toPascal = (s: string) =>
  s
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join('');

const lucide = (name: string): LucideIcon | undefined => (icons as Record<string, LucideIcon>)[toPascal(name)];

export type ResolvedIcon =
  | { kind: 'generic'; name: string; Icon: LucideIcon }
  | { kind: 'brand'; name: string; entry: BrandIconEntry };

const CLOUD_PREFIX = /^(aws|amazon|azure|gcp|google-cloud)[-\s]/;

/**
 * Resolve an `icon:` value. Order:
 *   1. cloud-prefixed names (aws-*, azure-*, gcp-*) → official vendor icons
 *   2. generic concept aliases (db, cache, queue...) → monochrome Lucide icons
 *   3. technology logos (postgresql, kafka, github...)
 *   4. any other Lucide icon name
 */
export function resolveIcon(name: string | undefined): ResolvedIcon | undefined {
  if (!name) return undefined;
  const key = name.trim().toLowerCase();
  if (CLOUD_PREFIX.test(key)) {
    const entry = findBrandIcon(key);
    return entry && { kind: 'brand', name: entry.name, entry };
  }
  const alias = ALIASES[key];
  if (alias) return { kind: 'generic', name: key, Icon: lucide(alias)! };
  const entry = findBrandIcon(key);
  if (entry) return { kind: 'brand', name: entry.name, entry };
  const Icon = lucide(key);
  return Icon && { kind: 'generic', name: key, Icon };
}

export const ICON_ALIASES = Object.keys(ALIASES).sort();
export const ALL_ICON_NAMES = Object.keys(icons)
  .map((n) => n.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Za-z])(\d)/g, '$1-$2').toLowerCase())
  .sort();

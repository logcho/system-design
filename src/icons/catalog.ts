/**
 * Icon name resolution, shared by the browser app and the Node MCP server.
 * Pure data and string logic: no React, no bundler features.
 *
 * Vendor icons come from @likec4/icons (MIT): official AWS / Azure / GCP
 * architecture icons and ~2,000 technology logos. Generic icons are Lucide.
 */

export type Pack = 'aws' | 'azure' | 'gcp' | 'tech';
export const PACKS: Pack[] = ['aws', 'azure', 'gcp', 'tech'];

/** Friendly aliases for common system-design concepts → Lucide icon names. */
export const GENERIC_ALIASES: Record<string, string> = {
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

/** Shorthands people actually type → canonical names. */
const BRAND_ALIASES: Record<string, string> = {
  // AWS
  'aws-s3': 'aws-simple-storage-service',
  'aws-glacier': 'aws-simple-storage-service-glacier',
  'aws-sqs': 'aws-simple-queue-service',
  'aws-sns': 'aws-simple-notification-service',
  'aws-ses': 'aws-simple-email-service',
  'aws-elb': 'aws-elastic-load-balancing',
  'aws-alb': 'aws-elastic-load-balancing',
  'aws-nlb': 'aws-elastic-load-balancing',
  'aws-load-balancer': 'aws-elastic-load-balancing',
  'aws-iam': 'aws-identity-and-access-management',
  'aws-vpc': 'aws-virtual-private-cloud',
  'aws-ecs': 'aws-elastic-container-service',
  'aws-eks': 'aws-elastic-kubernetes-service',
  'aws-ecr': 'aws-elastic-container-registry',
  'aws-ebs': 'aws-elastic-block-store',
  'aws-msk': 'aws-managed-streaming-for-apache-kafka',
  'aws-kafka': 'aws-managed-streaming-for-apache-kafka',
  'aws-mwaa': 'aws-managed-workflows-for-apache-airflow',
  'aws-airflow': 'aws-managed-workflows-for-apache-airflow',
  'aws-kms': 'aws-key-management-service',
  'aws-elasticsearch': 'aws-open-search-service',
  'aws-opensearch': 'aws-open-search-service',
  'aws-memorydb': 'aws-memory-db-for-redis',
  'aws-redis': 'aws-elasti-cache',
  'aws-sso': 'aws-iam-identity-center',
  'aws-cdk': 'aws-cloud-development-kit',
  'aws-cli': 'aws-command-line-interface',
  'aws-grafana': 'aws-managed-grafana',
  'aws-prometheus': 'aws-managed-service-for-prometheus',
  'aws-qldb': 'aws-quantum-ledger-database',
  'aws-dms': 'aws-database-migration-service',
  'aws-firehose': 'aws-kinesis-firehose',
  'aws-kinesis-streams': 'aws-kinesis-data-streams',
  // Azure
  'azure-functions': 'azure-function-apps',
  'azure-function': 'azure-function-apps',
  'azure-vm': 'azure-virtual-machine',
  'azure-app-service': 'azure-app-services',
  'azure-web-app': 'azure-app-services',
  'azure-aks': 'azure-kubernetes-services',
  'azure-kubernetes': 'azure-kubernetes-services',
  'azure-cosmos': 'azure-cosmos-db',
  'azure-cosmosdb': 'azure-cosmos-db',
  'azure-storage': 'azure-storage-accounts',
  'azure-blob': 'azure-storage-accounts',
  'azure-blob-storage': 'azure-storage-accounts',
  'azure-queue': 'azure-storage-queue',
  'azure-cdn': 'azure-front-door-and-cdn-profiles',
  'azure-front-door': 'azure-front-door-and-cdn-profiles',
  'azure-redis': 'azure-cache-redis',
  'azure-cache': 'azure-cache-redis',
  'azure-postgres': 'azure-database-postgre-sql-server',
  'azure-postgresql': 'azure-database-postgre-sql-server',
  'azure-mysql': 'azure-database-my-sql-server',
  'azure-sql-database': 'azure-sql-database',
  'azure-event-hub': 'azure-event-hubs',
  'azure-event-grid': 'azure-event-grid-topics',
  'azure-key-vault': 'azure-key-vaults',
  'azure-api-management': 'azure-api-management-services',
  'azure-apim': 'azure-api-management-services',
  'azure-vnet': 'azure-virtual-networks',
  'azure-virtual-network': 'azure-virtual-networks',
  'azure-load-balancer': 'azure-load-balancers',
  'azure-app-insights': 'azure-application-insights',
  'azure-container-apps': 'azure-container-apps-environments',
  'azure-acr': 'azure-container-registries',
  'azure-container-registry': 'azure-container-registries',
  'azure-aci': 'azure-container-instances',
  'azure-firewall': 'azure-firewalls',
  'azure-dns': 'azure-dns-zones',
  'azure-bastion': 'azure-bastions',
  'azure-logic-app': 'azure-logic-apps',
  'azure-synapse': 'azure-synapse-analytics',
  'azure-log-analytics': 'azure-log-analytics-workspaces',
  'azure-managed-identity': 'azure-managed-identities',
  'azure-traffic-manager': 'azure-traffic-manager-profiles',
  // GCP
  'gcp-gke': 'gcp-google-kubernetes-engine',
  'gcp-kubernetes': 'gcp-google-kubernetes-engine',
  'gcp-gce': 'gcp-compute-engine',
  'gcp-compute': 'gcp-compute-engine',
  'gcp-vm': 'gcp-compute-engine',
  'gcp-gcs': 'gcp-cloud-storage',
  'gcp-load-balancer': 'gcp-cloud-load-balancing',
  'gcp-lb': 'gcp-cloud-load-balancing',
  'gcp-redis': 'gcp-memorystore',
  'gcp-vertex': 'gcp-vertex-ai',
  // Tech brands
  postgres: 'postgresql',
  pg: 'postgresql',
  mongo: 'mongodb',
  k8s: 'kubernetes',
  es: 'elasticsearch',
  node: 'nodejs',
  'node.js': 'nodejs',
  golang: 'go',
  rabbit: 'rabbitmq',
};

/** Shorthand names accepted for vendor icons, e.g. "aws-s3", "postgres". */
export const BRAND_ALIAS_NAMES = Object.keys(BRAND_ALIASES);

/** Tech logo names that collide with a generic UI icon; the generic one wins. */
const PREFER_GENERIC = new Set([
  'box', 'terminal', 'square', 'moon', 'play', 'loader', 'signal', 'wifi', 'section', 'brackets',
  'baseline', 'compass', 'ampersand', 'atom', 'copyleft', 'origami', 'eraser',
]);

const PACK_PREFIX: Record<Pack, string> = { aws: 'aws-', azure: 'azure-', gcp: 'gcp-', tech: '' };

export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export const toPascal = (s: string) =>
  s
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join('');

/** "ChartLine" → "chart-line", "BarChart3" → "bar-chart-3" */
export const toKebab = (s: string) =>
  s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Za-z])(\d)/g, '$1-$2')
    .toLowerCase();

export interface BrandRef {
  /** Canonical name users write, e.g. "aws-lambda", "azure-sql", "postgresql" */
  name: string;
  pack: Pack;
  /** Module file name inside @likec4/icons/<pack>/, without ".js" */
  file: string;
}

export interface BrandCatalog {
  find(name: string): BrandRef | undefined;
  names: Record<Pack, string[]>;
}

/** Build the vendor icon index from the module file names in each pack. */
export function createBrandCatalog(files: Record<Pack, string[]>): BrandCatalog {
  const byName = new Map<string, BrandRef>();
  const byNorm = new Map<string, BrandRef>();
  const index = (key: string, ref: BrandRef) => {
    const k = norm(key);
    if (!byNorm.has(k)) byNorm.set(k, ref);
  };

  for (const pack of PACKS) {
    for (const file of files[pack]) {
      if (file === 'index') continue;
      const prefix = PACK_PREFIX[pack];
      const ref: BrandRef = { name: file.startsWith(prefix) ? file : prefix + file, pack, file };
      byName.set(ref.name, ref);
      index(ref.name, ref);
    }
  }
  // Secondary spellings, added after canonical names so they never shadow one.
  for (const ref of byName.values()) {
    if (ref.pack === 'gcp') {
      const rest = ref.name.slice(4);
      index(`google-cloud-${rest}`, ref);
      if (rest.startsWith('cloud-')) index(`gcp-${rest.slice(6)}`, ref);
    } else if (ref.pack === 'aws') {
      index(`amazon-${ref.name.slice(4)}`, ref);
    }
  }

  const names: Record<Pack, string[]> = { aws: [], azure: [], gcp: [], tech: [] };
  for (const ref of byName.values()) names[ref.pack].push(ref.name);
  for (const list of Object.values(names)) list.sort();

  return {
    names,
    find(name) {
      const key = name.trim().toLowerCase();
      if (PREFER_GENERIC.has(key)) return undefined;
      const aliased = BRAND_ALIASES[key];
      if (aliased) return byName.get(aliased) ?? byNorm.get(norm(aliased));
      return byName.get(key) ?? byNorm.get(norm(key));
    },
  };
}

export type IconRef =
  | { kind: 'generic'; name: string; lucide: string }
  | ({ kind: 'brand' } & BrandRef);

const CLOUD_PREFIX = /^(aws|amazon|azure|gcp|google-cloud)[-\s]/;

/**
 * Resolve an `icon:` value. Order:
 *   1. cloud-prefixed names (aws-*, azure-*, gcp-*) → official vendor icons
 *   2. generic concept aliases (db, cache, queue...) → monochrome Lucide icons
 *   3. technology logos (postgresql, kafka, github...)
 *   4. any other Lucide icon name
 * `hasLucide` receives a PascalCase Lucide component name.
 */
export function resolveIconRef(
  name: string | undefined,
  brand: BrandCatalog,
  hasLucide: (pascal: string) => boolean,
): IconRef | undefined {
  if (!name) return undefined;
  const key = name.trim().toLowerCase();
  if (CLOUD_PREFIX.test(key)) {
    const ref = brand.find(key);
    return ref && { kind: 'brand', ...ref };
  }
  const alias = GENERIC_ALIASES[key];
  if (alias) return { kind: 'generic', name: key, lucide: toPascal(alias) };
  const ref = brand.find(key);
  if (ref) return { kind: 'brand', ...ref };
  const pascal = toPascal(key);
  return hasLucide(pascal) ? { kind: 'generic', name: key, lucide: pascal } : undefined;
}

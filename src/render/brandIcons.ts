import type { ComponentType, SVGProps } from 'react';

/**
 * Full-color vendor icons: official AWS / Azure / GCP architecture icons and
 * ~2,000 technology logos, from @likec4/icons (MIT). Every icon is its own
 * module, so a diagram only downloads the icons it actually uses.
 */

export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;
type Loader = () => Promise<{ default: IconComponent }>;
export type Pack = 'aws' | 'azure' | 'gcp' | 'tech';

const GLOBS: Record<Pack, Record<string, Loader>> = {
  aws: import.meta.glob<{ default: IconComponent }>(['/node_modules/@likec4/icons/aws/*.js', '!**/index.js']),
  azure: import.meta.glob<{ default: IconComponent }>(['/node_modules/@likec4/icons/azure/*.js', '!**/index.js']),
  gcp: import.meta.glob<{ default: IconComponent }>(['/node_modules/@likec4/icons/gcp/*.js', '!**/index.js']),
  tech: import.meta.glob<{ default: IconComponent }>(['/node_modules/@likec4/icons/tech/*.js', '!**/index.js']),
};

export interface BrandIconEntry {
  /** Canonical name users write, e.g. "aws-lambda", "azure-sql", "postgresql" */
  name: string;
  pack: Pack;
  load: Loader;
}

/** Shorthands people actually type → canonical names. */
const ALIASES: Record<string, string> = {
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

/** Tech logo names that collide with a generic UI icon; the generic one wins. */
const PREFER_GENERIC = new Set([
  'box', 'terminal', 'square', 'moon', 'play', 'loader', 'signal', 'wifi', 'section', 'brackets',
  'baseline', 'compass', 'ampersand', 'atom', 'copyleft', 'origami', 'eraser',
]);

const PACK_PREFIX: Record<Pack, string> = { aws: 'aws-', azure: 'azure-', gcp: 'gcp-', tech: '' };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const byName = new Map<string, BrandIconEntry>();
const byNorm = new Map<string, BrandIconEntry>();
const index = (key: string, e: BrandIconEntry) => {
  const k = norm(key);
  if (!byNorm.has(k)) byNorm.set(k, e);
};

for (const pack of Object.keys(GLOBS) as Pack[]) {
  for (const [path, load] of Object.entries(GLOBS[pack])) {
    const file = path.slice(path.lastIndexOf('/') + 1, -3);
    const prefix = PACK_PREFIX[pack];
    const name = file.startsWith(prefix) ? file : prefix + file;
    const entry: BrandIconEntry = { name, pack, load };
    byName.set(name, entry);
    index(name, entry);
  }
}
// Secondary spellings, added after canonical names so they never shadow one.
for (const e of byName.values()) {
  if (e.pack === 'gcp') {
    const rest = e.name.slice(4);
    index(`google-cloud-${rest}`, e);
    if (rest.startsWith('cloud-')) index(`gcp-${rest.slice(6)}`, e);
  } else if (e.pack === 'aws') {
    index(`amazon-${e.name.slice(4)}`, e);
  }
}

/** Find a vendor icon by any reasonable spelling ("aws-dynamodb", "AWS DynamoDB", "gcp-sql"...). */
export function findBrandIcon(name: string): BrandIconEntry | undefined {
  const key = name.trim().toLowerCase();
  if (PREFER_GENERIC.has(key)) return undefined;
  const aliased = ALIASES[key];
  if (aliased) return byName.get(aliased) ?? byNorm.get(norm(aliased));
  return byName.get(key) ?? byNorm.get(norm(key));
}

export const BRAND_ICON_NAMES: Record<Pack, string[]> = { aws: [], azure: [], gcp: [], tech: [] };
for (const e of byName.values()) BRAND_ICON_NAMES[e.pack].push(e.name);
for (const list of Object.values(BRAND_ICON_NAMES)) list.sort();

export const BRAND_ALIAS_NAMES = Object.keys(ALIASES);

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

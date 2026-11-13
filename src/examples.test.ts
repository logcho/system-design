import { describe, expect, it } from 'vitest';
import { EXAMPLES } from './examples';
import { iconHolders, parseDocument } from './dsl/document';
import { resolveIcon } from './render/icons';

describe('examples', () => {
  it.each(EXAMPLES.map((e) => [e.name, e.code]))('%s parses cleanly with known icons', (_, code) => {
    const doc = parseDocument(code);
    expect(doc.diagram.errors).toEqual([]);
    const unknown = iconHolders(doc).filter((n) => n.icon && !resolveIcon(n.icon)).map((n) => n.icon);
    expect(unknown).toEqual([]);
  });
});

describe('resolveIcon', () => {
  it.each([
    ['aws-lambda', 'brand', 'aws-lambda'],
    ['aws-s3', 'brand', 'aws-simple-storage-service'],
    ['aws-dynamodb', 'brand', 'aws-dynamodb'],
    ['AWS CloudFront', 'brand', 'aws-cloud-front'],
    ['azure-functions', 'brand', 'azure-function-apps'],
    ['azure-cosmos-db', 'brand', 'azure-cosmos-db'],
    ['gcp-bigquery', 'brand', 'gcp-big-query'],
    ['gcp-sql', 'brand', 'gcp-cloud-sql'],
    ['postgres', 'brand', 'postgresql'],
    ['redis', 'brand', 'redis'],
    ['database', 'generic', 'database'],
    ['db', 'generic', 'db'],
    ['terminal', 'generic', 'terminal'],
  ])('%s → %s %s', (input, kind, name) => {
    expect(resolveIcon(input)).toMatchObject({ kind, name });
  });

  it('returns undefined for unknown names', () => {
    expect(resolveIcon('aws-not-a-service')).toBeUndefined();
    expect(resolveIcon('definitely-not-an-icon')).toBeUndefined();
  });
});

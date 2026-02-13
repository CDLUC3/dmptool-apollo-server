import { DOMParser } from '@xmldom/xmldom';
import * as xpath from 'xpath';
import { Client } from '@opensearch-project/opensearch';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// --- Configuration ---
const RE3DATA_API_BASE = process.env.RE3DATA_API_BASE || 'https://www.re3data.org/api/v1';

const DEFAULT_OPENSEARCH = {
  node: process.env.OPENSEARCH_NODE || 'http://localhost:9200',
  // index here is treated as the prefix for blue-green indices, e.g. "re3data-idx"
  index: process.env.OPENSEARCH_INDEX || 're3data-idx',
  batchSize: Number(process.env.OPENSEARCH_BATCH_SIZE || 100)
};

// Allow overrides from CLI args
const argv = yargs(hideBin(process.argv))
  .option('limit', { type: 'number', description: 'Limit number of repositories to process' })
  .option('batch-size', { type: 'number', description: 'Bulk batch size for OpenSearch' })
  .option('index', { type: 'string', description: 'OpenSearch index name prefix (e.g. re3data-idx)' })
  .option('node', { type: 'string', description: 'OpenSearch node URL' })
  .option('dry-run', { type: 'boolean', description: 'Do not index, just show what would be indexed', default: false })
  .option('verbose', { type: 'boolean', description: 'Verbose logging', default: false })
  .option('alias', { type: 'string', description: 'OpenSearch alias to swap (default: re3data)', default: process.env.OPENSEARCH_ALIAS || 're3data' })
  .help()
  .parseSync();

const OPENSEARCH_CONFIG = {
  node: argv.node || DEFAULT_OPENSEARCH.node,
  indexPrefix: argv.index || DEFAULT_OPENSEARCH.index,
  batchSize: argv['batch-size'] || DEFAULT_OPENSEARCH.batchSize
};

const ALIAS_NAME = argv.alias || process.env.OPENSEARCH_ALIAS || 're3data';

const DRY_RUN = Boolean(argv['dry-run']);
const VERBOSE = Boolean(argv.verbose);

const client = new Client({ node: OPENSEARCH_CONFIG.node });
const ns = { r3d: 'http://www.re3data.org/schema/2-2' };

const getText = (node: Node, path: string): string => {
  const select = xpath.useNamespaces(ns);
  const result = select(path, node, true) as Node;
  return result ? result.textContent || '' : '';
};

const getAllText = (node: Node, path: string): string[] => {
  const select = xpath.useNamespaces(ns);
  try {
    const results = select(path, node) as Node[];
    return results.map(n => n.textContent || '').filter(s => s.trim() !== '');
  } catch {
    return [];
  }
};

// Simple sleep
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Fetch wrapper with timeout
async function fetchWithTimeout(url: string, timeout = 30000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

// Index mapping & settings (from open-search-init.sh)
const INDEX_BODY = {
  settings: {
    index: {
      number_of_shards: 1,
      number_of_replicas: 0
    }
  },
  mappings: {
    properties: {
      id: { type: 'keyword', copy_to: 'search_all' },
      name: {
        type: 'text',
        copy_to: 'search_all',
        fields: { keyword: { type: 'keyword', ignore_above: 256 } }
      },
      description: { type: 'text', copy_to: 'search_all' },
      website: { type: 'keyword' },
      contact: { type: 'text', copy_to: 'search_all' },
      uri: { type: 'keyword' },
      types: { type: 'keyword', copy_to: 'search_all' },
      subjects: { type: 'keyword', copy_to: 'search_all' },
      provider_types: { type: 'keyword' },
      keywords: {
        type: 'text',
        copy_to: 'search_all',
        fields: { keyword: { type: 'keyword', ignore_above: 256 } }
      },
      access: { type: 'keyword' },
      pid_system: { type: 'keyword' },
      policies: { type: 'keyword' },
      upload_types: { type: 'keyword' },
      certificates: { type: 'keyword', copy_to: 'search_all' },
      software: { type: 'keyword', copy_to: 'search_all' },
      created: { type: 'date' },
      modified: { type: 'date' },
      search_all: { type: 'text' }
    }
  }
};

async function listIndicesWithPrefix(prefix: string): Promise<string[]> {
  try {
    const res = await client.cat.indices({ index: `${prefix}*`, format: 'json' });
    const body = (res && ((res as unknown) as { body?: unknown }).body) ?? res;
    if (!Array.isArray(body)) return [];
    return (body as unknown[])
      .map(row => {
        const r = row as Record<string, unknown>;
        return (r.index as string) ?? (r['i'] as string) ?? Object.values(r)[2];
      })
      .filter(Boolean) as string[];
  } catch (err) {
    if (VERBOSE) console.warn('No existing indices found or error listing indices:', err);
    return [];
  }
}

function parseIndexNumber(prefix: string, indexName: string): number | null {
  // accept both re3data-idx1 and re3data-idx-1
  const re = new RegExp(`^${prefix}-?(\\d+)$`);
  const m = indexName.match(re);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

async function determineNextIndexName(prefix: string): Promise<string> {
  const existing = await listIndicesWithPrefix(prefix);
  let max = 0;
  existing.forEach(name => {
    const n = parseIndexNumber(prefix, name);
    if (n && n > max) max = n;
  });
  const next = max + 1 || 1;
  return `${prefix}${next}`; // e.g. re3data-idx1
}

async function createIndexIfMissing(indexName: string) {
  try {
    // create index with mappings
    if (VERBOSE) console.log(`Creating index ${indexName} with mappings...`);
    const res = await client.indices.create({ index: indexName, body: (INDEX_BODY as unknown) as Record<string, unknown> });
    if (VERBOSE) console.log('Create index response:', ((res as unknown) as { body?: unknown }).body || res);
    return true;
  } catch (err: unknown) {
    // If already exists, that's ok
    const msg = err && (((err as unknown) as { body?: unknown }).body ? JSON.stringify(((err as unknown) as { body: unknown }).body) : String(err));
    if (msg && msg.includes('resource_already_exists_exception')) {
      if (VERBOSE) console.log(`Index ${indexName} already exists, proceeding.`);
      return true;
    }
    console.error('Failed to create index:', err instanceof Error ? err.message : err);
    throw err;
  }
}

async function swapAliasToNewIndex(alias: string, newIndex: string, prefix: string) {
  // find current indices for alias
  let currentIndices: string[] = [];
  try {
    const res = await client.indices.getAlias({ name: alias });
    const body = ((res as unknown) as { body?: unknown }).body ?? res;
    if (body && typeof body === 'object') {
      currentIndices = Object.keys(body as Record<string, unknown>);
    }
  } catch (err) {
    if (VERBOSE) console.log(`Alias ${alias} not found or error retrieving alias info:`, err);
    currentIndices = [];
  }

  const actions: Record<string, unknown>[] = [];
  // remove alias from current indices (but only those that match the prefix pattern)
  currentIndices.forEach(idx => {
    if (idx !== newIndex && idx.startsWith(prefix)) {
      actions.push({ remove: { index: idx, alias } });
    }
  });

  // add alias to new index
  actions.push({ add: { index: newIndex, alias } });

  if (actions.length === 0) {
    if (VERBOSE) console.log('No alias actions to perform');
    return;
  }

  if (DRY_RUN) {
    console.log('DRY-RUN: would update aliases with actions:', JSON.stringify(actions, null, 2));
    return;
  }

  if (VERBOSE) console.log('Updating alias atomically with actions:', JSON.stringify(actions));
  const r = await client.indices.updateAliases({ body: { actions } });
  if (VERBOSE) console.log('Alias update response:', ((r as unknown) as { body?: unknown }).body || r);

  // cleanup old indices that match prefix and are not the new index
  const existing = await listIndicesWithPrefix(prefix);
  const toDelete = existing.filter(n => n !== newIndex);
  for (const idx of toDelete) {
    try {
      if (VERBOSE) console.log(`Deleting old index ${idx}...`);
      const resp = await client.indices.delete({ index: idx });
      if (VERBOSE) console.log('Delete response:', ((resp as unknown) as { body?: unknown }).body || resp);
    } catch (err) {
      console.warn(`Failed to delete old index ${idx}:`, err instanceof Error ? err.message : err);
    }
  }
}

async function syncRe3Data() {
  console.log('Starting re3data -> OpenSearch sync');
  console.log(`Node version: ${process.version}`);
  console.log(`OpenSearch node: ${OPENSEARCH_CONFIG.node}, index prefix: ${OPENSEARCH_CONFIG.indexPrefix}`);
  console.log(`Batch size: ${OPENSEARCH_CONFIG.batchSize}, dry-run: ${DRY_RUN}, verbose: ${VERBOSE}`);
  console.log(`Alias to use: ${ALIAS_NAME}`);

  try {
    // Determine the blue-green new index name and create it
    const newIndexName = await determineNextIndexName(OPENSEARCH_CONFIG.indexPrefix);
    console.log(`Selected new index name: ${newIndexName}`);
    if (DRY_RUN) {
      console.log('DRY-RUN: skipping creation of new index');
    } else {
      await createIndexIfMissing(newIndexName);
    }

    console.log('Fetching repository list...');

    const listResponse = await fetchWithTimeout(`${RE3DATA_API_BASE}/repositories`);
    if (!listResponse) throw new Error('No response when fetching repository list');
    if (!listResponse.ok) {
      const txt = await listResponse.text().catch(() => '');
      throw new Error(`Failed to fetch repository list. HTTP ${listResponse.status} - ${txt}`);
    }

    const listXml = await listResponse.text();

    const doc = new DOMParser().parseFromString(listXml);
    const repoNodes = xpath.select("//repository/id", doc) as Node[];
    const repoIds = repoNodes.map(n => n.textContent).filter(Boolean) as string[];

    console.log(`Found ${repoIds.length} repositories. Starting bulk sync...`);

    if (argv.limit) {
      console.log(`Limiting to first ${argv.limit} repositories as requested`);
      repoIds.splice(argv.limit);
    }

    let currentBatch: unknown[] = [];
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < repoIds.length; i++) {
      const id = repoIds[i];

      try {
        if (VERBOSE) console.log(`[${i + 1}/${repoIds.length}] Fetching details for ${id}...`);
        const detailResponse = await fetchWithTimeout(`${RE3DATA_API_BASE}/repository/${encodeURIComponent(id)}`);
        if (!detailResponse) {
          console.warn(`No response for ${id}`);
          failedCount++;
          continue;
        }
        if (!detailResponse.ok) {
          console.warn(`Non-OK response for ${id}: ${detailResponse.status}`);
          failedCount++;
          continue;
        }
        const detailXml = await detailResponse.text();

        const repoDoc = new DOMParser().parseFromString(detailXml);

        const repositoryData = {
          id: id,
          name: getText(repoDoc, "//r3d:repository/r3d:repositoryName"),
          description: getText(repoDoc, "//r3d:repository/r3d:description"),
          website: getText(repoDoc, "//r3d:repository/r3d:repositoryURL"),
          contact: getText(repoDoc, "//r3d:repository/r3d:repositoryContact"),
          uri: `https://www.re3data.org/repository/${id}`,

          types: getAllText(repoDoc, "//r3d:repository/r3d:type"),
          // Normalize subjects: remove any leading numbers and whitespace (e.g. "3 Natural Sciences" -> "Natural Sciences")
          subjects: getAllText(repoDoc, "//r3d:repository/r3d:subject")
            .map(s => s.replace(/^\s*\d+\s*/, '').trim())
            .filter(s => s !== ''),

          provider_types: getAllText(repoDoc, "//r3d:repository/r3d:providerType"),
          keywords: getAllText(repoDoc, "//r3d:repository/r3d:keyword"),

          access: (() => {
            const type = getText(repoDoc, "//r3d:repository/r3d:databaseAccess/r3d:databaseAccessType");
            const restrictions = getAllText(repoDoc, "//r3d:repository/r3d:databaseAccess/r3d:databaseAccessRestriction");
            return restrictions.length > 0 ? `${type} (${restrictions.join(', ')})` : type;
          })(),
          pid_system: getAllText(repoDoc, "//r3d:repository/r3d:pidSystem"),
          policies: getAllText(repoDoc, "//r3d:repository/r3d:policy/r3d:policyName"),
          upload_types: getAllText(repoDoc, "//r3d:repository/r3d:dataUpload/r3d:dataUploadType"),

          certificates: getAllText(repoDoc, "//r3d:repository/r3d:certificate"),
          software: getAllText(repoDoc, "//r3d:repository/r3d:software/r3d:softwareName"),

          created: new Date().toISOString(),
          modified: new Date().toISOString()
        };

        if (VERBOSE) console.log('Prepared document:', repositoryData.id, repositoryData.name || '(no name)');

        if (!DRY_RUN) {
          currentBatch.push({ index: { _index: newIndexName, _id: id } });
          currentBatch.push(repositoryData);
        }

        successCount++;

        // flush batch when reached
        if ((currentBatch.length / 2) >= OPENSEARCH_CONFIG.batchSize || i === repoIds.length - 1) {
          if (DRY_RUN) {
            console.log(`DRY-RUN: would index ${currentBatch.length / 2} documents (batch ending at ${i + 1}/${repoIds.length})`);
            currentBatch = [];
          } else if (currentBatch.length > 0) {
            if (VERBOSE) console.log(`Indexing batch ending at ${i + 1}/${repoIds.length} (${currentBatch.length / 2} docs)`);
            const result = await client.bulk({ body: currentBatch });

            // OpenSearch client response structure may vary; prefer checking .body
            interface BulkResponse { items?: unknown[]; errors?: boolean }
            const resBody = ((result as unknown) as { body?: BulkResponse }).body ?? (result as unknown as BulkResponse);
            const items = (resBody && typeof resBody === 'object' && Array.isArray((resBody as BulkResponse).items) ? (resBody as BulkResponse).items as unknown[] : []);
            if (VERBOSE) console.log('Bulk response status:', Array.isArray(items) ? `${items.length} items` : JSON.stringify(resBody).slice(0, 200));
            if (resBody && typeof resBody === 'object' && (resBody as BulkResponse).errors) {
              console.error('Bulk indexing reported errors');
              const errored = items
                .map((it, idx) => ({ it, idx }))
                .filter(x => {
                  const op = Object.values(x.it as Record<string, unknown>)[0] as Record<string, unknown> | undefined;
                  return !!(op && 'error' in op);
                });
              console.error(`Bulk errors count: ${errored.length}`);
              errored.slice(0, 10).forEach(e => {
                const op = Object.values(e.it as Record<string, unknown>)[0] as Record<string, unknown> | undefined;
                console.error('Item error:', { id: op ? (op['_id'] ?? null) : null, error: op ? (op['error'] ?? null) : null });
              });
            } else if (VERBOSE) {
              console.log('Bulk index successful for this batch');
            }

            currentBatch = [];
          }
        }

        // be polite to the API
        await sleep(100);

      } catch (err) {
        console.error(`Error processing repo ${id}:`, err instanceof Error ? err.message : err);
        failedCount++;
      }
    }

    console.log(`Sync complete! Successes: ${successCount}, Failures: ${failedCount}`);

    // After successful indexing, swap alias and remove old indices
    try {
      await swapAliasToNewIndex(ALIAS_NAME, newIndexName, OPENSEARCH_CONFIG.indexPrefix);
      console.log(`Alias ${ALIAS_NAME} now points to ${newIndexName}. Old indices cleaned up.`);
    } catch (err) {
      console.error('Failed to swap alias or cleanup old indices:', err instanceof Error ? err.message : err);
      throw err;
    }

  } catch (error) {
    console.error('Critical error in sync process:', error instanceof Error ? error.message : error);
    throw error;
  }
}

// Run and ensure node process doesn't exit before async work completes
(async () => {
  try {
    await syncRe3Data();
    console.log('Script finished normally.');
    // explicit exit to ensure consistent CLI behavior
    process.exit(0);
  } catch {
    console.error('Script finished with errors. See logs above.');
    process.exit(1);
  }
})();

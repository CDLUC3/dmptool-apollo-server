import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { XMLParser } from 'fast-xml-parser';
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

const ALIAS_NAME: string = argv.alias || process.env.OPENSEARCH_ALIAS || 're3data';
const REPOSITORY_LIMIT: number | undefined = argv.limit
  ? Number(argv.limit) || Number(process.env.REPOSITORY_LIMIT)
  : process.env.REPOSITORY_LIMIT ? Number(process.env.REPOSITORY_LIMIT) : undefined;

const OPENSEARCH_CONFIG = {
  node: argv.node || DEFAULT_OPENSEARCH.node,
  indexPrefix: argv.index || DEFAULT_OPENSEARCH.index,
  batchSize: argv['batch-size'] || DEFAULT_OPENSEARCH.batchSize
};

const client = new Client({
  ...AwsSigv4Signer({
    region: 'us-west-2',
    service: 'aoss', // OpenSearch Serverless
    getCredentials: fromNodeProviderChain(),
  }),
  node: OPENSEARCH_CONFIG.node,
});

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true, // Simplifies keys (r3d:repositoryName becomes repositoryName)
});

// Simple sleep function because we don't want to aggressively poll the API
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Helper to ensure we always get an array from XML fields
 * (fast-xml-parser returns a single object if only one element exists)
 */
const ensureArray = (val: unknown): unknown[] => {
  if (val === undefined || val === null) return [];
  return Array.isArray(val) ? val : [val];
};

/**
 * Helper to extract text from fast-xml-parser nodes
 * which might be strings or objects with #text
 */
const getVal = (node: unknown): string => {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  return node['#text'] || '';
};

async function syncRe3Data(): Promise<void> {
  console.log(`Starting sync to ${OPENSEARCH_CONFIG.node}`);

  try {
    // Get Repo List
    const listRes = await fetch(`${RE3DATA_API_BASE}/repositories`);
    const listXml = await listRes.text();
    const listObj = parser.parse(listXml) as Record<string, unknown>;
    const list = listObj.list as Record<string, unknown> | undefined;
    const listRepo = list.repository as Record<string, unknown>[] | undefined;

    // Adjusting based on re3data API structure
    let repoIds = ensureArray(listRepo).map((r: Record<string, unknown>)  => r.id);

    if (REPOSITORY_LIMIT) repoIds = repoIds.slice(0, REPOSITORY_LIMIT);
    console.log(`Found ${repoIds.length} repositories to process.`);

    // Prepare the Index
    const newIndexName = `${OPENSEARCH_CONFIG.indexPrefix}-${Date.now()}`;
    await client.indices.create({
      index: newIndexName,
      body: {
        mappings: {
          properties: {
            id: { type: 'keyword' },
            name: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            subjects: { type: 'keyword' },
            uri: { type: 'keyword' },
            repositoryTypes: { type: 'keyword' },
            created: { type: 'date' },
            modified: { type: 'date' },
            synDate: { type: 'date' },
          }
        }
      }
    });

    // Process & Index the Repositories
    let currentBatch: Record<string, unknown>[] = [];
    let successCount = 0;

    for (let i = 0; i < repoIds.length; i++) {
      const id: unknown = repoIds[i];
      try {
        const detailRes: Response = await fetch(`${RE3DATA_API_BASE}/repository/${id}`);
        const detailXml: string = await detailRes.text();
        const detailObj = parser.parse(detailXml) as Record<string, unknown>;
        const re3data = detailObj.re3data as Record<string, unknown> | undefined;
        const r = re3data?.repository as Record<string, unknown> | undefined;

        if (!r) {
          // If the root isn't 're3data', try just 'repository' (sometimes happens
          // with fast-xml-parser NSPrefix removal)
          const fallbackR: unknown = detailObj.repository;
          if (!fallbackR) {
            console.error(`[${id}] Could not find repository root in XML`);
            continue;
          }
        }

        const doc = {
          id: id,
          name: getVal(r.repositoryName),
          description: getVal(r.description),
          website: getVal(r.repositoryURL),
          contact: getVal(r.repositoryContact),
          uri: `https://www.re3data.org/repository/${id}`,
          repositoryTypes: ensureArray(r.type).map((t: unknown): string => getVal(t)),
          subjects: ensureArray(r.subject).map((s: unknown): string =>
            getVal(s).replace(/^\s*\d+\s*/, '').trim()
          ),
          provider_types: ensureArray(r.providerType).map((k: unknown): string => getVal(k)),
          keywords: ensureArray(r.keyword).map((k: unknown): string => getVal(k)),
          access: ensureArray(r.databaseAccess).map((a: Record<string, unknown>): string => {
            const restrictions = ensureArray(a.databaseAccessRestriction).map(r => getVal(r));
            return `${getVal(a.databaseAccessType)} (${restrictions.join(', ')})`
            }),
          pid_system: ensureArray(r.pidSystem).map((ps: unknown): string => getVal(ps)),
          policies: ensureArray(r.policy).map((p: Record<string, unknown>): string => getVal(p.policyName)),
          upload_types: ensureArray(r.dataUpload).map((u: Record<string, unknown>): string => getVal(u.dataUploadType)),
          certificates: ensureArray(r.certificate).map((c: unknown): string => getVal(c)),
          software: ensureArray(r.software).map((s: Record<string, unknown>): string => getVal(s.softwareName)),
          created: getVal(r.entryDate) as string,
          modified: getVal(r.lastUpdate) as string,
          synDate: new Date().toISOString(),
        };

        console.log(`Indexing ${id} - ${doc.name} ...`);
        // console.log(doc)

        currentBatch.push({ index: { _index: newIndexName, _id: id } });
        currentBatch.push(doc);

        if (currentBatch.length / 2 >= argv['batch-size'] || i === repoIds.length - 1) {
          const { body } = await client.bulk({ body: currentBatch });
          if (!body.errors) {
            successCount += (currentBatch.length / 2);
            if (argv.verbose) console.log(`Indexed batch: ${successCount}/${repoIds.length}`);
          } else {
            console.error("Bulk errors detected in batch.");
          }
          currentBatch = [];
        }

        await sleep(200); // Rate limiting
      } catch (err) {
        console.error(`Failed to process ${id}:`, err);
      }
    }

    // Alias Swap
    console.log(`Sync complete. Swapping alias ${ALIAS_NAME} to ${newIndexName}`);

    // Check if alias exists to avoid 404 error on removal
    const aliasExists = await client.indices.existsAlias({ name: ALIAS_NAME });

    const actions: unknown[] = [{ add: { index: newIndexName, alias: ALIAS_NAME } }];
    if (aliasExists) {
      actions.unshift({ remove: {index: `${OPENSEARCH_CONFIG.indexPrefix}-*`, alias: ALIAS_NAME } });
    }

    await client.indices.updateAliases({ body: { actions } });
    console.log("Alias updated successfully.");

  } catch (error) {
    console.error("Critical Failure:", error);
    process.exit(1);
  }
}

syncRe3Data();

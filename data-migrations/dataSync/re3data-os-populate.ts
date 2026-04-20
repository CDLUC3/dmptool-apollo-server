import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { XMLParser } from 'fast-xml-parser';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// --- Configuration ---
const RE3DATA_API_BASE = process.env.RE3DATA_API_BASE || 'https://www.re3data.org/api/v1';

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

const client = new Client({
  ...AwsSigv4Signer({
    region: 'us-west-2',
    service: 'aoss', // OpenSearch Serverless
    getCredentials: fromNodeProviderChain(),
  }),
  node: argv.node,
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
const ensureArray = (val: any) => {
  if (val === undefined || val === null) return [];
  return Array.isArray(val) ? val : [val];
};

async function syncRe3Data() {
  console.log(`Starting sync to ${argv.node}`);

  try {
    // Get Repo List
    const listRes = await fetch(`${RE3DATA_API_BASE}/repositories`);
    const listXml = await listRes.text();
    const listObj = parser.parse(listXml);

    // Adjusting based on re3data API structure
    let repoIds = ensureArray(listObj.repositories?.repository).map(r => r.id);

    if (argv.limit) repoIds = repoIds.slice(0, argv.limit);
    console.log(`Found ${repoIds.length} repositories to process.`);

    // Prepare the Index
    const newIndexName = `${argv.index}-${Date.now()}`;
    await client.indices.create({
      index: newIndexName,
      body: {
        mappings: {
          properties: {
            id: { type: 'keyword' },
            name: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            subjects: { type: 'keyword' },
            created: { type: 'date' }
          }
        }
      }
    });

    // Process & Index the Repositories
    let currentBatch: any[] = [];
    let successCount = 0;

    for (let i = 0; i < repoIds.length; i++) {
      const id = repoIds[i];
      try {
        const detailRes = await fetch(`${RE3DATA_API_BASE}/repository/${id}`);
        const detailXml = await detailRes.text();
        const detailObj = parser.parse(detailXml);
        const r = detailObj.repository; // Root element

        const doc = {
          id: id,
          name: r.repositoryName,
          description: r.description,
          website: r.repositoryURL,
          contact: r.repositoryContact,
          uri: `https://www.re3data.org/repository/${id}`,
          repositoryTypes: ensureArray(r.type),
          subjects: ensureArray(r.subject).map((s: any) =>
            (typeof s === 'string' ? s : s['#text'] || '').replace(/^\s*\d+\s*/, '').trim()
          ),
          provider_types: ensureArray(r.providerType),
          keywords: ensureArray(r.keyword),
          access: ensureArray(r.databaseAccess).map((a: any) =>
            `${a.databaseAccessType} (${a.databaseAccessRestriction.join(', ')})`
          ),
          pid_system: ensureArray(r.pidSystem),
          policies: ensureArray(r.policy).map((p: any) => p.policyName),
          upload_types: ensureArray(r.dataUpload).map((u: any) => u.dataUploadType),
          certificates: ensureArray(r.certificate),
          software: ensureArray(r.software).map((s: any) => s.softwareName),
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
          synDate: new Date().toISOString(),
        };

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
    console.log(`Sync complete. Swapping alias ${argv.alias} to ${newIndexName}`);

    // Check if alias exists to avoid 404 error on removal
    const aliasExists = await client.indices.existsAlias({ name: argv.alias });

    const actions: any[] = [{ add: {index: newIndexName, alias: argv.alias } }];
    if (aliasExists) {
      actions.unshift({ remove: {index: `${argv.index}-*`, alias: argv.alias } });
    }

    await client.indices.updateAliases({body: { actions }});
    console.log("Alias updated successfully.");

  } catch (error) {
    console.error("Critical Failure:", error);
    process.exit(1);
  }
}

syncRe3Data();

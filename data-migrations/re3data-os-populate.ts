import { DOMParser } from 'xmldom';
import * as xpath from 'xpath';
import { Client } from '@opensearch-project/opensearch';

// --- Configuration ---
const RE3DATA_API_BASE = 'https://www.re3data.org/api/v1';
const OPENSEARCH_CONFIG = {
  node: 'http://localhost:9200',
  index: 're3data_repositories',
  batchSize: 100
};

const client = new Client({ node: OPENSEARCH_CONFIG.node });
const ns = { r3d: 'http://www.re3data.org/schema/2-2' };

const getText = (node: Node, path: string): string => {
  const select = xpath.useNamespaces(ns);
  const result = select(path, node, true) as Node;
  return result ? result.textContent || '' : '';
};

async function syncRe3Data() {
  try {
    console.log("Fetching repository list...");

    const listResponse = await fetch(`${RE3DATA_API_BASE}/repositories`);
    if (!listResponse.ok) throw new Error(`HTTP error! status: ${listResponse.status}`);
    const listXml = await listResponse.text();

    const doc = new DOMParser().parseFromString(listXml);
    const repoNodes = xpath.select("//repository/id", doc) as Node[];
    const repoIds = repoNodes.map(n => n.textContent).filter(Boolean) as string[];

    console.log(`Found ${repoIds.length} repositories. Starting bulk sync...`);

    let currentBatch: any[] = [];

    for (let i = 0; i < repoIds.length; i++) {
      const id = repoIds[i];

      try {
        const detailResponse = await fetch(`${RE3DATA_API_BASE}/repository/${id}`);
        if (!detailResponse.ok) continue;
        const detailXml = await detailResponse.text();

        const repoDoc = new DOMParser().parseFromString(detailXml);

        const repositoryData = {
          id: id,
          name: getText(repoDoc, "//r3d:repositoryName"),
          // additional_names: (xpath.select("//r3d:additionalName", repoDoc) as Node[]).map(n => n.textContent),
          uri: getText(repoDoc, "//r3d:repositoryURL"),
          description: getText(repoDoc, "//r3d:description"),
          doi: getText(repoDoc, "//r3d:repositoryIdentifier[@repositoryIdentifierType='DOI']"),
          provider_types: (xpath.select("//r3d:providerType", repoDoc) as Node[]).map(n => n.textContent),
          subjects: (xpath.select("//r3d:subject", repoDoc) as Node[]).map(n => n.textContent),
          keywords: (xpath.select("//r3d:keyword", repoDoc) as Node[]).map(n => n.textContent),
          updated_at: new Date().toISOString()
        };

        currentBatch.push({ index: { _index: OPENSEARCH_CONFIG.index, _id: id } });
        currentBatch.push(repositoryData);

        if (currentBatch.length / 2 >= OPENSEARCH_CONFIG.batchSize || i === repoIds.length - 1) {
          const result = await client.bulk({ body: currentBatch });
          console.log(`Indexed batch ending at ${i + 1}/${repoIds.length}`);
          currentBatch = [];
        }

      } catch (err) {
        console.error(`Error processing repo ${id}:`, err);
      }
    }

    console.log("Sync complete!");
  } catch (error) {
    console.error("Critical error in sync process:", error);
  }
}

syncRe3Data();

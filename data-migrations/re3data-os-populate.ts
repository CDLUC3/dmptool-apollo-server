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

// Helper to get multiple values as an array (for keywords, subjects, etc.)
const getAllText = (node: Node, path: string): string[] => {
  const select = xpath.useNamespaces(ns);
  const results = select(path, node) as Node[];
  return results.map(n => n.textContent || '').filter(s => s.trim() !== '');
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
          // Mapping to your specific OpenSearch schema
          id: id,
          name: getText(repoDoc, "//r3d:repositoryName"),
          description: getText(repoDoc, "//r3d:description"),
          homepage: getText(repoDoc, "//r3d:repositoryURL"),
          contact: getText(repoDoc, "//r3d:repositoryContact"),
          uri: getText(repoDoc, "//r3d:repositoryIdentifier"),

          // Array types for multi-value keywords/subjects
          types: getAllText(repoDoc, "//r3d:type"),
          subjects: getAllText(repoDoc, "//r3d:subject"),
          provider_types: getAllText(repoDoc, "//r3d:providerType"),
          keywords: getAllText(repoDoc, "//r3d:keyword"),

          // New specific fields from XML attributes/nested tags
          // 1. Access: Combine Type and Restrictions (e.g., "restricted (registration)")
          access: (() => {
            const type = getText(repoDoc, "//r3d:databaseAccess/r3d:databaseAccessType");
            const restrictions = getAllText(repoDoc, "//r3d:databaseAccess/r3d:databaseAccessRestriction");
            return restrictions.length > 0 ? `${type} (${restrictions.join(', ')})` : type;
          })(),
          pid_system: getAllText(repoDoc, "//r3d:pidSystem"),
          policies: getAllText(repoDoc, "//r3d:policy/r3d:policyName"),
          upload_types: getAllText(repoDoc, "//r3d:dataUpload/r3d:dataUploadType"),

          // Extract certificates (e.g., CoreTrustSeal, WDS)
          certificates: getAllText(repoDoc, "//r3d:certificate"),

          // Extract software (e.g., DataVerse, DSpace, CKAN)
          software: getAllText(repoDoc, "//r3d:software/r3d:softwareName"),

          // Dates
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()

          // Note: 'search_all' is handled by OpenSearch server-side via copy_to,
          // so we don't need to send it in the JSON payload.
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

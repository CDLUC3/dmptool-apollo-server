import { Client, ClientOptions } from "@opensearch-project/opensearch";
import { AwsSigv4Signer } from "@opensearch-project/opensearch/aws";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import {
  Property
} from "@opensearch-project/opensearch/api/_types/_common.mapping";
import {
  Delete_Response,
  Search_Response,
  Update_Response
} from "@opensearch-project/opensearch/api";
import { Hit } from "@opensearch-project/opensearch/api/_types/_core.search";

export interface OpenSearchServerlessConfig {
  node: string;
}

export interface OpenSearchConfig {
  host: string;
  port: number;
  useSSL: boolean;
  verifyCerts: boolean;
  authType: 'aws' | 'basic' | null;
  username: string | null;
  password: string | null;
  awsRegion: string | null;
  awsService: 'es' | 'aoss' | null;
}

export function createOpenSearchServerlessClient(config: OpenSearchServerlessConfig): Client {
  return new Client({
    ...AwsSigv4Signer({
      region: 'us-west-2',
      service: 'aoss', // OpenSearch Serverless
      getCredentials: fromNodeProviderChain(),
    }),
    node: config.node,
  });
}

export function createOpenSearchClient(config: OpenSearchConfig): Client {
  const protocol = config.useSSL ? 'https:' : 'http:';
  const url = new URL(`${protocol}//${config.host}:${config.port}`);

  const clientOptions: ClientOptions = {
    node: url.toString(),
    ssl: {
      rejectUnauthorized: config.verifyCerts,
    },
    compression: 'gzip',
  };

  if (config.authType === 'aws') {
    // Validation for AWS
    if (!config.awsRegion || !config.awsService) {
      throw new Error("AWS authentication requires 'awsRegion' and 'awsService' to be defined.");
    }

    Object.assign(
      clientOptions,
      AwsSigv4Signer({
        region: config.awsRegion,
        service: config.awsService,
        getCredentials: fromNodeProviderChain(),
      }),
    );
  } else if (config.authType === 'basic') {
    // Validation for Basic Auth
    if (!config.username || !config.password) {
      throw new Error("Basic authentication requires 'username' and 'password' to be defined.");
    }

    clientOptions.auth = {
      username: config.username,
      password: config.password,
    };
  }

  return new Client(clientOptions);
}

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
  'to', 'was', 'were', 'will', 'with', 'or', 'this', 'but', 'they'
]);

/**
 * Clean, tokenize, and remove stop words from input text fields.
 */
export const tokenizeText = (
  text: string | null | undefined,
  minWordLength = 2
): string[] => {
  if (!text) return [];

  return text.toLowerCase()
    // Strip punctuation, keeping alphanumeric characters and spaces
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .split(/\s+/)
    .filter((word: string): boolean => word.length >= minWordLength && !STOP_WORDS.has(word));
}

// Recursive Type Definitions to assist with TypeScript support
type SnakeToCamelCase<S extends string> = S extends `${infer T}_${infer U}`
  ? `${Lowercase<T>}${Capitalize<SnakeToCamelCase<U>>}`
  : Lowercase<S>;

export type DeepCamelCase<T> = T extends (infer U)[]
  ? (DeepCamelCase<U>)[]
  : T extends object
    ? { [K in keyof T as SnakeToCamelCase<string & K>]: DeepCamelCase<T[K]> }
    : T;

type CamelToSnakeCase<S extends string> = S extends `${infer T}${infer U}`
  ? U extends Uncapitalize<U>
    ? `${Lowercase<T>}${CamelToSnakeCase<U>}`
    : `${Lowercase<T>}_${CamelToSnakeCase<Uncapitalize<U>>}`
  : S;

export type DeepSnakeCase<T> = T extends (infer U)[]
  ? (DeepSnakeCase<U>)[]
  : T extends object
    ? { [K in keyof T as CamelToSnakeCase<string & K>]: DeepSnakeCase<T[K]> }
    : T;

/**
 * OpenSearch uses snake case for item keys but the app uses camel case. This
 * function converts an object from snake to camel case
 *
 * @param obj the index item with its snake case keys
 * @returns the index item with its keys in camel case format
 */
const camelizeKeys = <T>(obj: T): DeepCamelCase<T> => {
  if (Array.isArray(obj)) {
    return obj.map((v) => camelizeKeys(v)) as DeepCamelCase<T>;
  } else if (obj !== null && obj !== undefined && typeof obj === "object" && obj.constructor === Object) {
    return Object.keys(obj).reduce((result, key) => {
      const camelKey = key.toLowerCase().replace(/_([a-z0-9])/g, (_, m) => m.toUpperCase());
      result[camelKey] = camelizeKeys((obj as DeepCamelCase<T>)[key]);
      return result;
    }, {} as DeepCamelCase<T>);
  }
  return obj as DeepCamelCase<T>;
}

/**
 * OpenSearch uses snake case for item keys but the app uses camel case. This
 * function converts an object from camel to snake case
 *
 * @param obj the item with its camel case keys
 * @returns the item with its keys in snake case format for OpenSearch
 */
const snakeizeKeys = <T>(obj: T): DeepSnakeCase<T> => {
  if (Array.isArray(obj)) {
    return obj.map((v) => snakeizeKeys(v)) as DeepSnakeCase<T>;
  } else if (obj !== null && obj !== undefined && obj.constructor === Object) {
    return Object.keys(obj).reduce((result, key) => {
      const snakeKey = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
      result[snakeKey] = snakeizeKeys((obj as DeepSnakeCase<T>)[key]);
      return result;
    }, {} as DeepSnakeCase<T>);
  }
  return obj as DeepSnakeCase<T>;
}

/**
 * The index names we currently support
 */
// export const REPOSITORY_IDX = 're3data';

/**
 * The structure of the Repositories index
 */
/*const REPOSITORY_IDX_PROPERTY_DEFINITION: Record<string, Property> = {
  id: { type: 'keyword' },
  name: { type: 'text', fields: { keyword: { type: 'keyword' } } },
  subjects: { type: 'keyword' },
  uri: { type: 'keyword' },
  repositoryTypes: { type: 'keyword' },
  created: { type: 'date' },
  modified: { type: 'date' },
  synDate: { type: 'date' },
};
*/
/**
 * Generic index item
 */
/*
interface IndexItemInterface {
  _id: string;
  created: string;
  modified: string;
}
*/
/**
 * The shape of a repository record within the index
 */
/*
interface RepositoryIndexItemInterface extends IndexItemInterface {
  repository_id: string;
  name: string;
  description?: string;
}

export interface DmpFundingDocumentFragment {
  name: string;
  funding_status: string;
  id?: string;
  acronym?: string;
  aliases: string[];
  grant_id?: string;
  funding_project_id?: string;
  opportunity_id?: string;
}

export interface DmpRepositoryDocumentFragment {
  id?: string;
  name: string;
  url?: string;
}

export interface DmpInstitutionDocumentFragment {
  id?: string;
  name: string;
  acronym?: string;
}

export interface DmpContributorDocumentFragment {
  orcid?: string;
  affiliation_name?: string;
  affiliation_id?: string;
  given_name?: string;
  surname?: string;
  middle_initials?: number;
  full_name?: string;
}
*/
/*
export interface DmpSearchDocument {
  dmp_id: string;
  title: string;
  project_title?: string;
  visibility: string;
  project_start?: string;
  project_end?: string;
  output_formats?: string[];           // We don't support this yet, but here to support RDA API spec

  // Timestamps & Sorting
  created: string;
  modified: string;
  registered?: string;

  // Identifier arrays
  contact_ids?: string[];
  contributor_ids?: string[];
  institution_ids?: string[];
  funder_ids?: string[];
  grant_ids?: string[];
  opportunity_ids?: string[];
  funder_project_ids?: string[];
  dataset_ids?: string[];              // We don't support this yet, but here to support RDA API spec
  repository_ids?: string[];
  metadata_standard_ids?: string[];
  license_ids?: string[];
  alternate_identifier_ids?: string[];
  related_identifier_ids?: string[];

  // Faceting support: Fields containing the official/primary terms for faceting.
  //                   For example: ["National Institutes of Health"]
  funding_facets: string[];
  institutions_facets?: string[];
  repositories_facets: string[];
  language: string;
  status: string;
  is_test: boolean;
  featured: boolean;
  research_domain: string;
  funding_status?: string[];
  personal_data?: string[];
  sensitive_data?: string[];
  data_access?: string[];

  // Search support: Fields containing all variations to support user entered
  //                 search terms. For example: ["USGS", "US Geological Survey",
  //                                             "United States Geological Survey"]
  titles: string[];
  abstract?: string;
  tags?: string[];
  funding_search: string[];
  contributors_search: string[];
  institutions_search: string[];
  repositories_search: string[];

  // Objects containing information about a subject area to support UI display
  contributors_display?: DmpContributorDocumentFragment[];
  funding_display: DmpFundingDocumentFragment[];
  institutions_display?: DmpInstitutionDocumentFragment[];
  repositories_display?: DmpRepositoryDocumentFragment[];
}
 */

/**
 * The Shape of a DMP record within the index
 */
/*
export interface DmpIndexItemInterface extends IndexItemInterface {
  dmp_id: string;
  project_id: number;
  plan_id: number;
  versioned_template_id: number

  registered?: string;

  title: string[];
  abstract?: string;
  project_start?: string;
  project_end?: string;
  research_domain?: string;
  visibility?: string;
  status?: string;
  isTest: boolean;
  featured: boolean;
  tags?: string[];

  institutions?: string[];
  institution_ids?: string[];
  contributors?: {
    full_name: string;
    given_name?: string;
    surname?: string;
    first_initial?: string;
    middle_initials?: string;
  };
  contributor_ids?: string[];
  funders?: string[];
  funder_ids?: string[];
  repositories?: string[];
  repository_ids?: string[];
  published_outputs?: string[];
  published_output_ids?: string[];

  funding?: {
    funder: string;
    funder_id?: string;
    status: string;
    grant_ids?: string[];
    opportunity_ids?: string[];
    project_ids?: string[];
  }[]
}
*/

/**
 * The shape of an index item returned by a search
 */
export interface IndexSearchItemInterface {
  _id: string;
  fields: Record<string, unknown>;
}

/**
 * The shape of an index search response
 */
export interface IndexSearchResponseInterface {
  total: number;
  items: IndexSearchItemInterface[];
}

/**
 * Custom error for the OpenSearch data source
 */
export class OpenSearchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenSearchError';
  }
}

/**
 * An OpenSearch data source
 */
export class OpenSearch {
  private client: Client;
  private indices: string[];

  constructor(config: OpenSearchConfig | OpenSearchServerlessConfig) {
    this.indices = [];
    this.client = ('node' in config)
      ? createOpenSearchServerlessClient(config as OpenSearchServerlessConfig)
      : createOpenSearchClient(config as OpenSearchConfig);
  }

  /**
   * List all the existing indices that match the given prefix
   *
   * @param indexPrefix the optional index prefix to narrow down the results
   * @returns the list of indices
   */
  private async listIndices(
    indexPrefix?: string
  ): Promise<string[]> {
    try {
      const res = await this.client.indices.get({ index: `${indexPrefix}*` });
      const body = (res && ((res as unknown) as { body?: unknown }).body) ?? res;
      if (!Array.isArray(body)) return [];
      return (body as unknown[])
        .map(row => {
          const r = row as Record<string, unknown>;
          return (r.index as string) ?? (r['i'] as string) ?? Object.values(r)[2];
        })
        .filter(Boolean) as string[];
    } catch (err) {
      console.warn('No existing indices found or error listing indices:', err);
      return [];
    }
  }

  /**
   * Will find or create an index and return the name when complete
   *
   * @param indexName the name of the index
   * @param propertyDefinition the structure of an index record
   * @returns the name of the index or undefined if not found and unable to create
   */
  async findOrInitializeIndex(
    indexName: string,
    propertyDefinition: Record<string, Property>
  ): Promise<string> {
    // If there are no indices, load the list of available indices
    if (this.indices.length === 0) {
      this.indices = await this.listIndices();
    }

    // If the name already exists in the list
    if (this.indices.includes(indexName)) {
      return indexName;
    }

    // Create the index
    await this.client.indices.create({
      index: indexName,
      body: {
        mappings: {
          properties: propertyDefinition
        }
      }
    });
    return indexName;
  }

  /**
   * Add/update an item on the specified index
   *
   * @param indexName the name of the index
   * @param propertyDefinition the structure of an index record
   * @param id the index item's id
   * @param item the item to add/update
   */
  async updateIndexItem(
    indexName: string,
    propertyDefinition: Record<string, Property>,
    id: string,
    item: object
  ): Promise<void> {
    // Verify that the index exists and if not create it
    if (!(await this.findOrInitializeIndex(indexName, propertyDefinition))) {
      throw new OpenSearchError('UpdateItem: No index found!');
    }

    const response: Update_Response = await this.client.update({
      index: indexName,
      id,
      body: {
        doc: snakeizeKeys(item),
      }
    });

    if (!response || response.statusCode < 200 || response.statusCode >= 300) {
      throw new OpenSearchError(
        `UpdateItem: Failed to update item "${id}" in ${indexName}. Status code: ${response.statusCode}`
      );
    }
  }

  /**
   * Remove an item on the specified index
   *
   * @param indexName the name of the index
   * @param itemId the id of the item to remove
   */
  async removeIndexItem(
    indexName: string,
    itemId: string
  ): Promise<void> {
    // If no index exists we don't care since there's nothing to remove
    if ((await this.listIndices(indexName))) {
      const response: Delete_Response = await this.client.delete({
        index: indexName,
        id: itemId
      });

      if (!response || response.statusCode < 200 || response.statusCode >= 300) {
        throw new OpenSearchError(
          `OpenSearch: Failed to remove item "${itemId}" from ${indexName}. Status code: ${response.statusCode}`
        );
      }
    }
  }

  /**
   * Search the specified index
   *
   * @param indexName the name of the index
   * @param body the search request
   */
  async search(
    indexName: string,
    body: Record<string, unknown>
  ): Promise<IndexSearchResponseInterface> {
    // If the index doesn't exist throw an error because we won't ever find anything
    if (!(await this.listIndices(indexName))) {
      throw new OpenSearchError('Search: No index found!');
    }

    const response: Search_Response = await this.client.search({
      index: indexName,
      body,
    });

    if (!response.body || !response.body.hits || !response.body.hits.total) {
      return {
        total: 0,
        items: []
      };
    }

    const total: number = typeof response.body.hits.total === 'number'
      ? response.body.hits.total
      : (response.body.hits.total as { value: number }).value;

    const items: IndexSearchItemInterface[] = response.body.hits.hits.map((hit: Hit): IndexSearchItemInterface => {
      return {_id: hit._id, fields: camelizeKeys(hit.fields)};
    }) || [];

    return {
      total: total || 0,
      items
    };
  }
}

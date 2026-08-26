import { Client, ClientOptions } from "@opensearch-project/opensearch";
import { AwsSigv4Signer } from "@opensearch-project/opensearch/aws";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";

type OpenSearchProperties = NonNullable<
  Parameters<Client["indices"]["putMapping"]>[0]["body"]
>["properties"];

// Look up the index type to get the singular MappingProperty schema
export type MappingProperty = NonNullable<OpenSearchProperties>[string];


// Target the Response body data by resolving the underlying Promise value directly
export type Search_Response<T = unknown> = Awaited<ReturnType<Client["search"]>> extends { body: infer B }
  ? B
  : { hits?: { hits?: unknown[] } };


// Now extracting the individual Hit array item will work perfectly!
export type Hit<T = unknown> = NonNullable<
  NonNullable<Search_Response<T>["hits"]>["hits"]
>[number];


// Extract Indices_Get_Response and ResponseBody from client.indices.get
export type Indices_Get_Response = Awaited<ReturnType<Client["indices"]["get"]>>;

// In OpenSearch 3.x, the response object directly reflects the body payload shape
export type Indices_Get_ResponseBody = Indices_Get_Response;


// Extract Get_Response from client.get
export type Get_Response = Awaited<ReturnType<Client["get"]>>;

export interface SearchHit {
  _id: string;
  fields?: Record<string, unknown>;
  _source?: Record<string, unknown>;
}

import { awsConfig } from "../config/awsConfig";

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
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    return new Client({
      node: config.node,
      headers: {
        host: `${config.node
          .replace('http://', `aoss.${awsConfig.region}.opensearch.localhost.`)
          .replace(':', '.cloud:')}`
      }
    });
  }

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
 * The shape of an index item returned by a search
 */
export interface IndexSearchItemInterface {
  _id: string;
  fields: Record<string, unknown>;
}

/**
 * The shape of an index search response
 */
export interface IndexSearchResponseInterface<T> {
  total: number;
  items: T[];
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
  // Instead of trying to extract the type, explicitly type it:
  private async listIndices(
    indexPrefix?: string
  ): Promise<string[]> {
    try {
      const res = await this.client.indices.get({
        index: indexPrefix ? `${indexPrefix}*` : '*'
      });

      // The response has a `body` property with the indices
      const body = res.body as Record<string, unknown>;

      return Object.keys(body || {}).filter((key: string): boolean => {
        return !key.startsWith('top_queries-') && !key.startsWith('.');
      });
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
    propertyDefinition: Record<string, MappingProperty>
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
    this.indices.push(indexName);
    return indexName;
  }

  /**
   * Fetch a specific item from the index
   *
   * @param indexName the name of the index
   * @param id the id of the item/record
   * @returns the id and the item or undefined if it was not found
   */
  async getIndexItem<T = Record<string, unknown>>(
    indexName: string,
    id: string
  ): Promise<T | undefined> {
    // If the index doesn't exist throw an error because we won't ever find anything
    if ((await this.listIndices(indexName))?.length === 0) {
      throw new OpenSearchError('GetItem: No index found!');
    }

    try {
      const response = await this.client.get({
        index: indexName,
        id,
      });

      return response ? response.body?._source as T : undefined;
    } catch (error) {
      // OpenSearch client attaches the HTTP status code to error.meta.statusCode or error.statusCode
      const statusCode: number = error?.meta?.statusCode || error?.statusCode;

      if (statusCode === 404) {
        return undefined;
      }

      // Re-throw or handle non-404 errors (500s, network failures, etc.)
      throw new OpenSearchError(
        `GetItem: Failed to retrieve item "${id}" from ${indexName}. ${error.message}`
      );
    }
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
    propertyDefinition: Record<string, MappingProperty>,
    id: string,
    item: object
  ): Promise<void> {
    // Verify that the index exists and if not create it
    if (!(await this.findOrInitializeIndex(indexName, propertyDefinition))) {
      throw new OpenSearchError('UpdateItem: No index found!');
    }

    try {
      await this.client.index({
        index: indexName,
        id,
        body: {
          ...snakeizeKeys(item),
        }
      });
    } catch (error) {
      const statusCode: number = error?.meta?.statusCode || error?.statusCode;

      if (statusCode === 404) {
        return;
      }

      throw new OpenSearchError(
        `UpdateItem: Failed to update item "${id}" in ${indexName}. ${error.message}`
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
    if ((await this.listIndices(indexName))?.length > 0) {
      try {
        await this.client.delete({
          index: indexName,
          id: itemId
        });

      } catch (error) {
        // OpenSearch client attaches the HTTP status code to error.meta.statusCode or error.statusCode
        const statusCode: number = error?.meta?.statusCode || error?.statusCode;

        if (statusCode === 404) {
          // Item not found, nothing to remove
          return;
        }

        // Re-throw or handle non-404 errors (500s, network failures, etc.)
        throw new OpenSearchError(
          `OpenSearch: Failed to remove item "${itemId}" from ${indexName}. ${error.message}`
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
  async search<T = Record<string, unknown>>(
    indexName: string,
    body: Record<string, unknown>
  ): Promise<IndexSearchResponseInterface<T>> {
    // If the index doesn't exist throw an error because we won't ever find anything
    if ((await this.listIndices(indexName))?.length === 0) {
      throw new OpenSearchError('Search: No index found!');
    }

    try {
      const response = await this.client.search({
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

      const items: IndexSearchItemInterface[] = response.body.hits.hits.map((hit: SearchHit): IndexSearchItemInterface => {
        return { _id: hit._id, fields: camelizeKeys(hit.fields) };
      }) || [];

      return {
        total: total || 0,
        items: items as T[]
      };
    } catch (error) {
      // OpenSearch client attaches the HTTP status code to error.meta.statusCode or error.statusCode
      const statusCode: number = error?.meta?.statusCode || error?.statusCode;

      if (statusCode === 404) {
        // Item not found, nothing to remove
        return { total: 0, items: [] };
      }

      // Re-throw or handle non-404 errors (500s, network failures, etc.)
      throw new OpenSearchError(
        `OpenSearch: Failed to search within ${indexName}. ${error.message}`
      );
    }
  }
}

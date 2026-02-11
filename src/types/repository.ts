/**
 * ============================================
 * CUSTOM REPOSITORY TYPES (Database)
 * ============================================
 */

export interface CustomRepositoryRecord {
  id: number | string;
  name: string;
  uri?: string;
  description?: string;
  website?: string;
  keywords?: string[];
  repositoryTypes?: string[];
  createdById?: number;
  created?: string;
  modifiedById?: number;
  modified?: string;
}

/**
 * ============================================
 * RE3DATA REPOSITORY TYPES (OpenSearch/External)
 * ============================================
 */

export interface Re3DataRepositoryRecord {
  id: string;
  name: string;
  description?: string;
  homepage?: string;
  contact?: string;
  uri?: string;
  types?: string[];
  subjects?: string[];
  providerTypes?: string[];
  keywords?: string[];
  access?: string;
  pidSystem?: string[];
  policies?: string[];
  uploadTypes?: string[];
  certificates?: string[];
  software?: string[];
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Internal record format from OpenSearch (snake_case)
 */
export interface OpenSearchRe3DataRecord {
  id: string;
  name: string;
  description?: string;
  homepage?: string;
  contact?: string;
  uri?: string;
  types?: string[];
  subjects?: string[];
  provider_types?: string[];
  keywords?: string[];
  access?: string;
  pid_system?: string[];
  policies?: string[];
  upload_types?: string[];
  certificates?: string[];
  software?: string[];
  created_at?: string;
  updated_at?: string;
}

/**
 * ============================================
 * UNIFIED/SHARED TYPES
 * ============================================
 */

/**
 * Type discriminator for determining repository source in GraphQL
 */
export enum RepositorySourceType {
  CUSTOM = 'CUSTOM',
  RE3DATA = 'RE3DATA',
}

/**
 * Common interface for unified repository results
 */
export interface BaseRepository {
  id: string | number;
  name: string;
  description?: string;
  uri?: string;
  keywords?: string[];
  source: RepositorySourceType;
}
/**
 * Convert OpenSearch record (snake_case) to camelCase
 * Used by openSearchService when fetching re3data repositories
 */
export function convertRe3DataToCamelCase(
  record: OpenSearchRe3DataRecord,
): Re3DataRepositoryRecord {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    homepage: record.homepage,
    contact: record.contact,
    uri: record.uri,
    types: record.types || [],
    subjects: record.subjects || [],
    providerTypes: record.provider_types || [],
    keywords: record.keywords || [],
    access: record.access,
    pidSystem: record.pid_system || [],
    policies: record.policies || [],
    uploadTypes: record.upload_types || [],
    certificates: record.certificates || [],
    software: record.software || [],
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

/**
 * Type guard: Check if a Repository-like object is a Re3DataRepository
 * Used by resolvers to determine which type resolver to use
 */
export function isRe3DataRepository(
  repo: unknown,
): repo is Re3DataRepositoryRecord {
  return (
    repo !== null
    && typeof repo === 'object'
    && 'id' in repo
    && typeof (repo as { id: unknown }).id === 'string'
    && 'name' in repo
  );
}

/**
 * Type guard: Check if a Repository-like object is a CustomRepository
 * Used by resolvers to determine which type resolver to use
 */
export function isCustomRepository(
  repo: unknown,
): repo is CustomRepositoryRecord {
  return (
    repo !== null
    && typeof repo === 'object'
    && 'id' in repo
    && (typeof (repo as { id: unknown }).id === 'number'
      || (typeof (repo as { id: unknown }).id === 'string'
        && !isNaN(Number((repo as { id: unknown }).id))))
    && !('homepage' in repo) // re3data has homepage, custom doesn't
  );
}


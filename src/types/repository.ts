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
  re3dataId?: string;
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
  website?: string;
  contact?: string;
  uri?: string;
  repositoryTypes?: string[];
  subjects?: string[];
  providerTypes?: string[];
  keywords?: string[];
  access?: string;
  pidSystem?: string[];
  policies?: string[];
  uploadTypes?: string[];
  certificates?: string[];
  software?: string[];
  created?: string;
  modified?: string;
}

/**
 * Internal record format from OpenSearch (snake_case)
 */
export interface OpenSearchRe3DataRecord {
  id: string;
  name: string;
  description?: string;
  website?: string;
  contact?: string;
  uri?: string;
  repository_types?: string[];
  subjects?: string[];
  provider_types?: string[];
  keywords?: string[];
  access?: string;
  pid_system?: string[];
  policies?: string[];
  upload_types?: string[];
  certificates?: string[];
  software?: string[];
  created?: string;
  modified?: string;
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
    website: record.website,
    contact: record.contact,
    uri: record.uri,
    repositoryTypes: record.repository_types || [],
    subjects: record.subjects || [],
    providerTypes: record.provider_types || [],
    keywords: record.keywords || [],
    access: record.access,
    pidSystem: record.pid_system || [],
    policies: record.policies || [],
    uploadTypes: record.upload_types || [],
    certificates: record.certificates || [],
    software: record.software || [],
    created: record.created,
    modified: record.modified,
  };
}

/**
 * Type guard: Check if a Repository-like object is a CustomRepository
 * Custom repositories have a numeric or numeric-string ID
 * and may have a re3dataId field if they reference a re3data repository
 * Used by resolvers to determine which type resolver to use
 */
export function isCustomRepository(
  repo: unknown,
): repo is CustomRepositoryRecord {
  if (repo === null || typeof repo !== 'object') {
    return false;
  }

  const obj = repo as Record<string, unknown>;

  // Custom repositories have a numeric ID or a numeric string ID
  return (
    'id' in obj &&
    (typeof obj.id === 'number' ||
      (typeof obj.id === 'string' && !isNaN(Number(obj.id))))
  );
}

/**
 * Type guard: Check if a Repository-like object is a Re3DataRepository
 * Re3Data repositories have a string ID that is not a numeric string
 * and should not have the re3dataId field
 * Used by resolvers to determine which type resolver to use
 */
export function isRe3DataRepository(
  repo: unknown,
): repo is Re3DataRepositoryRecord {
  if (repo === null || typeof repo !== 'object') {
    return false;
  }

  const obj = repo as Record<string, unknown>;

  // Re3Data repositories have a string ID that is NOT a numeric string
  // and should NOT have re3dataId field (that's for custom repos only)
  return (
    'id' in obj &&
    typeof obj.id === 'string' &&
    isNaN(Number(obj.id)) &&
    !('re3dataId' in obj)
  );
}


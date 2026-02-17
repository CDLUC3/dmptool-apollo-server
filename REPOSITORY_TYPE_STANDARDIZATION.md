# Repository Type Standardization - February 2026

## Overview

This document describes the standardization of repository type values to use the re3data standard format consistently throughout the application. Previously, the system used multiple formats with complex conversion logic, leading to inconsistency and maintenance overhead.

## Problem

The system had inconsistent repository type handling:

1. **Database (MySQL)**: Stored as lowercase with hyphens (e.g., `"disciplinary"`, `"institutional"`, `"project-related"`)
2. **OpenSearch**: Stored as lowercase with hyphens from re3data API
3. **TypeScript Model**: Used SCREAMING_SNAKE_CASE enum (e.g., `RepositoryType.DISCIPLINARY`, `RepositoryType.PROJECT_RELATED`)
4. **GraphQL Schema**: Used SCREAMING_SNAKE_CASE enum
5. **Conversion Logic**: Multiple places with mapping between formats

This resulted in:
- Complex conversion logic in `Repository.processResult()`
- Mapping dictionaries in resolvers
- Format transformations in `repositoryService`
- Potential for bugs when formats didn't align
- Confusion about which format to use

## Solution

Standardize on the **re3data standard format** (lowercase with hyphens) throughout the entire application:

- `disciplinary`
- `institutional`
- `other`
- `multidisciplinary`
- `project-related`
- `governmental`

## Changes Made

### 1. GraphQL Schema (`src/schemas/repository.ts`)

**Before:**
```graphql
enum RepositoryType {
  DISCIPLINARY
  GENERALIST
  INSTITUTIONAL
  OTHER
  GOVERNMENTAL
  PROJECT_RELATED
  MULTI_DISCIPLINARY
}
```

**After:**
```graphql
"""
Repository type values follow the re3data standard:
- disciplinary: A discipline specific repository
- institutional: An institution specific repository
- other: A repository that doesn't fit into any of the other categories
- multidisciplinary: A repository that accepts any type of dataset, from any discipline
- project-related: A repository created to support a specific project or initiative
- governmental: A repository owned and managed by a government entity
"""
scalar RepositoryTypeValue
```

**Why:** Using a scalar instead of an enum allows string values that match the re3data standard directly.

### 2. Repository Model (`src/models/Repository.ts`)

**Before:**
```typescript
export enum RepositoryType {
  OTHER = 'OTHER',
  GOVERNMENTAL = 'GOVERNMENTAL',
  PROJECT_RELATED = 'PROJECT_RELATED',
  GENERALIST = 'GENERALIST',
  DISCIPLINARY = 'DISCIPLINARY',
  MULTI_DISCIPLINARY = 'MULTI_DISCIPLINARY',
  INSTITUTIONAL = 'INSTITUTIONAL',
}

export class Repository extends MySqlModel {
  public repositoryTypes: RepositoryType[];
  // ...
}

static processResult(repository: Repository): Repository {
  // Complex conversion logic to transform from database format to enum
  repository.repositoryTypes = parsed.map((type: string) =>
    type.toUpperCase().replace(/-/g, '_') as RepositoryType
  );
}
```

**After:**
```typescript
/**
 * Standard repository type values following the re3data standard
 */
export const REPOSITORY_TYPE = {
  DISCIPLINARY: 'disciplinary',
  INSTITUTIONAL: 'institutional',
  OTHER: 'other',
  MULTIDISCIPLINARY: 'multidisciplinary',
  PROJECT_RELATED: 'project-related',
  GOVERNMENTAL: 'governmental',
} as const;

export type RepositoryTypeValue = typeof REPOSITORY_TYPE[keyof typeof REPOSITORY_TYPE];

export class Repository extends MySqlModel {
  public repositoryTypes: string[];
  // ...
}

static processResult(repository: Repository): Repository {
  // Simple JSON parsing, no conversion needed
  if (repository?.repositoryTypes && typeof repository.repositoryTypes === 'string') {
    repository.repositoryTypes = JSON.parse(repository.repositoryTypes);
  }
}
```

**Why:** 
- Constants provide type safety while using standard values
- No conversion logic needed in `processResult()`
- Values match database and OpenSearch exactly

### 3. Resolver (`src/resolvers/repository.ts`)

**Before:**
```typescript
// Complex mapping dictionary
const typeMap: Record<string, string> = {
  'disciplinary': RepositoryType.DISCIPLINARY,
  'generalist': RepositoryType.GENERALIST,
  'institutional': RepositoryType.INSTITUTIONAL,
  'other': RepositoryType.OTHER,
  'governmental': RepositoryType.GOVERNMENTAL,
  'government': RepositoryType.GOVERNMENTAL,
  'govermental': RepositoryType.GOVERNMENTAL,
  'project-related': RepositoryType.PROJECT_RELATED,
  'multidisciplinary': RepositoryType.MULTI_DISCIPLINARY,
};

repoType = typeMap[repositoryType.toLowerCase()];
```

**After:**
```typescript
// No conversion needed - pass value directly
const results = await RepositoryService.searchCombined(
  reference,
  context,
  term,
  subjects,
  keyword,
  repositoryType, // Already in correct format
  opts,
);
```

**Why:** Values are already in the correct format from GraphQL input.

### 4. Repository Service (`src/services/repositoryService.ts`)

**Before:**
```typescript
async searchCombined(
  repositoryType: RepositoryType | null | undefined,
  // ...
) {
  // ...
}

async function searchRe3Data(
  repositoryType: string | null | undefined,
  // ...
) {
  // Convert enum format back to re3data format
  let re3dataRepositoryType: string | undefined;
  if (repositoryType) {
    re3dataRepositoryType = repositoryType.toLowerCase().replace(/_/g, '');
  }
  
  return await openSearchFindRe3Data(
    term,
    context,
    subjects,
    re3dataRepositoryType,
    maxResults,
  );
}
```

**After:**
```typescript
async searchCombined(
  repositoryType: string | null | undefined,
  // ...
) {
  // ...
}

async function searchRe3Data(
  repositoryType: string | null | undefined,
  // ...
) {
  // Pass directly - already in correct format
  return await openSearchFindRe3Data(
    term,
    context,
    subjects,
    repositoryType,
    maxResults,
  );
}
```

**Why:** No conversion needed since all layers use the same format.

### 5. Tests Updated

All test files updated to use lowercase string values:

- `src/models/__tests__/Repository.spec.ts`
- `src/services/__tests__/repositoryService.spec.ts`
- `src/resolvers/__tests__/repository.spec.ts`

**Example change:**
```typescript
// Before
repositoryTypes: [RepositoryType.DISCIPLINARY]

// After
repositoryTypes: ['disciplinary']
```

## Benefits

1. **Consistency**: One format used everywhere (database, OpenSearch, TypeScript, GraphQL)
2. **Simplicity**: No conversion logic needed between layers
3. **Maintainability**: Easier to understand and modify
4. **Standards Compliance**: Matches the re3data API standard
5. **Fewer Bugs**: No misalignment between format conversions
6. **Better DX**: Developers don't need to remember multiple formats

## Standard Repository Type Values

The following values are accepted throughout the system:

| Value | Description |
|-------|-------------|
| `disciplinary` | A discipline-specific repository (e.g., GeneCards, Arctic Data Centre) |
| `institutional` | An institution-specific repository (e.g., ASU Library Research Data Repository) |
| `other` | A repository that doesn't fit into any other category |
| `multidisciplinary` | A repository that accepts any type of dataset from any discipline |
| `project-related` | A repository created to support a specific project or initiative (e.g., Human Genome Project) |
| `governmental` | A repository owned and managed by a government entity (e.g., NCBI, NASA) |

**Note**: The `generalist` type was removed as it's not part of the standard re3data type list.

## Database Storage

Values are stored in the `repositories.repositoryTypes` column as a JSON array:
```json
["disciplinary", "institutional"]
```

## OpenSearch Storage

Values are stored in the `repositoryTypes` field as an array:
```json
{
  "repositoryTypes": ["disciplinary", "multidisciplinary"]
}
```

## GraphQL Usage

**Query with type filter:**
```graphql
query {
  repositories(input: {
    term: "genomics"
    repositoryType: "disciplinary"
  }) {
    items {
      ... on CustomRepository {
        id
        name
        repositoryTypes
      }
      ... on Re3DataRepository {
        id
        name
        repositoryTypes
      }
    }
  }
}
```

**Create repository:**
```graphql
mutation {
  addRepository(input: {
    name: "My Repository"
    repositoryTypes: ["disciplinary", "institutional"]
  }) {
    id
    name
    repositoryTypes
  }
}
```

## Migration Notes

- **No database migration needed**: Database already stores values in lowercase format
- **No OpenSearch reindex needed**: OpenSearch already stores values in lowercase format
- **Code changes only**: All changes are in the application layer

## Backward Compatibility

The system no longer accepts the old enum-style values (e.g., `DISCIPLINARY`, `MULTI_DISCIPLINARY`). GraphQL clients should use lowercase with hyphens (e.g., `disciplinary`, `project-related`).

## Related Files

- `src/schemas/repository.ts` - GraphQL schema
- `src/models/Repository.ts` - Repository model
- `src/resolvers/repository.ts` - GraphQL resolvers
- `src/services/repositoryService.ts` - Business logic
- `data-migrations/re3data-os-populate.ts` - OpenSearch population script
- All test files updated to use new format

## Date Completed

February 17, 2026


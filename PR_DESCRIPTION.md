# Pull Request Description: Re3Data OpenSearch Integration and Repository Enhancements

## Description

This PR implements integration with the **re3data repository database** through **OpenSearch**, adding robust search and discovery capabilities for research data repositories. The changes enable the system to search, filter, and manage both custom repositories and external re3data repositories through a unified GraphQL API.

### Key Features Added:
1. **Re3data OpenSearch Integration**: New data synchronization script that populates OpenSearch indices with repository metadata from the re3data API using a blue-green deployment strategy
2. **Unified Repository Search**: Combined search functionality across custom and re3data repositories with support for multiple filter types
3. **Repository Metadata Enrichment**: Added `re3dataId` field to track which custom repositories correspond to re3data entries
4. **Discovery Endpoints**: New GraphQL queries to explore available repository types and subject areas from re3data
5. **Type-Safe Repository Handling**: Implemented type guards and union types to properly distinguish between CustomRepository and Re3DataRepository types in GraphQL

### Related Issue
This change adds support for populating OpenSearch with re3data repository information for improved discoverability.

### Dependencies
- Added `@opensearch-project/opensearch` client dependency (already present in package.json)
- No breaking changes to existing API surface

## Type of change

- [x] New feature (non-breaking change which adds functionality)
- [x] This change requires a documentation update (added for populating opensearch)

## How Has This Been Tested?

Tested with GraphQL queries as well as unit tests. Example GraphQL queries for the new functionality:

### Search for repositories (custom and re3data combined)
```graphql
query SearchRepositories {
  repositories(input: {
    term: "genomics"
    subject: "life-sciences"
    repositoryType: "DISCIPLINARY"
    paginationOptions: {
      type: CURSOR
      limit: 20
    }
  }) {
    items {
      __typename
      ... on CustomRepository {
        id
        name
        uri
        description
        re3dataId
        repositoryTypes
      }
      ... on Re3DataRepository {
        id
        name
        description
        website
        contact
        types
        subjects
      }
    }
    hasNextPage
    totalCount
  }
}
```

### Get re3data repositories by URIs
```graphql
query GetRe3dataByURIs {
  re3byURIs(uris: ["https://www.re3data.org/repository/r3d100014782"]) {
    id
    name
    description
    website
    contact
    types
    subjects
    certificates
  }
}
```

### Get distinct subject areas from re3data
```graphql
query GetSubjectList {
  re3SubjectList(input: {
    includeCount: true
    limit: 50
  }) {
    subjects {
      subject
      count
    }
  }
}
```

### Get distinct repository types from re3data
```graphql
query GetRepositoryTypes {
  re3RepositoryTypesList(input: {
    includeCount: true
    limit: 50
  }) {
    types {
      type
      count
    }
  }
}
```

### Search custom repositories by URI
```graphql
query SearchByURIs {
  repositoriesByURIs(uris: ["https://example.com/repo1", "https://example.com/repo2"]) {
    id
    name
    description
    repositoryTypes
    re3dataId
  }
}
```

## Checklist:
- [x] I have performed a self-review of my own code
- [x] I have commented my code, particularly in hard-to-understand areas
- [x] I updated the CHANGELOG.md and added documentation if necessary
- [x] I have added tests that prove my fix is effective or that my feature works
- [x] New and existing unit tests pass locally with my changes

## Files Modified

### Database Migrations
- **`data-migrations/2026-02-11-1148-add-re3data-id-to-repositories.sql`**: Added `re3dataId` column to `repositories` table with unique constraint and auto-population logic for existing re3data URIs

### New Migration Script
- **`data-migrations/re3data-os-populate.ts`**: Data synchronization script that:
  - Fetches repository data from re3data API (https://www.re3data.org/api/v1)
  - Implements blue-green deployment strategy for OpenSearch indices
  - Supports dry-run mode, configurable batch sizes, and verbose logging
  - Atomically swaps aliases for zero-downtime updates
  - Documentation: `README-re3data-os-populate.md`

### Model Updates
- **`src/models/Repository.ts`**: Added `re3dataId` field to Repository class and updated constructor to accept this field

### Service Layer
- **`src/services/openSearchService.ts`**: New search methods added:
  - `findRe3Data()`: Search re3data repositories with optional filters (term, subject, type)
  - `findRe3DataByURIs()`: Fetch specific re3data repositories by their URIs
  - `findRe3DataSubjects()`: Get distinct subject areas from re3data with optional counts
  - `findRe3DataRepositoryTypes()`: Get distinct repository types from re3data with optional counts
  - `convertRe3DataToCamelCase()`: Convert snake_case API responses to camelCase

- **`src/services/repositoryService.ts`**: Enhanced `searchCombined()` method to merge results from both custom database and OpenSearch

### GraphQL Schema & Resolvers
- **`src/schemas/repository.ts`**: New types and queries:
  - New queries: `re3byURIs`, `re3SubjectList`, `re3RepositoryTypesList`
  - Updated `repositories` query to support subject filtering
  - New types: `Re3DataRepository`, `Re3SubjectListInput`, `Re3SubjectListResults`, `Re3RepositoryTypesListInput`, `Re3RepositoryTypesListResults`
  - Enhanced `CustomRepository` type with `re3dataId` field
  - New union type `Repository` for discriminating between CustomRepository and Re3DataRepository

- **`src/resolvers/repository.ts`**: New resolver implementations:
  - `re3byURIs`: Fetch re3data repositories by URIs
  - `re3SubjectList`: Get subject areas with optional filtering
  - `re3RepositoryTypesList`: Get repository types with optional filtering
  - Type discriminators using `isCustomRepository()` and `isRe3DataRepository()` guards

### Type Definitions
- **`src/types/repository.ts`**: New type definitions and guards:
  - `Re3DataRepositoryRecord`: TypeScript interface for re3data repository data
  - `CustomRepositoryRecord`: TypeScript interface for custom repository data
  - `isCustomRepository()`: Type guard for distinguishing custom repositories
  - `isRe3DataRepository()`: Type guard for distinguishing re3data repositories
  - `RepositorySourceType`: Enum indicating repository source (CUSTOM or RE3DATA)
  - `convertRe3DataToCamelCase()`: Utility to convert API response format

- **`src/types.ts`**: Auto-generated types from GraphQL schema including new Re3DataRepository type and input types

### Tests
- **`src/models/__tests__/Repository.spec.ts`**: Type guard tests for `isCustomRepository()` and `isRe3DataRepository()`
- **`src/resolvers/__tests__/repository.spec.ts`**: Resolver tests (mocked for the new re3data queries)

### Documentation
- **`data-migrations/README-re3data-os-populate.md`**: Comprehensive documentation for the re3data sync script with:
  - Purpose and blue-green strategy explanation
  - CLI options and environment variables
  - Usage examples and dry-run testing
  - Troubleshooting guide

## Usage

### Syncing Re3data Data to OpenSearch

To populate or update your OpenSearch indices with re3data data:

```bash
# Dry-run mode (safe, shows what would be indexed)
npm run re3data:sync -- --dry-run --limit=10 --verbose

# Full sync (creates index and swaps alias)
npm run re3data:sync -- --node=http://localhost:9200 --index=re3data-idx --alias=re3data
```

For more details, see `data-migrations/README-re3data-os-populate.md`

## Notes

- All new code follows the project's TypeScript and coding standards
- The repository union type is handled through GraphQL type resolvers that use the type guards
- Blue-green deployment ensures zero-downtime updates to OpenSearch indices
- The `--dry-run` mode is useful for integration testing without modifying OpenSearch state


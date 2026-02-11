# Repository Architecture: Custom and Re3Data Integration

## Overview

This document describes the architecture implemented for managing two distinct types of repositories in the DMSP Backend:

1. **Custom Repositories** - User-managed repositories stored in MySQL
2. **Re3Data Repositories** - Preset repositories from OpenSearch/re3data (external source)

## Architecture Layers

### 1. Type Definitions (`src/types/repository.ts`)

Centralized TypeScript type definitions for all repository-related types:

```
Re3DataRepositoryRecord       - Camel-case record from OpenSearch
OpenSearchRe3DataRecord       - Snake-case record (internal format)
RepositorySourceType (enum)   - Discriminator: CUSTOM or RE3DATA
convertRe3DataToCamelCase()   - Conversion function for OpenSearch data
isCustomRepository()          - Type guard for custom repositories
isRe3DataRepository()         - Type guard for re3data repositories
```

**Why separate from schemas:**
- These are application-level types, not exposed to GraphQL clients
- Shared across services, models, and resolvers
- Follows project convention of keeping custom types in `src/types/`
- Keeps service layer decoupled from GraphQL schema

### 2. Service Layer (`src/services/repositoryService.ts`)

High-level business logic orchestrator that:
- Combines searches from both sources
- Handles errors gracefully (fails to custom only if re3data errors)
- Provides unified interface for resolvers
- Manages source prioritization and result merging

**Key methods:**
```typescript
RepositoryService.searchCombined()  // Search both sources together
searchRe3Data()                     // Internal helper for re3data lookups
```

### 3. Data Sources

**OpenSearch Service** (`src/services/openSearchService.ts`)
- Low-level interaction with OpenSearch API
- Returns raw re3data records
- Uses `convertRe3DataToCamelCase()` for format conversion

**MySQL Model** (`src/models/Repository.ts`)
- Existing repository model for custom repositories
- Unchanged from original implementation
- Extends MySqlModel for database operations

### 4. GraphQL Schema (`src/schemas/repository.ts`)

**Type Definitions:**
- `Repository` - Union type: `CustomRepository | Re3DataRepository`
- `CustomRepository` - Database-backed with source: CUSTOM
- `Re3DataRepository` - External source with source: RE3DATA

**Queries:**
- `repositories()` - Searches both sources combined
- `repository()` - Returns single custom repository
- `repositorySubjectAreas` - From custom repositories
- `repositoriesByURIs()` - From custom repositories

**Mutations:**
- All mutations operate on custom repositories only
- Add, update, delete, merge functionality

**Discriminator Field:**
Both repository types include a `source` field that determines the type resolver to use.

### 5. Resolvers (`src/resolvers/repository.ts`)

**Responsibilities:**
- Authorization checks (all endpoints)
- Type conversion (adds `source` field to objects)
- Delegation to services/models
- Error handling and logging

**Key patterns:**
```typescript
// Type resolution for union
Repository.__resolveType(obj) {
  if (isCustomRepository(obj)) return 'CustomRepository';
  if (isRe3DataRepository(obj)) return 'Re3DataRepository';
}

// Source field is always provided
return { ...repo, source: RepositorySourceType.CUSTOM };
```

## Data Flow

```
GraphQL Request
    ↓
Resolver validates & authorizes
    ↓
RepositoryService (orchestration)
    ├→ Repository.search()          (custom from MySQL)
    └→ OpenSearchService.findRe3Data()  (re3data from OpenSearch)
    ↓
Service merges results & adds source field
    ↓
Resolver returns with source field
    ↓
GraphQL resolver uses source for union type dispatch
    ↓
CustomRepository or Re3DataRepository type resolver
    ↓
Client receives properly typed data
```

## Type Safety & Resolution

### Union Type Resolution

Apollo GraphQL resolves the `Repository` union at runtime using the `__resolveType` resolver:

```graphql
union Repository = CustomRepository | Re3DataRepository
```

The type guard functions determine which type to return:
- Custom repositories have numeric `id` (from database)
- Re3Data repositories have string `id` (from re3data)

### Source Field

Every repository object includes a `source` field:
- Populated by resolvers before returning to GraphQL
- Indicates whether it's CUSTOM or RE3DATA
- Helps clients understand data provenance
- Used internally by type guards

## Search Strategy

### Combined Search
```
Input: search term, filters
    ↓
Search Custom:  Filter by domain, keyword, type, search term
Search Re3Data: Filter by subject, search term
    ↓
Combine results with source field
    ↓
Return paginated results with source discrimination
```

### Graceful Degradation
If re3data search fails (OpenSearch unavailable):
- Warning is logged
- Custom search results are still returned
- System continues operating with reduced functionality

## File Organization

```
src/
├── types/
│   └── repository.ts              # ✨ NEW: Type definitions
├── services/
│   ├── repositoryService.ts       # ✨ NEW: Business logic orchestrator
│   └── openSearchService.ts       # MODIFIED: Imports from types/repository
├── schemas/
│   └── repository.ts              # MODIFIED: Union type, both repository types
├── resolvers/
│   └── repository.ts              # MODIFIED: Union type resolution, source field
└── models/
    └── Repository.ts              # UNCHANGED: Custom repository model
```

## Benefits of This Architecture

✅ **Clear Separation of Concerns**
- Types are centralized
- Services handle business logic
- Schemas define API contract
- Resolvers handle authorization & type dispatch

✅ **Type Safety**
- Full TypeScript coverage
- Type guards prevent runtime errors
- Union types provide compile-time safety

✅ **Extensibility**
- Easy to add more repository sources
- Service layer makes adding new search logic simple
- Can add custom result filtering/sorting

✅ **Maintainability**
- Single source of truth for types
- Business logic in one place (RepositoryService)
- Follows project conventions

✅ **Error Handling**
- Graceful degradation if one source fails
- Comprehensive error logging
- User-friendly error messages

✅ **Performance**
- Parallel searches (both sources at once)
- Efficient pagination support
- Query optimization through type-specific filters

## Future Enhancements

### Could add:
1. **Re3Data subject area aggregations** - For autocomplete
2. **Custom repository creation from re3data** - Copy and customize
3. **Search result ranking** - Prioritize exact matches
4. **Advanced filtering** - Combine filters across both sources
5. **Batch operations** - Create multiple repos from re3data

## Testing Considerations

### Unit Tests Should Cover:
- `RepositoryService.searchCombined()` with mock sources
- Type guards with various input types
- `convertRe3DataToCamelCase()` with edge cases
- Resolver type dispatch with mixed results

### Integration Tests Should Cover:
- Search with no re3data (graceful degradation)
- Search with both sources returning results
- Pagination across combined results
- Authorization on all endpoints

## Notes for Developers

1. **Adding new repository sources:**
   - Create new type in `types/repository.ts`
   - Add search method to `RepositoryService`
   - Update resolver's `repositories` query
   - Update `Repository` union and type resolvers

2. **When modifying schema:**
   - Run `npm run generate` to sync types.ts
   - Update RepositoryService return types if needed
   - Update resolvers to add `source` field

3. **When adding fields:**
   - Add to appropriate type definition
   - Ensure source field is always populated
   - Update type guards if type discrimination changes

4. **Error handling:**
   - Re3data errors are non-fatal (logged as warnings)
   - Custom repository errors are fatal (propagate)
   - Always include source in error context


# Quick Reference: Repository Architecture

## Key Files

| File | Purpose |
|------|---------|
| `src/types/repository.ts` | Type definitions for both sources |
| `src/services/repositoryService.ts` | Business logic orchestrator |
| `src/services/openSearchService.ts` | OpenSearch API client (modified) |
| `src/schemas/repository.ts` | GraphQL schema (modified) |
| `src/resolvers/repository.ts` | GraphQL resolvers (modified) |
| `src/models/Repository.ts` | Custom repository model (unchanged) |

## Type Guards

```typescript
// Use to discriminate between repository types
import { 
  isCustomRepository, 
  isRe3DataRepository 
} from '../types/repository';

if (isCustomRepository(repo)) {
  // repo is Repository model with id: number
  console.log(repo.id); // number
}

if (isRe3DataRepository(repo)) {
  // repo is Re3DataRepositoryRecord with id: string
  console.log(repo.id); // string
}
```

## Service Usage

```typescript
import { RepositoryService } from '../services/repositoryService';

// Combined search of custom + re3data
const results = await RepositoryService.searchCombined(
  reference,
  context,
  term,           // search term
  domainId,       // research domain (custom only)
  keyword,        // keyword (custom only)
  type,           // repository type (custom only)
  subject,        // subject area (re3data only)
  paginationOpts
);

// results.items contains both CustomRepository and Re3DataRepositoryRecord
```

## GraphQL Union Resolution

```typescript
// In resolvers
Repository: {
  __resolveType(obj) {
    if (isCustomRepository(obj)) {
      return 'CustomRepository';
    }
    if (isRe3DataRepository(obj)) {
      return 'Re3DataRepository';
    }
    return null;
  },
}
```

## Data Sources

### Custom Repositories
- **Location:** MariaDB
- **Model:** `Repository` class
- **Search:** `Repository.search()`
- **ID type:** number
- **Filters:** domainId, keyword, type

### Re3Data Repositories  
- **Location:** OpenSearch
- **Service:** `OpenSearchService.findRe3Data()`
- **Search:** Direct OpenSearch query
- **ID type:** string
- **Filters:** subject, type (type not yet exposed in GraphQL)

## Common Patterns

### Adding source field in resolver:
```typescript
return { ...repo, source: RepositorySourceType.CUSTOM };
```

### Type conversion in GraphQL:
```graphql
... on CustomRepository {
  id name source
  repositoryTypes researchDomains
}
... on Re3DataRepository {
  id name source
  types subjects
}
```

### Handling both types:
```typescript
const items = results.items.map(item => ({
  ...item,
  source: isCustomRepository(item)
    ? RepositorySourceType.CUSTOM
    : RepositorySourceType.RE3DATA,
}));
```

## Error Handling

### Re3Data Errors (Non-Fatal)
- Logged as warning
- Custom results returned
- System continues operating

### Custom Repository Errors (Fatal)
- Logged as error
- Error propagated to client
- Transaction rolled back

## Testing

### Mock RepositoryService:
```typescript
jest.mock('../services/repositoryService', () => ({
  RepositoryService: {
    searchCombined: jest.fn(),
  },
}));
```

### Mock Type Guards:
```typescript
import { 
  isCustomRepository, 
  isRe3DataRepository 
} from '../types/repository';

jest.mock('../types/repository', () => ({
  isCustomRepository: jest.fn(),
  isRe3DataRepository: jest.fn(),
}));
```

## Documentation

See `REPOSITORY_ARCHITECTURE.md` for:
- Full architecture details
- Design decisions
- Data flow diagrams
- Future enhancements
- Testing guidelines

## Compilation

```bash
npm run generate    # Generate types from GraphQL schemas
npm run compile     # Compile TypeScript
npm run build       # Full build (generate + compile)
npm run lint        # Check code quality
```

## GraphQL Queries

### Search both sources:
```graphql
repositories(input: {
  term: "search term"
  subject: "biology"          # re3data only
  repositoryType: DISCIPLINARY # custom only
  paginationOptions: {
    type: CURSOR
    limit: 20
  }
})
```

### Get single custom repository:
```graphql
repository(uri: "http://example.com/repo")
```

### Get by URIs (custom only):
```graphql
repositoriesByURIs(uris: [
  "http://example.com/repo1"
  "http://example.com/repo2"
])
```

## Extending

### To add new repository source:

1. Create type in `src/types/repository.ts`:
```typescript
export interface NewSourceRepository {
  id: string | number;
  name: string;
  // ... other fields
}
```

2. Add search to `src/services/repositoryService.ts`:
```typescript
const newSourceResults = await searchNewSource(...);
```

3. Update `src/schemas/repository.ts`:
```graphql
union Repository = CustomRepository | Re3DataRepository | NewSourceRepository
```

4. Update resolver type guards and dispatch

5. Run `npm run generate`


# Repository Type Quick Reference

## Valid Repository Type Values

Use these **exact** lowercase strings throughout the application:

```typescript
'disciplinary'
'institutional'
'other'
'multidisciplinary'
'project-related'
'governmental'
```

## Usage Examples

### Creating a Repository

```typescript
import { REPOSITORY_TYPE } from '../models/Repository';

const newRepo = new Repository({
  name: 'My Repository',
  repositoryTypes: [REPOSITORY_TYPE.DISCIPLINARY, REPOSITORY_TYPE.INSTITUTIONAL],
  // ... other fields
});
```

### GraphQL Mutation

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

### GraphQL Query with Filter

```graphql
query {
  repositories(input: {
    repositoryType: "disciplinary"
  }) {
    items {
      ... on CustomRepository {
        id
        name
        repositoryTypes
      }
    }
  }
}
```

### Testing

```typescript
// Use lowercase strings in tests
const mockRepo = {
  repositoryTypes: ['disciplinary', 'governmental'],
};
```

## Important Notes

- ✅ Always use lowercase with hyphens
- ❌ Don't use: `DISCIPLINARY`, `MULTI_DISCIPLINARY`, `ProjectRelated`
- 🗄️ Database stores as JSON array: `["disciplinary", "institutional"]`
- 🔍 OpenSearch indexes as array field
- 🎯 Values match re3data API standard

## Constants Available

```typescript
import { REPOSITORY_TYPE } from '../models/Repository';

REPOSITORY_TYPE.DISCIPLINARY       // 'disciplinary'
REPOSITORY_TYPE.INSTITUTIONAL      // 'institutional'
REPOSITORY_TYPE.OTHER              // 'other'
REPOSITORY_TYPE.MULTIDISCIPLINARY  // 'multidisciplinary'
REPOSITORY_TYPE.PROJECT_RELATED    // 'project-related'
REPOSITORY_TYPE.GOVERNMENTAL       // 'governmental'
```

Use these constants for type safety and IDE autocomplete!


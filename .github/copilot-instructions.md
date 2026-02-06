# Copilot Instructions for DMSP Backend Prototype

This file provides context and guidance for GitHub Copilot when working with this repository.

## Project Overview

This is the DMSP (Data Management and Sharing Plan) backend prototype, an Apollo Server that provides GraphQL APIs for managing data management plans, templates, and related resources. The system authenticates users and facilitates integrations through GraphQL, making it easier than traditional REST APIs.

**Key Technologies:**
- **Runtime:** Node.js v21.6+ with TypeScript
- **Framework:** Apollo Server v4 with GraphQL
- **Database:** MariaDB (MySQL-compatible), DynamoDB for DMP metadata, Redis for caching
- **Testing:** Jest with ts-jest
- **Linting:** ESLint with TypeScript ESLint
- **Authentication:** JWT tokens (access + refresh) stored in HTTP-only cookies

## Architecture

The system follows a layered architecture:

1. **GraphQL Layer**: Schemas define the API surface
2. **Resolvers**: Handle authorization and basic validation
3. **Models**: Contain business logic and data access
4. **Data Sources**: Interact with databases, APIs, and caches

```
GraphQL Request → Resolver → Model → Data Source → Database/API
```

## Code Style and Standards

### General Guidelines
- Use **TypeScript** for all new code
- Follow the existing **EditorConfig** settings:
  - 2-space indentation
  - LF line endings
  - UTF-8 encoding
  - Max line length: 80 characters (flexible for readability)
  - Trim trailing whitespace
- Use **ESLint** strict configuration (TypeScript ESLint)
- Write **clear, self-documenting code** with minimal comments unless necessary for complex logic

### Naming Conventions
- **Files**: PascalCase for classes/models (e.g., `User.ts`, `MySqlModel.ts`)
- **GraphQL schemas**: camelCase files (e.g., `affiliation.ts`, `user.ts`)
- **Variables/Functions**: camelCase (e.g., `findById`, `userId`)
- **Constants**: SCREAMING_SNAKE_CASE (e.g., `DEFAULT_LANGUAGE_ID`)
- **Interfaces/Types**: PascalCase (e.g., `User`, `MyContext`)
- **Enums**: PascalCase names, SCREAMING_SNAKE_CASE values

### TypeScript Patterns
- Use explicit types where possible; avoid `any`
- Leverage type inference when it improves readability
- Use interfaces for object shapes
- Export types that may be used across files
- Run `npm run generate` after modifying GraphQL schemas to regenerate types

## Development Workflow

### Setting Up Development Environment
1. Clone the repository
2. Create `.env` from `.env-example`
3. Run `docker-compose build` to build containers
4. Run `docker-compose up` to start services
5. Initialize database: `docker-compose exec apollo bash ./data-migrations/database-init.sh`
6. Run migrations: `docker-compose exec apollo bash ./data-migrations/process.sh`

### Running the Application
- **Development**: `docker-compose up` (starts Apollo, MariaDB, Redis)
- **Local dev server**: `npm run dev` (with ts-node-dev hot reload)
- **Build**: `npm run build` (generates types, compiles TypeScript)
- **Production**: `npm run start` (builds and starts with nodemon)

### Testing
- **Run tests**: `npm run test`
- **Test framework**: Jest with ts-jest preset
- **Coverage**: Automatically collected, output to `coverage/` directory
- **Test files**: Use `*.spec.ts` or `*.test.ts` naming
- **Mock files**: Place in `__mocks__/` directories
- **Setup**: Tests use setup files at `src/__tests__/setup.ts`

### Linting and Code Quality
- **Lint**: `npm run lint`
- **Pre-commit hooks**: Husky runs linting and tests before commits
- **Skip pre-commit**: Use `git commit -n` (only when actively developing)

## Testing Guidelines

### Writing Tests
- Place unit tests in `__tests__/` directories adjacent to the code
- Use descriptive test names that explain what is being tested
- Follow the **Arrange-Act-Assert** pattern
- Mock external dependencies (databases, APIs) using Jest mocks
- Use `casual` library for generating test data
- Use `jest-expect-message` for better assertion messages

### Example Test Structure
```typescript
describe('ClassName.methodName', () => {
  beforeEach(() => {
    // Setup mocks and test data
  });

  it('should handle the expected case', () => {
    // Arrange
    const input = casual.word;
    
    // Act
    const result = method(input);
    
    // Assert
    expect(result).toBeDefined();
  });

  it('should handle error conditions', () => {
    // Test error scenarios
  });
});
```

## GraphQL Development

### Adding New Queries/Mutations
1. **Schema**: Update/create schema in `src/schemas/` (e.g., `user.ts`)
2. **Generate Types**: Run `npm run generate` to update `src/types.ts`
3. **Resolver**: Add resolver in `src/resolvers/` for the query/mutation
4. **Model**: Implement business logic in `src/models/`
5. **Tests**: Add tests for resolver and model

### GraphQL Schema Patterns
- Use **camelCase** for field names
- Define input types for mutations
- Use **enums** for fixed sets of values
- Implement **pagination** using `PaginationOptions` type
- Include **error handling** in mutation responses

### Resolver Responsibilities
- **Validate** input parameters
- **Authorize** the user (check tokens, permissions)
- **Delegate** to models for business logic
- **Handle** errors gracefully
- **Return** properly typed responses

### Model Responsibilities
- Implement **business logic**
- Interact with **data sources** (MySQL, DynamoDB, Redis)
- **Normalize** data before returning to resolvers
- Handle **database transactions** when needed
- Extend `MySqlModel` for database-backed models

## Database Patterns

### MySQL (MariaDB)
- Use the `MySqlModel` base class for models
- Leverage built-in methods: `query`, `queryWithPagination`, `insert`, `update`, `delete`
- Write SQL in models, not resolvers
- Use parameterized queries to prevent SQL injection
- Migrations are SQL files in `data-migrations/` with timestamps

### DynamoDB (DMPHub)
- Stores DMP metadata in RDA DMP Common Standard format
- Partition key: `PK` (e.g., `DMP#doi.org/11.22222/A1B2C3`)
- Sort key: `SK` (e.g., `VERSION#latest` or `VERSION#2025-04-08T09:20:00.000Z`)
- Use AWS SDK v3 for interactions
- Local development uses local DynamoDB instance

### Redis Cache
- Used for ephemeral data (refresh tokens, query results)
- All cached data has TTL settings
- Access through context's cache object

## Security Considerations

### Authentication & Authorization
- JWT access tokens (10 min TTL) stored in `dmspt` cookie
- JWT refresh tokens (24 hour TTL) stored in `dmspr` cookie
- CSRF tokens in `X-CSRF-Token` header
- Always verify tokens in resolvers before processing
- Check user roles (ADMIN, USER) for authorization

### Best Practices
- **Never** commit secrets or credentials
- **Always** use parameterized queries
- **Validate** all user input
- **Sanitize** data before database operations
- Use **HTTP-only cookies** for tokens
- Implement **CORS** restrictions

## Common Patterns

### Error Handling
```typescript
// Return errors in mutation responses
return {
  ...object,
  errors: {
    general: ['Error message'],
    fieldName: ['Field-specific error'],
  },
};
```

### Pagination
- Support both **cursor** and **offset** pagination
- Use `queryWithPagination` from `MySqlModel`
- Return `hasNextPage`, `totalCount`, and cursor/offset info

### Logging
- Use the Pino logger from `src/logger.ts`
- Log important events, errors, and security events
- Follow ECS logging format

## File Organization

```
src/
├── config/           # Configuration files
├── controllers/      # Authentication endpoints
├── datasources/      # Data source abstractions
├── middleware/       # Express middleware
├── models/           # Business logic and data models
│   └── __tests__/    # Model unit tests
├── resolvers/        # GraphQL resolvers
├── schemas/          # GraphQL schema definitions
├── services/         # Shared services
├── types/            # TypeScript type definitions
└── utils/            # Utility functions
```

## Additional Resources

- **README.md**: Comprehensive setup and usage guide
- **CONTRIBUTING.md**: Contribution guidelines and workflow
- **GraphQL schemas**: See `src/schemas/` for API definitions
- **Data models**: Documentation in README and code comments
- **Apollo Server docs**: https://www.apollographql.com/docs/apollo-server/

## When Working on Code

1. **Understand the context**: Read related files before making changes
2. **Follow patterns**: Match existing code style and structure
3. **Test thoroughly**: Write and run tests for your changes
4. **Update types**: Run `npm run generate` after schema changes
5. **Lint your code**: Run `npm run lint` before committing
6. **Update CHANGELOG**: Document notable changes
7. **Small commits**: Make focused, incremental changes
8. **Meaningful messages**: Write clear commit messages

## Common Commands

```bash
# Development
npm run dev              # Start with hot reload
npm run build            # Build for production
npm run generate         # Generate types from GraphQL schemas

# Testing & Quality
npm run test             # Run tests with coverage
npm run lint             # Lint TypeScript files

# Database
docker-compose exec apollo bash ./data-migrations/process.sh        # Run migrations
docker-compose exec apollo bash ./data-migrations/database-init.sh  # Initialize database
docker-compose exec apollo bash ./data-migrations/nuke-db.sh        # Drop all tables

# Docker
docker-compose build     # Build containers
docker-compose up        # Start services
docker-compose down      # Stop services
```

## Notes for Copilot

- This is a **TypeScript** project; prefer TypeScript patterns
- **GraphQL first**: The API is the primary interface
- **Security matters**: Always validate and authorize
- **Test coverage**: Maintain good test coverage for new code
- **Documentation**: Update docs when adding features
- **Minimize dependencies**: Only add libraries when necessary
- **Docker-based**: Local development uses Docker containers

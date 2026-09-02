import { gql } from 'graphql-tag';

export const typeDefs = gql`
  # Specialized scalars from graphql-tools: https://the-guild.dev/graphql/scalars/docs/scalars
  scalar DateTimeISO
  scalar EmailAddress
  scalar URL

  # Our custom scalars
  scalar Orcid
  scalar Ror
  scalar DmspId
  scalar MD5

  # Base Query and Mutation objects are defined here because names must be unique and each
  # individual GraphQL file has its own Queries and Mutations, so we have those extend these
  # base definitions
  type Query {
    _empty: String
  }
  type Mutation {
    _empty: String
  }

  enum PaginationType {
    "Standard pagination using offsets (first, next, previous, last)"
    OFFSET
    "Cursor-based pagination (infinite scroll/load more)"
    CURSOR
  }

  "Pagination options, either cursor-based (inifite-scroll) or offset-based pagination (standard first, next, etc.)"
  input PaginationOptions {
    "The type of pagination to use (cursor or offset)"
    type: String = "CURSOR"
    "The number of items to return"
    limit: Int
    "The cursor to start the pagination from (used for cursor infinite scroll/load more only!)"
    cursor: String
    "The number of items to skip before starting the pagination (used for standard offset pagination only!)"
    offset: Int
    "The sort field (used for standard offset pagination only!)"
    sortField: String
    "The sort order (used for standard offset pagination only!)"
    sortDir: String
    "Request just the bestPractice templates"
    bestPractice: Boolean
    "Request templates whose ownerIds match the provided array of ownerURIs"
    selectOwnerURIs: [String]
  }

  interface PaginatedQueryResults {
    "The total number of possible items"
    totalCount: Int
    "The number of items returned"
    limit: Int
    "The cursor to use for the next page of results (for infinite scroll/load more only!)"
    nextCursor: String
    "The current offset of the results (for standard offset pagination only!)"
    currentOffset: Int
    "Whether or not there is a next page"
    hasNextPage: Boolean
    "Whether or not there is a previous page (standard offset pagination only!)"
    hasPreviousPage: Boolean
    "The sortFields that are available for this query (for standard offset pagination only!)"
    availableSortFields: [String]
  }
`;

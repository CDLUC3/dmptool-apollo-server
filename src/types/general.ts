import { MyContext } from "../context";
import { GraphQLResolveInfo } from "graphql/index";

export type AuthenticatedResolverType<TResult, TArgs = Record<string, unknown>, TParent = Record<string, unknown>> = (
  parent: TParent,
  args: TArgs,
  context: MyContext,
  info: GraphQLResolveInfo
) => Promise<TResult>;

export interface SectionFilterOptions {
  bestPractice?: boolean;        // Only return records where bestPractice = 1 if present
}
export interface TemplateFilterOptions {
  bestPractice?: boolean;        // Only return records where bestPractice = 1 if present
  selectOwnerURIs?: string[];    // Only return records with the specified ownerURIs
}

export enum PaginationType {
  OFFSET = 'OFFSET', // Standard pagination using offsets (first, next, previous, last)
  CURSOR = 'CURSOR', // Cursor-based pagination (infinite scroll/load more)
}

export enum SortDirection {
  ASC = 'ASC',   // Ascending sort order
  DESC = 'DESC', // Descending sort order
}

// The options for a paginated query using offsets (useful when using: pages, next/previous buttons).
export interface PaginationOptionsForOffsets {
  type: PaginationType;           // Discriminator for offset-based pagination
  limit?: number;                 // The number of items to return (integer)
  offset?: number;                // Used for offset pagination for standard pagination (integer)
  countField?: string;            // The field to count for totalCount (string)
  sortField?: string;             // The field to sort by (string)
  sortDir?: string;               // The order to sort by (must be 'ASC' or 'DESC')
  availableSortFields?: string[]; // The available sort fields (string array)
}

// The options for a paginatated query using cursors (useful when using: infinite scroll / load more).
// Note that cursor-base pagination cannot support sort options!
export interface PaginationOptionsForCursors {
  type: PaginationType;           // Discriminator for cursor-based pagination
  limit?: number;                 // The number of items to return (integer)
  cursor?: string;                // Used for cursor-based pagination for endless scroll functionality (ISO string)
  cursorField?: string;           // The field to use for cursor-based pagination (string)
  countField?: string;            // The field to count for totalCount (string)
  sortField?: string;             // The field to sort by (string)
  sortDir?: string;               // The order to sort by (must be 'ASC' or 'DESC')
  availableSortFields?: string[]; // The available sort fields (string array)
}

export type PaginationOptions = PaginationOptionsForOffsets | PaginationOptionsForCursors;

// The results of a query that supports pagination.
export interface PaginatedQueryResults<T> {
  items: T[],
  limit: number,                  // The number of items returned
  nextCursor?: string,            // The cursor to use to retrieve the next page when using cursor based pagination
  currentOffset?: number,         // The current offset of the results when using offset based pagination
  totalCount: number | null,      // The total number of items in the result set (returned if requested)
  hasNextPage: boolean,           // Whether or not there is a next page
  hasPreviousPage?: boolean,      // Whether or not there is a previous page (offset based pagination only)
  availableSortFields?: string[], // The available sort fields (offset based pagination only)
}

export type TemplateQueryOptions = TemplateFilterOptions & PaginationOptions;

export type SectionQueryOptions = SectionFilterOptions & PaginationOptions;

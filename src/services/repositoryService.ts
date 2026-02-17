import { MyContext } from '../context';
import { prepareObjectForLogs } from '../logger';
import { Repository } from '../models/Repository';
import {
  Re3DataRepositoryRecord,
} from '../types/repository';
import {
  PaginatedQueryResults,
  PaginationOptions,
  PaginationType,
  PaginationOptionsForOffsets,
} from '../types/general';
import { openSearchFindRe3Data, openSearchFindRe3DataByURIs } from './openSearchService';

/**
 * RepositoryService
 *
 * High-level service for managing both custom and re3data repositories.
 * Orchestrates queries from multiple sources and provides unified results
 * when needed.
 */
export const RepositoryService = {
  /**
   * Search repositories with optional filtering and pagination
   *
   * Performs a combined search across both custom and re3data repositories.
   * Re3data is used as the primary source for pagination since it has the
   * more comprehensive repository list.
   *
   * Returns results with a discriminator field indicating the source.
   *
   * NOTE: Pagination strategy:
   * - Pagination (cursor/offset) is based on re3data results
   * - totalCount reflects re3data total (the comprehensive source)
   * - Custom repositories are included as a supplementary source
   * - For offset pagination: uses from parameter
   * - For cursor pagination: re3data ID is used as cursor
   */
  async searchCombined(
    reference: string,
    context: MyContext,
    term: string | null | undefined,
    subjects: string[] | null | undefined,
    keyword: string | null | undefined,
    repositoryType: string | null | undefined,
    options: PaginationOptions,
  ): Promise<PaginatedQueryResults<object>> {
    try {
      // Determine pagination parameters based on pagination type
      let from = 0;
      if (options.type === PaginationType.OFFSET) {
        const offsetOpts = options as PaginationOptionsForOffsets;
        from = offsetOpts.offset || 0;
      } else {
        // For cursor-based pagination, we would need to track cursor position
        // For now, treat first page as from=0
        // TODO: Implement proper cursor decoding for re3data offset
      }

      // Search re3data repositories with pagination
      const re3dataResponse = await searchRe3DataWithPagination(
        reference,
        context,
        term,
        subjects,
        repositoryType,
        options.limit || 10,
        from,
      );

      // Search custom repositories (without pagination applied)
      const customResults = await Repository.search(
        reference,
        context,
        term,
        subjects || [],
        keyword,
        repositoryType,
        {
          ...options,
          limit: 1000, // Get all custom results to supplement re3data
        },
      );

      // Combine results - re3data first (primary source), then custom
      const combinedItems: object[] = [
        ...re3dataResponse.repositories,
        ...(customResults.items || []),
      ];

      // Calculate pagination based on re3data (primary source)
      const limit = options.limit || 10;
      const hasNextPage = from + re3dataResponse.repositories.length < re3dataResponse.total;
      const nextFrom = from + limit;

      return {
        items: combinedItems,
        limit,
        totalCount: re3dataResponse.total,
        currentOffset: from,
        hasNextPage,
        hasPreviousPage: from > 0,
        availableSortFields: ['name', 'created'],
      };
    } catch (err) {
      context.logger.error(
        prepareObjectForLogs(err),
        `Error in RepositoryService.searchCombined`,
      );
      throw err;
    }
  },

  /**
   * Search re3data repositories by their URIs
   *
   * Fetches re3data repositories from OpenSearch using provided URIs.
   * Returns an array of Re3DataRepositoryRecord objects.
   */
  async searchRe3DataByURIs(
    reference: string,
    context: MyContext,
    uris: string[],
  ): Promise<Re3DataRepositoryRecord[]> {
    try {
      return await openSearchFindRe3DataByURIs(context, uris);
    } catch (err) {
      context.logger.warn(
        prepareObjectForLogs(err),
        `Re3data by URIs search failed in ${reference}`,
      );
      return [];
    }
  },
};

/**
 * Search re3data repositories with pagination support
 * Returns both the repositories and total count for pagination
 */
async function searchRe3DataWithPagination(
  reference: string,
  context: MyContext,
  term: string | null | undefined,
  subjects: string[] | null | undefined,
  repositoryType: string | null | undefined,
  limit: number,
  from: number,
): Promise<{ repositories: Re3DataRepositoryRecord[]; total: number }> {
  try {
    // repositoryType is already in the correct re3data format (lowercase with hyphens)
    return await openSearchFindRe3Data(
      term,
      context,
      subjects,
      repositoryType,
      limit,
      from,
    );
  } catch (err) {
    context.logger.warn(
      prepareObjectForLogs(err),
      `Re3data search failed in ${reference}, continuing with custom results only`,
    );
    return { repositories: [], total: 0 };
  }
}

/**
 * Search re3data repositories without pagination
 * Legacy function for non-paginated queries
 */
async function searchRe3Data(
  reference: string,
  context: MyContext,
  term: string | null | undefined,
  subjects: string[] | null | undefined,
  repositoryType: string | null | undefined,
  maxResults: number,
): Promise<Re3DataRepositoryRecord[]> {
  try {
    // repositoryType is already in the correct re3data format (lowercase with hyphens)
    const result = await openSearchFindRe3Data(
      term,
      context,
      subjects,
      repositoryType,
      maxResults,
    );
    return result.repositories;
  } catch (err) {
    context.logger.warn(
      prepareObjectForLogs(err),
      `Re3data search failed in ${reference}, continuing with custom results only`,
    );
    return [];
  }
}


import { MyContext } from '../context';
import { prepareObjectForLogs } from '../logger';
import { Repository, RepositoryType } from '../models/Repository';
import {
  Re3DataRepositoryRecord,
} from '../types/repository';
import {
  PaginatedQueryResults,
  PaginationOptions,
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
   * Returns results with a discriminator field indicating the source.
   */
  async searchCombined(
    reference: string,
    context: MyContext,
    term: string | null | undefined,
    subjects: string[] | null | undefined,
    keyword: string | null | undefined,
    repositoryType: RepositoryType | null | undefined,
    options: PaginationOptions,
  ): Promise<PaginatedQueryResults<object>> {
    try {
      // Search custom repositories
      const customResults = await Repository.search(
        reference,
        context,
        term,
        subjects || [],
        keyword,
        repositoryType,
        options,
      );

      // Search re3data repositories
      const re3dataResults = await searchRe3Data(
        reference,
        context,
        term,
        subjects,
        repositoryType,
        50,
      );

      // Combine results - both sources are object types
      const combinedItems: object[] = [
        ...(customResults.items || []),
        ...re3dataResults,
      ];

      return {
        items: combinedItems,
        limit: customResults.limit,
        totalCount: customResults.totalCount,
        nextCursor: customResults.nextCursor,
        currentOffset: customResults.currentOffset,
        hasNextPage: customResults.hasNextPage,
        hasPreviousPage: customResults.hasPreviousPage,
        availableSortFields: customResults.availableSortFields,
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
 * Search re3data repositories from OpenSearch
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
    return await openSearchFindRe3Data(
      term,
      context,
      subjects,
      repositoryType,
      maxResults,
    );
  } catch (err) {
    context.logger.warn(
      prepareObjectForLogs(err),
      `Re3data search failed in ${reference}, continuing with custom results only`,
    );
    return [];
  }
}


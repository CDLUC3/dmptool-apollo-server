import { RepositoryService } from '../repositoryService';
import { Repository } from '../../models/Repository';
import * as openSearchService from '../openSearchService';
import { MyContext } from '../../context';
import { PaginatedQueryResults, PaginationType, PaginationOptionsForCursors } from '../../types/general';
import { GraphQLError } from 'graphql';

jest.mock('../../models/Repository');
jest.mock('../openSearchService', () => ({
  openSearchFindRe3Data: jest.fn(),
  openSearchFindRe3DataByURIs: jest.fn(),
}));

describe('RepositoryService', () => {
  const mockContext = {
    logger: { error: jest.fn(), warn: jest.fn() },
  } as unknown as MyContext;

  const mockPaginationOptions: PaginationOptionsForCursors = {
    type: PaginationType.CURSOR,
    cursor: null,
    limit: 10,
    sortField: 'name',
    sortDir: 'ASC',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('searchCombined', () => {
    it('should combine custom and re3data repository results', async () => {
      const reference = 'test-reference';
      const term = 'data';
      const subjects = ['Life Sciences', 'Biology'];
      const keyword = 'genomics';
      const repositoryType = 'disciplinary';

      const mockCustomResults: PaginatedQueryResults<Repository> = {
        items: [
          {
            id: 1,
            name: 'Custom Repo 1',
            description: 'A custom repository',
          } as Repository,
        ],
        limit: 10,
        totalCount: 1,
        currentOffset: 0,
        hasNextPage: false,
        hasPreviousPage: false,
        availableSortFields: ['name', 'created'],
      };

      const mockRe3DataResults = {
        repositories: [
          {
            id: 'r3d100010134',
            name: 'Dryad Digital Repository',
            description: 'Dryad is a curated resource',
            repositoryTypes: ['generalist'],
          },
        ],
        total: 100,
      };

      (Repository.search as jest.Mock).mockResolvedValueOnce(mockCustomResults);
      (openSearchService.openSearchFindRe3Data as jest.Mock).mockResolvedValueOnce(
        mockRe3DataResults,
      );

      const result = await RepositoryService.searchCombined(
        reference,
        mockContext,
        term,
        subjects,
        keyword,
        repositoryType,
        mockPaginationOptions,
      );

      // Repository.search should be called with a high limit to get all custom results
      expect(Repository.search).toHaveBeenCalledWith(
        reference,
        mockContext,
        term,
        subjects,
        keyword,
        repositoryType,
        expect.objectContaining({
          ...mockPaginationOptions,
          limit: 1000,
        }),
      );

      // openSearchFindRe3Data should be called with pagination parameters
      expect(openSearchService.openSearchFindRe3Data).toHaveBeenCalledWith(
        term,
        mockContext,
        subjects,
        'disciplinary', // Already in re3data standard format
        10, // limit from pagination options
        0, // from offset
      );

      // Results should have re3data first, then custom
      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toEqual(mockCustomResults.items[0]); //custom repo first
      expect(result.items[1]).toEqual(mockRe3DataResults.repositories[0]); //re3data repo second
      // totalCount is re3data.total + customTotal = 100 + 1 = 101
      expect(result.totalCount).toBe(101);//combined total count from both sources

    });

    it('should return only custom results when re3data search fails', async () => {
      const reference = 'test-reference';
      const term = 'data';

      const mockCustomResults: PaginatedQueryResults<Repository> = {
        items: [
          {
            id: 1,
            name: 'Custom Repo 1',
            description: 'A custom repository',
          } as Repository,
        ],
        limit: 10,
        totalCount: 1,
        currentOffset: 0,
        hasNextPage: false,
        hasPreviousPage: false,
        availableSortFields: ['name', 'created'],
      };

      const error = new GraphQLError('Service temporarily unavailable', {
        extensions: {
          code: 'SERVICE_UNAVAILABLE',
          service: 'opensearch',
        },
      });

      (Repository.search as jest.Mock).mockResolvedValueOnce(mockCustomResults);
      (openSearchService.openSearchFindRe3Data as jest.Mock).mockRejectedValueOnce(error);

      const result = await RepositoryService.searchCombined(
        reference,
        mockContext,
        term,
        null,
        null,
        null,
        mockPaginationOptions,
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual(mockCustomResults.items[0]);
      expect(mockContext.logger.warn).toHaveBeenCalledWith(
        expect.any(Object),
        expect.stringContaining('Re3data search failed'),
      );
    });

    it('should return empty custom results when Repository.search returns no items', async () => {
      const reference = 'test-reference';

      const mockCustomResults: PaginatedQueryResults<Repository> = {
        items: [],
        limit: 10,
        totalCount: 0,
        currentOffset: 0,
        hasNextPage: false,
        hasPreviousPage: false,
        availableSortFields: ['name', 'created'],
      };

      const mockRe3DataResults = {
        repositories: [
          {
            id: 'r3d100010134',
            name: 'Dryad Digital Repository',
          },
        ],
        total: 50,
      };

      (Repository.search as jest.Mock).mockResolvedValueOnce(mockCustomResults);
      (openSearchService.openSearchFindRe3Data as jest.Mock).mockResolvedValueOnce(
        mockRe3DataResults,
      );

      const result = await RepositoryService.searchCombined(
        reference,
        mockContext,
        null,
        null,
        null,
        null,
        mockPaginationOptions,
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual(mockRe3DataResults.repositories[0]);
      expect(result.totalCount).toBe(mockRe3DataResults.total);
    });

    it('should handle null items from custom results', async () => {
      const reference = 'test-reference';

      const mockCustomResults: PaginatedQueryResults<Repository> = {
        items: null,
        limit: 10,
        totalCount: 0,
        currentOffset: 0,
        hasNextPage: false,
        hasPreviousPage: false,
        availableSortFields: ['name', 'created'],
      };

      const mockRe3DataResults = {
        repositories: [
          {
            id: 'r3d100010134',
            name: 'Dryad Digital Repository',
          },
        ],
        total: 75,
      };

      (Repository.search as jest.Mock).mockResolvedValueOnce(mockCustomResults);
      (openSearchService.openSearchFindRe3Data as jest.Mock).mockResolvedValueOnce(
        mockRe3DataResults,
      );

      const result = await RepositoryService.searchCombined(
        reference,
        mockContext,
        null,
        null,
        null,
        null,
        mockPaginationOptions,
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual(mockRe3DataResults.repositories[0]);
      expect(result.totalCount).toBe(mockRe3DataResults.total);
    });

    it('should pass all filter parameters to Repository.search correctly', async () => {
      const reference = 'test-reference';
      const term = 'genomics';
      const subjects = ['Biology', 'Life Sciences'];
      const keyword = 'dna';
      const repositoryType = 'governmental';

      const mockCustomResults: PaginatedQueryResults<Repository> = {
        items: [],
        limit: 10,
        totalCount: 0,
        currentOffset: 0,
        hasNextPage: false,
        hasPreviousPage: false,
        availableSortFields: ['name', 'created'],
      };

      const mockRe3DataResults = {
        repositories: [],
        total: 0,
      };

      (Repository.search as jest.Mock).mockResolvedValueOnce(mockCustomResults);
      (openSearchService.openSearchFindRe3Data as jest.Mock).mockResolvedValueOnce(
        mockRe3DataResults,
      );

      await RepositoryService.searchCombined(
        reference,
        mockContext,
        term,
        subjects,
        keyword,
        repositoryType,
        mockPaginationOptions,
      );

      // Verify subjects and repositoryType are passed directly to re3data search
      expect(openSearchService.openSearchFindRe3Data).toHaveBeenCalledWith(
        term,
        mockContext,
        subjects,
        'governmental', // Already in re3data standard format
        10, // limit
        0, // from
      );
    });

    it('should use re3data pagination for combined results', async () => {
      const reference = 'test-reference';

      const mockCustomResults: PaginatedQueryResults<Repository> = {
        items: [{ id: 1, name: 'Repo 1' } as Repository],
        limit: 20,
        totalCount: 100,
        hasNextPage: true,
        hasPreviousPage: false,
        availableSortFields: ['name', 'created'],
      };

      const mockRe3DataResults = {
        repositories: [
          { id: 'r3d1', name: 'Re3Data Repo 1' },
          { id: 'r3d2', name: 'Re3Data Repo 2' },
        ],
        total: 250,
      };

      (Repository.search as jest.Mock).mockResolvedValueOnce(mockCustomResults);
      (openSearchService.openSearchFindRe3Data as jest.Mock).mockResolvedValueOnce(
        mockRe3DataResults,
      );

      const result = await RepositoryService.searchCombined(
        reference,
        mockContext,
        null,
        null,
        null,
        null,
        mockPaginationOptions,
      );

      // Pagination should be based on re3data, not custom results
      expect(result.currentOffset).toBe(0);
      expect(result.hasNextPage).toBe(true);
      expect(result.hasPreviousPage).toBe(false);
      expect(result.limit).toBe(10);
      // // items should include custom results, then re3data results
      expect(result.items).toHaveLength(3);
      expect(result.items[0]).toEqual(mockCustomResults.items[0]); //custom first
      expect(result.items[1]).toEqual(mockRe3DataResults.repositories[0]);
      expect(result.items[2]).toEqual(mockRe3DataResults.repositories[1]);
      // totalCount = 250 + 100 = 350
      expect(result.totalCount).toBe(350); // totalCount should be combined from both sources
    });

    it('should log and rethrow if Repository.search fails', async () => {
      const reference = 'test-reference';
      const error = new Error('Database connection failed');

      (Repository.search as jest.Mock).mockRejectedValueOnce(error);

      await expect(
        RepositoryService.searchCombined(
          reference,
          mockContext,
          null,
          null,
          null,
          null,
          mockPaginationOptions,
        ),
      ).rejects.toThrow('Database connection failed');

      expect(mockContext.logger.error).toHaveBeenCalledWith(
        expect.any(Object),
        expect.stringContaining('Error in RepositoryService.searchCombined'),
      );
    });

    it('should call openSearchFindRe3Data with pagination parameters from options', async () => {
      const reference = 'test-reference';

      const mockCustomResults: PaginatedQueryResults<Repository> = {
        items: [],
        limit: 10,
        totalCount: 0,
        currentOffset: 0,
        hasNextPage: false,
        hasPreviousPage: false,
        availableSortFields: ['name', 'created'],
      };

      const mockRe3DataResults = {
        repositories: [],
        total: 0,
      };

      (Repository.search as jest.Mock).mockResolvedValueOnce(mockCustomResults);
      (openSearchService.openSearchFindRe3Data as jest.Mock).mockResolvedValueOnce(
        mockRe3DataResults,
      );

      await RepositoryService.searchCombined(
        reference,
        mockContext,
        'search-term',
        null,
        null,
        null,
        mockPaginationOptions,
      );

      const call = (openSearchService.openSearchFindRe3Data as jest.Mock).mock.calls[0];
      expect(call[4]).toBe(10); // limit from pagination options
      expect(call[5]).toBe(0); // from offset (first page)
    });

    it('should pass type filter to openSearchFindRe3Data', async () => {
      const reference = 'test-reference';

      const mockCustomResults: PaginatedQueryResults<Repository> = {
        items: [],
        limit: 10,
        totalCount: 0,
        currentOffset: 0,
        hasNextPage: false,
        hasPreviousPage: false,
        availableSortFields: ['name', 'created'],
      };

      const mockRe3DataResults = {
        repositories: [],
        total: 0,
      };

      (Repository.search as jest.Mock).mockResolvedValueOnce(mockCustomResults);
      (openSearchService.openSearchFindRe3Data as jest.Mock).mockResolvedValueOnce(
        mockRe3DataResults,
      );

      await RepositoryService.searchCombined(
        reference,
        mockContext,
        null,
        null,
        null,
        'disciplinary', // This is passed directly to Repository.search and re3data
        mockPaginationOptions,
      );

      const call = (openSearchService.openSearchFindRe3Data as jest.Mock).mock.calls[0];
      // Type parameter is passed directly in re3data format
      expect(call[3]).toBe('disciplinary');
    });

    it('should correctly pass various repository type values to re3data search', async () => {
      const reference = 'test-reference';

      const mockCustomResults: PaginatedQueryResults<Repository> = {
        items: [],
        limit: 10,
        totalCount: 0,
        currentOffset: 0,
        hasNextPage: false,
        hasPreviousPage: false,
        availableSortFields: ['name', 'created'],
      };

      // Test cases for different repository types (using re3data standard format)
      const testCases: [string, string][] = [
        ['disciplinary', 'disciplinary'],
        ['institutional', 'institutional'],
        ['multidisciplinary', 'multidisciplinary'],
        ['governmental', 'governmental'],
        ['project-related', 'project-related'],
        ['other', 'other'],
      ];

      for (const [inputValue, expectedFormat] of testCases) {
        jest.clearAllMocks();
        (Repository.search as jest.Mock).mockResolvedValueOnce(mockCustomResults);
        (openSearchService.openSearchFindRe3Data as jest.Mock).mockResolvedValueOnce({
          repositories: [],
          total: 0,
        });

        await RepositoryService.searchCombined(
          reference,
          mockContext,
          null,
          null,
          null,
          inputValue,
          mockPaginationOptions,
        );

        const call = (openSearchService.openSearchFindRe3Data as jest.Mock).mock.calls[0];
        expect(call[3]).toBe(expectedFormat);
      }
    });

    it('should only show custom repos on the first page when re3data has results', async () => {
      const reference = 'test-reference';

      const mockCustomResults: PaginatedQueryResults<Repository> = {
        items: [{ id: 1, name: 'Custom Repo' } as Repository],
        limit: 10,
        totalCount: 1,
        currentOffset: 0,
        hasNextPage: false,
        hasPreviousPage: false,
        availableSortFields: ['name', 'created'],
      };

      const mockRe3DataResults = {
        repositories: [{ id: 'r3d1', name: 'Re3Data Repo' }],
        total: 50,
      };

      (Repository.search as jest.Mock).mockResolvedValue(mockCustomResults);
      (openSearchService.openSearchFindRe3Data as jest.Mock).mockResolvedValue(mockRe3DataResults);

      // Page 2 (from=10): custom repos should NOT appear
      const offsetOptions = {
        type: PaginationType.OFFSET,
        offset: 10,
        limit: 10,
        sortField: 'name',
        sortDir: 'ASC',
      };

      const result = await RepositoryService.searchCombined(
        reference, mockContext, null, null, null, null, offsetOptions,
      );

      // Custom repo should not be in results on page 2, and re3data repo should be present
      expect(result.items).not.toContainEqual(mockCustomResults.items[0]);
      expect(result.items).toEqual(mockRe3DataResults.repositories);
    });

    it('should sort custom repos alphabetically before merging', async () => {
      const reference = 'test-reference';

      const mockCustomResults: PaginatedQueryResults<Repository> = {
        items: [
          { id: 3, name: 'Zebra Repo' } as Repository,
          { id: 1, name: 'Alpha Repo' } as Repository,
          { id: 2, name: 'Middle Repo' } as Repository,
        ],
        limit: 10,
        totalCount: 3,
        currentOffset: 0,
        hasNextPage: false,
        hasPreviousPage: false,
        availableSortFields: ['name', 'created'],
      };

      const mockRe3DataResults = {
        repositories: [{ id: 'r3d1', name: 'Re3Data Repo' }],
        total: 50,
      };

      (Repository.search as jest.Mock).mockResolvedValueOnce(mockCustomResults);
      (openSearchService.openSearchFindRe3Data as jest.Mock).mockResolvedValueOnce(mockRe3DataResults);

      const result = await RepositoryService.searchCombined(
        reference, mockContext, null, null, null, null, mockPaginationOptions,
      );

      // Custom repos should appear sorted alphabetically at the start
      expect(result.items[0]).toMatchObject({ name: 'Alpha Repo' });
      expect(result.items[1]).toMatchObject({ name: 'Middle Repo' });
      expect(result.items[2]).toMatchObject({ name: 'Zebra Repo' });
    });

    it('should always fetch custom repos from offset 0 regardless of pagination', async () => {
      const reference = 'test-reference';
      const offsetOptions = {
        type: PaginationType.OFFSET,
        offset: 20,
        limit: 10,
        sortField: 'name',
        sortDir: 'ASC',
      };

      const mockCustomResults: PaginatedQueryResults<Repository> = {
        items: [],
        limit: 10,
        totalCount: 0,
        currentOffset: 0,
        hasNextPage: false,
        hasPreviousPage: false,
        availableSortFields: ['name', 'created'],
      };

      (Repository.search as jest.Mock).mockResolvedValueOnce(mockCustomResults);
      (openSearchService.openSearchFindRe3Data as jest.Mock).mockResolvedValueOnce({
        repositories: [],
        total: 0,
      });

      await RepositoryService.searchCombined(
        reference, mockContext, null, null, null, null, offsetOptions,
      );

      expect(Repository.search).toHaveBeenCalledWith(
        expect.any(String),
        expect.anything(),
        null,
        [],
        null,
        null,
        expect.objectContaining({ offset: 0 }), // always 0
      );
    });

    it('should paginate custom repos directly when re3data returns nothing', async () => {
      const reference = 'test-reference';
      const offsetOptions = {
        type: PaginationType.OFFSET,
        offset: 5,
        limit: 3,
        sortField: 'name',
        sortDir: 'ASC',
      };

      const customItems = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        name: `Custom Repo ${String(i + 1).padStart(2, '0')}`,
      } as Repository));

      const mockCustomResults: PaginatedQueryResults<Repository> = {
        items: customItems,
        limit: 1000,
        totalCount: 10,
        currentOffset: 0,
        hasNextPage: false,
        hasPreviousPage: false,
        availableSortFields: ['name', 'created'],
      };

      (Repository.search as jest.Mock).mockResolvedValueOnce(mockCustomResults);
      (openSearchService.openSearchFindRe3Data as jest.Mock).mockResolvedValueOnce({
        repositories: [],
        total: 0,
      });

      const result = await RepositoryService.searchCombined(
        reference, mockContext, null, null, null, null, offsetOptions,
      );

      // Should slice custom items from offset 5, limit 3 → gives indices 5,6,7 (Custom Repo 06, 07, 08)
      expect(result.items).toHaveLength(3);
      expect(result.items[0]).toMatchObject({ name: 'Custom Repo 06' });
      expect(result.totalCount).toBe(10);
      expect(result.hasNextPage).toBe(true); // 5 + 3 < 10
      expect(result.hasPreviousPage).toBe(true); // from > 0
    });

    it('should set hasNextPage false when on last page of custom-only results', async () => {
      const reference = 'test-reference';
      const offsetOptions = {
        type: PaginationType.OFFSET,
        offset: 8,
        limit: 5,
        sortField: 'name',
        sortDir: 'ASC',
      };

      const customItems = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        name: `Custom Repo ${i + 1}`,
      } as Repository));

      const mockCustomResults: PaginatedQueryResults<Repository> = {
        items: customItems,
        limit: 1000,
        totalCount: 10,
        currentOffset: 0,
        hasNextPage: false,
        hasPreviousPage: false,
        availableSortFields: ['name', 'created'],
      };

      (Repository.search as jest.Mock).mockResolvedValueOnce(mockCustomResults);
      (openSearchService.openSearchFindRe3Data as jest.Mock).mockResolvedValueOnce({
        repositories: [],
        total: 0,
      });

      const result = await RepositoryService.searchCombined(
        reference, mockContext, null, null, null, null, offsetOptions,
      );

      // from=8, limit=5: only 2 items remain (indices 8,9), 8+5=13 >= 10
      expect(result.items).toHaveLength(2);
      expect(result.hasNextPage).toBe(false); // No next page since only 2 items remain on the page
    });
  });

  describe('searchRe3DataByURIs', () => {
    it('should return re3data records from OpenSearch by URIs', async () => {
      const reference = 'test-reference';
      const uris = [
        'http://www.re3data.org/repository/r3d100010134',
        'http://www.re3data.org/repository/r3d100014782',
      ];

      const mockResults = [
        {
          id: 'r3d100010134',
          name: 'Dryad Digital Repository',
          website: 'https://datadryad.org/',
          uri: uris[0],
        },
        {
          id: 'r3d100014782',
          name: 'Zenodo',
          website: 'https://zenodo.org/',
          uri: uris[1],
        },
      ];

      (openSearchService.openSearchFindRe3DataByURIs as jest.Mock).mockResolvedValueOnce(
        mockResults,
      );

      const result = await RepositoryService.searchRe3DataByURIs(
        reference,
        mockContext,
        uris,
      );

      expect(openSearchService.openSearchFindRe3DataByURIs).toHaveBeenCalledWith(
        mockContext,
        uris,
      );
      expect(result).toEqual(mockResults);
    });

    it('should return empty array if no URIs provided', async () => {
      const reference = 'test-reference';
      const uris: string[] = [];

      (openSearchService.openSearchFindRe3DataByURIs as jest.Mock).mockResolvedValueOnce([]);

      const result = await RepositoryService.searchRe3DataByURIs(
        reference,
        mockContext,
        uris,
      );

      expect(result).toEqual([]);
    });

    it('should return empty array and log warning if OpenSearch search fails', async () => {
      const reference = 'test-reference';
      const uris = ['http://example.com/repository/r3d100010134'];
      const error = new GraphQLError('Service temporarily unavailable', {
        extensions: {
          code: 'SERVICE_UNAVAILABLE',
          service: 'opensearch',
        },
      });

      (openSearchService.openSearchFindRe3DataByURIs as jest.Mock).mockRejectedValueOnce(error);

      const result = await RepositoryService.searchRe3DataByURIs(
        reference,
        mockContext,
        uris,
      );

      expect(result).toEqual([]);
      expect(mockContext.logger.warn).toHaveBeenCalledWith(
        expect.any(Object),
        expect.stringContaining('Re3data by URIs search failed'),
      );
    });

    it('should handle partial results when some URIs find no matches', async () => {
      const reference = 'test-reference';
      const uris = [
        'http://www.re3data.org/repository/r3d100010134',
        'http://www.re3data.org/repository/nonexistent',
        'http://www.re3data.org/repository/r3d100014782',
      ];

      const mockResults = [
        {
          id: 'r3d100010134',
          name: 'Dryad Digital Repository',
          uri: uris[0],
        },
        {
          id: 'r3d100014782',
          name: 'Zenodo',
          uri: uris[2],
        },
      ];

      (openSearchService.openSearchFindRe3DataByURIs as jest.Mock).mockResolvedValueOnce(
        mockResults,
      );

      const result = await RepositoryService.searchRe3DataByURIs(
        reference,
        mockContext,
        uris,
      );

      expect(result).toHaveLength(2);
      expect(result).toEqual(mockResults);
    });

    it('should pass reference name in error message', async () => {
      const reference = 'my-custom-reference';
      const uris = ['http://example.com/repository/r3d100010134'];
      const error = new Error('Connection timeout');

      (openSearchService.openSearchFindRe3DataByURIs as jest.Mock).mockRejectedValueOnce(error);

      await RepositoryService.searchRe3DataByURIs(reference, mockContext, uris);

      expect(mockContext.logger.warn).toHaveBeenCalledWith(
        expect.any(Object),
        expect.stringContaining(reference),
      );
    });

    it('should handle multiple URIs correctly', async () => {
      const reference = 'test-reference';
      const uris = Array.from({ length: 10 }, (_, i) =>
        `http://www.re3data.org/repository/r3d${String(100010134 + i).padStart(9, '0')}`,
      );

      const mockResults = uris.map((uri, i) => ({
        id: `r3d${String(100010134 + i).padStart(9, '0')}`,
        name: `Repository ${i + 1}`,
        uri,
      }));

      (openSearchService.openSearchFindRe3DataByURIs as jest.Mock).mockResolvedValueOnce(
        mockResults,
      );

      const result = await RepositoryService.searchRe3DataByURIs(
        reference,
        mockContext,
        uris,
      );

      expect(result).toHaveLength(10);
      expect(openSearchService.openSearchFindRe3DataByURIs).toHaveBeenCalledWith(
        mockContext,
        uris,
      );
    });
  });

  describe('edge cases and integration', () => {
    it('should handle all filter parameters as null', async () => {
      const reference = 'test-reference';

      const mockCustomResults: PaginatedQueryResults<Repository> = {
        items: [],
        limit: 10,
        totalCount: 0,
        currentOffset: 0,
        hasNextPage: false,
        hasPreviousPage: false,
        availableSortFields: ['name', 'created'],
      };

      const mockRe3DataResults = {
        repositories: [],
        total: 0,
      };

      (Repository.search as jest.Mock).mockResolvedValueOnce(mockCustomResults);
      (openSearchService.openSearchFindRe3Data as jest.Mock).mockResolvedValueOnce(
        mockRe3DataResults,
      );

      const result = await RepositoryService.searchCombined(
        reference,
        mockContext,
        null,
        null,
        null,
        null,
        mockPaginationOptions,
      );

      // Repository.search should be called with high limit to get all custom results
      expect(Repository.search).toHaveBeenCalledWith(
        reference,
        mockContext,
        null,
        [],
        null,
        null,
        expect.objectContaining({
          limit: 1000,
        }),
      );

      expect(result).toBeDefined();
      expect(result.items).toEqual([]);
    });

    it('should handle undefined filter parameters', async () => {
      const reference = 'test-reference';

      const mockCustomResults: PaginatedQueryResults<Repository> = {
        items: [],
        limit: 10,
        totalCount: 0,
        currentOffset: 0,
        hasNextPage: false,
        hasPreviousPage: false,
        availableSortFields: ['name', 'created'],
      };

      const mockRe3DataResults = {
        repositories: [],
        total: 0,
      };

      (Repository.search as jest.Mock).mockResolvedValueOnce(mockCustomResults);
      (openSearchService.openSearchFindRe3Data as jest.Mock).mockResolvedValueOnce(
        mockRe3DataResults,
      );

      const result = await RepositoryService.searchCombined(
        reference,
        mockContext,
        undefined,
        undefined,
        undefined,
        undefined,
        mockPaginationOptions,
      );

      expect(result).toBeDefined();
      expect(result.items).toEqual([]);
    });

    it('should handle mixed custom and re3data results with different pagination', async () => {
      const reference = 'test-reference';

      const mockCustomResults: PaginatedQueryResults<Repository> = {
        items: Array.from({ length: 5 }, (_, i) => ({
          id: i + 1,
          name: `Custom Repo ${i + 1}`,
        } as Repository)),
        limit: 20,
        totalCount: 100,
        nextCursor: 'cursor-xyz',
        currentOffset: 0,
        hasNextPage: true,
        hasPreviousPage: false,
        availableSortFields: ['name', 'created'],
      };

      const mockRe3DataResults = {
        repositories: Array.from({ length: 3 }, (_, i) => ({
          id: `r3d${String(i + 1).padStart(9, '0')}`,
          name: `Re3Data Repo ${i + 1}`,
          repositoryTypes: ['generalist'],
        })),
        total: 250,
      };

      (Repository.search as jest.Mock).mockResolvedValueOnce(mockCustomResults);
      (openSearchService.openSearchFindRe3Data as jest.Mock).mockResolvedValueOnce(
        mockRe3DataResults,
      );

      const result = await RepositoryService.searchCombined(
        reference,
        mockContext,
        'test',
        null,
        null,
        null,
        mockPaginationOptions,
      );

      // Results should have re3data first (3), then custom (5) = 8 total items
      expect(result.items).toHaveLength(8);
      expect(result.items.slice(0, 5)).toEqual(mockCustomResults.items); // custom first
      expect(result.items.slice(5, 8)).toEqual(mockRe3DataResults.repositories);
      // totalCount = 250 + 100 = 350
      expect(result.totalCount).toBe(350);

    });
  });
});


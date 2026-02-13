import { RepositoryService } from '../repositoryService';
import { Repository, RepositoryType } from '../../models/Repository';
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
      const researchDomainId = 1;
      const keyword = 'genomics';
      const repositoryType = RepositoryType.DISCIPLINARY;
      const subject = 'Life Sciences';

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

      const mockRe3DataResults = [
        {
          id: 'r3d100010134',
          name: 'Dryad Digital Repository',
          description: 'Dryad is a curated resource',
          types: ['generalist'],
        },
      ];

      (Repository.search as jest.Mock).mockResolvedValueOnce(mockCustomResults);
      (openSearchService.openSearchFindRe3Data as jest.Mock).mockResolvedValueOnce(
        mockRe3DataResults,
      );

      const result = await RepositoryService.searchCombined(
        reference,
        mockContext,
        term,
        researchDomainId,
        keyword,
        repositoryType,
        subject,
        mockPaginationOptions,
      );

      expect(Repository.search).toHaveBeenCalledWith(
        reference,
        mockContext,
        term,
        researchDomainId,
        keyword,
        repositoryType,
        mockPaginationOptions,
      );

      expect(openSearchService.openSearchFindRe3Data).toHaveBeenCalledWith(
        term,
        mockContext,
        subject,
        null,
        50,
      );

      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toEqual(mockCustomResults.items[0]);
      expect(result.items[1]).toEqual(mockRe3DataResults[0]);
      expect(result.limit).toBe(mockCustomResults.limit);
      expect(result.totalCount).toBe(mockCustomResults.totalCount);
      expect(result.hasNextPage).toBe(mockCustomResults.hasNextPage);
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

      const mockRe3DataResults = [
        {
          id: 'r3d100010134',
          name: 'Dryad Digital Repository',
        },
      ];

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
        null,
        mockPaginationOptions,
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual(mockRe3DataResults[0]);
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

      const mockRe3DataResults = [
        {
          id: 'r3d100010134',
          name: 'Dryad Digital Repository',
        },
      ];

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
        null,
        mockPaginationOptions,
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual(mockRe3DataResults[0]);
    });

    it('should pass all filter parameters to Repository.search correctly', async () => {
      const reference = 'test-reference';
      const term = 'genomics';
      const researchDomainId = 42;
      const keyword = 'dna';
      const repositoryType = RepositoryType.GOVERNMENTAL;
      const subject = 'Biology';

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
      (openSearchService.openSearchFindRe3Data as jest.Mock).mockResolvedValueOnce([]);

      await RepositoryService.searchCombined(
        reference,
        mockContext,
        term,
        researchDomainId,
        keyword,
        repositoryType,
        subject,
        mockPaginationOptions,
      );

      expect(Repository.search).toHaveBeenCalledWith(
        reference,
        mockContext,
        term,
        researchDomainId,
        keyword,
        repositoryType,
        mockPaginationOptions,
      );

      // Verify subject is used for re3data search, not repository type
      expect(openSearchService.openSearchFindRe3Data).toHaveBeenCalledWith(
        term,
        mockContext,
        subject,
        null, // type parameter is always null (not exposed yet)
        50,
      );
    });

    it('should preserve pagination info from custom results', async () => {
      const reference = 'test-reference';
      const nextCursor = 'cursor-abc123';
      const currentOffset = 20;

      const mockCustomResults: PaginatedQueryResults<Repository> = {
        items: [{ id: 1, name: 'Repo 1' } as Repository],
        limit: 20,
        totalCount: 100,
        nextCursor,
        currentOffset,
        hasNextPage: true,
        hasPreviousPage: true,
        availableSortFields: ['name', 'created'],
      };

      (Repository.search as jest.Mock).mockResolvedValueOnce(mockCustomResults);
      (openSearchService.openSearchFindRe3Data as jest.Mock).mockResolvedValueOnce([]);

      const result = await RepositoryService.searchCombined(
        reference,
        mockContext,
        null,
        null,
        null,
        null,
        null,
        mockPaginationOptions,
      );

      expect(result.nextCursor).toBe(nextCursor);
      expect(result.currentOffset).toBe(currentOffset);
      expect(result.hasNextPage).toBe(true);
      expect(result.hasPreviousPage).toBe(true);
      expect(result.limit).toBe(20);
      expect(result.totalCount).toBe(100);
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
          null,
          mockPaginationOptions,
        ),
      ).rejects.toThrow('Database connection failed');

      expect(mockContext.logger.error).toHaveBeenCalledWith(
        expect.any(Object),
        expect.stringContaining('Error in RepositoryService.searchCombined'),
      );
    });

    it('should call openSearchFindRe3Data with fixed maxResults of 50', async () => {
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

      (Repository.search as jest.Mock).mockResolvedValueOnce(mockCustomResults);
      (openSearchService.openSearchFindRe3Data as jest.Mock).mockResolvedValueOnce([]);

      await RepositoryService.searchCombined(
        reference,
        mockContext,
        'search-term',
        null,
        null,
        null,
        null,
        mockPaginationOptions,
      );

      const call = (openSearchService.openSearchFindRe3Data as jest.Mock).mock.calls[0];
      expect(call[4]).toBe(50); // maxResults parameter should always be 50
    });

    it('should pass type filter as null to openSearchFindRe3Data (not exposed in GraphQL yet)', async () => {
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

      (Repository.search as jest.Mock).mockResolvedValueOnce(mockCustomResults);
      (openSearchService.openSearchFindRe3Data as jest.Mock).mockResolvedValueOnce([]);

      await RepositoryService.searchCombined(
        reference,
        mockContext,
        null,
        null,
        null,
        RepositoryType.DISCIPLINARY, // This is passed to Repository.search, not re3data
        null,
        mockPaginationOptions,
      );

      const call = (openSearchService.openSearchFindRe3Data as jest.Mock).mock.calls[0];
      expect(call[3]).toBeNull(); // type parameter is always null
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

      (Repository.search as jest.Mock).mockResolvedValueOnce(mockCustomResults);
      (openSearchService.openSearchFindRe3Data as jest.Mock).mockResolvedValueOnce([]);

      const result = await RepositoryService.searchCombined(
        reference,
        mockContext,
        null,
        null,
        null,
        null,
        null,
        mockPaginationOptions,
      );

      expect(Repository.search).toHaveBeenCalledWith(
        reference,
        mockContext,
        null,
        null,
        null,
        null,
        mockPaginationOptions,
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

      (Repository.search as jest.Mock).mockResolvedValueOnce(mockCustomResults);
      (openSearchService.openSearchFindRe3Data as jest.Mock).mockResolvedValueOnce([]);

      const result = await RepositoryService.searchCombined(
        reference,
        mockContext,
        undefined,
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

      const mockRe3DataResults = Array.from({ length: 3 }, (_, i) => ({
        id: `r3d${String(i + 1).padStart(9, '0')}`,
        name: `Re3Data Repo ${i + 1}`,
        types: ['generalist'],
      }));

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
        null,
        mockPaginationOptions,
      );

      expect(result.items).toHaveLength(8); // 5 custom + 3 re3data
      expect(result.items.slice(0, 5)).toEqual(mockCustomResults.items);
      expect(result.items.slice(5, 8)).toEqual(mockRe3DataResults);
    });
  });
});


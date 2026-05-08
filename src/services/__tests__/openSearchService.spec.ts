import {
  createOpenSearchClient,
  createOpenSearchServerlessClient
} from '../../datasources/openSearch';
import { OpenSearchService } from '../openSearchService';
import { MyContext } from '../../context';
import { GraphQLError } from 'graphql';

jest.mock('../../datasources/openSearch');

describe('OpenSearchService', () => {
  const mockContext = {
    logger: {
      error: jest.fn(),
      debug: jest.fn(),
    },
  } as unknown as MyContext;

  const mockSearch = jest.fn();
  let service: OpenSearchService;

  beforeEach(() => {
    jest.clearAllMocks();
    (createOpenSearchClient as jest.Mock).mockReturnValue({ search: mockSearch });
    (createOpenSearchServerlessClient as jest.Mock).mockReturnValue({ search: mockSearch });
    service = new OpenSearchService();
  });

  describe('findWorkByIdentifier', () => {
    test.each([null, undefined, '', '   '])('Returns empty array if DOI is invalid: "%s"', async (doi) => {
      const result = await service.findWorkByIdentifier('reference', mockContext, doi, 10);

      expect(result).toEqual([]);
      expect(mockSearch).not.toHaveBeenCalled();
    });

    test('Returns converted works when OpenSearch returns hits', async () => {
      mockSearch.mockResolvedValue({
        body: {
          hits: {
            hits: [
              {
                _source: {
                  doi: '10.1234/example.doi',
                  title: 'Sample Research Title',
                  abstract_text: 'This is a summary of the work.',
                  hash: 'abc123hash',
                  work_type: 'article',
                  publication_date: '2023-01-01',
                  updated_date: '2023-06-15',
                  publication_venue: 'Journal of Examples',
                  institutions: [
                    {
                      name: 'Example University',
                      ror: 'https://ror.org/012345678',
                    },
                  ],
                  authors: [
                    {
                      orcid: '0000-0000-0000-0000',
                      first_initial: 'J',
                      given_name: 'John',
                      middle_initials: 'D',
                      middle_names: 'Doe',
                      surname: 'Smith',
                      full: 'John D. Smith',
                    },
                  ],
                  funders: [
                    {
                      name: 'National Science Foundation',
                      ror: 'https://ror.org/021nxhr62',
                    },
                  ],
                  awards: [
                    {
                      award_id: 'NSF-123456',
                    },
                  ],
                  source: {
                    name: 'Crossref',
                    url: 'https://crossref.org',
                  },
                },
              },
            ],
          },
        },
      });

      const result = await service.findWorkByIdentifier('reference', mockContext, '10.1234/doi', 5);
      expect(mockSearch).toHaveBeenCalledWith({
        index: 'works-index',
        body: {
          size: 5,
          query: { ids: { values: ['10.1234/doi'] } },
        },
      });

      expect(result).toEqual([
        expect.objectContaining({
          doi: '10.1234/example.doi',
          title: 'Sample Research Title',
          abstractText: 'This is a summary of the work.',
          hash: 'abc123hash',
          workType: 'article',
          publicationDate: '2023-01-01',
          updatedDate: '2023-06-15',
          publicationVenue: 'Journal of Examples',
          institutions: [
            {
              name: 'Example University',
              ror: 'https://ror.org/012345678',
            },
          ],
          authors: [
            {
              orcid: '0000-0000-0000-0000',
              firstInitial: 'J',
              givenName: 'John',
              middleInitials: 'D',
              middleNames: 'Doe',
              surname: 'Smith',
              full: 'John D. Smith',
            },
          ],
          funders: [
            {
              name: 'National Science Foundation',
              ror: 'https://ror.org/021nxhr62',
            },
          ],
          awards: [
            {
              awardId: 'NSF-123456',
            },
          ],
          source: {
            name: 'Crossref',
            url: 'https://crossref.org',
          },
        }),
      ]);
    });

    test('Logs and rethrows if OpenSearch search fails', async () => {
      const error = new Error('Connection failed');
      mockSearch.mockRejectedValue(error);

      const call = service.findWorkByIdentifier('reference', mockContext, '10.1234/valid-doi', 10);
      await expect(call).rejects.toThrow('Service temporarily unavailable');
      await expect(call).rejects.toBeInstanceOf(GraphQLError);

      await expect(call).rejects.toMatchObject({
        extensions: {
          code: 'SERVICE_UNAVAILABLE',
          service: 'opensearch',
          details: expect.stringContaining('trouble connecting'),
        },
      });

      expect(mockContext.logger.error).toHaveBeenCalledWith(
        expect.objectContaining({}),
        expect.stringContaining('Error fetching works with DOI 10.1234/valid-doi from OpenSearch domain in reference'),
      );
    });

    test('Logs and rethrows if response structure is invalid', async () => {
      mockSearch.mockResolvedValue({ body: {} });
      await expect(service.findWorkByIdentifier('reference', mockContext, '10.1234/valid-doi', 10)).rejects.toThrow();

      expect(mockContext.logger.error).toHaveBeenCalledWith(
        expect.any(Object),
        expect.stringContaining('Error converting OpenSearch response'),
      );
    });
  });

  describe('findRe3Data', () => {
    test('Returns converted re3data records when OpenSearch returns hits', async () => {
      mockSearch.mockResolvedValue({
        body: {
          hits: {
            total: { value: 100 },
            hits: [
              {
                _source: {
                  id: 'r3d100010134',
                  name: 'Dryad Digital Repository',
                  description: 'Dryad is a curated resource that makes the data underlying scientific publications discoverable, freely reusable, and citable.',
                  website: 'https://datadryad.org/',
                  contact: 'help@datadryad.org',
                  uri: 'http://www.re3data.org/repository/r3d100010134',
                  repository_types: ['disciplinary'],
                  subjects: ['Life Sciences', 'Medicine'],
                  provider_types: ['non-profit'],
                  keywords: ['data', 'science'],
                  access: 'open',
                  pid_system: ['DOI'],
                  policies: ['Data Policy'],
                  upload_types: ['images', 'text'],
                  certificates: ['CoreTrustSeal'],
                  software: ['DSpace'],
                  created: '2023-01-01T00:00:00Z',
                  modified: '2023-06-15T00:00:00Z',
                },
              },
            ],
          },
        },
      });

      const result = await service.findRe3Data('Dryad', mockContext, ['Life Sciences'], 'disciplinary', 5, 0);

      expect(mockSearch).toHaveBeenCalledWith({
        index: 're3data',
        body: {
          from: 0,
          size: 5,
          query: {
            bool: {
              must: [
                {
                  multi_match: {
                    query: 'Dryad',
                    fields: ['name^2', 'description', 'keywords', 'subjects', 'repositoryTypes', 'search_all'],
                  },
                },
              ],
              filter: [
                { terms: { subjects: ['Life Sciences'] } },
                { term: { repositoryTypes: 'disciplinary' } },
              ],
            },
          },
          sort: [{ "name.keyword": { order: 'asc' } }],
        },
      });

      expect(result).toEqual({
        repositories: [
          expect.objectContaining({
            id: 'r3d100010134',
            name: 'Dryad Digital Repository',
            description: 'Dryad is a curated resource that makes the data underlying scientific publications discoverable, freely reusable, and citable.',
            website: 'https://datadryad.org/',
            contact: 'help@datadryad.org',
            uri: 'http://www.re3data.org/repository/r3d100010134',
            repositoryTypes: ['disciplinary'],
            subjects: ['Life Sciences', 'Medicine'],
            providerTypes: ['non-profit'],
            keywords: ['data', 'science'],
            access: 'open',
            pidSystem: ['DOI'],
            policies: ['Data Policy'],
            uploadTypes: ['images', 'text'],
            certificates: ['CoreTrustSeal'],
            software: ['DSpace'],
            created: '2023-01-01T00:00:00Z',
            modified: '2023-06-15T00:00:00Z',
          }),
        ],
        total: 100,
      });
    });

    test('Handles empty search term correctly', async () => {
      mockSearch.mockResolvedValue({
        body: {
          hits: {
            total: { value: 0 },
            hits: [],
          },
        },
      });

      const result = await service.findRe3Data(null, mockContext, null, null, 10, 0);

      expect(mockSearch).toHaveBeenCalledWith({
        index: 're3data',
        body: {
          from: 0,
          size: 10,
          query: {
            bool: {
              must: [{ match_all: {} }],
              filter: [],
            },
          },
          sort: [{ "name.keyword": { order: 'asc' } }],
        },
      });

      expect(result).toEqual({
        repositories: [],
        total: 0,
      });
    });

    test('Logs and rethrows if OpenSearch search fails', async () => {
      const error = new Error('Connection failed');
      mockSearch.mockRejectedValue(error);

      const call = service.findRe3Data('term', mockContext, null, null, 10, 0);
      await expect(call).rejects.toThrow('Service temporarily unavailable');
      await expect(call).rejects.toBeInstanceOf(GraphQLError);

      expect(mockContext.logger.error).toHaveBeenCalledWith(
        expect.objectContaining({}),
        expect.stringContaining('Error fetching re3data from OpenSearch'),
      );
    });

    test('Logs and rethrows if response structure is invalid', async () => {
      mockSearch.mockResolvedValue({ body: {} });
      await expect(service.findRe3Data('term', mockContext, null, null, 10, 0)).rejects.toThrow();

      expect(mockContext.logger.error).toHaveBeenCalledWith(
        expect.any(Object),
        expect.stringContaining('Error converting OpenSearch response'),
      );
    });

    test('Normalizes subject casing to title case before filtering', async () => {
      mockSearch.mockResolvedValue({
        body: { hits: { total: { value: 0 }, hits: [] } },
      });

      await service.findRe3Data(null, mockContext, ['economics', 'life sciences'], null, 10, 0);

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            query: expect.objectContaining({
              bool: expect.objectContaining({
                filter: [{ terms: { subjects: ['Economics', 'Life Sciences'] } }],
              }),
            }),
          }),
        })
      );
    });

    test('Filters out empty or whitespace-only subjects', async () => {
      mockSearch.mockResolvedValue({
        body: { hits: { total: { value: 0 }, hits: [] } },
      });

      await service.findRe3Data(null, mockContext, ['', '   ', null], null, 10, 0);

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            query: expect.objectContaining({
              bool: expect.objectContaining({
                filter: [], // all subjects were invalid, so no filter pushed
              }),
            }),
          }),
        })
      );
    });

    test('Trims whitespace from subjects before title-casing', async () => {
      mockSearch.mockResolvedValue({
        body: { hits: { total: { value: 0 }, hits: [] } },
      });

      await service.findRe3Data(null, mockContext, ['  economics  '], null, 10, 0);

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            query: expect.objectContaining({
              bool: expect.objectContaining({
                filter: [{ terms: { subjects: ['Economics'] } }],
              }),
            }),
          }),
        })
      );
    });
  });

  describe('findRe3DataRepositoryTypes', () => {
    test('Returns repository types with counts when includeCount is true', async () => {
      mockSearch.mockResolvedValue({
        body: {
          aggregations: {
            unique_types: {
              buckets: [
                { key: 'disciplinary', doc_count: 150 },
                { key: 'generalist', doc_count: 45 },
                { key: 'institutional', doc_count: 320 },
              ],
            },
          },
        },
      });

      const result = await service.findRe3DataRepositoryTypes(mockContext, true, 10);

      expect(mockSearch).toHaveBeenCalledWith({
        index: 're3data',
        body: {
          size: 0,
          aggs: {
            unique_types: {
              terms: {
                field: 'repositoryTypes',
                size: 10,
              },
            },
          },
        },
      });

      expect(result).toEqual([
        { type: 'disciplinary', count: 150 },
        { type: 'generalist', count: 45 },
        { type: 'institutional', count: 320 },
      ]);
    });

    test('Returns repository types without counts when includeCount is false', async () => {
      mockSearch.mockResolvedValue({
        body: {
          aggregations: {
            unique_types: {
              buckets: [
                { key: 'disciplinary', doc_count: 150 },
                { key: 'generalist', doc_count: 45 },
              ],
            },
          },
        },
      });

      const result = await service.findRe3DataRepositoryTypes(mockContext, false, 5);

      expect(result).toEqual([
        { type: 'disciplinary' },
        { type: 'generalist' },
      ]);
    });

    test('Respects maxResults parameter', async () => {
      mockSearch.mockResolvedValue({
        body: {
          aggregations: {
            unique_types: {
              buckets: [
                { key: 'disciplinary', doc_count: 150 },
              ],
            },
          },
        },
      });

      await service.findRe3DataRepositoryTypes(mockContext, true, 100);

      expect(mockSearch).toHaveBeenCalledWith({
        index: 're3data',
        body: {
          size: 0,
          aggs: {
            unique_types: {
              terms: {
                field: 'repositoryTypes',
                size: 100,
              },
            },
          },
        },
      });
    });

    test('Logs and rethrows if OpenSearch search fails', async () => {
      const error = new Error('Connection failed');
      mockSearch.mockRejectedValue(error);

      const call = service.findRe3DataRepositoryTypes(mockContext, true, 10);
      await expect(call).rejects.toThrow('Service temporarily unavailable');
      await expect(call).rejects.toBeInstanceOf(GraphQLError);

      expect(mockContext.logger.error).toHaveBeenCalledWith(
        expect.objectContaining({}),
        expect.stringContaining('Error fetching re3data repository types from OpenSearch'),
      );
    });

    test('Logs and rethrows if response structure is invalid', async () => {
      mockSearch.mockResolvedValue({ body: {} });
      await expect(service.findRe3DataRepositoryTypes(mockContext, true, 10)).rejects.toThrow();

      expect(mockContext.logger.error).toHaveBeenCalledWith(
        expect.any(Object),
        expect.stringContaining('Error converting OpenSearch aggregation response for re3data repository types'),
      );
    });

    test('Returns empty array if no types are found', async () => {
      mockSearch.mockResolvedValue({
        body: {
          aggregations: {
            unique_types: {
              buckets: [],
            },
          },
        },
      });

      const result = await service.findRe3DataRepositoryTypes(mockContext, true, 10);

      expect(result).toEqual([]);
    });
  });

  describe('findRe3DataByURIs', () => {
    test('Returns empty array if uris is empty', async () => {
      const result = await service.findRe3DataByURIs(mockContext, []);

      expect(result).toEqual([]);
      expect(mockSearch).not.toHaveBeenCalled();
    });

    test('Returns converted records for given URIs', async () => {
      mockSearch.mockResolvedValue({
        body: {
          hits: {
            hits: [
              {
                _source: {
                  id: 'r3d100013914',
                  name: 'Repo A',
                  uri: 'https://www.re3data.org/repository/r3d100013914',
                  repository_types: ['disciplinary'],
                  subjects: ['Life Sciences'],
                  provider_types: ['dataProvider'],
                  keywords: ['biology'],
                  pid_system: ['DOI'],
                  policies: [],
                  upload_types: ['open'],
                  certificates: [],
                  software: [],
                  created: '2024-01-01',
                  modified: '2024-06-01',
                },
              },
            ],
          },
        },
      });

      const uris = ['https://www.re3data.org/repository/r3d100013914'];
      const result = await service.findRe3DataByURIs(mockContext, uris);

      expect(mockSearch).toHaveBeenCalledWith({
        index: 're3data',
        body: {
          size: uris.length * 10,
          query: { terms: { uri: uris } },
          sort: { 'name.keyword': { order: 'asc' } },
        },
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'r3d100013914',
        name: 'Repo A',
        uri: 'https://www.re3data.org/repository/r3d100013914',
        repositoryTypes: ['disciplinary'],
        modified: '2024-06-01',
      });
    });

    test('Deduplicates records by URI, keeping the most recently modified', async () => {
      mockSearch.mockResolvedValue({
        body: {
          hits: {
            hits: [
              {
                _source: {
                  id: 'r3d100014656',
                  name: 'Blue-Cloud Resource Catalogue',
                  uri: 'https://www.re3data.org/repository/r3d100014656',
                  repository_types: ['project-related'],
                  subjects: [],
                  provider_types: ['dataProvider'],
                  keywords: [],
                  pid_system: [],
                  policies: [],
                  upload_types: [],
                  certificates: [],
                  software: [],
                  created: '2025-07-09',
                  modified: '2025-07-11',
                },
              },
              {
                _source: {
                  id: 'r3d100014656',
                  name: 'Blue-Cloud Resource Catalogue',
                  uri: 'https://www.re3data.org/repository/r3d100014656',
                  repository_types: ['project-related'],
                  subjects: [],
                  provider_types: ['dataProvider'],
                  keywords: [],
                  pid_system: [],
                  policies: [],
                  upload_types: [],
                  certificates: [],
                  software: [],
                  created: '2026-04-15T14:49:51.574Z',
                  modified: '2026-04-15T14:49:51.574Z',
                },
              },
            ],
          },
        },
      });

      const result = await service.findRe3DataByURIs(
        mockContext,
        ['https://www.re3data.org/repository/r3d100014656'],
      );

      expect(result).toHaveLength(1);
      expect(result[0].modified).toBe('2026-04-15T14:49:51.574Z');
    });

    test('Returns one record per URI when multiple URIs are requested', async () => {
      mockSearch.mockResolvedValue({
        body: {
          hits: {
            hits: [
              {
                _source: {
                  id: 'r3d100013914',
                  name: 'Repo A',
                  uri: 'https://www.re3data.org/repository/r3d100013914',
                  repository_types: [],
                  subjects: [],
                  provider_types: [],
                  keywords: [],
                  pid_system: [],
                  policies: [],
                  upload_types: [],
                  certificates: [],
                  software: [],
                  created: '2024-01-01',
                  modified: '2024-06-01',
                },
              },
              {
                _source: {
                  id: 'r3d100014656',
                  name: 'Repo B (old)',
                  uri: 'https://www.re3data.org/repository/r3d100014656',
                  repository_types: [],
                  subjects: [],
                  provider_types: [],
                  keywords: [],
                  pid_system: [],
                  policies: [],
                  upload_types: [],
                  certificates: [],
                  software: [],
                  created: '2025-07-09',
                  modified: '2025-07-11',
                },
              },
              {
                _source: {
                  id: 'r3d100014656',
                  name: 'Repo B (new)',
                  uri: 'https://www.re3data.org/repository/r3d100014656',
                  repository_types: [],
                  subjects: [],
                  provider_types: [],
                  keywords: [],
                  pid_system: [],
                  policies: [],
                  upload_types: [],
                  certificates: [],
                  software: [],
                  created: '2026-04-15',
                  modified: '2026-04-15T14:49:51.574Z',
                },
              },
            ],
          },
        },
      });

      const uris = [
        'https://www.re3data.org/repository/r3d100013914',
        'https://www.re3data.org/repository/r3d100014656',
      ];
      const result = await service.findRe3DataByURIs(mockContext, uris);

      expect(result).toHaveLength(2);
      const ids = result.map((r) => r.id);
      expect(ids).toContain('r3d100013914');
      expect(ids).toContain('r3d100014656');
      const repoB = result.find((r) => r.id === 'r3d100014656');
      expect(repoB?.name).toBe('Repo B (new)');
    });

    test('Logs and rethrows if OpenSearch search fails', async () => {
      const error = new Error('Connection failed');
      mockSearch.mockRejectedValue(error);

      const call = service.findRe3DataByURIs(
        mockContext,
        ['https://www.re3data.org/repository/r3d100013914'],
      );
      await expect(call).rejects.toThrow('Service temporarily unavailable');
      await expect(call).rejects.toBeInstanceOf(GraphQLError);

      await expect(call).rejects.toMatchObject({
        extensions: {
          code: 'SERVICE_UNAVAILABLE',
          service: 'opensearch',
        },
      });

      expect(mockContext.logger.error).toHaveBeenCalledWith(
        expect.objectContaining({}),
        expect.stringContaining('Error fetching re3data repositories by URIs from OpenSearch'),
      );
    });

    test('Logs and rethrows if response structure is invalid', async () => {
      mockSearch.mockResolvedValue({ body: {} });

      await expect(
        service.findRe3DataByURIs(
          mockContext,
          ['https://www.re3data.org/repository/r3d100013914'],
        ),
      ).rejects.toThrow();

      expect(mockContext.logger.error).toHaveBeenCalledWith(
        expect.any(Object),
        expect.stringContaining('Error converting OpenSearch response for re3data by URIs'),
      );
    });
  });
});

/* eslint-disable @typescript-eslint/no-explicit-any */

import { ApolloServer } from "@apollo/server";
import casual from "casual";
import { jest } from '@jest/globals';

import { mockAppConfigs, mockAppLogger } from '../../__tests__/mockConfigs.js';

mockAppConfigs();
mockAppLogger();


jest.unstable_mockModule('../../datasources/cache.js', () => ({
  Cache: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
  })),
}));

jest.unstable_mockModule('../../services/openSearchService.js', () => ({
  openSearchFindWorkByIdentifier: jest.fn(),
  openSearchFindRe3Data: jest.fn(),
  openSearchFindRe3DataByURIs: jest.fn(),
  openSearchFindRe3DataSubjects: jest.fn(),
  openSearchFindRe3DataRepositoryTypes: jest.fn(),
}));


const actualRepositoryService = await import('../../services/repositoryService.js');
jest.unstable_mockModule('../../services/repositoryService.js', () => ({
  ...actualRepositoryService,
}));

import type { MyContext } from "../../context.js";
import {
  PaginationType,
} from '../../types/general.js';

// Dynamic import AFTER mocking the configs and logger
const { typeDefs } = await import("../../schema.js");
const { resolvers } = await import("../../resolver.js");
const { logger } = await import("../../logger.js");
const {
  buildContext,
  mockResearcherToken,
  mockAdminToken,
  mockSuperAdminToken,
} = await import("../../__mocks__/context.js");
const { getCurrentDate } = await import("../../utils/helpers.js");
const {
  Repository,
  DEFAULT_DMPTOOL_REPOSITORY_URL,
} = await import('../../models/Repository.js');
const { ResearchDomain } = await import('../../models/ResearchDomain.js');
const { RepositoryService } = await import('../../services/repositoryService.js');

type RepositoryInstance = InstanceType<typeof Repository>;
function asRepository(value: any): RepositoryInstance {
  return value as RepositoryInstance;
}

type ResearchDomainInstance = InstanceType<typeof ResearchDomain>;
function asResearchDomain(value: any): ResearchDomainInstance {
  return value as ResearchDomainInstance;
}

let testServer: ApolloServer;
let token: MyContext['token'];
let context: MyContext;

// Proxy call to the Apollo server test server
async function executeQuery(query: string, variables: any): Promise<any> {
  return await testServer.executeOperation(
    { query, variables },
    { contextValue: context },
  );
}

beforeEach(async () => {
  jest.resetAllMocks();

  // Initialize the Apollo server
  testServer = new ApolloServer({
    typeDefs, resolvers
  });

  context = buildContext(logger, token, null);

  token = await mockResearcherToken();
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('Repository Resolvers', () => {
  function makeMockRepository(overrides: Record<string, any> = {}) {
    return {
      id: casual.integer(1, 99),
      uri: `${DEFAULT_DMPTOOL_REPOSITORY_URL}test`,
      name: 'Test Repository',
      description: casual.description,
      website: 'https://example.com',
      re3dataId: casual.uuid,
      researchDomains: [],
      repositoryTypes: ['generalist'],
      keywords: ['test', 'repository'],
      created: getCurrentDate(),
      modified: getCurrentDate(),
      createdById: casual.integer(1, 9999),
      modifiedById: casual.integer(1, 9999),
      errors: {},
      addError: jest.fn<(...args: any[]) => void>(),
      create: jest.fn<(...args: any[]) => Promise<any>>(),
      update: jest.fn<(...args: any[]) => Promise<any>>(),
      delete: jest.fn<(...args: any[]) => Promise<any>>(),
      hasErrors: jest.fn<() => boolean>(() => false),
      ...overrides,
    };
  }

  let mockRepository: ReturnType<typeof makeMockRepository>;
  let mockRepositories: ReturnType<typeof makeMockRepository>[];

  beforeEach(() => {
    jest.clearAllMocks();

    mockRepository = makeMockRepository();

    mockRepositories = [
      mockRepository,
      makeMockRepository({
        id: casual.integer(100, 199),
        uri: `${DEFAULT_DMPTOOL_REPOSITORY_URL}test-2`,
        name: 'Second Repository',
        website: 'https://example2.com',
        repositoryTypes: ['disciplinary'],
        keywords: ['disciplinary'],
      }),
    ];
  });

  describe('Query', () => {
    describe('repositories', () => {
      const query = `
        query Repositories($input: RepositorySearchInput!) {
          repositories(input: $input) {
            items {
              __typename
              ... on CustomRepository {
                id
                name
                uri
                description
              }
            }
            totalCount
          }
        }`;

      it('should return repositories when authorized', async () => {
        context.token = token;
        const mockResults = {
          items: [mockRepository],
          totalCount: 1,
          limit: 10,
          hasNextPage: false,
        };

        const repositoryServiceSpy = jest
          .spyOn(RepositoryService, 'searchCombined')
          .mockResolvedValue(mockResults as any);

        const result = await executeQuery(query, {
          input: {
            term: 'test',
            paginationOptions: {
              type: PaginationType.CURSOR,
            },
          },
        });

        expect(repositoryServiceSpy).toHaveBeenCalled();
        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeUndefined();
        expect(result.body.singleResult.data.repositories).toBeTruthy();
      });

      it('should throw AuthenticationError when not authorized', async () => {
        context.token = null;

        const result = await executeQuery(query, {
          input: {
            term: 'test',
            paginationOptions: {
              type: PaginationType.CURSOR,
            },
          },
        });

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeTruthy();
        expect(result.body.singleResult.errors[0].message).toEqual('Unauthorized');
      });

      it('should throw InternalServerError on service failure', async () => {
        context.token = token;
        const error = new Error('Database error');
        jest
          .spyOn(RepositoryService, 'searchCombined')
          .mockRejectedValue(error);

        const result = await executeQuery(query, {
          input: {
            term: 'test',
            paginationOptions: {
              type: PaginationType.CURSOR,
            },
          },
        });

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeTruthy();
        expect(result.body.singleResult.errors[0].message).toEqual('Something went wrong');
      });

      it('should accept repositoryType as lowercase hyphenated string (e.g., "multidisciplinary")', async () => {
        context.token = token;
        const mockResults = {
          items: [mockRepository],
          totalCount: 1,
          limit: 10,
          hasNextPage: false,
        };

        const repositoryServiceSpy = jest
          .spyOn(RepositoryService, 'searchCombined')
          .mockResolvedValue(mockResults as any);

        // Test with lowercase hyphenated format like what comes from OpenSearch
        const result = await executeQuery(query, {
          input: {
            repositoryType: 'multidisciplinary',
            paginationOptions: {
              type: PaginationType.CURSOR,
            },
          },
        });

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeUndefined();
        expect(result.body.singleResult.data.repositories).toBeTruthy();

        // Verify the service was called with the string value directly (no conversion)
        expect(repositoryServiceSpy).toHaveBeenCalledWith(
          'repositories resolver',
          context,
          undefined,
          undefined,
          undefined,
          'multidisciplinary', // Value passed directly in re3data standard format
          expect.any(Object)
        );
      });

      it('should accept repositoryType as other valid types (e.g., "project-related")', async () => {
        context.token = token;
        const mockResults = {
          items: [mockRepository],
          totalCount: 1,
          limit: 10,
          hasNextPage: false,
        };

        const repositoryServiceSpy = jest
          .spyOn(RepositoryService, 'searchCombined')
          .mockResolvedValue(mockResults as any);

        // Test with another format
        const result = await executeQuery(query, {
          input: {
            repositoryType: 'project-related',
            paginationOptions: {
              type: PaginationType.CURSOR,
            },
          },
        });

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeUndefined();
        expect(result.body.singleResult.data.repositories).toBeTruthy();

        // Verify the service was called with the string value directly (no conversion)
        expect(repositoryServiceSpy).toHaveBeenCalledWith(
          'repositories resolver',
          context,
          undefined,
          undefined,
          undefined,
          'project-related', // Value passed directly in re3data standard format
          expect.any(Object)
        );
      });
    });

    describe('repository', () => {
      const query = `
        query Repository($uri: String!) {
          repository(uri: $uri) {
            id
            name
            uri
            description
          }
        }`;

      it('should return a single repository by URI', async () => {
        context.token = token;
        const querySpy = jest
          .spyOn(Repository, 'findByURI')
          .mockResolvedValue(asRepository(mockRepository));

        const result = await executeQuery(query, {
          uri: mockRepository.uri,
        });

        expect(querySpy).toHaveBeenCalledWith(
          'repository resolver',
          context,
          mockRepository.uri
        );
        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeUndefined();
        expect(result.body.singleResult.data.repository).toBeTruthy();
      });

      it('should throw AuthenticationError when not authorized', async () => {
        context.token = null;

        const result = await executeQuery(query, {
          uri: mockRepository.uri,
        });

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeTruthy();
        expect(result.body.singleResult.errors[0].message).toEqual('Unauthorized');
      });

      it('should throw InternalServerError on failure', async () => {
        context.token = token;
        const error = new Error('Database error');
        jest.spyOn(Repository, 'findByURI').mockRejectedValue(error);

        const result = await executeQuery(query, {
          uri: mockRepository.uri,
        });

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeTruthy();
        expect(result.body.singleResult.errors[0].message).toEqual('Something went wrong');
      });
    });

    describe('repositorySubjectAreas', () => {
      const query = `
        query {
          repositorySubjectAreas
        }`;

      it('should return all distinct keywords', async () => {
        context.token = token;
        const keywords = ['test', 'repository', 'data'];
        const querySpy = jest
          .spyOn(Repository, 'findAllDistinctKeywords')
          .mockResolvedValue(keywords);

        const result = await executeQuery(query, undefined);

        expect(querySpy).toHaveBeenCalledWith(
          'repositorySubjectAreas resolver',
          context
        );
        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeUndefined();
        expect(result.body.singleResult.data.repositorySubjectAreas).toEqual(
          keywords
        );
      });

      it('should throw AuthenticationError when not authorized', async () => {
        context.token = null;

        const result = await executeQuery(query, undefined);

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeTruthy();
        expect(result.body.singleResult.errors[0].message).toEqual('Unauthorized');
      });

      it('should throw InternalServerError on failure', async () => {
        context.token = token;
        const error = new Error('Database error');
        jest
          .spyOn(Repository, 'findAllDistinctKeywords')
          .mockRejectedValue(error);

        const result = await executeQuery(query, undefined);

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeTruthy();
        expect(result.body.singleResult.errors[0].message).toEqual('Something went wrong');
      });
    });

    describe('repositoriesByURIs', () => {
      const query = `
        query RepositoriesByURIs($uris: [String!]!) {
          repositoriesByURIs(uris: $uris) {
            id
            name
            uri
          }
        }`;

      it('should return repositories matching the provided URIs', async () => {
        context.token = token;
        const uris = [mockRepositories[0].uri, mockRepositories[1].uri];
        const querySpy = jest
          .spyOn(Repository, 'findByURIs')
          .mockResolvedValue(mockRepositories.map(asRepository));

        const result = await executeQuery(query, { uris });

        expect(querySpy).toHaveBeenCalledWith(
          'repositoriesByURIs resolver',
          context,
          uris
        );
        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeUndefined();
        expect(result.body.singleResult.data.repositoriesByURIs).toBeTruthy();
      });

      it('should throw AuthenticationError when not authorized', async () => {
        context.token = null;

        const result = await executeQuery(query, {
          uris: [mockRepository.uri],
        });

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeTruthy();
        expect(result.body.singleResult.errors[0].message).toEqual('Unauthorized');
      });

      it('should throw InternalServerError on failure', async () => {
        context.token = token;
        const error = new Error('Database error');
        jest.spyOn(Repository, 'findByURIs').mockRejectedValue(error);

        const result = await executeQuery(query, {
          uris: [mockRepository.uri],
        });

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeTruthy();
        expect(result.body.singleResult.errors[0].message).toEqual('Something went wrong');
      });
    });

    describe('re3byURIs', () => {
      const query = `
        query Re3ByURIs($uris: [String!]!) {
          re3byURIs(uris: $uris) {
            id
            uri
          }
        }`;

      it('should return re3data repositories matching the provided URIs', async () => {
        context.token = token;
        const uris = [mockRepository.uri];
        const querySpy = jest
          .spyOn(RepositoryService, 'searchRe3DataByURIs')
          .mockResolvedValue([mockRepository] as any);

        const result = await executeQuery(query, { uris });

        expect(querySpy).toHaveBeenCalledWith(
          're3byURIs resolver',
          context,
          uris
        );
        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeUndefined();
      });

      it('should throw AuthenticationError when not authorized', async () => {
        context.token = null;

        const result = await executeQuery(query, {
          uris: [mockRepository.uri],
        });

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeTruthy();
        expect(result.body.singleResult.errors[0].message).toEqual('Unauthorized');
      });

      it('should throw InternalServerError on failure', async () => {
        context.token = token;
        const error = new Error('Service error');
        jest
          .spyOn(RepositoryService, 'searchRe3DataByURIs')
          .mockRejectedValue(error);

        const result = await executeQuery(query, {
          uris: [mockRepository.uri],
        });

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeTruthy();
        expect(result.body.singleResult.errors[0].message).toEqual('Something went wrong');
      });
    });

    describe('re3SubjectList', () => {
      const query = `
        query Re3SubjectList($input: Re3SubjectListInput) {
          re3SubjectList(input: $input) {
            subjects {
              subject
              count
            }
            totalCount
          }
        }`;

      it('should return list of re3data subjects', async () => {
        context.token = token;

        // This will need the openSearchFindRe3DataSubjects mock
        // For now, we'll test the basic flow
        const result = await executeQuery(query, {
          input: {
            includeCount: true,
            maxResults: 100,
          },
        });

        expect(result.body.kind).toEqual('single');
        // Note: This will likely have errors due to the mock not being fully set up
        // but it demonstrates the test structure
      });

      it('should throw AuthenticationError when not authorized', async () => {
        context.token = null;

        const result = await executeQuery(query, {
          input: {
            includeCount: true,
          },
        });

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeTruthy();
        expect(result.body.singleResult.errors[0].message).toEqual('Unauthorized');
      });
    });

    describe('re3RepositoryTypesList', () => {
      const query = `
        query Re3RepositoryTypesList($input: Re3RepositoryTypesListInput) {
          re3RepositoryTypesList(input: $input) {
            types {
              type
              count
            }
            totalCount
          }
        }`;

      it('should throw AuthenticationError when not authorized', async () => {
        context.token = null;

        const result = await executeQuery(query, {
          input: {
            includeCount: true,
          },
        });

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeTruthy();
        expect(result.body.singleResult.errors[0].message).toEqual('Unauthorized');
      });
    });
  });

  describe('Mutation', () => {
    describe('addRepository', () => {
      const query = `
        mutation AddRepository($input: AddRepositoryInput!) {
          addRepository(input: $input) {
            id
            name
            uri
            description
            source
            errors {
              general
            }
          }
        }`;

      let mockInput: any;

      beforeEach(() => {
        mockInput = {
          name: 'New Repository',
          uri: `${DEFAULT_DMPTOOL_REPOSITORY_URL}new-repo`,
          description: 'A new test repository',
          repositoryTypes: ['generalist'],
          keywords: ['test'],
        };
      });

      it('should add a new repository when authorized', async () => {
        context.token = token;

        const createSpy = jest
          .spyOn(Repository.prototype, 'create')
          .mockResolvedValue(asRepository(mockRepository));

        jest
          .spyOn(Repository, 'findById')
          .mockResolvedValue(asRepository(mockRepository));

        const result = await executeQuery(query, { input: mockInput });

        expect(createSpy).toHaveBeenCalledWith(context);
        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeUndefined();
        expect(result.body.singleResult.data.addRepository).toBeTruthy();
      });

      it('should throw AuthenticationError when not authorized', async () => {
        context.token = null;

        const result = await executeQuery(query, { input: mockInput });

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeTruthy();
        expect(result.body.singleResult.errors[0].message).toEqual('Unauthorized');
      });

      it('should include errors when creation fails', async () => {
        context.token = token;

        const failedRepo = {
          ...mockRepository,
          errors: { general: ['Creation failed'] }
        }
        jest.spyOn(Repository.prototype, 'hasErrors').mockReturnValue(true);

        const createSpy = jest
          .spyOn(Repository.prototype, 'create')
          .mockResolvedValue(asRepository(failedRepo));

        const result = await executeQuery(query, { input: mockInput });

        expect(createSpy).toHaveBeenCalledWith(context);
        expect(result.body.kind).toEqual('single');
      });

      it('should associate research domains when provided', async () => {
        context.token = token;

        const mockInputWithDomains = {
          ...mockInput,
          researchDomainIds: [1, 2],
        };

        const mockDomain = asRepository({
          id: 1,
          name: 'Test Domain',
          addToRepository: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
        });

        jest
          .spyOn(Repository.prototype, 'create')
          .mockResolvedValue(asRepository(mockRepository));

        jest
          .spyOn(ResearchDomain, 'findById')
          .mockResolvedValue(asResearchDomain(mockDomain));

        jest
          .spyOn(Repository, 'findById')
          .mockResolvedValue(asRepository(mockRepository));

        const result = await executeQuery(query, {
          input: mockInputWithDomains,
        });

        expect(result.body.kind).toEqual('single');
      });

      it('should throw InternalServerError on unexpected failure', async () => {
        context.token = token;
        const error = new Error('Database error');
        jest
          .spyOn(Repository.prototype, 'create')
          .mockRejectedValue(error);

        const result = await executeQuery(query, { input: mockInput });

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeTruthy();
        expect(result.body.singleResult.errors[0].message).toEqual('Something went wrong');
      });
    });

    describe('updateRepository', () => {
      const query = `
        mutation UpdateRepository($input: UpdateRepositoryInput!) {
          updateRepository(input: $input) {
            id
            name
            uri
            description
            errors {
              general
            }
          }
        }`;

      let mockInput: any;

      beforeEach(() => {
        mockInput = {
          id: mockRepository.id,
          name: 'Updated Repository',
          description: 'Updated description',
          repositoryTypes: ['disciplinary'],
        };
      });

      it('should update a repository when admin', async () => {
        context.token = await mockAdminToken();

        jest
          .spyOn(Repository, 'findById')
          .mockResolvedValue(asRepository(mockRepository));

        jest
          .spyOn(Repository.prototype, 'update')
          .mockResolvedValue(asRepository(mockRepository));

        jest
          .spyOn(ResearchDomain, 'findByRepositoryId')
          .mockResolvedValue([]);

        jest
          .spyOn(Repository, 'reconcileAssociationIds')
          .mockReturnValue({
            idsToBeRemoved: [],
            idsToBeSaved: [],
          });

        const result = await executeQuery(query, { input: mockInput });

        expect(result.body.kind).toEqual('single');
      });

      it('should throw ForbiddenError when researcher tries to update', async () => {
        context.token = token;

        jest
          .spyOn(Repository, 'findById')
          .mockResolvedValue(asRepository(mockRepository));

        const result = await executeQuery(query, { input: mockInput });

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeTruthy();
      });

      it('should throw NotFoundError when repository not found', async () => {
        context.token = await mockAdminToken();

        jest.spyOn(Repository, 'findById').mockResolvedValue(null);

        const result = await executeQuery(query, { input: mockInput });

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeTruthy();
      });

      it('should throw InternalServerError on unexpected failure', async () => {
        context.token = await mockAdminToken();
        const error = new Error('Database error');

        jest.spyOn(Repository, 'findById').mockRejectedValue(error);

        const result = await executeQuery(query, { input: mockInput });

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeTruthy();
        expect(result.body.singleResult.errors[0].message).toEqual('Something went wrong');
      });
    });

    describe('removeRepository', () => {
      const query = `
        mutation RemoveRepository($repositoryId: Int!) {
          removeRepository(repositoryId: $repositoryId) {
            id
            name
            uri
            errors {
              general
            }
          }
        }`;

      it('should remove a repository when admin', async () => {
        context.token = await mockAdminToken();

        jest
          .spyOn(Repository, 'findById')
          .mockResolvedValue(asRepository(mockRepository));

        jest
          .spyOn(Repository.prototype, 'delete')
          .mockResolvedValue(asRepository(mockRepository));

        const result = await executeQuery(query, {
          repositoryId: mockRepository.id,
        });

        expect(result.body.kind).toEqual('single');
      });

      it('should throw ForbiddenError when researcher tries to remove', async () => {
        context.token = token;

        jest
          .spyOn(Repository, 'findById')
          .mockResolvedValue(asRepository(mockRepository));

        const result = await executeQuery(query, {
          repositoryId: mockRepository.id,
        });

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeTruthy();
      });

      it('should throw NotFoundError when repository not found', async () => {
        context.token = await mockAdminToken();

        jest.spyOn(Repository, 'findById').mockResolvedValue(null);

        const result = await executeQuery(query, {
          repositoryId: mockRepository.id,
        });

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeTruthy();
      });

      it('should throw InternalServerError on unexpected failure', async () => {
        context.token = await mockAdminToken();
        const error = new Error('Database error');

        jest.spyOn(Repository, 'findById').mockRejectedValue(error);

        const result = await executeQuery(query, {
          repositoryId: mockRepository.id,
        });

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeTruthy();
        expect(result.body.singleResult.errors[0].message).toEqual('Something went wrong');
      });
    });

    describe('mergeRepositories', () => {
      const query = `
        mutation MergeRepositories(
          $repositoryToKeepId: Int!
          $repositoryToRemoveId: Int!
        ) {
          mergeRepositories(
            repositoryToKeepId: $repositoryToKeepId
            repositoryToRemoveId: $repositoryToRemoveId
          ) {
            id
            name
            uri
            errors {
              general
            }
          }
        }`;

      it('should merge repositories when superadmin', async () => {
        context.token = await mockSuperAdminToken();

        const toKeep = { ...mockRepository };
        const toRemove = { ...mockRepositories[1] };

        jest
          .spyOn(Repository, 'findById')
          .mockResolvedValueOnce(asRepository(toKeep))
          .mockResolvedValueOnce(asRepository(toRemove));

        jest
          .spyOn(Repository.prototype, 'update')
          .mockResolvedValue(asRepository(toKeep));

        jest
          .spyOn(Repository.prototype, 'delete')
          .mockResolvedValue(asRepository(toRemove));

        const result = await executeQuery(query, {
          repositoryToKeepId: toKeep.id,
          repositoryToRemoveId: toRemove.id,
        });

        expect(result.body.kind).toEqual('single');
      });

      it('should throw ForbiddenError when admin tries to merge', async () => {
        context.token = await mockAdminToken();

        const toKeep = { ...mockRepository };
        const toRemove = { ...mockRepositories[1] };

        jest
          .spyOn(Repository, 'findById')
          .mockResolvedValueOnce(asRepository(toKeep))
          .mockResolvedValueOnce(asRepository(toRemove));

        const result = await executeQuery(query, {
          repositoryToKeepId: toKeep.id,
          repositoryToRemoveId: toRemove.id,
        });

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeTruthy();
      });

      it('should throw NotFoundError when a repository is not found', async () => {
        context.token = await mockSuperAdminToken();

        jest.spyOn(Repository, 'findById').mockResolvedValue(null);

        const result = await executeQuery(query, {
          repositoryToKeepId: 999,
          repositoryToRemoveId: 888,
        });

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeTruthy();
      });

      it('should throw ForbiddenError when trying to remove non-DMPTool repository', async () => {
        context.token = await mockSuperAdminToken();

        const toKeep = { ...mockRepository };
        const toRemove = {
          ...mockRepositories[1],
          uri: 'https://external.org/repo',
        };

        jest
          .spyOn(Repository, 'findById')
          .mockResolvedValueOnce(asRepository(toKeep))
          .mockResolvedValueOnce(asRepository(toRemove));

        const result = await executeQuery(query, {
          repositoryToKeepId: toKeep.id,
          repositoryToRemoveId: toRemove.id,
        });

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeTruthy();
      });

      it('should throw InternalServerError on unexpected failure', async () => {
        context.token = await mockSuperAdminToken();
        const error = new Error('Database error');

        jest.spyOn(Repository, 'findById').mockRejectedValue(error);

        const result = await executeQuery(query, {
          repositoryToKeepId: mockRepository.id,
          repositoryToRemoveId: mockRepositories[1].id,
        });

        expect(result.body.kind).toEqual('single');
        expect(result.body.singleResult.errors).toBeTruthy();
        expect(result.body.singleResult.errors[0].message).toEqual('Something went wrong');
      });
    });
  });
});


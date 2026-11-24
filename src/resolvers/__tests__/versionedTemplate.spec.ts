/* eslint-disable @typescript-eslint/no-explicit-any */
import { ApolloServer } from "@apollo/server";
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

import type { MyContext } from "../../context.js";

// Dynamic imports AFTER mocks are set up
const { typeDefs } = await import("../../schema.js");
const { resolvers } = await import("../../resolver.js");
const { logger } = await import("../../logger.js");
const { buildContext, mockToken } = await import("../../__mocks__/context.js");
const { FunderTemplateSearchResult } = await import("../../models/VersionedTemplate.js");
const { TemplateLinkType } = await import("../../models/TemplateLink.js");
const { VersionedTemplateLink } = await import("../../models/VersionedTemplateLink.js");
const { UserRole } = await import("../../models/User.js");

let testServer: ApolloServer;

// Proxy call to the Apollo server test server
async function executeQuery(query: string, variables: any, token: MyContext['token']): Promise<any> {
  const context = buildContext(logger, token, null);
  const result = await testServer.executeOperation({ query, variables }, { contextValue: context });
  expect(result.body.kind).toEqual('single');
  return (result.body as any).singleResult;
}

beforeEach(() => {
  jest.resetAllMocks();
  testServer = new ApolloServer({ typeDefs, resolvers });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('publishedFunderTemplates', () => {
  const query = `
    query PublishedFunderTemplates($term: String, $paginationOptions: PaginationOptions) {
      publishedFunderTemplates(term: $term, paginationOptions: $paginationOptions) {
        totalCount
        currentOffset
        hasNextPage
        hasPreviousPage
        availableSortFields
        items {
          id
          name
          ownerDisplayName
          modified
          funderLinks: links(linkType: FUNDER) { id url text }
          samplePlanLinks: links(linkType: SAMPLE_PLAN) { id url text }
        }
      }
    }
  `;
  const paginationOptions = { type: 'OFFSET', offset: 0, limit: 10, sortField: 'vt.name', sortDir: 'ASC' };

  let funderTemplate: InstanceType<typeof FunderTemplateSearchResult>;
  let searchSpy;

  beforeEach(() => {
    funderTemplate = new FunderTemplateSearchResult({
      id: 21,
      templateId: 7,
      name: 'NSF Polar Programs',
      ownerDisplayName: 'National Science Foundation (nsf.gov)',
      modified: '2026-11-01 10:00:00',
    });
    searchSpy = jest.spyOn(FunderTemplateSearchResult, 'search').mockResolvedValue({
      items: [funderTemplate],
      totalCount: 1,
      limit: 10,
      currentOffset: 0,
      hasNextPage: false,
      hasPreviousPage: false,
      availableSortFields: ['vt.name', 'a.displayName', 'vt.modified'],
    });
  });

  it('works without a login and returns each Template with its published links', async () => {
    const funderLink = new VersionedTemplateLink({
      id: 1,
      versionedTemplateId: funderTemplate.id,
      linkType: TemplateLinkType.FUNDER,
      url: 'https://www.nsf.gov/polar',
      text: 'Polar guidance',
    });
    const findSpy = jest.spyOn(VersionedTemplateLink, 'findByVersionedTemplateId')
      .mockImplementation(async (_ref, _ctx, _id, linkType) => (linkType === TemplateLinkType.FUNDER ? [funderLink] : []));

    const result = await executeQuery(query, { term: 'polar', paginationOptions }, null);

    expect(result.errors).toBeUndefined();
    expect(searchSpy).toHaveBeenCalledWith(
      'publishedFunderTemplates resolver',
      expect.anything(),
      'polar',
      expect.objectContaining({ type: 'OFFSET', offset: 0, limit: 10, sortField: 'vt.name', sortDir: 'ASC' })
    );
    expect(findSpy).toHaveBeenCalledWith(
      'Chained FunderTemplateSearchResult.links',
      expect.anything(),
      funderTemplate.id,
      'FUNDER'
    );
    expect(findSpy).toHaveBeenCalledWith(
      'Chained FunderTemplateSearchResult.links',
      expect.anything(),
      funderTemplate.id,
      'SAMPLE_PLAN'
    );

    const results = result.data.publishedFunderTemplates;
    expect(results.totalCount).toEqual(1);
    expect(results.items).toEqual([{
      id: 21,
      name: 'NSF Polar Programs',
      ownerDisplayName: 'National Science Foundation (nsf.gov)',
      modified: expect.any(String),
      funderLinks: [{ id: 1, url: 'https://www.nsf.gov/polar', text: 'Polar guidance' }],
      samplePlanLinks: [],
    }]);
  });

  it('works the same for a logged in user, and defaults to cursor pagination when no options are given', async () => {
    jest.spyOn(VersionedTemplateLink, 'findByVersionedTemplateId').mockResolvedValue([]);
    const researcherToken = { ...(await mockToken()), role: UserRole.RESEARCHER };

    const result = await executeQuery(query, {}, researcherToken);

    expect(result.errors).toBeUndefined();
    expect(searchSpy).toHaveBeenCalledWith(
      'publishedFunderTemplates resolver',
      expect.anything(),
      undefined,
      expect.objectContaining({ type: 'CURSOR' })
    );
  });

  it('returns no links when the result has no id', async () => {
    const findSpy = jest.spyOn(VersionedTemplateLink, 'findByVersionedTemplateId').mockResolvedValue([]);
    searchSpy.mockResolvedValueOnce({
      items: [new FunderTemplateSearchResult({ name: 'No id' })],
      totalCount: 1,
      limit: 10,
      hasNextPage: false,
    });

    const result = await executeQuery(
      `query { publishedFunderTemplates { items { name links { id } } } }`,
      {},
      null
    );

    expect(result.errors).toBeUndefined();
    expect(result.data.publishedFunderTemplates.items).toEqual([{ name: 'No id', links: [] }]);
    expect(findSpy).not.toHaveBeenCalled();
  });

  it('returns an InternalServerError when the search fails', async () => {
    searchSpy.mockRejectedValueOnce(new Error('Database down'));

    const result = await executeQuery(query, { paginationOptions }, null);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].extensions.code).toEqual('INTERNAL_SERVER');
  });

  it.each(['createdById', 'modifiedById'])('does not let anyone ask for the links\' %s user id', async (field) => {
    const findSpy = jest.spyOn(VersionedTemplateLink, 'findByVersionedTemplateId').mockResolvedValue([]);

    const result = await executeQuery(
      `query { publishedFunderTemplates { items { links { url ${field} } } } }`,
      {},
      null
    );

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].extensions.code).toEqual('GRAPHQL_VALIDATION_FAILED');
    expect(result.errors[0].message).toContain(`Cannot query field "${field}" on type "VersionedTemplateLink"`);
    expect(searchSpy).not.toHaveBeenCalled();
    expect(findSpy).not.toHaveBeenCalled();
  });
});

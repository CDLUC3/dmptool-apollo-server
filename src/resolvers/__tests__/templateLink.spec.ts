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

const mockHasPermissionOnTemplate = jest.fn<(...args: any[]) => Promise<any>>();

const actualTemplateService = await import('../../services/templateService.js');
jest.unstable_mockModule('../../services/templateService.js', () => ({
  ...actualTemplateService,
  hasPermissionOnTemplate: mockHasPermissionOnTemplate,
}));

import type { MyContext } from "../../context.js";

// Dynamic imports AFTER mocks are set up
const { typeDefs } = await import("../../schema.js");
const { resolvers } = await import("../../resolver.js");
const { logger } = await import("../../logger.js");
const { buildContext, mockToken } = await import("../../__mocks__/context.js");
const { Template } = await import("../../models/Template.js");
const { VersionedTemplate } = await import("../../models/VersionedTemplate.js");
const { TemplateLink, TemplateLinkType } = await import("../../models/TemplateLink.js");
const { VersionedTemplateLink } = await import("../../models/VersionedTemplateLink.js");
const { UserRole } = await import("../../models/User.js");
const { Affiliation } = await import("../../models/Affiliation.js");
const { FUNDER_ONLY_ERROR } = await import("../templateLink.js");

let testServer: ApolloServer;
let affiliationId: string;
let templateId: number;
let adminToken: MyContext['token'];
let researcherToken: MyContext['token'];
let template: InstanceType<typeof Template>;
let link: InstanceType<typeof TemplateLink>;

// Proxy call to the Apollo server test server
async function executeQuery(query: string, variables: any, token: MyContext['token']): Promise<any> {
  const context = buildContext(logger, token, null);
  const result = await testServer.executeOperation({ query, variables }, { contextValue: context });
  expect(result.body.kind).toEqual('single');
  return (result.body as any).singleResult;
}

beforeEach(async () => {
  jest.resetAllMocks();

  testServer = new ApolloServer({ typeDefs, resolvers });

  affiliationId = casual.url;
  templateId = casual.integer(1, 999);

  adminToken = await mockToken();
  adminToken.affiliationId = affiliationId;
  adminToken.role = UserRole.ADMIN;

  researcherToken = { ...adminToken, role: UserRole.RESEARCHER };

  template = new Template({
    id: templateId,
    name: casual.sentence,
    ownerId: affiliationId,
    latestPublishVersion: 'v1',
    isDirty: false,
  });
  link = new TemplateLink({
    id: casual.integer(1, 999),
    templateId,
    linkType: TemplateLinkType.FUNDER,
    url: 'https://funder.example.org/requirements',
    text: 'Requirements',
  });

  jest.spyOn(Template, 'findById').mockResolvedValue(template);
  mockHasPermissionOnTemplate.mockResolvedValue(true);
  // By default the Template is owned by a funder
  jest.spyOn(Affiliation, 'findByURI').mockResolvedValue(new Affiliation({ uri: affiliationId, funder: true }));
});

// Make the Template's owner a non-funder affiliation (e.g. a university)
const mockNonFunderOwner = () => {
  jest.spyOn(Affiliation, 'findByURI').mockResolvedValue(new Affiliation({ uri: affiliationId, funder: false }));
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe('addTemplateLink mutation', () => {
  const query = `
    mutation AddTemplateLink($templateId: Int!, $linkType: TemplateLinkType!, $url: String!, $text: String) {
      addTemplateLink(templateId: $templateId, linkType: $linkType, url: $url, text: $text) {
        id
        templateId
        linkType
        url
        text
        errors { general url text linkType }
      }
    }
  `;
  const variables = () => ({ templateId, linkType: 'FUNDER', url: link.url, text: link.text });

  it('adds the link and marks the Template as dirty', async () => {
    const createSpy = jest.spyOn(TemplateLink.prototype, 'create').mockResolvedValue(link);
    const updateSpy = jest.spyOn(Template.prototype, 'update').mockResolvedValue(template);

    const result = await executeQuery(query, variables(), adminToken);

    expect(result.errors).toBeUndefined();
    expect(result.data.addTemplateLink).toEqual(expect.objectContaining({
      id: link.id,
      templateId,
      linkType: 'FUNDER',
      url: link.url,
      text: link.text,
    }));
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenCalledTimes(1);
  });

  it('returns validation errors without touching the Template', async () => {
    const invalid = new TemplateLink({ ...link, id: null });
    invalid.addError('general', 'A Template can have a maximum of 5 links of this type');
    jest.spyOn(TemplateLink.prototype, 'create').mockResolvedValue(invalid);
    const updateSpy = jest.spyOn(Template.prototype, 'update');

    const result = await executeQuery(query, variables(), adminToken);

    expect(result.errors).toBeUndefined();
    expect(result.data.addTemplateLink.errors.general).toEqual('A Template can have a maximum of 5 links of this type');
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('returns an error when the Template is not owned by a funder', async () => {
    mockNonFunderOwner();
    const createSpy = jest.spyOn(TemplateLink.prototype, 'create');
    const updateSpy = jest.spyOn(Template.prototype, 'update');

    const result = await executeQuery(query, variables(), adminToken);

    expect(result.errors).toBeUndefined();
    expect(result.data.addTemplateLink.id).toBeNull();
    expect(result.data.addTemplateLink.errors.general).toEqual(FUNDER_ONLY_ERROR);
    expect(Affiliation.findByURI).toHaveBeenCalledWith('addTemplateLink resolver', expect.anything(), affiliationId);
    expect(createSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('returns an error when the Template owner cannot be found', async () => {
    jest.spyOn(Affiliation, 'findByURI').mockResolvedValue(null);
    const createSpy = jest.spyOn(TemplateLink.prototype, 'create');

    const result = await executeQuery(query, variables(), adminToken);

    expect(result.data.addTemplateLink.errors.general).toEqual(FUNDER_ONLY_ERROR);
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('throws a NotFound error when the Template does not exist', async () => {
    jest.spyOn(Template, 'findById').mockResolvedValue(null);
    const createSpy = jest.spyOn(TemplateLink.prototype, 'create');

    const result = await executeQuery(query, variables(), adminToken);

    expect(result.errors[0].extensions.code).toEqual('NOT_FOUND');
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('throws a Forbidden error when the admin does not have access to the Template', async () => {
    mockHasPermissionOnTemplate.mockResolvedValue(false);
    const createSpy = jest.spyOn(TemplateLink.prototype, 'create');

    const result = await executeQuery(query, variables(), adminToken);

    expect(result.errors[0].extensions.code).toEqual('FORBIDDEN');
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('throws a Forbidden error when the user is not an admin', async () => {
    const result = await executeQuery(query, variables(), researcherToken);
    expect(result.errors[0].extensions.code).toEqual('FORBIDDEN');
  });

  it('throws an Unauthenticated error when there is no token', async () => {
    const result = await executeQuery(query, variables(), null);
    expect(result.errors[0].extensions.code).toEqual('UNAUTHENTICATED');
  });
});

describe('updateTemplateLink mutation', () => {
  const query = `
    mutation UpdateTemplateLink($templateLinkId: Int!, $url: String!, $text: String) {
      updateTemplateLink(templateLinkId: $templateLinkId, url: $url, text: $text) {
        id
        url
        text
        errors { general url text }
      }
    }
  `;

  it('updates the link and marks the Template as dirty', async () => {
    jest.spyOn(TemplateLink, 'findById').mockResolvedValue(link);
    const updateLinkSpy = jest.spyOn(TemplateLink.prototype, 'update')
      .mockImplementation(async function (this: any) { return this; });
    const updateTemplateSpy = jest.spyOn(Template.prototype, 'update').mockResolvedValue(template);

    const variables = { templateLinkId: link.id, url: 'https://funder.example.org/new', text: 'New text' };
    const result = await executeQuery(query, variables, adminToken);

    expect(result.errors).toBeUndefined();
    expect(result.data.updateTemplateLink).toEqual(expect.objectContaining({
      id: link.id,
      url: 'https://funder.example.org/new',
      text: 'New text',
    }));
    expect(updateLinkSpy).toHaveBeenCalledTimes(1);
    expect(updateTemplateSpy).toHaveBeenCalledTimes(1);
    // The permission check is made against the link's Template
    expect(Template.findById).toHaveBeenCalledWith('updateTemplateLink resolver', expect.anything(), templateId);
  });

  it('returns validation errors without touching the Template', async () => {
    jest.spyOn(TemplateLink, 'findById').mockResolvedValue(link);
    const invalid = new TemplateLink({ ...link, url: 'bad' });
    invalid.addError('url', 'Invalid URL');
    jest.spyOn(TemplateLink.prototype, 'update').mockResolvedValue(invalid);
    const updateTemplateSpy = jest.spyOn(Template.prototype, 'update');

    const result = await executeQuery(query, { templateLinkId: link.id, url: 'bad' }, adminToken);

    expect(result.data.updateTemplateLink.errors.url).toEqual('Invalid URL');
    expect(updateTemplateSpy).not.toHaveBeenCalled();
  });

  it('returns an error when the Template is not owned by a funder', async () => {
    jest.spyOn(TemplateLink, 'findById').mockResolvedValue(link);
    mockNonFunderOwner();
    const updateLinkSpy = jest.spyOn(TemplateLink.prototype, 'update');

    const result = await executeQuery(query, { templateLinkId: link.id, url: 'https://funder.example.org/new' }, adminToken);

    expect(result.errors).toBeUndefined();
    expect(result.data.updateTemplateLink.errors.general).toEqual(FUNDER_ONLY_ERROR);
    // The original values are returned unchanged
    expect(result.data.updateTemplateLink.url).toEqual(link.url);
    expect(updateLinkSpy).not.toHaveBeenCalled();
  });

  it('throws a NotFound error when the link does not exist', async () => {
    jest.spyOn(TemplateLink, 'findById').mockResolvedValue(null);

    const result = await executeQuery(query, { templateLinkId: 1, url: link.url }, adminToken);
    expect(result.errors[0].extensions.code).toEqual('NOT_FOUND');
  });

  it('throws a Forbidden error when the admin does not have access to the Template', async () => {
    jest.spyOn(TemplateLink, 'findById').mockResolvedValue(link);
    mockHasPermissionOnTemplate.mockResolvedValue(false);
    const updateLinkSpy = jest.spyOn(TemplateLink.prototype, 'update');

    const result = await executeQuery(query, { templateLinkId: link.id, url: link.url }, adminToken);
    expect(result.errors[0].extensions.code).toEqual('FORBIDDEN');
    expect(updateLinkSpy).not.toHaveBeenCalled();
  });
});

describe('removeTemplateLink mutation', () => {
  const query = `
    mutation RemoveTemplateLink($templateLinkId: Int!) {
      removeTemplateLink(templateLinkId: $templateLinkId) {
        id
        url
        errors { general }
      }
    }
  `;

  it('removes the link and marks the Template as dirty', async () => {
    jest.spyOn(TemplateLink, 'findById').mockResolvedValue(link);
    const deleteSpy = jest.spyOn(TemplateLink.prototype, 'delete').mockResolvedValue(link);
    const updateTemplateSpy = jest.spyOn(Template.prototype, 'update').mockResolvedValue(template);

    const result = await executeQuery(query, { templateLinkId: link.id }, adminToken);

    expect(result.errors).toBeUndefined();
    expect(result.data.removeTemplateLink.id).toEqual(link.id);
    expect(deleteSpy).toHaveBeenCalledTimes(1);
    expect(updateTemplateSpy).toHaveBeenCalledTimes(1);
  });

  it('still removes the link when the Template is no longer owned by a funder', async () => {
    jest.spyOn(TemplateLink, 'findById').mockResolvedValue(link);
    mockNonFunderOwner();
    const deleteSpy = jest.spyOn(TemplateLink.prototype, 'delete').mockResolvedValue(link);
    jest.spyOn(Template.prototype, 'update').mockResolvedValue(template);

    const result = await executeQuery(query, { templateLinkId: link.id }, adminToken);

    expect(result.errors).toBeUndefined();
    expect(result.data.removeTemplateLink.id).toEqual(link.id);
    expect(deleteSpy).toHaveBeenCalledTimes(1);
  });

  it('returns an error when the link could not be removed', async () => {
    jest.spyOn(TemplateLink, 'findById').mockResolvedValue(link);
    jest.spyOn(TemplateLink.prototype, 'delete').mockResolvedValue(null);
    const updateTemplateSpy = jest.spyOn(Template.prototype, 'update');

    const result = await executeQuery(query, { templateLinkId: link.id }, adminToken);

    expect(result.data.removeTemplateLink.errors.general).toEqual('Unable to remove the link');
    expect(updateTemplateSpy).not.toHaveBeenCalled();
  });

  it('throws a NotFound error when the link does not exist', async () => {
    jest.spyOn(TemplateLink, 'findById').mockResolvedValue(null);

    const result = await executeQuery(query, { templateLinkId: 1 }, adminToken);
    expect(result.errors[0].extensions.code).toEqual('NOT_FOUND');
  });

  it('throws a Forbidden error when the admin does not have access to the Template', async () => {
    jest.spyOn(TemplateLink, 'findById').mockResolvedValue(link);
    mockHasPermissionOnTemplate.mockResolvedValue(false);
    const deleteSpy = jest.spyOn(TemplateLink.prototype, 'delete');

    const result = await executeQuery(query, { templateLinkId: link.id }, adminToken);
    expect(result.errors[0].extensions.code).toEqual('FORBIDDEN');
    expect(deleteSpy).not.toHaveBeenCalled();
  });
});

describe('Template.links and Template.maxLinks', () => {
  const query = `
    query Template($templateId: Int!) {
      template(templateId: $templateId) {
        id
        funderLinks: links(linkType: FUNDER) { id url text linkType created }
        maxFunderLinks: maxLinks(linkType: FUNDER)
        maxSamplePlanLinks: maxLinks(linkType: SAMPLE_PLAN)
      }
    }
  `;

  it('returns the links of the requested type along with the limits', async () => {
    const findSpy = jest.spyOn(TemplateLink, 'findByTemplateId').mockResolvedValue([link]);

    const result = await executeQuery(query, { templateId }, adminToken);

    expect(result.errors).toBeUndefined();
    expect(findSpy).toHaveBeenCalledWith('Chained Template.links', expect.anything(), templateId, 'FUNDER');
    expect(result.data.template.funderLinks).toEqual([
      expect.objectContaining({ id: link.id, url: link.url, text: link.text, linkType: 'FUNDER' }),
    ]);
    expect(result.data.template.maxFunderLinks).toEqual(5);
    expect(result.data.template.maxSamplePlanLinks).toEqual(5);
  });
});

describe('VersionedTemplate.links', () => {
  const query = `
    query VersionedTemplate($id: Int!) {
      versionedTemplate(id: $id) {
        id
        links { id url text linkType }
      }
    }
  `;

  it('returns the links captured when the Template was versioned', async () => {
    const versionedTemplate = new VersionedTemplate({ id: casual.integer(1, 999), templateId, name: 'Test' });
    jest.spyOn(VersionedTemplate, 'findById').mockResolvedValue(versionedTemplate);
    const versionedLink = new VersionedTemplateLink({
      id: 9,
      versionedTemplateId: versionedTemplate.id,
      linkType: TemplateLinkType.SAMPLE_PLAN,
      url: 'https://funder.example.org/sample.pdf',
    });
    const findSpy = jest.spyOn(VersionedTemplateLink, 'findByVersionedTemplateId').mockResolvedValue([versionedLink]);

    const result = await executeQuery(query, { id: versionedTemplate.id }, adminToken);

    expect(result.errors).toBeUndefined();
    expect(findSpy).toHaveBeenCalledWith(
      'Chained VersionedTemplate.links',
      expect.anything(),
      versionedTemplate.id,
      undefined
    );
    expect(result.data.versionedTemplate.links).toEqual([
      { id: 9, url: versionedLink.url, text: null, linkType: 'SAMPLE_PLAN' },
    ]);
  });
});

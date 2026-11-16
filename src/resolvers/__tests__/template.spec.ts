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

jest.unstable_mockModule('../../services/authService.js', () => ({
  authenticatedResolver: jest.fn((ref, level, resolver) => resolver),
  isAuthorized: (token) => {
    return token != null && token.id != null;
  },
  isAdmin: (token) => {
    if (token != null && token.id != null && token.affiliationId) {
      return ['ADMIN', 'SUPERADMIN'].includes(token?.role);
    }
    return false;
  },
  isSuperAdmin: (token) => {
    return token != null && token.id != null && token?.role === 'SUPERADMIN';
  },
}));

const mockHasPermissionOnTemplate = jest.fn<(...args: any[]) => Promise<any>>();

const actualTemplateService = await import('../../services/templateService.js');
jest.unstable_mockModule('../../services/templateService.js', () => ({
  ...actualTemplateService,
  hasPermissionOnTemplate: mockHasPermissionOnTemplate,
}));

const mockHandleFunderTemplateRepublication = jest.fn<(...args: any[]) => Promise<any>>();
const mockHandleFunderTemplateArchive = jest.fn<(...args: any[]) => Promise<any>>();

const actualTemplateCustomizationService = await import('../../services/templateCustomizationService.js');
jest.unstable_mockModule('../../services/templateCustomizationService.js', () => ({
  ...actualTemplateCustomizationService,
  handleFunderTemplateRepublication: mockHandleFunderTemplateRepublication,
  handleFunderTemplateArchive: mockHandleFunderTemplateArchive,
}));

const actualEmailService = await import('../../services/emailService.js');
jest.unstable_mockModule('../../services/emailService.js', () => ({
  ...actualEmailService,
  sendTemplateArchiveNotification: jest.fn(),
  sendTemplateUnpublishNotification: jest.fn(),
}));

import type { MyContext } from "../../context.js";

// Dynamic imports AFTER mocks are set up
const { typeDefs } = await import("../../schema.js");
const { resolvers } = await import("../../resolver.js");
const { logger } = await import("../../logger.js");
const { buildContext, mockToken } = await import("../../__mocks__/context.js");
const { Template } = await import("../../models/Template.js");
const { VersionedTemplate } = await import("../../models/VersionedTemplate.js");
const { UserRole } = await import("../../models/User.js");
const { Section } = await import("../../models/Section.js");
const { VersionedSection } = await import("../../models/VersionedSection.js");
const { TemplateLink, TemplateLinkType } = await import("../../models/TemplateLink.js");
const { VersionedTemplateLink } = await import("../../models/VersionedTemplateLink.js");
const { AdminNotification } = await import("../../models/AdminNotifications.js");


let testServer: ApolloServer;
let affiliationId: string;
let templateId: number;
let adminToken: MyContext['token'];
let query: string;

// Proxy call to the Apollo server test server
async function executeQuery(
  query: string,
  variables: any,
  token: MyContext['token']
): Promise<any> {
  const context = buildContext(logger, token, null);

  return await testServer.executeOperation(
    { query, variables },
    { contextValue: context },
  );
}

beforeEach(async () => {
  jest.resetAllMocks();

  // Initialize the Apollo server
  testServer = new ApolloServer({ typeDefs, resolvers });

  affiliationId = casual.url;
  templateId = casual.integer(1, 999);

  adminToken = await mockToken();
  adminToken.affiliationId = affiliationId;
  adminToken.role = UserRole.ADMIN;
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('archiveTemplate mutation', () => {
  let template: InstanceType<typeof Template>;

  beforeEach(() => {
    query = `
      mutation ArchiveTemplate($templateId: Int!) {
        archiveTemplate(templateId: $templateId) {
          id
          name
          isDirty
          latestPublishVersion
          latestPublishDate
          errors {
            general
          }
        }
      }
    `;

    template = new Template({
      id: templateId,
      name: casual.sentence,
      ownerId: affiliationId,
      latestPublishVersion: 'v1.0',
      latestPublishDate: casual.date('YYYY-MM-DD'),
      isDirty: false,
    });

    // Mock hasPermissionOnTemplate to always return true
    mockHasPermissionOnTemplate.mockResolvedValue(true);
  });

  it('unpublishes the template when it has associated plans', async () => {
    // Mock the template lookup
    jest.spyOn(Template, 'findById').mockResolvedValue(template);

    // Mock hasAssociatedPlans to return true
    jest.spyOn(VersionedTemplate, 'hasAssociatedPlans').mockResolvedValue(true);

    // Mock deactivateByTemplateId
    jest.spyOn(VersionedTemplate, 'deactivateByTemplateId').mockResolvedValue(undefined);

    // Mock the update to return the unpublished template
    const updatedTemplate = new Template({
      ...template,
      latestPublishVersion: null,
      latestPublishDate: null,
      isDirty: true,
    });
    jest.spyOn(Template.prototype, 'update').mockResolvedValue(updatedTemplate);

    const variables = { templateId };
    const result = await executeQuery(query, variables, adminToken);

    expect(result.body.kind).toEqual('single');
    expect(result.body.singleResult.errors).toBeUndefined();
    expect(result.body.singleResult.data.archiveTemplate).toBeTruthy();
    expect(result.body.singleResult.data.archiveTemplate.id).toEqual(templateId);
    expect(result.body.singleResult.data.archiveTemplate.isDirty).toBe(true);

    // Verify that update was called instead of delete
    expect(Template.prototype.update).toHaveBeenCalledTimes(1);
    expect(VersionedTemplate.deactivateByTemplateId).toHaveBeenCalledTimes(1);
  });

  it('deletes the template when it has no associated plans', async () => {
    // Mock the template lookup
    jest.spyOn(Template, 'findById').mockResolvedValue(template);

    // Mock hasAssociatedPlans to return false
    jest.spyOn(VersionedTemplate, 'hasAssociatedPlans').mockResolvedValue(false);

    // Mock deactivateByTemplateId (should not be called)
    const deactivateSpy = jest.spyOn(VersionedTemplate, 'deactivateByTemplateId').mockResolvedValue(undefined);

    // Mock the delete to return the deleted template
    jest.spyOn(Template.prototype, 'delete').mockResolvedValue(template);

    const variables = { templateId };
    const result = await executeQuery(query, variables, adminToken);

    expect(result.body.kind).toEqual('single');
    expect(result.body.singleResult.errors).toBeUndefined();
    expect(result.body.singleResult.data.archiveTemplate).toBeTruthy();
    expect(result.body.singleResult.data.archiveTemplate.id).toEqual(templateId);

    // Verify that delete was called instead of update
    expect(Template.prototype.delete).toHaveBeenCalledTimes(1);
    expect(deactivateSpy).not.toHaveBeenCalled();
  });

  it('returns an error if the template update fails', async () => {
    // Mock the template lookup
    jest.spyOn(Template, 'findById').mockResolvedValue(template);

    // Mock hasAssociatedPlans to return true
    jest.spyOn(VersionedTemplate, 'hasAssociatedPlans').mockResolvedValue(true);

    // Mock the update to return a template with errors
    const failedTemplate = new Template({
      ...template,
      latestPublishVersion: null,
      latestPublishDate: null,
      isDirty: true,
    });
    failedTemplate.addError('general', 'Unable to unpublish Template');
    jest.spyOn(Template.prototype, 'update').mockResolvedValue(failedTemplate);

    const variables = { templateId };
    const result = await executeQuery(query, variables, adminToken);

    expect(result.body.kind).toEqual('single');
    expect(result.body.singleResult.errors).toBeUndefined();
    expect(result.body.singleResult.data.archiveTemplate).toBeTruthy();
    expect(result.body.singleResult.data.archiveTemplate.errors.general).toBeTruthy();

    // Verify that deactivateByTemplateId was not called due to error
    expect(VersionedTemplate.deactivateByTemplateId).not.toHaveBeenCalled();
  });

  it('returns an error if the template delete fails', async () => {
    // Mock the template lookup
    jest.spyOn(Template, 'findById').mockResolvedValue(template);

    // Mock hasAssociatedPlans to return false
    jest.spyOn(VersionedTemplate, 'hasAssociatedPlans').mockResolvedValue(false);

    // Mock the delete to return null (failure)
    jest.spyOn(Template.prototype, 'delete').mockResolvedValue(null);

    const variables = { templateId };
    const result = await executeQuery(query, variables, adminToken);

    expect(result.body.kind).toEqual('single');
    expect(result.body.singleResult.errors).toBeUndefined();
    expect(result.body.singleResult.data.archiveTemplate).toBeTruthy();
    expect(result.body.singleResult.data.archiveTemplate.errors.general).toBeTruthy();
  });

  it('returns an error when user is not an admin', async () => {
    const researcherToken = await mockToken();
    researcherToken.affiliationId = affiliationId;
    researcherToken.role = UserRole.RESEARCHER;

    const variables = { templateId };
    const result = await executeQuery(query, variables, researcherToken);

    expect(result.body.kind).toEqual('single');
    expect(result.body.singleResult.errors).toBeTruthy();
    expect(result.body.singleResult.errors[0].message).toContain('Forbidden');
  });

  it('returns an error when template is not found', async () => {
    // Mock the template lookup to return null
    jest.spyOn(Template, 'findById').mockResolvedValue(null);

    const variables = { templateId };
    const result = await executeQuery(query, variables, adminToken);

    expect(result.body.kind).toEqual('single');
    expect(result.body.singleResult.errors).toBeTruthy();
    // The error could be "Not found" or "Something went wrong" depending on how hasPermissionOnTemplate handles null
  });
});

describe('templateNameAvailable query', () => {
  beforeEach(() => {
    query = `
      query TemplateNameAvailable($name: String!) {
        templateNameAvailable(name: $name)
      }
    `;
  });

  it('returns true when no template with that name exists for the affiliation', async () => {
    const findSpy = jest.spyOn(Template, 'findByNameAndOwnerId').mockResolvedValue(null);

    const result = await executeQuery(query, { name: 'Brand New Template' }, adminToken);

    expect(result.body.kind).toEqual('single');
    expect(result.body.singleResult.errors).toBeUndefined();
    expect(result.body.singleResult.data.templateNameAvailable).toBe(true);
    expect(findSpy).toHaveBeenCalledWith(
      'templateNameAvailable resolver',
      expect.anything(),
      'Brand New Template',
    );
  });

  it('returns false when a template with that name already exists for the affiliation', async () => {
    const existing = new Template({ id: templateId, name: 'Existing Template', ownerId: affiliationId });
    jest.spyOn(Template, 'findByNameAndOwnerId').mockResolvedValue(existing);

    const result = await executeQuery(query, { name: 'existing template' }, adminToken);

    expect(result.body.kind).toEqual('single');
    expect(result.body.singleResult.errors).toBeUndefined();
    expect(result.body.singleResult.data.templateNameAvailable).toBe(false);
  });

  it('returns false without querying when the name is blank', async () => {
    const findSpy = jest.spyOn(Template, 'findByNameAndOwnerId');

    const result = await executeQuery(query, { name: '   ' }, adminToken);

    expect(result.body.kind).toEqual('single');
    expect(result.body.singleResult.errors).toBeUndefined();
    expect(result.body.singleResult.data.templateNameAvailable).toBe(false);
    expect(findSpy).not.toHaveBeenCalled();
  });
});

describe('addTemplate mutation (copying links)', () => {
  let newTemplateId: number;
  let mockLinkCreate: ReturnType<typeof jest.fn>;

  beforeEach(() => {
    query = `
      mutation AddTemplate($name: String!, $copyFromTemplateId: Int, $copyFromVersionedTemplateId: Int) {
        addTemplate(
          name: $name,
          copyFromTemplateId: $copyFromTemplateId,
          copyFromVersionedTemplateId: $copyFromVersionedTemplateId
        ) {
          id
          errors { general }
        }
      }
    `;

    newTemplateId = templateId + 1000;
    jest.spyOn(Template.prototype, 'create')
      .mockResolvedValue(new Template({ id: newTemplateId, name: 'Copy', ownerId: affiliationId }));
    jest.spyOn(AdminNotification, 'addNotificationForAffiliation').mockResolvedValue(undefined);
    jest.spyOn(Section, 'findByTemplateId').mockResolvedValue([]);
    jest.spyOn(VersionedSection, 'findByTemplateId').mockResolvedValue([]);

    mockLinkCreate = jest.fn<(...args: any[]) => Promise<any>>()
      .mockImplementation(async function (this: any) { return this; });
    jest.spyOn(TemplateLink.prototype, 'create').mockImplementation(mockLinkCreate as any);
  });

  it('copies the links from a Template owned by the admin', async () => {
    jest.spyOn(Template, 'findById')
      .mockResolvedValue(new Template({ id: templateId, name: 'Original', ownerId: affiliationId }));
    const findLinksSpy = jest.spyOn(TemplateLink, 'findByTemplateId').mockResolvedValue([
      new TemplateLink({ id: 1, templateId, linkType: TemplateLinkType.FUNDER, url: 'https://funder.org/a' }),
    ]);

    const result = await executeQuery(query, { name: 'Copy', copyFromTemplateId: templateId }, adminToken);

    expect(result.body.singleResult.errors).toBeUndefined();
    expect(result.body.singleResult.data.addTemplate.errors.general).toBeNull();
    expect(findLinksSpy).toHaveBeenCalledWith('addTemplate resolver', expect.anything(), templateId);
    expect(mockLinkCreate).toHaveBeenCalledTimes(1);
    const copy = (mockLinkCreate.mock.contexts as any[])[0];
    expect(copy.templateId).toEqual(newTemplateId);
    expect(copy.url).toEqual('https://funder.org/a');
  });

  it('copies the links from a published VersionedTemplate', async () => {
    const versionedTemplateId = casual.integer(1, 999);
    jest.spyOn(VersionedTemplate, 'findById')
      .mockResolvedValue(new VersionedTemplate({ id: versionedTemplateId, templateId, name: 'Published' }));
    const findLinksSpy = jest.spyOn(VersionedTemplateLink, 'findByVersionedTemplateId').mockResolvedValue([
      new VersionedTemplateLink({
        id: 2,
        versionedTemplateId,
        linkType: TemplateLinkType.SAMPLE_PLAN,
        url: 'https://funder.org/sample.pdf',
      }),
    ]);

    const result = await executeQuery(
      query,
      { name: 'Copy', copyFromVersionedTemplateId: versionedTemplateId },
      adminToken
    );

    expect(result.body.singleResult.errors).toBeUndefined();
    expect(findLinksSpy).toHaveBeenCalledWith('addTemplate resolver', expect.anything(), versionedTemplateId);
    const copy = (mockLinkCreate.mock.contexts as any[])[0];
    expect(copy.templateId).toEqual(newTemplateId);
    expect(copy.linkType).toEqual(TemplateLinkType.SAMPLE_PLAN);
  });

  it('returns an error when a link could not be copied', async () => {
    jest.spyOn(Template, 'findById')
      .mockResolvedValue(new Template({ id: templateId, name: 'Original', ownerId: affiliationId }));
    jest.spyOn(TemplateLink, 'findByTemplateId').mockResolvedValue([
      new TemplateLink({ id: 1, templateId, linkType: TemplateLinkType.FUNDER, url: 'https://funder.org/a' }),
    ]);
    mockLinkCreate.mockResolvedValue(null);

    const result = await executeQuery(query, { name: 'Copy', copyFromTemplateId: templateId }, adminToken);

    expect(result.body.singleResult.data.addTemplate.id).toEqual(newTemplateId);
    expect(result.body.singleResult.data.addTemplate.errors.general)
      .toEqual('Created Template but unable to copy all links');
  });

  it('does not look up links when creating a Template from scratch', async () => {
    const findLinksSpy = jest.spyOn(TemplateLink, 'findByTemplateId');

    const result = await executeQuery(query, { name: 'Brand new' }, adminToken);

    expect(result.body.singleResult.errors).toBeUndefined();
    expect(findLinksSpy).not.toHaveBeenCalled();
  });
});

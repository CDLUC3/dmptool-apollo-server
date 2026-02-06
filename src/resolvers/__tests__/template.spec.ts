import { ApolloServer } from "@apollo/server";
import { typeDefs } from "../../schema";
import { resolvers } from "../../resolver";
import casual from "casual";
import { buildContext, mockToken } from "../../__mocks__/context";
import { logger } from "../../logger";
import { JWTAccessToken } from "../../services/tokenService";

import { Template } from "../../models/Template";
import { VersionedTemplate } from "../../models/VersionedTemplate";
import { UserRole } from "../../models/User";
import * as templateService from "../../services/templateService";

jest.mock('../../context.ts');
jest.mock('../../datasources/cache');
jest.mock('../../services/emailService');

let testServer: ApolloServer;
let affiliationId: string;
let templateId: number;
let adminToken: JWTAccessToken;
let query: string;

// Proxy call to the Apollo server test server
async function executeQuery (
  query: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  variables: any,
  token: JWTAccessToken
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  testServer = new ApolloServer({
    typeDefs, resolvers
  });

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
  let template: Template;

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
    jest.spyOn(templateService, 'hasPermissionOnTemplate').mockResolvedValue(true);
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

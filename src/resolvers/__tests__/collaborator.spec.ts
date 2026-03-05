import { ApolloServer } from "@apollo/server";
import { typeDefs } from "../../schema";
import { resolvers } from "../../resolver";
import casual from "casual";
import assert from "assert";
import { buildContext, mockToken } from "../../__mocks__/context";
import { logger } from "../../logger";
import { JWTAccessToken } from "../../services/tokenService";

import { TemplateCollaborator } from "../../models/Collaborator";
import { clearTemplateCollaboratorsStore, initTemplateCollaboratorsStore, mockDeleteTemplateCollaborators, mockFindTemplateCollaboratorById, mockFindTemplateCollaboratorByTemplateId, mockFindTemplateCollaboratorByTemplateIdAndEmail, mockFindTemplateCollaboratorsByEmail, mockFindTemplateCollaboratorsByInviterId, mockInsertTemplateCollaborators, mockUpdateTemplateCollaborators } from "../../models/__mocks__/Collaborator";
import { User, UserRole } from "../../models/User";
import { Template } from "../../models/Template";

jest.mock('../../context.ts');
jest.mock('../../datasources/cache');
jest.mock('../../services/emailService');
jest.mock('../../services/openSearchService');
jest.mock('../../config/awsConfig', () => ({
  awsConfig: { opensearch: { useSSL: false, host: 'localhost', port: 9200 } },
}));

let testServer: ApolloServer;
let templateCollaboratorStore: TemplateCollaborator[];
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

  // Add initial data to the mock database
  templateCollaboratorStore = initTemplateCollaboratorsStore(3);

  // Use the mocks to replace the actual queries
  jest.spyOn(TemplateCollaborator, 'findById').mockImplementation(mockFindTemplateCollaboratorById);
  jest.spyOn(TemplateCollaborator, 'findByEmail').mockImplementation(mockFindTemplateCollaboratorsByEmail);
  jest.spyOn(TemplateCollaborator, 'findByInvitedById').mockImplementation(mockFindTemplateCollaboratorsByInviterId);
  jest.spyOn(TemplateCollaborator, 'findByTemplateIdAndEmail').mockImplementation(mockFindTemplateCollaboratorByTemplateIdAndEmail);
  jest.spyOn(TemplateCollaborator, 'findByTemplateId').mockImplementation(mockFindTemplateCollaboratorByTemplateId);

  // Use the mocks to replace the actual mutations
  jest.spyOn(TemplateCollaborator, 'insert').mockImplementation(mockInsertTemplateCollaborators);
  jest.spyOn(TemplateCollaborator, 'update').mockImplementation(mockUpdateTemplateCollaborators);
  jest.spyOn(TemplateCollaborator, 'delete').mockImplementation(mockDeleteTemplateCollaborators);

  affiliationId = casual.url;
  templateId = templateCollaboratorStore[0].templateId;

  adminToken = await mockToken();
  adminToken.affiliationId = affiliationId;
  adminToken.role = UserRole.ADMIN;

  // Mock the call to fetch the template from within the TemplateCollaborator resolver
  jest.spyOn(Template, 'findById').mockResolvedValue(new Template({ id: templateId, ownerId: affiliationId }));
  jest.spyOn(User, 'findByEmail').mockResolvedValue(new User({ id: casual.integer(1, 9999) }));
  jest.spyOn(User, 'findById').mockResolvedValue(new User({ id: casual.integer(1, 9999) }));
});

afterEach(() => {
  jest.clearAllMocks();

  // Reset the mock database
  clearTemplateCollaboratorsStore();
});

describe.skip('templateCollaborators query', () => {
  beforeEach(() => {
    query = `
      query TemplateCollaborators($templateId: Int!) {
        templateCollaborators (templateId: $templateId) {
          id
          createdById
          created
          modifiedById
          modified
          errors {
            general
          }

          email
          invitedBy {
            id
          }
          user {
            id
          }
          template {
            id
          }
        }
      }
    `;
  });

  it('returns the template collaborators when successful', async () => {
    // Make sure each entry has the same templateId
    for (const entry of templateCollaboratorStore) {
      entry.templateId = templateId;
    }
    const variables = { templateId: templateId };
    const resp = await executeQuery(query, variables, adminToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    // Verify the entire object is returned since we're not returning everything
    expect(resp.body.singleResult.data.templateCollaborators.length).toEqual(templateCollaboratorStore.length);
  });

  it('returns a 401 when the user is not authenticated', async () => {
    const variables = { templateId: templateCollaboratorStore[0].templateId };
    const resp = await executeQuery(query, variables, null);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.templateCollaborators).toBeNull();
    expect(resp.body.singleResult.errors[0].message).toEqual('Unauthorized');
  });

  it('returns a 403 when the user is not an Admin', async () => {
    // Make the user an Researcher
    const token = await mockToken();
    token.affiliationId = affiliationId;
    token.role = UserRole.RESEARCHER.toString();

    const variables = { templateId: templateCollaboratorStore[0].templateId };
    const resp = await executeQuery(query, variables, token);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.templateCollaborators).toBeNull();
    expect(resp.body.singleResult.errors[0].message).toEqual('Forbidden');
  });

  it('returns a 403 when the user is not from the same affiliation as the template', async () => {
    // Make the user an Researcher
    adminToken.affiliationId = '1234567890';

    const variables = { templateId: templateCollaboratorStore[0].templateId };
    const resp = await executeQuery(query, variables, adminToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.templateCollaborators).toBeNull();
    expect(resp.body.singleResult.errors[0].message).toEqual('Forbidden');
  });

  it('returns an empty array when no matching records are found', async () => {
    // Use an id that will not match any records
    const variables = { templateId: 9999999 };
    const resp = await executeQuery(query, variables, adminToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data?.templateCollaborators).toEqual([]);
  });

  it('returns a 500 when a fatal error occurs', async () => {
    jest.spyOn(TemplateCollaborator, 'findByTemplateId').mockImplementation(() => { throw new Error('Error!') });

    // Make sure each entry has the same templateId
    for (const entry of templateCollaboratorStore) {
      entry.templateId = templateId;
    }
    const variables = { templateId: templateId };
    const resp = await executeQuery(query, variables, adminToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.templateCollaborators).toBeNull();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('INTERNAL_SERVER');
  });
});

describe.skip('addTemplateCollaborator mutation', () => {
  beforeEach(() => {
    query = `
      mutation AddTemplateCollaborator($templateId: Int!, $email: String!) {
        addTemplateCollaborator (templateId: $templateId, email: $email) {
          id
          createdById
          created
          modifiedById
          modified
          errors {
            general
          }

          email
          invitedBy {
            id
          }
          user {
            id
          }
          template {
            id
          }
        }
      }
    `;
  });

  it('returns the template collaborator when successful', async () => {
    const originalRecordCount = templateCollaboratorStore.length;
    const variables = { templateId: templateId, email: casual.email };
    const resp = await executeQuery(query, variables, adminToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    // Verify the entire object is returned since we're not returning everything
    expect(resp.body.singleResult.data.addTemplateCollaborator.id).toBeDefined();
    expect(resp.body.singleResult.data?.addTemplateCollaborator?.errors?.general).toBeNull();
    expect(templateCollaboratorStore.length).toEqual(originalRecordCount + 1);
  });

  it('returns the existing template collaborator with field level errors when the record is a duplicate', async () => {
    const originalRecordCount = templateCollaboratorStore.length;
    const variables = {
      templateId: templateCollaboratorStore[0].templateId,
      email: templateCollaboratorStore[0].email.toUpperCase()
    };
    const resp = await executeQuery(query, variables, adminToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    // Verify the entire object is returned since we're not returning everything
    expect(resp.body.singleResult.data.addTemplateCollaborator.id).toEqual(templateCollaboratorStore[0].id);
    expect(resp.body.singleResult.data?.addTemplateCollaborator?.errors?.general).toBeDefined();
    expect(templateCollaboratorStore.length).toEqual(originalRecordCount);
  });

  it('returns a 401 when the user is not authenticated', async () => {
    const originalRecordCount = templateCollaboratorStore.length;
    const variables = { templateId: casual.integer(1, 9999), email: casual.email };
    const resp = await executeQuery(query, variables, null);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.addTemplateCollaborator).toBeNull();
    expect(resp.body.singleResult.errors[0].message).toEqual('Unauthorized');
    expect(templateCollaboratorStore.length).toEqual(originalRecordCount);
  });

  it('returns a 403 when the user is not an Admin', async () => {
    // Make the user an Researcher
    const token = await mockToken();
    token.affiliationId = affiliationId;
    token.role = UserRole.RESEARCHER.toString();

    const originalRecordCount = templateCollaboratorStore.length;
    const variables = { templateId: casual.integer(1, 9999), email: casual.email };
    const resp = await executeQuery(query, variables, token);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.addTemplateCollaborator).toBeNull();
    expect(resp.body.singleResult.errors[0].message).toEqual('Forbidden');
    expect(templateCollaboratorStore.length).toEqual(originalRecordCount);
  });

  it('returns a 403 when the user is not from the same affiliation as the template', async () => {
    // Make the user an Researcher
    adminToken.affiliationId = '1234567890';

    const originalRecordCount = templateCollaboratorStore.length;
    const variables = { templateId: casual.integer(1, 9999), email: casual.email };
    const resp = await executeQuery(query, variables, adminToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.addTemplateCollaborator).toBeNull();
    expect(resp.body.singleResult.errors[0].message).toEqual('Forbidden');
    expect(templateCollaboratorStore.length).toEqual(originalRecordCount);
  });

  it('returns a 404 when the template is not found', async () => {
    jest.spyOn(Template, 'findById').mockResolvedValue(null);

    const originalRecordCount = templateCollaboratorStore.length;
    const variables = { templateId: 999999, email: casual.email };
    const resp = await executeQuery(query, variables, adminToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    // Verify the entire object is returned since we're not returning everything
    expect(resp.body.singleResult.data?.addTemplateCollaborator).toBeNull();
    expect(resp.body.singleResult.errors[0].message).toEqual('Not Found');
    expect(templateCollaboratorStore.length).toEqual(originalRecordCount);
  });

  it('returns a 500 when a fatal error occurs', async () => {
    jest.spyOn(TemplateCollaborator.prototype, 'create').mockImplementationOnce(async () => { throw new Error('Error!') });

    const originalRecordCount = templateCollaboratorStore.length;
    const variables = { templateId: casual.integer(1, 9999), email: casual.email };
    const resp = await executeQuery(query, variables, adminToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.addTemplateCollaborator).toBeNull();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('INTERNAL_SERVER');
    expect(templateCollaboratorStore.length).toEqual(originalRecordCount);
  });
});

describe.skip('removeTemplateCollaborator mutation', () => {
  beforeEach(() => {
    query = `
      mutation RemoveTemplateCollaborator($templateId: Int!, $email: String!) {
        removeTemplateCollaborator (templateId: $templateId, email: $email) {
          id
        }
      }
    `;
  });

  it('returns true when successful', async () => {
    const originalRecordCount = templateCollaboratorStore.length;
    const variables = { templateId: templateCollaboratorStore[0].templateId, email: templateCollaboratorStore[0].email };
    const resp = await executeQuery(query, variables, adminToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data.removeTemplateCollaborator).toBeTruthy();
    expect(templateCollaboratorStore.length).toEqual(originalRecordCount - 1);
  });

  it('returns a 401 when the user is not authenticated', async () => {
    const originalRecordCount = templateCollaboratorStore.length;
    const variables = { templateId: templateCollaboratorStore[0].templateId, email: templateCollaboratorStore[0].email };
    const resp = await executeQuery(query, variables, null);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.removeTemplateCollaborator).toBeNull();
    expect(resp.body.singleResult.errors[0].message).toEqual('Unauthorized');
    expect(templateCollaboratorStore.length).toEqual(originalRecordCount);
  });

  it('returns a 403 when the user is not an Admin', async () => {
    // Make the user an Researcher
    const token = await mockToken();
    token.affiliationId = affiliationId;
    token.role = UserRole.RESEARCHER.toString();

    const originalRecordCount = templateCollaboratorStore.length;
    const variables = { templateId: templateCollaboratorStore[0].templateId, email: templateCollaboratorStore[0].email };
    const resp = await executeQuery(query, variables, token);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.removeTemplateCollaborator).toBeNull();
    expect(resp.body.singleResult.errors[0].message).toEqual('Forbidden');
    expect(templateCollaboratorStore.length).toEqual(originalRecordCount);
  });

  it('returns a 403 when the user is not from the same affiliation as the template', async () => {
    // Make the user belongs to a different affiliation
    adminToken.affiliationId = '1234567890';

    const originalRecordCount = templateCollaboratorStore.length;
    const variables = { templateId: templateCollaboratorStore[0].templateId, email: templateCollaboratorStore[0].email };
    const resp = await executeQuery(query, variables, adminToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data?.removeTemplateCollaborator).toBeNull();
    expect(resp.body.singleResult.errors[0].message).toEqual('Forbidden');
    expect(templateCollaboratorStore.length).toEqual(originalRecordCount);
  });

  it('returns the collaborator with errors when the record cannot be removed', async () => {
    // Force an error
    jest.spyOn(TemplateCollaborator, 'delete').mockImplementationOnce(async () => true);

    const originalRecordCount = templateCollaboratorStore.length;
    const variables = { templateId: templateCollaboratorStore[0].templateId, email: templateCollaboratorStore[0].email };
    const resp = await executeQuery(query, variables, adminToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeUndefined();
    expect(resp.body.singleResult.data.removeTemplateCollaborator).toBeDefined();
    expect(templateCollaboratorStore.length).toEqual(originalRecordCount);
  });

  it('returns a 500 when a fatal error occurs', async () => {
    jest.spyOn(TemplateCollaborator, 'delete').mockImplementationOnce(async () => {
      throw new Error('Error!');
    });

    const originalRecordCount = templateCollaboratorStore.length;
    const variables = { templateId: templateCollaboratorStore[0].templateId, email: templateCollaboratorStore[0].email };
    const resp = await executeQuery(query, variables, adminToken);

    assert(resp.body.kind === 'single');
    expect(resp.body.singleResult.errors).toBeDefined();
    expect(resp.body.singleResult.data.removeTemplateCollaborator).toBeNull();
    expect(resp.body.singleResult.errors[0].extensions.code).toEqual('INTERNAL_SERVER');
    expect(templateCollaboratorStore.length).toEqual(originalRecordCount);
  });
});

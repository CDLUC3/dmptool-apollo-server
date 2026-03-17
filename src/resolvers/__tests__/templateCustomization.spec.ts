import casual from "casual";
import { ApolloServer } from "@apollo/server";
import { typeDefs } from "../../schema";
import { resolvers } from '../../resolver';

import { buildContext, mockToken } from "../../__mocks__/context";
import { VersionedTemplate } from '../../models/VersionedTemplate';
import { logger } from "../../logger";
import { JWTAccessToken } from "../../services/tokenService";
import { UserRole } from "../../models/User";
import {
  TemplateCustomization,
  TemplateCustomizationMigrationStatus,
  TemplateCustomizationOverview,
  TemplateCustomizationStatus
} from '../../models/TemplateCustomization';
import {
  getValidatedCustomization,
  hasPermissionOnTemplateCustomization
} from '../../services/templateCustomizationService';

// Mock the authenticatedResolver function because it is a Highest Order Function (HOF)
// and gets loaded when we import resolvers.ts below
jest.mock('../../services/authService', () => ({
  ...jest.requireActual('../../services/authService'),
  // This mocks the HOF itself to be a simple pass-through
  authenticatedResolver: jest.fn((ref, level, resolver) => resolver),
}));

jest.mock('../../context.ts');
jest.mock('../../datasources/cache');
jest.mock('../../services/openSearchService');
jest.mock('../../config/awsConfig', () => ({
  awsConfig: { opensearch: { useSSL: false, host: 'localhost', port: 9200 } },
}));

jest.mock('../../models/TemplateCustomization');
jest.mock('../../services/templateCustomizationService');

const mockHasPermissionOnTemplateCustomization = hasPermissionOnTemplateCustomization as jest.MockedFunction<typeof hasPermissionOnTemplateCustomization>;

let testServer: ApolloServer;
let affiliationId: string;
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
  testServer = new ApolloServer({ typeDefs, resolvers });

  affiliationId = casual.url;

  adminToken = await mockToken();
  adminToken.affiliationId = affiliationId;
  adminToken.role = UserRole.ADMIN;
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('templateCustomization resolvers', () => {
  let mockCustomization: TemplateCustomization;
  let mockCustomizationOverview: TemplateCustomizationOverview;
  let mockVersionedTemplate: VersionedTemplate;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCustomization = {
      id: 1,
      affiliationId: 'http://example.com/univerity',
      templateId: 25,
      currentVersionedTemplateId: 100,
      status: TemplateCustomizationStatus.PUBLISHED,
      migrationStatus: TemplateCustomizationMigrationStatus.OK,
      latestPublishedDate: '2023-11-23T02:03:04.000Z',
      latestPublishedVersionId: 5,
      isDirty: false,
      created: '2023-08-09T01:02:03.000Z',
      createdById: 12,
      modified: '2023-09-10T04:05:06.000Z',
      modifiedById: 12,
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      publish: jest.fn(),
      unpublish: jest.fn(),
      addError: jest.fn(),
    } as undefined as TemplateCustomization;

    mockCustomizationOverview = {
      versionedTemplateId: 100,
      versionedTemplateAffiliationId: 'http://example.com/funder',
      versionedTemplateAffiliationName: 'Example Funder',
      versionedTemplateName: 'Test Template',
      versionedTemplateVersion: 'v12',
      versionedTemplateLastModified: '2023-01-01T00:00:00.000Z',
      customizationId: 1,
      customizationIsDirty: false,
      customizationStatus: TemplateCustomizationStatus.PUBLISHED,
      customizationMigrationStatus: TemplateCustomizationMigrationStatus.OK,
      customizationLastCustomizedById: 12,
      customizationLastCustomizedByName: 'Test User',
      customizationLastCustomized: '2023-11-23T02:03:04.000Z',
      sections: [],
      errors: {}
    };

    mockVersionedTemplate = {
      id: 200,
      templateId: 100,
    } as undefined as VersionedTemplate;
  });

  describe('Query.templateCustomizationOverview', () => {
    beforeEach(() => {
      query = `
        query templateCustomizationOverview($templateCustomizationId: Int!) {
          templateCustomizationOverview(templateCustomizationId: $templateCustomizationId) {
            versionedTemplateId
            customizationId
            versionedTemplateAffiliationId
            customizationStatus
            customizationMigrationStatus
            customizationIsDirty
            customizationLastCustomized
          }
        }
      `;
    });

    it('should return template customization when user is admin and has permission', async () => {
      (TemplateCustomizationOverview.generateOverview as jest.Mock) = jest.fn().mockResolvedValue(mockCustomizationOverview);
      mockHasPermissionOnTemplateCustomization.mockReturnValue(true);
      (getValidatedCustomization as jest.Mock).mockResolvedValue(mockCustomizationOverview);

      const vars = { templateCustomizationId: mockCustomizationOverview.customizationId };
      const result = await executeQuery(query, vars, adminToken);

      expect(TemplateCustomizationOverview.generateOverview).toHaveBeenCalledWith(
        'templateCustomization resolver',
        expect.any(Object),
        1
      );
      expect(getValidatedCustomization).toHaveBeenCalledWith(
        'templateCustomization resolver',
        expect.any(Object),
        mockCustomizationOverview.customizationId
      );

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.templateCustomizationOverview).toBeTruthy();
      expect(result.body.singleResult.data.templateCustomizationOverview.customizationId).toEqual(mockCustomizationOverview.customizationId);
    });

    it('should throw NotFoundError when customization does not exist', async () => {
      (TemplateCustomizationOverview.generateOverview as jest.Mock) = jest.fn().mockResolvedValue(null);

      const vars = { templateCustomizationId: mockCustomizationOverview.customizationId };
      const result = await executeQuery(query, vars, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });

    it('should throw InternalServerError on unexpected error', async () => {
      const unexpectedError = new Error('Unexpected');
      (TemplateCustomizationOverview.generateOverview as jest.Mock) = jest.fn().mockRejectedValue(unexpectedError);

      const vars = { templateCustomizationId: mockCustomizationOverview.customizationId };
      const result = await executeQuery(query, vars, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Unexpected');
    });
  });

  describe('Mutation.addTemplateCustomization', () => {
    const input = {
      input: {
        versionedTemplateId: 200,
        status: TemplateCustomizationStatus.DRAFT
      }
    };

    beforeEach(() => {
      query = `
        mutation addTemplateCustomization($input: AddTemplateCustomizationInput!) {
          addTemplateCustomization(input: $input) {
            versionedTemplateId
            customizationId
            versionedTemplateAffiliationId
            customizationStatus
            customizationMigrationStatus
            customizationIsDirty
            customizationLastCustomized
            errors {
              general
            }
          }
        }
      `;
    });

    it('should create template customization successfully', async () => {
      (VersionedTemplate.findById as jest.Mock) = jest.fn().mockResolvedValue(mockVersionedTemplate);
      jest.spyOn(TemplateCustomization.prototype, 'create').mockResolvedValue(mockCustomization);
      (TemplateCustomizationOverview.generateOverview as jest.Mock).mockResolvedValue(mockCustomizationOverview);

      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.addTemplateCustomization).toBeTruthy();
      expect(result.body.singleResult.data.addTemplateCustomization.customizationId).toEqual(mockCustomizationOverview.customizationId);
    });

    it('should throw NotFoundError when versioned template does not exist', async () => {
      (VersionedTemplate.findById as jest.Mock) = jest.fn().mockResolvedValue(null);

      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });

    it('should throw InternalServerError on unexpected error', async () => {
      const unexpectedError = new Error('Unexpected');
      (VersionedTemplate.findById as jest.Mock) = jest.fn().mockRejectedValue(unexpectedError);

      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Unexpected');
    });
  });

  describe('Mutation.updateTemplateCustomization', () => {
    const input = {
      input: {
        templateCustomizationId: 1,
        status: TemplateCustomizationStatus.PUBLISHED
      }
    };

    beforeEach(() => {
      query = `
        mutation updateTemplateCustomization($input: UpdateTemplateCustomizationInput!) {
          updateTemplateCustomization(input: $input) {
            versionedTemplateId
            customizationId
            versionedTemplateAffiliationId
            customizationStatus
            customizationMigrationStatus
            customizationIsDirty
            customizationLastCustomized
            errors {
              general
            }
          }
        }
      `;
    });

    it('should update template customization successfully', async () => {
      (getValidatedCustomization as jest.Mock) = jest.fn().mockResolvedValue(mockCustomization);
      (mockCustomization.update as jest.Mock).mockResolvedValue(mockCustomization);
      (TemplateCustomizationOverview.generateOverview as jest.Mock).mockResolvedValue(mockCustomizationOverview);

      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.updateTemplateCustomization).toBeTruthy();
      expect(result.body.singleResult.data.updateTemplateCustomization.customizationId).toEqual(mockCustomizationOverview.customizationId);
    });

    it('should update versioned template when it has changed', async () => {
      const customizationWithDifferentTemplate = {
        ...mockCustomization,
        currentVersionedTemplateId: 300,
      } as unknown as TemplateCustomization;
      (getValidatedCustomization as jest.Mock) = jest.fn().mockResolvedValue(customizationWithDifferentTemplate);
      (customizationWithDifferentTemplate.update as jest.Mock).mockResolvedValue(customizationWithDifferentTemplate);
      (TemplateCustomizationOverview.generateOverview as jest.Mock).mockResolvedValue(mockCustomizationOverview);

      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.updateTemplateCustomization).toBeTruthy();
      expect(result.body.singleResult.data.updateTemplateCustomization.customizationId).toEqual(mockCustomizationOverview.customizationId);
    });

    it('should throw NotFoundError when customization does not exist', async () => {
      (getValidatedCustomization as jest.Mock) = jest.fn().mockResolvedValue(null);

      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });

    it('should throw InternalServerError on unexpected error', async () => {
      const unexpectedError = new Error('Unexpected');
      (getValidatedCustomization as jest.Mock) = jest.fn().mockRejectedValue(unexpectedError);

      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Unexpected');
    });
  });

  describe('Mutation.removeTemplateCustomization', () => {
    beforeEach(() => {
      query = `
        mutation removeTemplateCustomization($templateCustomizationId: Int!) {
          removeTemplateCustomization(templateCustomizationId: $templateCustomizationId) {
            id
            errors {
              general
            }
          }
        }
      `;
    });

    it('should delete template customization successfully', async () => {
      (getValidatedCustomization as jest.Mock) = jest.fn().mockResolvedValue(mockCustomization);
      (mockCustomization.delete as jest.Mock).mockResolvedValue(mockCustomization);
      (TemplateCustomizationOverview.generateOverview as jest.Mock).mockResolvedValue(mockCustomizationOverview);

      const input = { templateCustomizationId: 1 };
      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.removeTemplateCustomization).toBeTruthy();
      expect(result.body.singleResult.data.removeTemplateCustomization.id).toEqual(mockCustomizationOverview.customizationId);
    });

    it('should throw NotFoundError when customization does not exist', async () => {
      (getValidatedCustomization as jest.Mock) = jest.fn().mockResolvedValue(null);

      const input = { templateCustomizationId: 1 };
      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });

    it('should throw InternalServerError on unexpected error', async () => {
      const unexpectedError = new Error('Unexpected');
      (getValidatedCustomization as jest.Mock) = jest.fn().mockRejectedValue(unexpectedError);

      const vars = { templateCustomizationId: 1 };
      const result = await executeQuery(query, vars, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Unexpected');
    });
  });

  describe('Mutation.publishTemplateCustomization', () => {
    beforeEach(() => {
      query = `
        mutation publishTemplateCustomization($templateCustomizationId: Int!) {
          publishTemplateCustomization(templateCustomizationId: $templateCustomizationId) {
            customizationId
            customizationStatus
            customizationIsDirty
            customizationLastCustomized
            errors {
              general
            }
          }
        }
      `;
    });

    it('should publish template customization successfully when status is DRAFT', async () => {
      const draftCustomization = {
        ...mockCustomization,
        status: TemplateCustomizationStatus.DRAFT
      } as unknown as TemplateCustomization;
      (getValidatedCustomization as jest.Mock) = jest.fn().mockResolvedValue(draftCustomization);
      (mockCustomization.publish as jest.Mock).mockResolvedValue(mockCustomization);
      (TemplateCustomizationOverview.generateOverview as jest.Mock).mockResolvedValue(mockCustomizationOverview);

      const input = { templateCustomizationId: 1 };
      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.publishTemplateCustomization).toBeTruthy();
      expect(result.body.singleResult.data.publishTemplateCustomization.customizationId).toEqual(mockCustomizationOverview.customizationId);
      expect(draftCustomization.publish).toHaveBeenCalledWith(expect.any(Object));
    });

    it('should throw NotFoundError when customization does not exist', async () => {
      (getValidatedCustomization as jest.Mock) = jest.fn().mockResolvedValue(null);

      const input = { templateCustomizationId: 1 };
      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });

    it('should throw InternalServerError on unexpected error', async () => {
      const unexpectedError = new Error('Unexpected');
      (getValidatedCustomization as jest.Mock) = jest.fn().mockRejectedValue(unexpectedError);

      const vars = { templateCustomizationId: 1 };
      const result = await executeQuery(query, vars, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Unexpected');
    });
  });

  describe('Mutation.unpublishTemplateCustomization', () => {
    beforeEach(() => {
      query = `
        mutation unpublishTemplateCustomization($templateCustomizationId: Int!) {
          unpublishTemplateCustomization(templateCustomizationId: $templateCustomizationId) {
            customizationId
            customizationStatus
            customizationIsDirty
            customizationLastCustomized
            errors {
              general
            }
          }
        }
      `;
    });

    it('should unpublish template customization successfully when status is PUBLISHED', async () => {
      const unpublishedCustomizationOverview = {
        ...mockCustomizationOverview,
        customizationStatus: TemplateCustomizationStatus.PUBLISHED,
        customizationLastCustomized: mockCustomization.id
      };
      (getValidatedCustomization as jest.Mock).mockResolvedValue(mockCustomization);
      (mockCustomization.unpublish as jest.Mock).mockResolvedValue(mockCustomization);
      (TemplateCustomizationOverview.generateOverview as jest.Mock).mockResolvedValue(unpublishedCustomizationOverview);

      const input = { templateCustomizationId: 1 };
      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.unpublishTemplateCustomization).toBeTruthy();
      expect(result.body.singleResult.data.unpublishTemplateCustomization.customizationId).toEqual(unpublishedCustomizationOverview.customizationId);
      expect(mockCustomization.unpublish).toHaveBeenCalledWith(expect.any(Object));
    });

    it('should throw NotFoundError when customization does not exist', async () => {
      (getValidatedCustomization as jest.Mock) = jest.fn().mockResolvedValue(null);

      const input = { templateCustomizationId: 1 };
      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });

    it('should throw InternalServerError on unexpected error', async () => {
      const unexpectedError = new Error('Unexpected');
      (getValidatedCustomization as jest.Mock) = jest.fn().mockRejectedValue(unexpectedError);

      const vars = { templateCustomizationId: 1 };
      const result = await executeQuery(query, vars, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Unexpected');
    });
  });
});

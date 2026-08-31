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

const mockGetValidatedCustomization = jest.fn<(...args: any[]) => Promise<any>>();
const mockHasPermissionOnTemplateCustomization = jest.fn<(...args: boolean[]) => Promise<boolean>>();

const actualTemplateCustomizationService = await import('../../services/templateCustomizationService.js');
jest.unstable_mockModule('../../services/templateCustomizationService.js', () => ({
  ...actualTemplateCustomizationService,
  getValidatedCustomization: mockGetValidatedCustomization,
  hasPermissionOnTemplateCustomization: mockHasPermissionOnTemplateCustomization,
}));

type TemplateCustomizationInstance = InstanceType<typeof TemplateCustomization>;
function asTemplateCustomization(value: any): TemplateCustomizationInstance {
  return value as TemplateCustomizationInstance;
}

type VersionedTemplateInstance = InstanceType<typeof VersionedTemplate>;
function asVersionedTemplate(value: any): VersionedTemplateInstance {
  return value as VersionedTemplateInstance;
}

import type { MyContext } from "../../context.js";

// Dynamic imports AFTER mocks are set up
const { typeDefs } = await import("../../schema.js");
const { resolvers } = await import("../../resolver.js");
const { logger } = await import("../../logger.js");
const { buildContext, mockToken } = await import("../../__mocks__/context.js");
const { UserRole } = await import("../../models/User.js");
const { Affiliation } = await import("../../models/Affiliation.js");
const { VersionedTemplate } = await import('../../models/VersionedTemplate.js');
const { AdminNotification } = await import('../../models/AdminNotifications.js');
const {
  TemplateCustomization,
  TemplateCustomizationMigrationStatus,
  TemplateCustomizationOverview,
  TemplateCustomizationStatus
} = await import('../../models/TemplateCustomization.js');


let testServer: ApolloServer;
let affiliationId: string;
let adminToken: MyContext['token'];
let query: string;

// Proxy call to the Apollo server test server
async function executeQuery(
  query: string,
  variables: any,
  token: MyContext['token'],
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
  let mockCustomization: ReturnType<typeof makeMockCustomization>;
  let mockCustomizationOverview: any;
  let mockVersionedTemplate: any;


  function makeMockCustomization(overrides: Record<string, any> = {}) {
    return {
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
      create: jest.fn<(...args: any[]) => Promise<any>>(),
      update: jest.fn<(...args: any[]) => Promise<any>>(),
      delete: jest.fn<(...args: any[]) => Promise<any>>(),
      publish: jest.fn<(...args: any[]) => Promise<any>>(),
      unpublish: jest.fn<(...args: any[]) => Promise<any>>(),
      addError: jest.fn<(...args: any[]) => void>(),
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();

    mockCustomization = makeMockCustomization();

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

    mockVersionedTemplate = asVersionedTemplate({
      id: 200,
      templateId: 100,
    });
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
      jest.spyOn(TemplateCustomizationOverview, 'generateOverview').mockResolvedValue(mockCustomizationOverview as InstanceType<typeof TemplateCustomizationOverview>);

      mockHasPermissionOnTemplateCustomization.mockResolvedValue(true);
      mockGetValidatedCustomization.mockResolvedValue(mockCustomizationOverview);

      const vars = { templateCustomizationId: mockCustomizationOverview.customizationId };
      const result = await executeQuery(query, vars, adminToken);

      expect(TemplateCustomizationOverview.generateOverview).toHaveBeenCalledWith(
        'templateCustomization resolver',
        expect.any(Object),
        1
      );
      expect(mockGetValidatedCustomization).toHaveBeenCalledWith(
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
      jest.spyOn(TemplateCustomizationOverview, 'generateOverview').mockResolvedValue(null);

      const vars = { templateCustomizationId: mockCustomizationOverview.customizationId };
      const result = await executeQuery(query, vars, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });

    it('should throw InternalServerError on unexpected error', async () => {
      const unexpectedError = new Error('Unexpected');
      jest.spyOn(TemplateCustomizationOverview, 'generateOverview').mockRejectedValue(unexpectedError);

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
      jest.spyOn(VersionedTemplate, 'findById').mockResolvedValue(mockVersionedTemplate);
      jest.spyOn(TemplateCustomization.prototype, 'create').mockResolvedValue(asTemplateCustomization(mockCustomization));
      jest.spyOn(TemplateCustomizationOverview, 'generateOverview').mockResolvedValue(mockCustomizationOverview);

      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.addTemplateCustomization).toBeTruthy();
      expect(result.body.singleResult.data.addTemplateCustomization.customizationId).toEqual(mockCustomizationOverview.customizationId);
    });

    it('should throw NotFoundError when versioned template does not exist', async () => {
      jest.spyOn(VersionedTemplate, 'findById').mockResolvedValue(null);

      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });

    it('should throw InternalServerError on unexpected error', async () => {
      const unexpectedError = new Error('Unexpected');
      jest.spyOn(VersionedTemplate, 'findById').mockRejectedValue(unexpectedError);

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
      mockGetValidatedCustomization.mockResolvedValue(mockCustomization);
      mockCustomization.update.mockResolvedValue(mockCustomization as any);
      jest.spyOn(TemplateCustomizationOverview, 'generateOverview').mockResolvedValue(mockCustomizationOverview);

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
      };
      mockGetValidatedCustomization.mockResolvedValue(customizationWithDifferentTemplate);
      customizationWithDifferentTemplate.update.mockResolvedValue(customizationWithDifferentTemplate);
      jest.spyOn(TemplateCustomizationOverview, 'generateOverview').mockResolvedValue(mockCustomizationOverview);

      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.updateTemplateCustomization).toBeTruthy();
      expect(result.body.singleResult.data.updateTemplateCustomization.customizationId).toEqual(mockCustomizationOverview.customizationId);
    });

    it('should throw NotFoundError when customization does not exist', async () => {
      mockGetValidatedCustomization.mockResolvedValue(null);

      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });

    it('should throw InternalServerError on unexpected error', async () => {
      const unexpectedError = new Error('Unexpected');
      mockGetValidatedCustomization.mockRejectedValue(unexpectedError);

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
      mockGetValidatedCustomization.mockResolvedValue(mockCustomization);
      mockCustomization.delete.mockResolvedValue(mockCustomization as any);
      jest.spyOn(TemplateCustomizationOverview, 'generateOverview').mockResolvedValue(mockCustomizationOverview as InstanceType<typeof TemplateCustomizationOverview>);

      const input = { templateCustomizationId: 1 };
      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.removeTemplateCustomization).toBeTruthy();
      expect(result.body.singleResult.data.removeTemplateCustomization.id).toEqual(mockCustomizationOverview.customizationId);
    });

    it('should throw NotFoundError when customization does not exist', async () => {
      mockGetValidatedCustomization.mockResolvedValue(null);

      const input = { templateCustomizationId: 1 };
      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });

    it('should throw InternalServerError on unexpected error', async () => {
      const unexpectedError = new Error('Unexpected');
      mockGetValidatedCustomization.mockRejectedValue(unexpectedError);

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
        status: TemplateCustomizationStatus.DRAFT,
        publish: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(mockCustomization),
      };

      mockGetValidatedCustomization.mockResolvedValue(draftCustomization);
      jest.spyOn(TemplateCustomizationOverview, 'generateOverview').mockResolvedValue(mockCustomizationOverview);

      jest.spyOn(Affiliation, 'findByURI').mockResolvedValue({ uri: affiliationId } as any);

      const mockCreate = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ id: 1 });
      jest.spyOn(AdminNotification.prototype, 'create').mockImplementation(mockCreate);


      const input = { templateCustomizationId: 1 };
      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.publishTemplateCustomization.customizationId).toEqual(mockCustomizationOverview.customizationId);
      expect(draftCustomization.publish).toHaveBeenCalledWith(expect.any(Object));
    });

    it('should throw NotFoundError when customization does not exist', async () => {
      mockGetValidatedCustomization.mockResolvedValue(null);

      const input = { templateCustomizationId: 1 };
      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });

    it('should throw InternalServerError on unexpected error', async () => {
      const unexpectedError = new Error('Unexpected');
      mockGetValidatedCustomization.mockRejectedValue(unexpectedError);

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
      mockGetValidatedCustomization.mockResolvedValue(mockCustomization);
      mockCustomization.unpublish.mockResolvedValue(mockCustomization);
      jest.spyOn(TemplateCustomizationOverview, 'generateOverview').mockResolvedValue(unpublishedCustomizationOverview);

      const input = { templateCustomizationId: 1 };
      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.unpublishTemplateCustomization).toBeTruthy();
      expect(result.body.singleResult.data.unpublishTemplateCustomization.customizationId).toEqual(unpublishedCustomizationOverview.customizationId);
      expect(mockCustomization.unpublish).toHaveBeenCalledWith(expect.any(Object));
    });

    it('should throw NotFoundError when customization does not exist', async () => {
      mockGetValidatedCustomization.mockResolvedValue(null);

      const input = { templateCustomizationId: 1 };
      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });

    it('should throw InternalServerError on unexpected error', async () => {
      const unexpectedError = new Error('Unexpected');
      mockGetValidatedCustomization.mockRejectedValue(unexpectedError);

      const vars = { templateCustomizationId: 1 };
      const result = await executeQuery(query, vars, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Unexpected');
    });
  });
});

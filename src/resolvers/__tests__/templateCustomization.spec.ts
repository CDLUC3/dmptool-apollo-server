import casual from "casual";
import { ApolloServer } from "@apollo/server";
import { typeDefs } from "../../schema";
import { resolvers } from '../../resolver';
import { buildContext, mockToken } from "../../__mocks__/context";
import { isAdmin } from '../../services/authService';
import { VersionedTemplate } from '../../models/VersionedTemplate';
import { logger } from "../../logger";
import { MyContext } from '../../context';
import { JWTAccessToken } from "../../services/tokenService";
import { UserRole } from "../../models/User";
import {
  TemplateCustomization,
  TemplateCustomizationMigrationStatus,
  TemplateCustomizationStatus
} from '../../models/TemplateCustomization';
import {
  checkForFunderTemplateDrift,
  hasPermissionOnTemplateCustomization
} from '../../services/templateCustomizationService';

jest.mock('../../context.ts');
jest.mock('../../datasources/cache');

jest.mock('../../models/TemplateCustomization');
jest.mock('../../services/authService');
jest.mock('../../services/templateCustomizationService');

const mockIsAdmin = isAdmin as jest.MockedFunction<typeof isAdmin>;
const mockHasPermissionOnTemplateCustomization = hasPermissionOnTemplateCustomization as jest.MockedFunction<typeof hasPermissionOnTemplateCustomization>;
const mockCheckForFunderTemplateDrift = checkForFunderTemplateDrift as jest.MockedFunction<typeof checkForFunderTemplateDrift>;

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
  let mockContext: MyContext;
  let mockCustomization;
  let mockVersionedTemplate;

  beforeEach(() => {
    jest.clearAllMocks();

    mockContext = {
      token: {
        affiliationId: 1,
      },
      logger: {
        error: jest.fn(),
      },
    } as undefined as MyContext;

    mockCustomization = {
      id: 1,
      affiliationId: 'http://example.com/uni',
      templateId: 100,
      currentVersionedTemplateId: 200,
      status: TemplateCustomizationStatus.PUBLISHED,
      migrationStatus: TemplateCustomizationMigrationStatus.OK,
      isDirty: false,
      latestPublishedDate: new Date('2023-01-01').toISOString(),
      latestPublishedVersion: 12,
      created: new Date('2023-01-01').toISOString(),
      modified: new Date('2023-01-02').toISOString(),
      errors: null,
      hasErrors: jest.fn().mockReturnValue(false),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      publish: jest.fn(),
      unpublish: jest.fn(),
      addError: jest.fn(),
    };

    mockVersionedTemplate = {
      id: 200,
      templateId: 100,
    };
  });

  describe('Query.templateCustomization', () => {
    beforeEach(() => {
      query = `
        query templateCustomization($templateCustomizationId: Int!) {
          templateCustomization(templateCustomizationId: $templateCustomizationId) {
            id
            affiliationId
            currentVersionedTemplateId
            status
            migrationStatus
            isDirty
            latestPublishedDate
            errors {
              general
            }
          }
        }
      `;
    });

    it('should return template customization when user is admin and has permission', async () => {
      mockIsAdmin.mockReturnValue(true);
      (TemplateCustomization.findById as jest.Mock) = jest.fn().mockResolvedValue(mockCustomization);
      mockHasPermissionOnTemplateCustomization.mockReturnValue(true);
      mockCheckForFunderTemplateDrift.mockResolvedValue(mockCustomization);

      const vars = { templateCustomizationId: mockCustomization.id };
      const result = await executeQuery(query, vars, adminToken);

      expect(mockIsAdmin).toHaveBeenCalledWith(adminToken);
      expect(TemplateCustomization.findById).toHaveBeenCalledWith(
        'templateCustomization resolver',
        expect.any(Object),
        1
      );
      expect(mockHasPermissionOnTemplateCustomization).toHaveBeenCalledWith(
        expect.any(Object),
        mockCustomization
      );
      expect(mockCheckForFunderTemplateDrift).toHaveBeenCalledWith(
        'templateCustomization resolver',
        expect.any(Object),
        mockCustomization
      );

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.templateCustomization).toBeTruthy();
      expect(result.body.singleResult.data.templateCustomization.id).toEqual(mockCustomization.id);
    });

    it('should throw NotFoundError when customization does not exist', async () => {
      mockIsAdmin.mockReturnValue(true);
      (TemplateCustomization.findById as jest.Mock) = jest.fn().mockResolvedValue(null);

      const vars = { templateCustomizationId: mockCustomization.id };
      const result = await executeQuery(query, vars, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });

    it('should throw ForbiddenError when user does not have permission', async () => {
      mockIsAdmin.mockReturnValue(true);
      (TemplateCustomization.findById as jest.Mock) = jest.fn().mockResolvedValue(mockCustomization);
      mockHasPermissionOnTemplateCustomization.mockReturnValue(false);

      const vars = { templateCustomizationId: mockCustomization.id };
      const result = await executeQuery(query, vars, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Forbidden');
    });

    it('should throw ForbiddenError when user is not admin but has token', async () => {
      mockIsAdmin.mockReturnValue(false);

      const vars = { templateCustomizationId: mockCustomization.id };
      const result = await executeQuery(query, vars, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Forbidden');
    });

    it('should throw AuthenticationError when user has no token', async () => {
      mockIsAdmin.mockReturnValue(false);
      mockContext.token = null;

      const vars = { templateCustomizationId: mockCustomization.id };
      const result = await executeQuery(query, vars, null);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Unauthorized');
    });

    it('should throw InternalServerError on unexpected error', async () => {
      mockIsAdmin.mockReturnValue(true);
      const unexpectedError = new Error('Unexpected');
      (TemplateCustomization.findById as jest.Mock) = jest.fn().mockRejectedValue(unexpectedError);

      const vars = { templateCustomizationId: mockCustomization.id };
      const result = await executeQuery(query, vars, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Something went wrong');
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
            id
            affiliationId
            currentVersionedTemplateId
            status
            migrationStatus
            isDirty
            latestPublishedDate
            errors {
              general
            }
          }
        }
      `;
    });

    it('should create template customization successfully', async () => {
      mockIsAdmin.mockReturnValue(true);
      (VersionedTemplate.findById as jest.Mock) = jest.fn().mockResolvedValue(mockVersionedTemplate);
      mockCustomization.create.mockResolvedValue(mockCustomization);
      mockCheckForFunderTemplateDrift.mockResolvedValue(mockCustomization);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (TemplateCustomization as any).mockImplementation(() => mockCustomization);

      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.addTemplateCustomization).toBeTruthy();
      expect(result.body.singleResult.data.addTemplateCustomization.id).toEqual(mockCustomization.id);
    });

    it('should throw NotFoundError when versioned template does not exist', async () => {
      mockIsAdmin.mockReturnValue(true);
      (VersionedTemplate.findById as jest.Mock) = jest.fn().mockResolvedValue(null);

      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });

    it('should throw ForbiddenError when user is not admin but has token', async () => {
      mockIsAdmin.mockReturnValue(false);

      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Forbidden');
    });

    it('should throw AuthenticationError when user has no token', async () => {
      mockIsAdmin.mockReturnValue(false);
      mockContext.token = null;

      const result = await executeQuery(query, input, null);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Unauthorized');
    });

    it('should throw InternalServerError on unexpected error', async () => {
      mockIsAdmin.mockReturnValue(true);
      const unexpectedError = new Error('Unexpected');
      (VersionedTemplate.findById as jest.Mock) = jest.fn().mockRejectedValue(unexpectedError);

      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Something went wrong');
    });
  });

  describe('Mutation.updateTemplateCustomization', () => {
    const input = {
      input: {
        templateCustomizationId: 1,
        versionedTemplateId: 200,
        status: TemplateCustomizationStatus.PUBLISHED
      }
    };

    beforeEach(() => {
      query = `
        mutation updateTemplateCustomization($input: UpdateTemplateCustomizationInput!) {
          updateTemplateCustomization(input: $input) {
            id
            affiliationId
            currentVersionedTemplateId
            status
            migrationStatus
            isDirty
            latestPublishedDate
            errors {
              general
            }
          }
        }
      `;
    });

    it('should update template customization successfully', async () => {
      mockIsAdmin.mockReturnValue(true);
      (TemplateCustomization.findById as jest.Mock) = jest.fn().mockResolvedValue(mockCustomization);
      mockCustomization.update.mockResolvedValue(mockCustomization);
      mockCheckForFunderTemplateDrift.mockResolvedValue(mockCustomization);

      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.updateTemplateCustomization).toBeTruthy();
      expect(result.body.singleResult.data.updateTemplateCustomization.id).toEqual(mockCustomization.id);
    });

    it('should update versioned template when it has changed', async () => {
      mockIsAdmin.mockReturnValue(true);
      const customizationWithDifferentTemplate = {
        ...mockCustomization,
        currentVersionedTemplateId: 300,
      };
      (TemplateCustomization.findById as jest.Mock) = jest.fn().mockResolvedValue(customizationWithDifferentTemplate);
      (VersionedTemplate.findById as jest.Mock) = jest.fn().mockResolvedValue(mockVersionedTemplate);
      customizationWithDifferentTemplate.update.mockResolvedValue(customizationWithDifferentTemplate);
      mockCheckForFunderTemplateDrift.mockResolvedValue(customizationWithDifferentTemplate);

      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.updateTemplateCustomization).toBeTruthy();
      expect(result.body.singleResult.data.updateTemplateCustomization.id).toEqual(mockCustomization.id);
    });

    it('should throw NotFoundError when versioned template does not exist', async () => {
      mockIsAdmin.mockReturnValue(true);
      const customizationWithDifferentTemplate = {
        ...mockCustomization,
        currentVersionedTemplateId: 300,
      };
      (TemplateCustomization.findById as jest.Mock) = jest.fn().mockResolvedValue(customizationWithDifferentTemplate);
      (VersionedTemplate.findById as jest.Mock) = jest.fn().mockResolvedValue(null);

      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });

    it('should throw NotFoundError when customization does not exist', async () => {
      mockIsAdmin.mockReturnValue(true);
      (TemplateCustomization.findById as jest.Mock) = jest.fn().mockResolvedValue(null);

      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });

    it('should throw ForbiddenError when user is not admin but has token', async () => {
      mockIsAdmin.mockReturnValue(false);

      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Forbidden');
    });

    it('should throw AuthenticationError when user has no token', async () => {
      mockIsAdmin.mockReturnValue(false);
      mockContext.token = null;

      const result = await executeQuery(query, input, null);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Unauthorized');
    });

    it('should throw InternalServerError on unexpected error', async () => {
      mockIsAdmin.mockReturnValue(true);
      const unexpectedError = new Error('Unexpected');
      (TemplateCustomization.findById as jest.Mock) = jest.fn().mockRejectedValue(unexpectedError);

      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Something went wrong');
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
      mockIsAdmin.mockReturnValue(true);
      (TemplateCustomization.findById as jest.Mock) = jest.fn().mockResolvedValue(mockCustomization);
      mockCustomization.delete.mockResolvedValue(mockCustomization);

      const input = { templateCustomizationId: 1 };
      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.removeTemplateCustomization).toBeTruthy();
      expect(result.body.singleResult.data.removeTemplateCustomization.id).toEqual(mockCustomization.id);
    });

    it('should throw NotFoundError when customization does not exist', async () => {
      mockIsAdmin.mockReturnValue(true);
      (TemplateCustomization.findById as jest.Mock) = jest.fn().mockResolvedValue(null);

      const input = { templateCustomizationId: 1 };
      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });

    it('should throw ForbiddenError when user is not admin but has token', async () => {
      mockIsAdmin.mockReturnValue(false);

      const input = { templateCustomizationId: 1 };
      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Forbidden');
    });

    it('should throw AuthenticationError when user has no token', async () => {
      mockIsAdmin.mockReturnValue(false);
      mockContext.token = null;

      const vars = { templateCustomizationId: 1 };
      const result = await executeQuery(query, vars, null);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Unauthorized');
    });

    it('should throw InternalServerError on unexpected error', async () => {
      mockIsAdmin.mockReturnValue(true);
      const unexpectedError = new Error('Unexpected');
      (TemplateCustomization.findById as jest.Mock) = jest.fn().mockRejectedValue(unexpectedError);

      const vars = { templateCustomizationId: 1 };
      const result = await executeQuery(query, vars, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Something went wrong');
    });
  });

  describe('Mutation.publishTemplateCustomization', () => {
    beforeEach(() => {
      query = `
        mutation publishTemplateCustomization($templateCustomizationId: Int!) {
          publishTemplateCustomization(templateCustomizationId: $templateCustomizationId) {
            id
            affiliationId
            currentVersionedTemplateId
            status
            migrationStatus
            isDirty
            latestPublishedDate
            errors {
              general
            }
          }
        }
      `;
    });

    it('should publish template customization successfully when status is DRAFT', async () => {
      mockIsAdmin.mockReturnValue(true);
      const draftCustomization = {
        ...mockCustomization,
        status: TemplateCustomizationStatus.DRAFT
      };
      (TemplateCustomization.findById as jest.Mock) = jest.fn().mockResolvedValue(draftCustomization);
      draftCustomization.publish.mockResolvedValue(mockCustomization);

      const input = {templateCustomizationId: 1};
      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.publishTemplateCustomization).toBeTruthy();
      expect(result.body.singleResult.data.publishTemplateCustomization.id).toEqual(mockCustomization.id);
      expect(draftCustomization.publish).toHaveBeenCalledWith(expect.any(Object));
    });

    it('should add error when customization is already published', async () => {
      mockIsAdmin.mockReturnValue(true);
      (TemplateCustomization.findById as jest.Mock) = jest.fn().mockResolvedValue(mockCustomization);
      mockCustomization.publish.mockResolvedValue(mockCustomization);

      const input = {templateCustomizationId: 1};
      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.publishTemplateCustomization).toBeTruthy();
      expect(mockCustomization.addError).toHaveBeenCalledWith('general', 'Customization is already published');
      expect(mockCustomization.publish).toHaveBeenCalledWith(expect.any(Object));
    });

    it('should throw NotFoundError when customization does not exist', async () => {
      mockIsAdmin.mockReturnValue(true);
      (TemplateCustomization.findById as jest.Mock) = jest.fn().mockResolvedValue(null);

      const input = {templateCustomizationId: 1};
      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });

    it('should throw ForbiddenError when user is not admin but has token', async () => {
      mockIsAdmin.mockReturnValue(false);

      const input = {templateCustomizationId: 1};
      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Forbidden');
    });

    it('should throw AuthenticationError when user has no token', async () => {
      mockIsAdmin.mockReturnValue(false);
      mockContext.token = null;

      const vars = {templateCustomizationId: 1};
      const result = await executeQuery(query, vars, null);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Unauthorized');
    });

    it('should throw InternalServerError on unexpected error', async () => {
      mockIsAdmin.mockReturnValue(true);
      const unexpectedError = new Error('Unexpected');
      (TemplateCustomization.findById as jest.Mock) = jest.fn().mockRejectedValue(unexpectedError);

      const vars = {templateCustomizationId: 1};
      const result = await executeQuery(query, vars, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Something went wrong');
    });
  });

  describe('Mutation.unpublishTemplateCustomization', () => {
    beforeEach(() => {
      query = `
        mutation unpublishTemplateCustomization($templateCustomizationId: Int!) {
          unpublishTemplateCustomization(templateCustomizationId: $templateCustomizationId) {
            id
            affiliationId
            currentVersionedTemplateId
            status
            migrationStatus
            isDirty
            latestPublishedDate
            errors {
              general
            }
          }
        }
      `;
    });

    it('should unpublish template customization successfully when status is PUBLISHED', async () => {
      mockIsAdmin.mockReturnValue(true);
      (TemplateCustomization.findById as jest.Mock) = jest.fn().mockResolvedValue(mockCustomization);
      const unpublishedCustomization = {
        ...mockCustomization,
        status: TemplateCustomizationStatus.DRAFT
      };
      mockCustomization.unpublish.mockResolvedValue(unpublishedCustomization);

      const input = {templateCustomizationId: 1};
      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.unpublishTemplateCustomization).toBeTruthy();
      expect(result.body.singleResult.data.unpublishTemplateCustomization.id).toEqual(mockCustomization.id);
      expect(mockCustomization.unpublish).toHaveBeenCalledWith(expect.any(Object));
    });

    it('should add error when customization is not published', async () => {
      mockIsAdmin.mockReturnValue(true);
      const draftCustomization = {
        ...mockCustomization,
        status: TemplateCustomizationStatus.DRAFT
      };
      (TemplateCustomization.findById as jest.Mock) = jest.fn().mockResolvedValue(draftCustomization);

      const input = {templateCustomizationId: 1};
      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(draftCustomization.addError).toHaveBeenCalledWith('general', 'Customization is not published');
      expect(draftCustomization.unpublish).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when customization does not exist', async () => {
      mockIsAdmin.mockReturnValue(true);
      (TemplateCustomization.findById as jest.Mock) = jest.fn().mockResolvedValue(null);

      const input = {templateCustomizationId: 1};
      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });

    it('should throw ForbiddenError when user is not admin but has token', async () => {
      mockIsAdmin.mockReturnValue(false);

      const input = {templateCustomizationId: 1};
      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Forbidden');
    });

    it('should throw AuthenticationError when user has no token', async () => {
      mockIsAdmin.mockReturnValue(false);
      mockContext.token = null;

      const vars = {templateCustomizationId: 1};
      const result = await executeQuery(query, vars, null);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Unauthorized');
    });

    it('should throw InternalServerError on unexpected error', async () => {
      mockIsAdmin.mockReturnValue(true);
      const unexpectedError = new Error('Unexpected');
      (TemplateCustomization.findById as jest.Mock) = jest.fn().mockRejectedValue(unexpectedError);

      const vars = {templateCustomizationId: 1};
      const result = await executeQuery(query, vars, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Something went wrong');
    });
  });


});

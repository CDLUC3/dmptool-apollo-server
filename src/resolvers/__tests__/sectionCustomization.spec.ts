import casual from "casual";

// Mock the authenticatedResolver function because it is a Highest Order Function (HOF)
// and gets loaded when we import resolvers.ts below
jest.mock('../../services/authService', () => ({
  ...jest.requireActual('../../services/authService'),
  // This mocks the HOF itself to be a simple pass-through
  authenticatedResolver: jest.fn((ref, level, resolver) => resolver),
}));

import { ApolloServer } from "@apollo/server";
import { typeDefs } from "../../schema";
import { resolvers } from '../../resolver';

import { logger } from "../../logger";
import { JWTAccessToken } from "../../services/tokenService";
import { SectionCustomization } from '../../models/SectionCustomization';
import { CustomSection } from '../../models/CustomSection';
import { VersionedSection } from '../../models/VersionedSection';
import { PinnedSectionTypeEnum } from '../../models/CustomSection';
import { User, UserRole } from "../../models/User";
import {
  getValidatedCustomization,
  markTemplateCustomizationAsDirty
} from '../../services/templateCustomizationService';
import { buildContext, mockToken } from "../../__mocks__/context";
import { Affiliation } from "../../models/Affiliation";

jest.mock('../../context.ts');
jest.mock('../../datasources/cache');

jest.mock('../../models/SectionCustomization');
jest.mock('../../models/CustomSection');
jest.mock('../../models/TemplateCustomization');
jest.mock('../../models/VersionedSection');
jest.mock('../../services/templateCustomizationService');

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

describe('sectionCustomization resolver', () => {
  let user: User;

  beforeEach(async () => {
    user = new User({
      id: casual.integer(1, 999),
      givenName: casual.first_name,
      surName: casual.last_name,
      role: UserRole.RESEARCHER,
      affiliationId: casual.url,
    });

    (user.getEmail as jest.Mock) = jest.fn().mockResolvedValue(casual.email);
  });

  describe('Query.sectionCustomization', () => {
    beforeEach(() => {
      query = `
        query sectionCustomization($sectionCustomizationId: Int!) {
          sectionCustomization(sectionCustomizationId: $sectionCustomizationId) {
            id
            templateCustomizationId
            sectionId
            migrationStatus
            guidance
            errors {
              general
            }
            versionedSection {
              id
              name
            }
          }
        }
      `;
    });

    it('should return the section customization when found and user has permission', async () => {
      const mockCustomization = {
        id: 1,
        templateCustomizationId: 10,
        sectionId: 5,
        migrationStatus: 'OK',
        guidance: 'Test guidance'
      };
      const mockParent = { id: 10, isDirty: false };

      (SectionCustomization.findById as jest.Mock).mockResolvedValue(mockCustomization);
      (getValidatedCustomization as jest.Mock).mockResolvedValue(mockParent);

      const vars = { sectionCustomizationId: 1 };
      const result = await executeQuery(query, vars, adminToken);

      expect(result.body.singleResult.data.sectionCustomization.id).toEqual(1);
      expect(result.body.singleResult.data.sectionCustomization.templateCustomizationId).toEqual(10);
      expect(result.body.singleResult.data.sectionCustomization.sectionId).toEqual(5);
      expect(result.body.singleResult.data.sectionCustomization.migrationStatus).toEqual('OK');
      expect(result.body.singleResult.data.sectionCustomization.guidance).toEqual('Test guidance');
      expect(SectionCustomization.findById).toHaveBeenCalledWith(
        'sectionCustomization resolver',
        expect.any(Object),
        1
      );
    });

    it('should return NotFound error when section customization is not found', async () => {
      (SectionCustomization.findById as jest.Mock).mockResolvedValue(null);

      const vars = { sectionCustomizationId: 999 };
      const result = await executeQuery(query, vars, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });

    it('should return NotFound error when parent template customization is not found', async () => {
      const mockCustomization = {
        id: 1,
        templateCustomizationId: 10
      };

      (SectionCustomization.findById as jest.Mock).mockResolvedValue(mockCustomization);
      (getValidatedCustomization as jest.Mock).mockResolvedValue(null);

      const vars = { sectionCustomizationId: 1 };
      const result = await executeQuery(query, vars, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });
  });

  describe('Query.sectionCustomizationByVersionedSection', () => {
    beforeEach(() => {
      query = `
        query sectionCustomizationByVersionedSection($templateCustomizationId: Int!, $versionedSectionId: Int!) {
          sectionCustomizationByVersionedSection(templateCustomizationId: $templateCustomizationId, versionedSectionId: $versionedSectionId) {
            id
            templateCustomizationId
            sectionId
            migrationStatus
            guidance
            errors {
              general
            }
            versionedSection {
              id
              name
            }
          }
        }
      `;
    });

    it('should return the section customization when found and user has permission', async () => {
      const mockCustomization = {
        id: 1,
        templateCustomizationId: 10,
        sectionId: 5,
        migrationStatus: 'OK',
        guidance: 'Test guidance'
      };
      const mockParent = { id: 10, isDirty: false };

      (SectionCustomization.findByCustomizationAndVersionedSection as jest.Mock).mockResolvedValue(mockCustomization);
      (getValidatedCustomization as jest.Mock).mockResolvedValue(mockParent);

      const vars = { templateCustomizationId: 10, versionedSectionId: 5 };
      const result = await executeQuery(query, vars, adminToken);

      expect(result.body.singleResult.data.sectionCustomizationByVersionedSection.id).toEqual(1);
      expect(result.body.singleResult.data.sectionCustomizationByVersionedSection.templateCustomizationId).toEqual(10);
      expect(result.body.singleResult.data.sectionCustomizationByVersionedSection.sectionId).toEqual(5);
      expect(result.body.singleResult.data.sectionCustomizationByVersionedSection.migrationStatus).toEqual('OK');
      expect(result.body.singleResult.data.sectionCustomizationByVersionedSection.guidance).toEqual('Test guidance');
      expect(SectionCustomization.findByCustomizationAndVersionedSection).toHaveBeenCalledWith(
        'sectionCustomizationByVersionedSection resolver',
        expect.any(Object),
        10,
        5
      );
    });

    it('should return NotFound error when section customization is not found', async () => {
      (SectionCustomization.findByCustomizationAndVersionedSection as jest.Mock).mockResolvedValue(null);

      const vars = { templateCustomizationId: 10, versionedSectionId: 999 };
      const result = await executeQuery(query, vars, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });

    it('should return NotFound error when parent template customization is not found', async () => {
      const mockCustomization = {
        id: 1,
        templateCustomizationId: 10
      };

      (SectionCustomization.findByCustomizationAndVersionedSection as jest.Mock).mockResolvedValue(mockCustomization);
      (getValidatedCustomization as jest.Mock).mockResolvedValue(null);

      const vars = { templateCustomizationId: 10, versionedSectionId: 5 };
      const result = await executeQuery(query, vars, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });
  });

  describe('Query.sectionCustomizationByVersionedQuestion', () => {
    beforeEach(() => {
      query = `
        query sectionCustomizationByVersionedQuestion($templateCustomizationId: Int!, $versionedQuestionId: Int!) {
          sectionCustomizationByVersionedQuestion(templateCustomizationId: $templateCustomizationId, versionedQuestionId: $versionedQuestionId) {
            id
            templateCustomizationId
            sectionId
            migrationStatus
            guidance
            errors {
              general
            }
            versionedSection {
              id
              name
            }
          }
        }
      `;
    });

    it('should return the question customization when found and user has permission', async () => {
      const mockCustomization = {
        id: 1,
        templateCustomizationId: 10,
        sectionId: 5,
        migrationStatus: 'OK',
        guidance: 'Test guidance'
      };
      const mockParent = { id: 10, isDirty: false };

      (SectionCustomization.findByCustomizationAndVersionedQuestion as jest.Mock).mockResolvedValue(mockCustomization);
      (getValidatedCustomization as jest.Mock).mockResolvedValue(mockParent);

      const vars = { templateCustomizationId: 10, versionedQuestionId: 5 };
      const result = await executeQuery(query, vars, adminToken);

      expect(result.body.singleResult.data.sectionCustomizationByVersionedQuestion.id).toEqual(1);
      expect(result.body.singleResult.data.sectionCustomizationByVersionedQuestion.templateCustomizationId).toEqual(10);
      expect(result.body.singleResult.data.sectionCustomizationByVersionedQuestion.sectionId).toEqual(5);
      expect(result.body.singleResult.data.sectionCustomizationByVersionedQuestion.migrationStatus).toEqual('OK');
      expect(result.body.singleResult.data.sectionCustomizationByVersionedQuestion.guidance).toEqual('Test guidance');
      expect(SectionCustomization.findByCustomizationAndVersionedQuestion).toHaveBeenCalledWith(
        'sectionCustomizationByVersionedQuestion resolver',
        expect.any(Object),
        10,
        5
      );
    });

    it('should return NotFound error when section customization is not found', async () => {
      (SectionCustomization.findByCustomizationAndVersionedQuestion as jest.Mock).mockResolvedValue(null);

      const vars = { templateCustomizationId: 10, versionedQuestionId: 999 };
      const result = await executeQuery(query, vars, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });

    it('should return NotFound error when parent template customization is not found', async () => {
      const mockCustomization = {
        id: 1,
        templateCustomizationId: 10
      };

      (SectionCustomization.findByCustomizationAndVersionedQuestion as jest.Mock).mockResolvedValue(mockCustomization);
      (getValidatedCustomization as jest.Mock).mockResolvedValue(null);

      const vars = { templateCustomizationId: 10, versionedQuestionId: 5 };
      const result = await executeQuery(query, vars, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });
  });

  describe('Query.customSection', () => {
    beforeEach(() => {
      query = `
        query customSection($customSectionId: Int!) {
          customSection(customSectionId: $customSectionId) {
            id
            templateCustomizationId
            pinnedSectionType
            pinnedSectionId
            migrationStatus
            name
            introduction
            requirements
            guidance
            errors {
              general
            }
          }
        }
      `;
    });

    it('should return the custom section when found and user has permission', async () => {
      const mockCustomSection = {
        id: 1,
        templateCustomizationId: 10,
        name: 'Custom Section'
      };
      const mockParent = {id: 10, isDirty: false};

      (CustomSection.findById as jest.Mock).mockResolvedValue(mockCustomSection);
      (getValidatedCustomization as jest.Mock).mockResolvedValue(mockParent);

      const vars = { customSectionId: 1 };
      const result = await executeQuery(query, vars, adminToken);

      expect(result.body.singleResult.data.customSection.id).toEqual(1);
      expect(result.body.singleResult.data.customSection.templateCustomizationId).toEqual(10);
      expect(result.body.singleResult.data.customSection.name).toEqual('Custom Section');
      expect(CustomSection.findById).toHaveBeenCalledWith(
        'customSection resolver',
        expect.any(Object),
        1
      );
    });

    it('should return NotFound when custom section is not found', async () => {
      (CustomSection.findById as jest.Mock).mockResolvedValue(null);

      const vars = { customSectionId: 999 };
      const result = await executeQuery(query, vars, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });

    it('should throw error when parent template customization is not found', async () => {
      const mockCustomSection = {
        id: 1,
        templateCustomizationId: 10
      };

      (CustomSection.findById as jest.Mock).mockResolvedValue(mockCustomSection);
      (getValidatedCustomization as jest.Mock).mockResolvedValue(null);

      const vars = { customSectionId: 1 };
      const result = await executeQuery(query, vars, adminToken)

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });
  });

  describe('Mutation.addSectionCustomization', () => {
    beforeEach(() => {
      query = `
        mutation addSectionCustomization($input: AddSectionCustomizationInput!) {
          addSectionCustomization(input: $input) {
            id
            templateCustomizationId
            sectionId
            errors {
              templateCustomizationId
              sectionId
              guidance
              general
            }
          }
        }
      `;
    });

    it('should create a new section customization successfully', async () => {
      const input = {
        templateCustomizationId: 10,
        versionedSectionId: 5
      };
      const mockSection = { id: 5, name: 'Section' };
      const mockParent = { id: 10, isDirty: false };
      const mockCreated = {
        id: 1,
        sectionId: 5,
        ...input,
        hasErrors: jest.fn().mockReturnValue(false)
      } as undefined as SectionCustomization;

      (VersionedSection.findById as jest.Mock).mockResolvedValue(mockSection);
      (getValidatedCustomization as jest.Mock).mockResolvedValue(mockParent);
      jest.spyOn(SectionCustomization.prototype, 'create').mockResolvedValue(mockCreated);

      const result = await executeQuery(query, { input }, adminToken);

      expect(result.body.singleResult.data.addSectionCustomization.id).toEqual(1);
      expect(result.body.singleResult.data.addSectionCustomization.templateCustomizationId).toEqual(10);
      expect(result.body.singleResult.data.addSectionCustomization.sectionId).toEqual(5);
      expect(markTemplateCustomizationAsDirty).toHaveBeenCalledWith(
        'addSectionCustomization resolver',
        expect.any(Object),
        10,
        mockCreated
      );
    });

    it('should throw NotFoundError when versioned section is not found', async () => {
      const input = {
        templateCustomizationId: 10,
        versionedSectionId: 999
      };

      (VersionedSection.findById as jest.Mock).mockResolvedValue(null);

      const result = await executeQuery(query, { input }, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });

    it('should not mark parent as dirty when creation has errors', async () => {
      const input = {
        templateCustomizationId: 10,
        versionedSectionId: 5
      };
      const mockSection = {id: 5};
      const mockParent = {id: 10, isDirty: false};
      const mockCreated = {
        id: 1,
        sectionId: 5,
        hasErrors: jest.fn().mockReturnValue(true)
      } as undefined as SectionCustomization;

      (VersionedSection.findById as jest.Mock).mockResolvedValue(mockSection);
      (getValidatedCustomization as jest.Mock).mockResolvedValue(mockParent);
      jest.spyOn(SectionCustomization.prototype, 'create').mockResolvedValue(mockCreated);

      await executeQuery(query, { input }, adminToken);

      expect(markTemplateCustomizationAsDirty).not.toHaveBeenCalled();
    });
  });

  describe('Mutation.updateSectionCustomization', () => {
    beforeEach(() => {
      query = `
        mutation updateSectionCustomization($input: UpdateSectionCustomizationInput!) {
          updateSectionCustomization(input: $input) {
            id
            templateCustomizationId
            sectionId
            guidance
            errors {
              templateCustomizationId
              sectionId
              guidance
              general
            }
          }
        }
      `;
    });

    it('should update section customization successfully', async () => {
      const input = {
        sectionCustomizationId: 1,
        guidance: 'Updated guidance'
      };
      const mockCustomization = {
        id: 1,
        templateCustomizationId: 10,
        sectionId: 5,
        guidance: 'Old guidance',
        hasErrors: jest.fn().mockReturnValue(false),
        update: jest.fn()
      };
      const mockParent = { id: 10, isDirty: false };
      const mockUpdated = { ...mockCustomization, guidance: 'Updated guidance' };

      (SectionCustomization.findById as jest.Mock).mockResolvedValue(mockCustomization);
      (getValidatedCustomization as jest.Mock).mockResolvedValue(mockParent);
      mockCustomization.update.mockResolvedValue(mockUpdated);

      const result = await executeQuery(query, { input }, adminToken);

      expect(result.body.singleResult.data.updateSectionCustomization.guidance).toBe('Updated guidance');
      expect(markTemplateCustomizationAsDirty).toHaveBeenCalled();
    });

    it('should throw NotFoundError when section customization is not found', async () => {
      const input = {
        sectionCustomizationId: 999,
        guidance: 'New guidance'
      };

      (SectionCustomization.findById as jest.Mock).mockResolvedValue(null);

      const result = await executeQuery(query, { input }, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });

    it('should not mark parent as dirty when parent is already dirty', async () => {
      const input = {
        sectionCustomizationId: 1,
        guidance: 'Updated guidance'
      };
      const mockCustomization = {
        id: 1,
        templateCustomizationId: 10,
        hasErrors: jest.fn().mockReturnValue(false),
        update: jest.fn()
      };
      const mockParent = { id: 10, isDirty: true };
      const mockUpdated = { ...mockCustomization };

      (SectionCustomization.findById as jest.Mock).mockResolvedValue(mockCustomization);
      (getValidatedCustomization as jest.Mock).mockResolvedValue(mockParent);
      mockCustomization.update.mockResolvedValue(mockUpdated);

      await executeQuery(query, { input }, adminToken);

      expect(markTemplateCustomizationAsDirty).not.toHaveBeenCalled();
    });
  });

  describe('Mutation.removeSectionCustomization', () => {
    beforeEach(() => {
      query = `
        mutation removeSectionCustomization($sectionCustomizationId: Int!) {
          removeSectionCustomization(sectionCustomizationId: $sectionCustomizationId) {
            id
            templateCustomizationId
            errors {
              templateCustomizationId
              sectionId
              guidance
              general
            }
          }
        }
      `;
    });

    it('should delete section customization successfully', async () => {
      const mockCustomization = {
        id: 1,
        templateCustomizationId: 10,
        hasErrors: jest.fn().mockReturnValue(false),
        delete: jest.fn()
      };
      const mockParent = { id: 10, isDirty: false };
      const mockDeleted = { ...mockCustomization };

      (SectionCustomization.findById as jest.Mock).mockResolvedValue(mockCustomization);
      (getValidatedCustomization as jest.Mock).mockResolvedValue(mockParent);
      mockCustomization.delete.mockResolvedValue(mockDeleted);

      const args = { sectionCustomizationId: 1 };
      const result = await executeQuery(query, args, adminToken);

      expect(result.body.singleResult.data.removeSectionCustomization.id).toEqual(1);
      expect(mockCustomization.delete).toHaveBeenCalled();
      expect(markTemplateCustomizationAsDirty).toHaveBeenCalled();
    });

    it('should throw NotFoundError when section customization is not found', async () => {
      (SectionCustomization.findById as jest.Mock).mockResolvedValue(null);

      const args = { sectionCustomizationId: 999 };
      const result = await executeQuery(query, args, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });
  });

  describe('Mutation.addCustomSection', () => {
    beforeEach(() => {
      query = `
        mutation addCustomSection($input: AddCustomSectionInput!) {
          addCustomSection(input: $input) {
            id
            templateCustomizationId
            pinnedSectionType
            pinnedSectionId
            name
            errors {
              templateCustomizationId
              pinnedSectionType
              pinnedSectionId
              name
              general
            }
          }
        }
      `;
    });

    it('should create a new custom section successfully', async () => {
      const input = {
        templateCustomizationId: 10,
        pinnedSectionType: 'BASE',
        pinnedSectionId: 5
      };
      const mockParent = { id: 10, isDirty: false };
      const mockCreated = {
        id: 1,
        ...input,
        name: 'Test Affiliation',
        hasErrors: jest.fn().mockReturnValue(false)
      } as undefined as CustomSection;
      const mockAffiliation = { id: 5, name: 'Test Affiliation' } as undefined as Affiliation;

      (getValidatedCustomization as jest.Mock).mockResolvedValue(mockParent);
      jest.spyOn(Affiliation, 'findByURI').mockResolvedValue(mockAffiliation);

      jest.spyOn(CustomSection.prototype, 'create').mockResolvedValue(mockCreated);

      const result = await executeQuery(query, { input }, adminToken);

      expect(result.body.singleResult.data.addCustomSection.id).toEqual(1);
      expect(result.body.singleResult.data.addCustomSection.templateCustomizationId).toEqual(10);
      expect(result.body.singleResult.data.addCustomSection.pinnedSectionType).toEqual('BASE');
      expect(result.body.singleResult.data.addCustomSection.pinnedSectionId).toEqual(5);
      expect(result.body.singleResult.data.addCustomSection.name).toEqual('Test Affiliation');
      expect(markTemplateCustomizationAsDirty).toHaveBeenCalled();
    });

    it('should not mark parent as dirty when creation has errors', async () => {
      const input = {
        templateCustomizationId: 10,
        pinnedSectionType: 'BASE',
        pinnedSectionId: 5
      };
      const mockParent = { id: 10, isDirty: false };
      const mockCreated = {
        id: 1,
        hasErrors: jest.fn().mockReturnValue(true)
      } as undefined as CustomSection;

      (getValidatedCustomization as jest.Mock).mockResolvedValue(mockParent);

      jest.spyOn(CustomSection.prototype, 'create').mockResolvedValue(mockCreated);

      await executeQuery(query, { input }, adminToken);

      expect(markTemplateCustomizationAsDirty).not.toHaveBeenCalled();
    });
  });

  describe('Mutation.updateCustomSection', () => {
    beforeEach(() => {
      query = `
        mutation updateCustomSection($input: UpdateCustomSectionInput!) {
          updateCustomSection(input: $input) {
            id
            templateCustomizationId
            pinnedSectionType
            pinnedSectionId
            name
            introduction
            requirements
            guidance
            errors {
              templateCustomizationId
              pinnedSectionType
              pinnedSectionId
              name
              general
            }
          }
        }
      `;
    });

    it('should update custom section successfully', async () => {
      const input = {
        customSectionId: 1,
        name: 'Updated Name',
        introduction: 'Updated intro',
        requirements: 'Updated requirements',
        guidance: 'Updated guidance'
      };
      const mockCustomization = {
        id: 1,
        templateCustomizationId: 10,
        name: 'Old Name',
        hasErrors: jest.fn().mockReturnValue(false),
        update: jest.fn()
      };
      const mockParent = { id: 10, isDirty: false };
      const mockUpdated = { ...mockCustomization, ...input };

      (CustomSection.findById as jest.Mock).mockResolvedValue(mockCustomization);
      (getValidatedCustomization as jest.Mock).mockResolvedValue(mockParent);
      mockCustomization.update.mockResolvedValue(mockUpdated);

      const result = await executeQuery(query, { input }, adminToken);

      expect(result.body.singleResult.data.updateCustomSection.name).toEqual('Updated Name');
      expect(markTemplateCustomizationAsDirty).toHaveBeenCalled();
    });

    it('should throw NotFoundError when custom section is not found', async () => {
      const input = {
        customSectionId: 999,
        name: 'Name',
        introduction: 'Intro',
        requirements: 'Reqs',
        guidance: 'Guide'
      };

      (CustomSection.findById as jest.Mock).mockResolvedValue(null);

      const result = await executeQuery(query, { input }, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });
  });

  describe('Mutation.removeCustomSection', () => {
    beforeEach(() => {
      query = `
        mutation removeCustomSection($customSectionId: Int!) {
          removeCustomSection(customSectionId: $customSectionId) {
            id
            templateCustomizationId
            pinnedSectionType
            pinnedSectionId
            name
            errors {
              templateCustomizationId
              pinnedSectionType
              pinnedSectionId
              name
              general
            }
          }
        }
      `;
    });

    it('should delete custom section successfully', async () => {
      const mockCustomization = {
        id: 1,
        templateCustomizationId: 10,
        hasErrors: jest.fn().mockReturnValue(false),
        delete: jest.fn()
      };
      const mockParent = { id: 10, isDirty: false };
      const mockDeleted = { ...mockCustomization };

      (CustomSection.findById as jest.Mock).mockResolvedValue(mockCustomization);
      (getValidatedCustomization as jest.Mock).mockResolvedValue(mockParent);
      mockCustomization.delete.mockResolvedValue(mockDeleted);

      const input = { customSectionId: 1 };
      const result = await executeQuery(query, input, adminToken);

      expect(result.body.singleResult.data.removeCustomSection.id).toEqual(1);
      expect(mockCustomization.delete).toHaveBeenCalled();
      expect(markTemplateCustomizationAsDirty).toHaveBeenCalled();
    });

    it('should throw NotFoundError when custom section is not found', async () => {
      (CustomSection.findById as jest.Mock).mockResolvedValue(null);

      const input = { customSectionId: 999 };
      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });
  });

  describe('Mutation.moveCustomSection', () => {
    beforeEach(() => {
      query = `
        mutation moveCustomSection($input: MoveCustomSectionInput!) {
          moveCustomSection(input: $input) {
            id
            templateCustomizationId
            pinnedSectionType
            pinnedSectionId
            name
            errors {
              templateCustomizationId
              pinnedSectionType
              pinnedSectionId
              name
              general
            }
          }
        }
      `;
    });

    it('should move custom section successfully', async () => {
      const input = {
        customSectionId: 1,
        newSectionType: 'BASE',
        newSectionId: 10
      };
      const mockCustomization = {
        id: 1,
        templateCustomizationId: 10,
        pinnedSectionType: null,
        pinnedSectionId: null,
        hasErrors: jest.fn().mockReturnValue(false),
        update: jest.fn()
      };
      const mockParent = { id: 10, isDirty: false };
      const mockMoved = {
        ...mockCustomization,
        pinnedSectionType: PinnedSectionTypeEnum.BASE,
        pinnedSectionId: 10
      };

      (CustomSection.findById as jest.Mock).mockResolvedValue(mockCustomization);
      (getValidatedCustomization as jest.Mock).mockResolvedValue(mockParent);
      mockCustomization.update.mockResolvedValue(mockMoved);

      const result = await executeQuery(query, { input }, adminToken);

      expect(result.body.singleResult.data.moveCustomSection.id).toEqual(1);
      expect(markTemplateCustomizationAsDirty).toHaveBeenCalled();
    });

    it('should throw NotFoundError when custom section is not found', async () => {
      const input = {
        customSectionId: 999,
        newSectionType: 'BASE',
        newSectionId: 10
      };

      (CustomSection.findById as jest.Mock).mockResolvedValue(null);

      const result = await executeQuery(query, { input }, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });

    it('should handle null newSectionType and newSectionId', async () => {
      const input = {
        customSectionId: 1,
        newSectionType: null,
        newSectionId: null
      };
      const mockCustomization = {
        id: 1,
        templateCustomizationId: 10,
        hasErrors: jest.fn().mockReturnValue(false),
        update: jest.fn()
      } as undefined as CustomSection;
      const mockParent = { id: 10, isDirty: false };
      const mockMoved = {
        ...mockCustomization,
        pinnedSectionType: null,
        pinnedSectionId: null
      } as undefined as CustomSection;

      (CustomSection.findById as jest.Mock).mockResolvedValue(mockCustomization);
      (getValidatedCustomization as jest.Mock).mockResolvedValue(mockParent);
      jest.spyOn(mockCustomization, 'update').mockResolvedValue(mockMoved);

      await executeQuery(query, { input }, adminToken);

      expect(mockCustomization.pinnedSectionType).toBeNull();
      expect(mockCustomization.pinnedSectionId).toBeNull();
    });
  });
});

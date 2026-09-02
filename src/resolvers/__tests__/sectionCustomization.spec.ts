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

const mockGetValidatedCustomization = jest.fn<(...args: any[]) => Promise<any>>();
const mockMarkTemplateCustomizationAsDirty = jest.fn<(...args: any[]) => Promise<any>>();

const actualTemplateCustomizationService = await import('../../services/templateCustomizationService.js');
jest.unstable_mockModule('../../services/templateCustomizationService.js', () => ({
  ...actualTemplateCustomizationService,
  getValidatedCustomization: mockGetValidatedCustomization,
  markTemplateCustomizationAsDirty: mockMarkTemplateCustomizationAsDirty,
}));

type SectionCustomizationInstance = InstanceType<typeof SectionCustomization>;
function asSectionCustomization(value: any): SectionCustomizationInstance {
  return value as SectionCustomizationInstance;
}

type CustomSectionInstance = InstanceType<typeof CustomSection>;
function asCustomSection(value: any): CustomSectionInstance {
  return value as CustomSectionInstance;
}

type VersionedSectionInstance = InstanceType<typeof VersionedSection>;
function asVersionedSection(value: any): VersionedSectionInstance {
  return value as VersionedSectionInstance;
}

type AffiliationInstance = InstanceType<typeof Affiliation>;
function asAffiliation(value: any): AffiliationInstance {
  return value as AffiliationInstance;
}
import type { MyContext } from "../../context.js";

// Dynamic imports AFTER mocks are set up
const { typeDefs } = await import("../../schema.js");
const { resolvers } = await import("../../resolver.js");
const { logger } = await import("../../logger.js");
const { buildContext, mockToken } = await import("../../__mocks__/context.js");
const { User, UserRole } = await import("../../models/User.js");
const { SectionCustomization } = await import('../../models/SectionCustomization.js');
const { CustomSection } = await import('../../models/CustomSection.js');
const { VersionedSection } = await import('../../models/VersionedSection.js');
const { PinnedSectionTypeEnum } = await import('../../models/CustomSection.js');
const {
  markTemplateCustomizationAsDirty
} = await import('../../services/templateCustomizationService.js');
const { Affiliation } = await import("../../models/Affiliation.js");

let testServer: ApolloServer;
let affiliationId: string;
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
  adminToken = await mockToken();
  adminToken.affiliationId = affiliationId;
  adminToken.role = UserRole.ADMIN;
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('sectionCustomization resolver', () => {
  let user: InstanceType<typeof User>;

  beforeEach(async () => {
    user = new User({
      id: casual.integer(1, 999),
      givenName: casual.first_name,
      surName: casual.last_name,
      role: UserRole.RESEARCHER,
      affiliationId: casual.url,
    });

    (user.getEmail as jest.Mock) = jest.fn<() => Promise<string>>().mockResolvedValue(casual.email);
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

      jest.spyOn(SectionCustomization, 'findById').mockResolvedValue(mockCustomization as InstanceType<typeof SectionCustomization>);
      mockGetValidatedCustomization.mockResolvedValue(mockParent);

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
      jest.spyOn(SectionCustomization, 'findById').mockResolvedValue(null);

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

      jest.spyOn(SectionCustomization, 'findById').mockResolvedValue(mockCustomization as InstanceType<typeof SectionCustomization>);
      mockGetValidatedCustomization.mockResolvedValue(null);

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

      jest.spyOn(SectionCustomization, 'findByCustomizationAndVersionedSection').mockResolvedValue(mockCustomization as InstanceType<typeof SectionCustomization>);
      mockGetValidatedCustomization.mockResolvedValue(mockParent);

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
      jest.spyOn(SectionCustomization, 'findByCustomizationAndVersionedSection').mockResolvedValue(null);

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

      jest.spyOn(SectionCustomization, 'findByCustomizationAndVersionedSection').mockResolvedValue(mockCustomization as InstanceType<typeof SectionCustomization>);
      mockGetValidatedCustomization.mockResolvedValue(null);

      const vars = { templateCustomizationId: 10, versionedSectionId: 5 };
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
      const mockParent = { id: 10, isDirty: false };

      jest.spyOn(CustomSection, 'findById').mockResolvedValue(mockCustomSection as InstanceType<typeof CustomSection>);
      mockGetValidatedCustomization.mockResolvedValue(mockParent);

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
      jest.spyOn(CustomSection, 'findById').mockResolvedValue(null);

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

      jest.spyOn(CustomSection, 'findById').mockResolvedValue(mockCustomSection as InstanceType<typeof CustomSection>);
      mockGetValidatedCustomization.mockResolvedValue(null);

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
      const mockCreated = asSectionCustomization({
        id: 1,
        sectionId: 5,
        ...input,
        hasErrors: jest.fn().mockReturnValue(false)
      });

      jest.spyOn(VersionedSection, 'findById').mockResolvedValue(mockSection as InstanceType<typeof VersionedSection>);
      mockGetValidatedCustomization.mockResolvedValue(mockParent);
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

      jest.spyOn(VersionedSection, 'findById').mockResolvedValue(asVersionedSection(null));

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
      const mockSection = { id: 5 };
      const mockParent = { id: 10, isDirty: false };
      const mockCreated = asSectionCustomization({
        id: 1,
        sectionId: 5,
        hasErrors: jest.fn().mockReturnValue(true)
      });
      jest.spyOn(VersionedSection, 'findById').mockResolvedValue(asVersionedSection(mockSection));
      mockGetValidatedCustomization.mockResolvedValue(mockParent);
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
        hasErrors: jest.fn<() => boolean>().mockReturnValue(false),
        update: jest.fn<() => Promise<any>>()
      };
      const mockParent = { id: 10, isDirty: false };
      const mockUpdated = { ...mockCustomization, guidance: 'Updated guidance' };

      jest.spyOn(SectionCustomization, 'findById').mockResolvedValue(asSectionCustomization(mockCustomization));
      mockGetValidatedCustomization.mockResolvedValue(mockParent);
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

      jest.spyOn(SectionCustomization, 'findById').mockResolvedValue(null);

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
        hasErrors: jest.fn<() => boolean>().mockReturnValue(false),
        update: jest.fn<() => Promise<any>>()
      };
      const mockParent = { id: 10, isDirty: true };
      const mockUpdated = { ...mockCustomization };

      jest.spyOn(SectionCustomization, 'findById').mockResolvedValue(asSectionCustomization(mockCustomization));
      mockGetValidatedCustomization.mockResolvedValue(mockParent);
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
        hasErrors: jest.fn<() => boolean>().mockReturnValue(false),
        delete: jest.fn<() => Promise<any>>()
      };
      const mockParent = { id: 10, isDirty: false };
      const mockDeleted = { ...mockCustomization };

      jest.spyOn(SectionCustomization, 'findById').mockResolvedValue(asSectionCustomization(mockCustomization));
      mockGetValidatedCustomization.mockResolvedValue(mockParent);
      mockCustomization.delete.mockResolvedValue(mockDeleted);

      const args = { sectionCustomizationId: 1 };
      const result = await executeQuery(query, args, adminToken);

      expect(result.body.singleResult.data.removeSectionCustomization.id).toEqual(1);
      expect(mockCustomization.delete).toHaveBeenCalled();
      expect(markTemplateCustomizationAsDirty).toHaveBeenCalled();
    });

    it('should throw NotFoundError when section customization is not found', async () => {
      jest.spyOn(SectionCustomization, 'findById').mockResolvedValue(null);

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
            name
            introduction
            requirements
            guidance
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
        name: 'Test Affiliation',
        introduction: 'Test introduction',
        requirements: 'Test requirements',
        guidance: 'Test guidance',
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
      };
      const mockAffiliation = { id: 5, name: 'Test Affiliation' };

      mockGetValidatedCustomization.mockResolvedValue(mockParent);
      jest.spyOn(Affiliation, 'findByURI').mockResolvedValue(asAffiliation(mockAffiliation));
      jest.spyOn(CustomSection.prototype, 'create').mockResolvedValue(asCustomSection(mockCreated));

      const result = await executeQuery(query, { input }, adminToken);

      expect(result.body.singleResult.data.addCustomSection.id).toEqual(1);
      expect(result.body.singleResult.data.addCustomSection.templateCustomizationId).toEqual(10);
      expect(result.body.singleResult.data.addCustomSection.pinnedSectionType).toEqual('BASE');
      expect(result.body.singleResult.data.addCustomSection.pinnedSectionId).toEqual(5);
      expect(result.body.singleResult.data.addCustomSection.name).toEqual('Test Affiliation');
      expect(result.body.singleResult.data.addCustomSection.introduction).toEqual('Test introduction');
      expect(result.body.singleResult.data.addCustomSection.requirements).toEqual('Test requirements');
      expect(result.body.singleResult.data.addCustomSection.guidance).toEqual('Test guidance');
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
      };

      mockGetValidatedCustomization.mockResolvedValue(mockParent);

      jest.spyOn(CustomSection.prototype, 'create').mockResolvedValue(asCustomSection(mockCreated));

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
        hasErrors: jest.fn<() => boolean>().mockReturnValue(false),
        update: jest.fn<() => Promise<any>>()
      };
      const mockParent = { id: 10, isDirty: false };
      const mockUpdated = { ...mockCustomization, ...input };

      jest.spyOn(CustomSection, 'findById').mockResolvedValue(asCustomSection(mockCustomization));
      mockGetValidatedCustomization.mockResolvedValue(asSectionCustomization(mockParent));
      mockCustomization.update.mockResolvedValue(asCustomSection(mockUpdated));

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

      jest.spyOn(CustomSection, 'findById').mockResolvedValue(null);

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
        hasErrors: jest.fn<() => boolean>().mockReturnValue(false),
        delete: jest.fn<() => Promise<any>>()
      };
      const mockParent = { id: 10, isDirty: false };
      const mockDeleted = { ...mockCustomization };

      jest.spyOn(CustomSection, 'findById').mockResolvedValue(asCustomSection(mockCustomization));
      mockGetValidatedCustomization.mockResolvedValue(asSectionCustomization(mockParent));
      mockCustomization.delete.mockResolvedValue(asCustomSection(mockDeleted));

      const input = { customSectionId: 1 };
      const result = await executeQuery(query, input, adminToken);

      expect(result.body.singleResult.data.removeCustomSection.id).toEqual(1);
      expect(mockCustomization.delete).toHaveBeenCalled();
      expect(markTemplateCustomizationAsDirty).toHaveBeenCalled();
    });

    it('should throw NotFoundError when custom section is not found', async () => {
      jest.spyOn(CustomSection, 'findById').mockResolvedValue(asCustomSection(null));

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
        hasErrors: jest.fn<() => boolean>().mockReturnValue(false),
        update: jest.fn<() => Promise<any>>()
      };
      const mockParent = { id: 10, isDirty: false };
      const mockMoved = {
        ...mockCustomization,
        pinnedSectionType: PinnedSectionTypeEnum.BASE,
        pinnedSectionId: 10
      };
      jest.spyOn(CustomSection, 'findById').mockResolvedValue(asCustomSection(mockCustomization));
      mockGetValidatedCustomization.mockResolvedValue(asSectionCustomization(mockParent));
      mockCustomization.update.mockResolvedValue(asCustomSection(mockMoved));

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

      jest.spyOn(CustomSection, 'findById').mockResolvedValue(null);

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
        pinnedSectionType: null,
        pinnedSectionId: null,
        hasErrors: jest.fn<() => boolean>().mockReturnValue(false),
        update: jest.fn<() => Promise<any>>()
      };
      const mockParent = { id: 10, isDirty: false };
      const mockMoved = {
        ...mockCustomization,
        pinnedSectionType: null,
        pinnedSectionId: null
      };

      jest.spyOn(CustomSection, 'findById').mockResolvedValue(asCustomSection(mockCustomization));
      mockGetValidatedCustomization.mockResolvedValue(asSectionCustomization(mockParent));
      jest.spyOn(mockCustomization, 'update').mockResolvedValue(asCustomSection(mockMoved));

      await executeQuery(query, { input }, adminToken);

      expect(mockCustomization.pinnedSectionType).toBeNull();
      expect(mockCustomization.pinnedSectionId).toBeNull();
    });
  });
});

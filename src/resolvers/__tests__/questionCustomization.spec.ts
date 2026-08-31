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

// Register mocks FIRST, before any dynamic imports
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


import type { MyContext } from "../../context.js";
type QuestionCustomizationInstance = InstanceType<typeof QuestionCustomization>;
function asQuestionCustomization(value: any): QuestionCustomizationInstance {
  return value as QuestionCustomizationInstance;
}

type CustomQuestionInstance = InstanceType<typeof CustomQuestion>;
function asCustomQuestion(value: any): CustomQuestionInstance {
  return value as CustomQuestionInstance;
}

type VersionedQuestionInstance = InstanceType<typeof VersionedQuestion>;
function asVersionedQuestion(value: any): VersionedQuestionInstance {
  return value as VersionedQuestionInstance;
}

// Dynamic import AFTER mocking the configs and logger
const { typeDefs } = await import("../../schema.js");
const { resolvers } = await import("../../resolver.js");
const { logger } = await import("../../logger.js");
const {
  buildContext,
  mockToken
} = await import("../../__mocks__/context.js");
const { QuestionCustomization } = await import('../../models/QuestionCustomization.js');
const { CustomQuestion, PinnedQuestionTypeEnum } = await import('../../models/CustomQuestion.js');
const { VersionedQuestion } = await import('../../models/VersionedQuestion.js');
const { PinnedSectionTypeEnum } = await import('../../models/CustomSection.js');
const { User, UserRole } = await import("../../models/User.js");
const {
  markTemplateCustomizationAsDirty
} = await import('../../services/templateCustomizationService.js');

let testServer: ApolloServer;
let affiliationId: string;
let adminToken: MyContext['token'];
let query: string;

// Proxy call to the Apollo server test server
async function executeQuery(
  query: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  variables: any,
  token: MyContext['token'],
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

describe('questionCustomization resolver', () => {
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

  describe('Query.questionCustomization', () => {
    beforeEach(() => {
      query = `
        query questionCustomization($questionCustomizationId: Int!) {
          questionCustomization(questionCustomizationId: $questionCustomizationId) {
            id
            templateCustomizationId
            questionId
            migrationStatus
            guidanceText
            sampleText
            errors {
              general
            }
            versionedQuestion {
              id
              questionText
            }
          }
        }
      `;
    });

    it('should return the section customization when found and user has permission', async () => {
      const mockCustomization = {
        id: 1,
        templateCustomizationId: 10,
        questionId: 5,
        migrationStatus: 'OK',
        guidanceText: 'Test guidance text',
        sampleText: 'Test sample text'
      };
      const mockParent = { id: 10, isDirty: false };

      jest.spyOn(QuestionCustomization, 'findById').mockResolvedValue(mockCustomization as InstanceType<typeof QuestionCustomization>);
      mockGetValidatedCustomization.mockResolvedValue(mockParent);
      const vars = { questionCustomizationId: 1 };
      const result = await executeQuery(query, vars, adminToken);

      expect(result.body.singleResult.data.questionCustomization.id).toEqual(1);
      expect(result.body.singleResult.data.questionCustomization.templateCustomizationId).toEqual(10);
      expect(result.body.singleResult.data.questionCustomization.questionId).toEqual(5);
      expect(result.body.singleResult.data.questionCustomization.migrationStatus).toEqual('OK');
      expect(result.body.singleResult.data.questionCustomization.guidanceText).toEqual('Test guidance text');
      expect(result.body.singleResult.data.questionCustomization.sampleText).toEqual('Test sample text');
      expect(QuestionCustomization.findById).toHaveBeenCalledWith(
        'questionCustomization resolver',
        expect.any(Object),
        1
      );
    });

    it('should return NotFound error when section customization is not found', async () => {
      jest.spyOn(QuestionCustomization, 'findById').mockResolvedValue(null);

      const vars = { questionCustomizationId: 999 };
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

      jest.spyOn(QuestionCustomization, 'findById').mockResolvedValue(asQuestionCustomization(mockCustomization)); mockGetValidatedCustomization.mockResolvedValue(null);

      const vars = { questionCustomizationId: 1 };
      const result = await executeQuery(query, vars, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });
  });

  describe('Query.questionCustomizationByVersionedQuestion', () => {
    beforeEach(() => {
      query = `
        query questionCustomizationByVersionedQuestion($templateCustomizationId: Int!, $versionedQuestionId: Int!) {
          questionCustomizationByVersionedQuestion(templateCustomizationId: $templateCustomizationId, versionedQuestionId: $versionedQuestionId) {
            id
            templateCustomizationId
            questionId
            migrationStatus
            guidanceText
            sampleText
            errors {
              general
            }
            versionedQuestion {
              id
              questionText
            }
          }
        }
      `;
    });

    it('should return the section customization when found and user has permission', async () => {
      const mockCustomization = {
        id: 1,
        templateCustomizationId: 10,
        questionId: 5,
        migrationStatus: 'OK',
        guidanceText: 'Test guidance text',
        sampleText: 'Test sample text'
      };
      const mockParent = { id: 10, isDirty: false };

      jest.spyOn(QuestionCustomization, 'findByCustomizationAndVersionedQuestion').mockResolvedValue(asQuestionCustomization(mockCustomization));
      mockGetValidatedCustomization.mockResolvedValue(mockParent);

      const vars = { templateCustomizationId: 1, versionedQuestionId: 5 };
      const result = await executeQuery(query, vars, adminToken);

      expect(result.body.singleResult.data.questionCustomizationByVersionedQuestion.id).toEqual(1);
      expect(result.body.singleResult.data.questionCustomizationByVersionedQuestion.templateCustomizationId).toEqual(10);
      expect(result.body.singleResult.data.questionCustomizationByVersionedQuestion.questionId).toEqual(5);
      expect(result.body.singleResult.data.questionCustomizationByVersionedQuestion.migrationStatus).toEqual('OK');
      expect(result.body.singleResult.data.questionCustomizationByVersionedQuestion.guidanceText).toEqual('Test guidance text');
      expect(result.body.singleResult.data.questionCustomizationByVersionedQuestion.sampleText).toEqual('Test sample text');
      expect(QuestionCustomization.findByCustomizationAndVersionedQuestion).toHaveBeenCalledWith(
        'questionCustomizationByVersionedQuestion resolver',
        expect.any(Object),
        1,
        5
      );
    });

    it('should return NotFound error when section customization is not found', async () => {
      jest.spyOn(QuestionCustomization, 'findByCustomizationAndVersionedQuestion').mockResolvedValue(null);

      const vars = { templateCustomizationId: 1, versionedQuestionId: 999 };
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

      jest.spyOn(QuestionCustomization, 'findByCustomizationAndVersionedQuestion').mockResolvedValue(asQuestionCustomization(mockCustomization));
      mockGetValidatedCustomization.mockResolvedValue(null);

      const vars = { templateCustomizationId: 1, versionedQuestionId: 5 };
      const result = await executeQuery(query, vars, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });
  });

  describe('Query.customQuestion', () => {
    beforeEach(() => {
      query = `
        query customQuestion($customQuestionId: Int!) {
          customQuestion(customQuestionId: $customQuestionId) {
            id
            templateCustomizationId
            sectionType
            sectionId
            pinnedQuestionType
            pinnedQuestionId
            migrationStatus
            questionText
            json
            requirementText
            guidanceText
            sampleText
            useSampleTextAsDefault
            required
            errors {
              general
            }
          }
        }
      `;
    });

    it('should return the custom section when found and user has permission', async () => {
      const mockCustomQuestion = {
        id: 1,
        templateCustomizationId: 10,
        questionText: 'Custom Question',
        sectionType: 'BASE',
        sectionId: 5,
        migrationStatus: 'OK'
      };
      const mockParent = { id: 10, isDirty: false };

      jest.spyOn(CustomQuestion, 'findById').mockResolvedValue(asCustomQuestion(mockCustomQuestion));
      mockGetValidatedCustomization.mockResolvedValue(mockParent);

      const vars = { customQuestionId: 1 };
      const result = await executeQuery(query, vars, adminToken);

      expect(result.body.singleResult.data.customQuestion.id).toEqual(1);
      expect(result.body.singleResult.data.customQuestion.templateCustomizationId).toEqual(10);
      expect(result.body.singleResult.data.customQuestion.questionText).toEqual('Custom Question');
      expect(CustomQuestion.findById).toHaveBeenCalledWith(
        'customQuestion resolver',
        expect.any(Object),
        1
      );
    });

    it('should return NotFound when custom section is not found', async () => {
      jest.spyOn(CustomQuestion, 'findById').mockResolvedValue(null);

      const vars = { customQuestionId: 999 };
      const result = await executeQuery(query, vars, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });

    it('should throw error when parent template customization is not found', async () => {
      const mockCustomQuestion = {
        id: 1,
        templateCustomizationId: 10
      };

      jest.spyOn(CustomQuestion, 'findById').mockResolvedValue(asCustomQuestion(mockCustomQuestion));
      mockGetValidatedCustomization.mockResolvedValue(null);

      const vars = { customQuestionId: 1 };
      const result = await executeQuery(query, vars, adminToken)

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });
  });

  describe('Mutation.addQuestionCustomization', () => {
    beforeEach(() => {
      query = `
        mutation addQuestionCustomization($input: AddQuestionCustomizationInput!) {
          addQuestionCustomization(input: $input) {
            id
            templateCustomizationId
            questionId
            errors {
              templateCustomizationId
              questionId
              guidanceText
              sampleText
              general
            }
          }
        }
      `;
    });

    it('should create a new section customization successfully', async () => {
      const input = {
        templateCustomizationId: 10,
        versionedQuestionId: 5,
      };
      const mockSection = { id: 5, name: 'Section' };
      const mockParent = { id: 10, isDirty: false };
      const mockCreated = asQuestionCustomization({
        id: 1,
        questionId: 5,
        ...input,
        hasErrors: jest.fn<() => boolean>().mockReturnValue(false)
      });

      jest.spyOn(VersionedQuestion, 'findById').mockResolvedValue(asVersionedQuestion(mockSection));
      mockGetValidatedCustomization.mockResolvedValue(mockParent);
      jest.spyOn(QuestionCustomization.prototype, 'create').mockResolvedValue(mockCreated);

      const result = await executeQuery(query, { input }, adminToken);

      expect(result.body.singleResult.data.addQuestionCustomization.id).toEqual(1);
      expect(result.body.singleResult.data.addQuestionCustomization.templateCustomizationId).toEqual(10);
      expect(result.body.singleResult.data.addQuestionCustomization.questionId).toEqual(5);
      expect(markTemplateCustomizationAsDirty).toHaveBeenCalledWith(
        'addQuestionCustomization resolver',
        expect.any(Object),
        10,
        mockCreated
      );
    });

    it('should throw NotFoundError when versioned section is not found', async () => {
      const input = {
        templateCustomizationId: 10,
        versionedQuestionId: 999
      };

      jest.spyOn(VersionedQuestion, 'findById').mockResolvedValue(null);

      const result = await executeQuery(query, { input }, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });

    it('should not mark parent as dirty when creation has errors', async () => {
      const input = {
        templateCustomizationId: 10,
        versionedQuestionId: 5
      };
      const mockSection = { id: 5 };
      const mockParent = { id: 10, isDirty: false };
      const mockCreated = asQuestionCustomization({
        id: 1,
        questionId: 5,
        hasErrors: jest.fn<() => boolean>().mockReturnValue(true)
      });

      jest.spyOn(VersionedQuestion, 'findById').mockResolvedValue(asVersionedQuestion(mockSection));
      mockGetValidatedCustomization.mockResolvedValue(mockParent);
      jest.spyOn(QuestionCustomization.prototype, 'create').mockResolvedValue(mockCreated);

      await executeQuery(query, { input }, adminToken);

      expect(markTemplateCustomizationAsDirty).not.toHaveBeenCalled();
    });
  });

  describe('Mutation.updateQuestionCustomization', () => {
    beforeEach(() => {
      query = `
        mutation updateQuestionCustomization($input: UpdateQuestionCustomizationInput!) {
          updateQuestionCustomization(input: $input) {
            id
            templateCustomizationId
            guidanceText
            errors {
              templateCustomizationId
              questionId
              guidanceText
              general
            }
          }
        }
      `;
    });

    it('should update section customization successfully', async () => {
      const input = {
        questionCustomizationId: 1,
        guidanceText: 'Updated guidanceText'
      };
      const mockCustomization = {
        id: 1,
        templateCustomizationId: 10,
        versionedQuestionId: 5,
        guidanceText: 'Old guidanceText',
        hasErrors: jest.fn<() => boolean>().mockReturnValue(false),
        update: jest.fn<() => Promise<any>>()
      };
      const mockParent = { id: 10, isDirty: false };
      const mockUpdated = { ...mockCustomization, guidanceText: 'Updated guidanceText' };

      jest.spyOn(QuestionCustomization, 'findById').mockResolvedValue(asQuestionCustomization(mockCustomization));
      mockGetValidatedCustomization.mockResolvedValue(mockParent);
      mockCustomization.update.mockResolvedValue(mockUpdated);

      const result = await executeQuery(query, { input }, adminToken);

      expect(result.body.singleResult.data.updateQuestionCustomization.guidanceText).toBe('Updated guidanceText');
      expect(markTemplateCustomizationAsDirty).toHaveBeenCalled();
    });

    it('should throw NotFoundError when section customization is not found', async () => {
      const input = {
        questionCustomizationId: 999,
        guidanceText: 'New guidanceText'
      };

      jest.spyOn(QuestionCustomization, 'findById').mockResolvedValue(null);

      const result = await executeQuery(query, { input }, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });

    it('should not mark parent as dirty when parent is already dirty', async () => {
      const input = {
        questionCustomizationId: 1,
        guidanceText: 'Updated guidanceText'
      };
      const mockCustomization = {
        id: 1,
        templateCustomizationId: 10,
        hasErrors: jest.fn().mockReturnValue(false),
        update: jest.fn<() => Promise<any>>()
      };
      const mockParent = { id: 10, isDirty: true };
      const mockUpdated = { ...mockCustomization };

      jest.spyOn(QuestionCustomization, 'findById').mockResolvedValue(asQuestionCustomization(mockCustomization));
      mockGetValidatedCustomization.mockResolvedValue(mockParent);
      mockCustomization.update.mockResolvedValue(mockUpdated);

      await executeQuery(query, { input }, adminToken);

      expect(markTemplateCustomizationAsDirty).not.toHaveBeenCalled();
    });
  });

  describe('Mutation.removeQuestionCustomization', () => {
    beforeEach(() => {
      query = `
        mutation removeQuestionCustomization($questionCustomizationId: Int!) {
          removeQuestionCustomization(questionCustomizationId: $questionCustomizationId) {
            id
            templateCustomizationId
            errors {
              templateCustomizationId
              questionId
              guidanceText
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
        delete: jest.fn<() => Promise<any>>()
      };
      const mockParent = { id: 10, isDirty: false };
      const mockDeleted = { ...mockCustomization };

      jest.spyOn(QuestionCustomization, 'findById').mockResolvedValue(asQuestionCustomization(mockCustomization));
      mockGetValidatedCustomization.mockResolvedValue(mockParent);
      mockCustomization.delete.mockResolvedValue(mockDeleted);

      const args = { questionCustomizationId: 1 };
      const result = await executeQuery(query, args, adminToken);

      expect(result.body.singleResult.data.removeQuestionCustomization.id).toEqual(1);
      expect(mockCustomization.delete).toHaveBeenCalled();
      expect(markTemplateCustomizationAsDirty).toHaveBeenCalled();
    });

    it('should throw NotFoundError when section customization is not found', async () => {
      jest.spyOn(QuestionCustomization, 'findById').mockResolvedValue(null);

      const args = { questionCustomizationId: 999 };
      const result = await executeQuery(query, args, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });
  });

  describe('Mutation.addCustomQuestion', () => {
    beforeEach(() => {
      query = `
        mutation addCustomQuestion($input: AddCustomQuestionInput!) {
          addCustomQuestion(input: $input) {
            id
            templateCustomizationId
            sectionType
            sectionId
            pinnedQuestionType
            pinnedQuestionId
            questionText
            json
            errors {
              templateCustomizationId
              sectionId
              questionText
              json
              general
            }
          }
        }
      `;
    });

    it('should create a new custom section successfully', async () => {
      const input = {
        templateCustomizationId: 10,
        sectionType: 'BASE',
        sectionId: 5,
        pinnedQuestionType: 'BASE',
        pinnedQuestionId: 5
      };
      const mockParent = { id: 10, isDirty: false };
      const mockCreated = asCustomQuestion({
        id: 1,
        ...input,
        hasErrors: jest.fn<() => boolean>().mockReturnValue(false)
      });
      mockGetValidatedCustomization.mockResolvedValue(mockParent);

      jest.spyOn(CustomQuestion.prototype, 'create').mockResolvedValue(mockCreated);

      const result = await executeQuery(query, { input }, adminToken);

      expect(result.body.singleResult.data.addCustomQuestion.id).toEqual(1);
      expect(result.body.singleResult.data.addCustomQuestion.templateCustomizationId).toEqual(10);
      expect(result.body.singleResult.data.addCustomQuestion.sectionType).toEqual('BASE');
      expect(result.body.singleResult.data.addCustomQuestion.sectionId).toEqual(5);
      expect(result.body.singleResult.data.addCustomQuestion.pinnedQuestionType).toEqual('BASE');
      expect(result.body.singleResult.data.addCustomQuestion.pinnedQuestionId).toEqual(5);
      expect(markTemplateCustomizationAsDirty).toHaveBeenCalled();
    });

    it('should not mark parent as dirty when creation has errors', async () => {
      const input = {
        templateCustomizationId: 10,
        sectionType: 'BASE',
        sectionId: 5,
        pinnedQuestionType: 'BASE',
        pinnedQuestionId: 5,
        migrationStatus: 'OK'
      };
      const mockParent = { id: 10, isDirty: false };
      const mockCreated = asCustomQuestion({
        id: 1,
        ...input,
        hasErrors: jest.fn<() => boolean>().mockReturnValue(true)
      });

      mockGetValidatedCustomization.mockResolvedValue(mockParent);

      jest.spyOn(CustomQuestion.prototype, 'create').mockResolvedValue(mockCreated);

      await executeQuery(query, { input }, adminToken);

      expect(markTemplateCustomizationAsDirty).not.toHaveBeenCalled();
    });
  });

  describe('Mutation.updateCustomQuestion', () => {
    beforeEach(() => {
      query = `
        mutation updateCustomQuestion($input: UpdateCustomQuestionInput!) {
          updateCustomQuestion(input: $input) {
            id
            templateCustomizationId
            sectionType
            sectionId
            pinnedQuestionType
            pinnedQuestionId
            questionText
            json
            sampleText
            requirementText
            guidanceText
            errors {
              templateCustomizationId
              sectionId
              questionText
              general
            }
          }
        }
      `;
    });

    it('should update custom question successfully', async () => {
      const input = {
        customQuestionId: 1,
        questionText: 'Updated text',
        json: '{"type":"text","meta":{"schemaVersion":"v1.0"}}',
        sampleText: 'Updated sample',
        requirementText: 'Updated requirements',
        guidanceText: 'Updated guidance'
      };
      const mockCustomization = {
        id: 1,
        templateCustomizationId: 10,
        sectionType: 'BASE',
        sectionId: 5,
        pinnedQuestionType: 'BASE',
        pinnedQuestionId: 5,
        migrationStatus: 'OK',
        questionText: 'Old text',
        json: { type: "text", meta: { schemaVersion: "v1.0" } },
        sampleText: 'Old sample',
        requirementText: 'Old requirements',
        guidanceText: 'Old guidance',
        hasErrors: jest.fn().mockReturnValue(false),
        update: jest.fn<() => Promise<any>>()
      };
      const mockParent = { id: 10, isDirty: false };
      const mockUpdated = { ...mockCustomization, ...input };



      jest.spyOn(CustomQuestion, 'findById').mockResolvedValue(asCustomQuestion(mockCustomization));
      mockGetValidatedCustomization.mockResolvedValue(asQuestionCustomization(mockParent));
      mockCustomization.update.mockResolvedValue(mockUpdated);

      const result = await executeQuery(query, { input }, adminToken);

      expect(result.body.singleResult.data.updateCustomQuestion.guidanceText).toEqual('Updated guidance');
      expect(markTemplateCustomizationAsDirty).toHaveBeenCalled();
    });

    it('should throw NotFoundError when custom section is not found', async () => {
      const input = {
        customQuestionId: 999,
        questionText: 'Name',
        json: '{"type":"text","meta":{"schemaVersion":"v1.0"}}',
        sampleText: 'Intro',
        requirementText: 'Reqs',
        guidanceText: 'Guide'
      };

      jest.spyOn(CustomQuestion, 'findById').mockResolvedValue(null);

      const result = await executeQuery(query, { input }, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });
  });

  describe('Mutation.removeCustomQuestion', () => {
    beforeEach(() => {
      query = `
        mutation removeCustomQuestion($customQuestionId: Int!) {
          removeCustomQuestion(customQuestionId: $customQuestionId) {
            id
            templateCustomizationId
            sectionType
            sectionId
            pinnedQuestionType
            pinnedQuestionId
            errors {
              templateCustomizationId
              sectionId
              questionText
              json
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
        sectionType: 'BASE',
        sectionId: 5,
        pinnedQuestionType: 'BASE',
        pinnedQuestionId: 5,
        hasErrors: jest.fn().mockReturnValue(false),
        delete: jest.fn<() => Promise<any>>()
      };
      const mockParent = { id: 10, isDirty: false };
      const mockDeleted = { ...mockCustomization };

      jest.spyOn(CustomQuestion, 'findById').mockResolvedValue(asCustomQuestion(mockCustomization));
      mockGetValidatedCustomization.mockResolvedValue(asQuestionCustomization(mockParent));
      mockCustomization.delete.mockResolvedValue(mockDeleted);

      const input = { customQuestionId: 1 };
      const result = await executeQuery(query, input, adminToken);

      expect(result.body.singleResult.data.removeCustomQuestion.id).toEqual(1);
      expect(mockCustomization.delete).toHaveBeenCalled();
      expect(markTemplateCustomizationAsDirty).toHaveBeenCalled();
    });

    it('should throw NotFoundError when custom section is not found', async () => {
      jest.spyOn(CustomQuestion, 'findById').mockResolvedValue(null);

      const input = { customQuestionId: 999 };
      const result = await executeQuery(query, input, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });
  });

  describe('Mutation.moveCustomQuestion', () => {
    beforeEach(() => {
      query = `
        mutation moveCustomQuestion($input: MoveCustomQuestionInput!) {
          moveCustomQuestion(input: $input) {
            id
            templateCustomizationId
            sectionType
            sectionId
            pinnedQuestionType
            pinnedQuestionId
            questionText
            errors {
              templateCustomizationId
              sectionType
              sectionId
              pinnedQuestionType
              pinnedQuestionId
              general
            }
          }
        }
      `;
    });

    it('should move custom question successfully when no occupant exists', async () => {
      const input = {
        customQuestionId: 1,
        sectionType: 'BASE',
        sectionId: 2,
        pinnedQuestionType: 'BASE',
        pinnedQuestionId: 10,
        direction: 'DOWN'
      };
      const mockCustomization = {
        id: 1,
        templateCustomizationId: 10,
        sectionType: 'BASE',
        sectionId: 1,
        pinnedQuestionType: null,
        pinnedQuestionId: null,
        hasErrors: jest.fn().mockReturnValue(false),
        update: jest.fn<() => Promise<any>>()
      };
      const mockParent = { id: 10, isDirty: false };
      const mockMoved = {
        ...mockCustomization,
        pinnedQuestionType: PinnedSectionTypeEnum.BASE,
        pinnedQuestionId: 10,
        hasErrors: jest.fn().mockReturnValue(false)
      };

      jest.spyOn(CustomQuestion, 'findById').mockResolvedValue(asCustomQuestion(mockCustomization));
      mockGetValidatedCustomization.mockResolvedValue(asQuestionCustomization(mockParent));
      jest.spyOn(CustomQuestion, 'findByPosition').mockResolvedValue(null);
      mockCustomization.update.mockResolvedValue(mockMoved);

      const result = await executeQuery(query, { input }, adminToken);

      expect(result.body.singleResult.data.moveCustomQuestion.id).toEqual(1);
      expect(CustomQuestion.findByPosition).toHaveBeenCalledTimes(1);
      expect(markTemplateCustomizationAsDirty).toHaveBeenCalled();
    });

    it('should throw NotFoundError when custom question is not found', async () => {
      const input = {
        customQuestionId: 999,
        sectionType: 'BASE',
        sectionId: 2,
        pinnedQuestionType: 'BASE',
        pinnedQuestionId: 10,
        direction: 'DOWN'
      };

      jest.spyOn(CustomQuestion, 'findById').mockResolvedValue(null);

      const result = await executeQuery(query, { input }, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });

    it('should handle null pinnedQuestionType and pinnedQuestionId', async () => {
      const input = {
        customQuestionId: 1,
        sectionType: 'BASE',
        sectionId: 2,
        pinnedQuestionType: null,
        pinnedQuestionId: null,
        direction: 'DOWN'
      };
      const mockCustomization = asCustomQuestion({
        id: 1,
        templateCustomizationId: 10,
        pinnedQuestionType: null,
        pinnedQuestionId: null,
        hasErrors: jest.fn().mockReturnValue(false),
        update: jest.fn<() => Promise<any>>()
      });
      const mockParent = { id: 10, isDirty: false };
      const mockMoved = asCustomQuestion({
        ...mockCustomization,
        sectionType: PinnedSectionTypeEnum.BASE,
        sectionId: 2,
        pinnedQuestionType: null,
        pinnedQuestionId: null,
        hasErrors: jest.fn().mockReturnValue(false)
      });

      jest.spyOn(CustomQuestion, 'findById').mockResolvedValue(mockCustomization);
      mockGetValidatedCustomization.mockResolvedValue(mockParent);
      jest.spyOn(CustomQuestion, 'findByPosition').mockResolvedValue(null);
      jest.spyOn(mockCustomization, 'update').mockResolvedValue(mockMoved);

      await executeQuery(query, { input }, adminToken);

      expect(mockCustomization.pinnedQuestionType).toBeNull();
      expect(mockCustomization.pinnedQuestionId).toBeNull();
    });

    it('should swap positions with occupant when moving DOWN', async () => {
      const input = {
        customQuestionId: 1,
        sectionType: 'BASE',
        sectionId: 2,
        pinnedQuestionType: 'BASE',
        pinnedQuestionId: 5,
        direction: 'DOWN'
      };
      const mockCustomization = {
        id: 1,
        templateCustomizationId: 10,
        sectionType: PinnedSectionTypeEnum.BASE,
        sectionId: 2,
        pinnedQuestionType: null,
        pinnedQuestionId: null,
        hasErrors: jest.fn<() => boolean>().mockReturnValue(false),
        update: jest.fn<() => Promise<any>>()
      };
      const mockOccupant = {
        id: 2,
        templateCustomizationId: 10,
        sectionType: PinnedSectionTypeEnum.BASE,
        sectionId: 2,
        pinnedQuestionType: PinnedQuestionTypeEnum.BASE,
        pinnedQuestionId: 5,
        hasErrors: jest.fn<() => boolean>().mockReturnValue(false),
        update: jest.fn<() => Promise<any>>()
      };
      const mockParent = { id: 10, isDirty: false };
      const mockTempMoved = {
        ...mockCustomization,
        hasErrors: jest.fn<() => boolean>().mockReturnValue(false)
      };
      const mockMoved = {
        ...mockCustomization,
        pinnedQuestionType: PinnedSectionTypeEnum.BASE,
        pinnedQuestionId: 5,
        hasErrors: jest.fn<() => boolean>().mockReturnValue(false)
      };
      const mockSwapped = {
        ...mockOccupant,
        hasErrors: jest.fn<() => boolean>().mockReturnValue(false)
      };

      jest.spyOn(CustomQuestion, 'findById').mockResolvedValue(asCustomQuestion(mockCustomization));
      mockGetValidatedCustomization.mockResolvedValue(asQuestionCustomization(mockParent));
      jest.spyOn(CustomQuestion, 'findByPosition').mockResolvedValue(asCustomQuestion(mockOccupant));
      mockCustomization.update
        .mockResolvedValueOnce(mockTempMoved)
        .mockResolvedValueOnce(mockMoved);
      mockOccupant.update.mockResolvedValue(mockSwapped);

      const result = await executeQuery(query, { input }, adminToken);

      expect(result.body.singleResult.data.moveCustomQuestion.id).toEqual(1);
      expect(mockCustomization.update).toHaveBeenCalledTimes(2);
      expect(mockOccupant.update).toHaveBeenCalledTimes(1);
      expect(mockOccupant.pinnedQuestionType).toEqual(PinnedQuestionTypeEnum.CUSTOM);
      expect(mockOccupant.pinnedQuestionId).toEqual(1);
      expect(markTemplateCustomizationAsDirty).toHaveBeenCalled();
    });

    it('should swap positions with occupant when moving UP', async () => {
      const originalSectionType = PinnedSectionTypeEnum.BASE;
      const originalSectionId = 2;
      const originalPinnedQuestionType = PinnedQuestionTypeEnum.BASE;
      const originalPinnedQuestionId = 5;
      const input = {
        customQuestionId: 1,
        sectionType: 'BASE',
        sectionId: 2,
        pinnedQuestionType: null,
        pinnedQuestionId: null,
        direction: 'UP'
      };
      const mockCustomization = {
        id: 1,
        templateCustomizationId: 10,
        sectionType: originalSectionType,
        sectionId: originalSectionId,
        pinnedQuestionType: originalPinnedQuestionType,
        pinnedQuestionId: originalPinnedQuestionId,
        hasErrors: jest.fn<() => boolean>().mockReturnValue(false),
        update: jest.fn<() => Promise<any>>()
      };
      const mockOccupant = {
        id: 2,
        sectionType: null,
        sectionId: null,
        pinnedQuestionType: null,
        pinnedQuestionId: null,
        hasErrors: jest.fn<() => boolean>().mockReturnValue(false),
        update: jest.fn<() => Promise<any>>()
      };
      const mockParent = { id: 10, isDirty: false };
      const mockTempMoved = {
        ...mockCustomization,
        hasErrors: jest.fn().mockReturnValue(false)
      };
      const mockMoved = {
        ...mockCustomization,
        pinnedQuestionType: null,
        pinnedQuestionId: null,
        hasErrors: jest.fn().mockReturnValue(false)
      };
      const mockSwapped = {
        ...mockOccupant,
        hasErrors: jest.fn().mockReturnValue(false)
      };

      jest.spyOn(CustomQuestion, 'findById').mockResolvedValue(asCustomQuestion(mockCustomization));
      mockGetValidatedCustomization.mockResolvedValue(asQuestionCustomization(mockParent));
      jest.spyOn(CustomQuestion, 'findByPosition').mockResolvedValue(asCustomQuestion(mockOccupant));
      mockCustomization.update
        .mockResolvedValueOnce(mockTempMoved)
        .mockResolvedValueOnce(mockMoved);
      mockOccupant.update.mockResolvedValue(mockSwapped);

      const result = await executeQuery(query, { input }, adminToken);

      expect(result.body.singleResult.data.moveCustomQuestion.id).toEqual(1);
      expect(mockOccupant.sectionType).toEqual(originalSectionType);
      expect(mockOccupant.sectionId).toEqual(originalSectionId);
      expect(mockOccupant.pinnedQuestionType).toEqual(originalPinnedQuestionType);
      expect(mockOccupant.pinnedQuestionId).toEqual(originalPinnedQuestionId);
      expect(markTemplateCustomizationAsDirty).toHaveBeenCalled();
    });

    it('should re-anchor tail question when moving UP with no occupant', async () => {
      const originalSectionType = PinnedSectionTypeEnum.BASE;
      const originalSectionId = 2;
      const originalPinnedQuestionType = PinnedQuestionTypeEnum.CUSTOM;
      const originalPinnedQuestionId = 3;
      const input = {
        customQuestionId: 1,
        sectionType: 'BASE',
        sectionId: 2,
        pinnedQuestionType: null,
        pinnedQuestionId: null,
        direction: 'UP'
      };
      const mockCustomization = {
        id: 1,
        templateCustomizationId: 10,
        sectionType: originalSectionType,
        sectionId: originalSectionId,
        pinnedQuestionType: originalPinnedQuestionType,
        pinnedQuestionId: originalPinnedQuestionId,
        hasErrors: jest.fn<() => boolean>().mockReturnValue(false),
        update: jest.fn<() => Promise<any>>()
      };
      const mockTailQuestion = {
        id: 3,
        sectionType: null,
        sectionId: null,
        pinnedQuestionType: null,
        pinnedQuestionId: null,
        hasErrors: jest.fn<() => boolean>().mockReturnValue(false),
        update: jest.fn<() => Promise<any>>()
      };
      const mockParent = { id: 10, isDirty: false };
      const mockTempMoved = {
        ...mockCustomization,
        hasErrors: jest.fn<() => boolean>().mockReturnValue(false)
      };
      const mockMoved = {
        ...mockCustomization,
        hasErrors: jest.fn<() => boolean>().mockReturnValue(false)
      };
      const mockReanchored = {
        ...mockTailQuestion,
        hasErrors: jest.fn().mockReturnValue(false)
      };

      jest.spyOn(CustomQuestion, 'findById').mockResolvedValue(asCustomQuestion(mockCustomization));
      mockGetValidatedCustomization.mockResolvedValue(asQuestionCustomization(mockParent));
      jest.spyOn(CustomQuestion, 'findByPosition')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(asCustomQuestion(mockTailQuestion));
      mockCustomization.update
        .mockResolvedValueOnce(mockTempMoved)
        .mockResolvedValueOnce(mockMoved);
      mockTailQuestion.update.mockResolvedValue(mockReanchored);

      const result = await executeQuery(query, { input }, adminToken);

      expect(result.body.singleResult.data.moveCustomQuestion.id).toEqual(1);
      expect(CustomQuestion.findByPosition).toHaveBeenCalledTimes(2);
      expect(mockTailQuestion.update).toHaveBeenCalledTimes(1);
      expect(mockTailQuestion.sectionType).toEqual(originalSectionType);
      expect(mockTailQuestion.sectionId).toEqual(originalSectionId);
      expect(mockTailQuestion.pinnedQuestionType).toEqual(originalPinnedQuestionType);
      expect(mockTailQuestion.pinnedQuestionId).toEqual(originalPinnedQuestionId);
      expect(markTemplateCustomizationAsDirty).toHaveBeenCalled();
    });
  });
});

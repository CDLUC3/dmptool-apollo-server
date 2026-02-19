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
import { QuestionCustomization } from '../../models/QuestionCustomization';
import { CustomQuestion } from '../../models/CustomQuestion';
import { VersionedQuestion } from '../../models/VersionedQuestion';
import { PinnedSectionTypeEnum } from '../../models/CustomSection';
import { User, UserRole } from "../../models/User";
import {
  getValidatedCustomization,
  markTemplateCustomizationAsDirty
} from '../../services/templateCustomizationService';
import { buildContext, mockToken } from "../../__mocks__/context";

jest.mock('../../context.ts');
jest.mock('../../datasources/cache');

jest.mock('../../models/QuestionCustomization');
jest.mock('../../models/CustomQuestion');
jest.mock('../../models/TemplateCustomization');
jest.mock('../../models/VersionedQuestion');
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

describe('questionCustomization resolver', () => {
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
      
      (QuestionCustomization.findById as jest.Mock).mockResolvedValue(mockCustomization);
      (getValidatedCustomization as jest.Mock).mockResolvedValue(mockParent);

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
      (QuestionCustomization.findById as jest.Mock).mockResolvedValue(null);

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

      (QuestionCustomization.findById as jest.Mock).mockResolvedValue(mockCustomization);
      (getValidatedCustomization as jest.Mock).mockResolvedValue(null);

      const vars = { questionCustomizationId: 1 };
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
      const mockParent = {id: 10, isDirty: false};

      (CustomQuestion.findById as jest.Mock).mockResolvedValue(mockCustomQuestion);
      (getValidatedCustomization as jest.Mock).mockResolvedValue(mockParent);

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
      (CustomQuestion.findById as jest.Mock).mockResolvedValue(null);

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

      (CustomQuestion.findById as jest.Mock).mockResolvedValue(mockCustomQuestion);
      (getValidatedCustomization as jest.Mock).mockResolvedValue(null);

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
              versionedQuestionId
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
      const mockCreated = {
        id: 1,
        questionId: 5,
        ...input,
        hasErrors: jest.fn().mockReturnValue(false)
      } as undefined as QuestionCustomization;

      (VersionedQuestion.findById as jest.Mock).mockResolvedValue(mockSection);
      (getValidatedCustomization as jest.Mock).mockResolvedValue(mockParent);
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

      (VersionedQuestion.findById as jest.Mock).mockResolvedValue(null);

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
      const mockSection = {id: 5};
      const mockParent = {id: 10, isDirty: false};
      const mockCreated = {
        id: 1,
        questionId: 5,
        hasErrors: jest.fn().mockReturnValue(true)
      } as undefined as QuestionCustomization;

      (VersionedQuestion.findById as jest.Mock).mockResolvedValue(mockSection);
      (getValidatedCustomization as jest.Mock).mockResolvedValue(mockParent);
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
              versionedQuestionId
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
        hasErrors: jest.fn().mockReturnValue(false),
        update: jest.fn()
      };
      const mockParent = { id: 10, isDirty: false };
      const mockUpdated = { ...mockCustomization, guidanceText: 'Updated guidanceText' };

      (QuestionCustomization.findById as jest.Mock).mockResolvedValue(mockCustomization);
      (getValidatedCustomization as jest.Mock).mockResolvedValue(mockParent);
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

      (QuestionCustomization.findById as jest.Mock).mockResolvedValue(null);

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
        update: jest.fn()
      };
      const mockParent = { id: 10, isDirty: true };
      const mockUpdated = { ...mockCustomization };

      (QuestionCustomization.findById as jest.Mock).mockResolvedValue(mockCustomization);
      (getValidatedCustomization as jest.Mock).mockResolvedValue(mockParent);
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
              versionedQuestionId
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
        delete: jest.fn()
      };
      const mockParent = { id: 10, isDirty: false };
      const mockDeleted = { ...mockCustomization };

      (QuestionCustomization.findById as jest.Mock).mockResolvedValue(mockCustomization);
      (getValidatedCustomization as jest.Mock).mockResolvedValue(mockParent);
      mockCustomization.delete.mockResolvedValue(mockDeleted);

      const args = { questionCustomizationId: 1 };
      const result = await executeQuery(query, args, adminToken);

      expect(result.body.singleResult.data.removeQuestionCustomization.id).toEqual(1);
      expect(mockCustomization.delete).toHaveBeenCalled();
      expect(markTemplateCustomizationAsDirty).toHaveBeenCalled();
    });

    it('should throw NotFoundError when section customization is not found', async () => {
      (QuestionCustomization.findById as jest.Mock).mockResolvedValue(null);

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
      const mockCreated = {
        id: 1,
        ...input,
        hasErrors: jest.fn().mockReturnValue(false)
      } as undefined as CustomQuestion;

      (getValidatedCustomization as jest.Mock).mockResolvedValue(mockParent);

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
      const mockCreated = {
        id: 1,
        hasErrors: jest.fn().mockReturnValue(true)
      } as undefined as CustomQuestion;

      (getValidatedCustomization as jest.Mock).mockResolvedValue(mockParent);

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
        update: jest.fn()
      };
      const mockParent = { id: 10, isDirty: false };
      const mockUpdated = { ...mockCustomization, ...input };

      (CustomQuestion.findById as jest.Mock).mockResolvedValue(mockCustomization);
      (getValidatedCustomization as jest.Mock).mockResolvedValue(mockParent);
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

      (CustomQuestion.findById as jest.Mock).mockResolvedValue(null);

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
        delete: jest.fn()
      };
      const mockParent = { id: 10, isDirty: false };
      const mockDeleted = { ...mockCustomization };

      (CustomQuestion.findById as jest.Mock).mockResolvedValue(mockCustomization);
      (getValidatedCustomization as jest.Mock).mockResolvedValue(mockParent);
      mockCustomization.delete.mockResolvedValue(mockDeleted);

      const input = { customQuestionId: 1 };
      const result = await executeQuery(query, input, adminToken);

      expect(result.body.singleResult.data.removeCustomQuestion.id).toEqual(1);
      expect(mockCustomization.delete).toHaveBeenCalled();
      expect(markTemplateCustomizationAsDirty).toHaveBeenCalled();
    });

    it('should throw NotFoundError when custom section is not found', async () => {
      (CustomQuestion.findById as jest.Mock).mockResolvedValue(null);

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

    it('should move custom section successfully', async () => {
      const input = {
        customQuestionId: 1,
        sectionType: 'BASE',
        sectionId: 2,
        pinnedQuestionType: 'BASE',
        pinnedQuestionId: 10
      };
      const mockCustomization = {
        id: 1,
        templateCustomizationId: 10,
        sectionType: 'BASE',
        sectionId: 1,
        pinnedQuestionType: null,
        pinnedQuestionId: null,
        hasErrors: jest.fn().mockReturnValue(false),
        update: jest.fn()
      };
      const mockParent = { id: 10, isDirty: false };
      const mockMoved = {
        ...mockCustomization,
        pinnedQuestionType: PinnedSectionTypeEnum.BASE,
        pinnedQuestionId: 10
      };

      (CustomQuestion.findById as jest.Mock).mockResolvedValue(mockCustomization);
      (getValidatedCustomization as jest.Mock).mockResolvedValue(mockParent);
      mockCustomization.update.mockResolvedValue(mockMoved);

      const result = await executeQuery(query, { input }, adminToken);

      expect(result.body.singleResult.data.moveCustomQuestion.id).toEqual(1);
      expect(markTemplateCustomizationAsDirty).toHaveBeenCalled();
    });

    it('should throw NotFoundError when custom section is not found', async () => {
      const input = {
        customQuestionId: 999,
        sectionType: 'BASE',
        sectionId: 2,
        pinnedQuestionType: 'BASE',
        pinnedQuestionId: 10
      };

      (CustomQuestion.findById as jest.Mock).mockResolvedValue(null);

      const result = await executeQuery(query, { input }, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Not Found');
    });

    it('should handle null QuestionType and QuestionId', async () => {
      const input = {
        customQuestionId: 1,
        sectionType: 'BASE',
        sectionId: 2,
        pinnedQuestionType: null,
        pinnedQuestionId: null
      };
      const mockCustomization = {
        id: 1,
        templateCustomizationId: 10,
        hasErrors: jest.fn().mockReturnValue(false),
        update: jest.fn()
      } as undefined as CustomQuestion;
      const mockParent = { id: 10, isDirty: false };
      const mockMoved = {
        ...mockCustomization,
        sectionType: PinnedSectionTypeEnum.BASE,
        sectionId: 2,
        pinnedSectionType: null,
        pinnedSectionId: null
      } as undefined as CustomQuestion;

      (CustomQuestion.findById as jest.Mock).mockResolvedValue(mockCustomization);
      (getValidatedCustomization as jest.Mock).mockResolvedValue(mockParent);
      jest.spyOn(mockCustomization, 'update').mockResolvedValue(mockMoved);

      await executeQuery(query, { input }, adminToken);

      expect(mockCustomization.pinnedQuestionType).toBeNull();
      expect(mockCustomization.pinnedQuestionId).toBeNull();
    });
  });
});

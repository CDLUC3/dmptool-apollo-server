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

// hasPermissionOnSection is a bare function export, so it needs a full module
// mock (same reasoning as authService) rather than jest.spyOn.
const actualSectionService = await import('../../services/sectionService.js');
const mockHasPermissionOnSection = jest.fn<(...args: any[]) => Promise<boolean>>();
jest.unstable_mockModule('../../services/sectionService.js', () => ({
  ...actualSectionService,
  hasPermissionOnSection: mockHasPermissionOnSection,
}));

// updateDisplayOrders / questionHasSelectableOptions are also bare function
// exports used directly by the resolvers under test.
const mockUpdateDisplayOrders = jest.fn<(...args: any[]) => Promise<any>>();
const mockQuestionHasSelectableOptions = jest.fn<(...args: any[]) => boolean>();
const mockExtractTriggerQuestionOptionValues = jest.fn<(...args: any[]) => Set<string>>(() => new Set(['option1', 'option2']));
const mockHasPermissionOnQuestion = jest.fn<(...args: any[]) => Promise<boolean>>();
const mockCloneQuestion = jest.fn<(...args: any[]) => Promise<any>>();
jest.unstable_mockModule('../../services/questionService.js', () => ({
  updateDisplayOrders: mockUpdateDisplayOrders,
  questionHasSelectableOptions: mockQuestionHasSelectableOptions,
  extractTriggerQuestionOptionValues: mockExtractTriggerQuestionOptionValues,
  hasPermissionOnQuestion: mockHasPermissionOnQuestion,
  cloneQuestion: mockCloneQuestion,
}));

import type { MyContext } from "../../context.js";

// Dynamic import AFTER mocking the configs, logger, and services
const { typeDefs } = await import("../../schema.js");
const { resolvers } = await import("../../resolver.js");
const { logger } = await import("../../logger.js");
const {
  buildContext,
  mockToken
} = await import("../../__mocks__/context.js");
const { Question } = await import('../../models/Question.js');
const { Template } = await import('../../models/Template.js');
const { Tag } = await import('../../models/Tag.js');
const { QuestionConditionGroup } = await import('../../models/QuestionConditionGroup.js');

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

  testServer = new ApolloServer({ typeDefs, resolvers });

  affiliationId = casual.url;
  adminToken = await mockToken();
  adminToken.affiliationId = affiliationId;
  adminToken.role = 'ADMIN';

  // Sensible defaults so most tests don't need to restate permission checks
  mockHasPermissionOnSection.mockResolvedValue(true);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('question resolvers', () => {

  describe('Query.questions', () => {
    beforeEach(() => {
      query = `
        query questions($sectionId: Int!) {
          questions(sectionId: $sectionId) {
            id
            questionText
            displayOrder
            sectionId
            errors { general }
          }
        }
      `;
    });

    it('should return all questions for the section when authorized', async () => {
      const mockQuestions = [
        { id: 1, questionText: 'Q1', displayOrder: 1, sectionId: 5 },
        { id: 2, questionText: 'Q2', displayOrder: 2, sectionId: 5 },
      ];
      jest.spyOn(Question, 'findBySectionId').mockResolvedValue(mockQuestions as any);

      const result = await executeQuery(query, { sectionId: 5 }, adminToken);

      expect(result.body.singleResult.data.questions).toHaveLength(2);
      expect(Question.findBySectionId).toHaveBeenCalledWith(
        'questions resolver',
        expect.any(Object),
        5
      );
    });

    it('should throw AuthenticationError when no token is present', async () => {
      const result = await executeQuery(query, { sectionId: 5 }, null);

      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Unauthorized');
    });

    it('should throw ForbiddenError when token is present but unauthorized', async () => {
      const unauthorizedToken = { ...adminToken, id: null };
      const result = await executeQuery(query, { sectionId: 5 }, unauthorizedToken as any);

      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Forbidden');
    });
  });

  describe('Query.question', () => {
    beforeEach(() => {
      query = `
        query question($questionId: Int!) {
          question(questionId: $questionId) {
            id
            questionText
            displayOrder
            errors { general }
          }
        }
      `;
    });

    it('should return the question when authorized', async () => {
      const mockQuestion = { id: 1, questionText: 'Q1', displayOrder: 1 };
      jest.spyOn(Question, 'findById').mockResolvedValue(mockQuestion as any);

      const result = await executeQuery(query, { questionId: 1 }, adminToken);

      expect(result.body.singleResult.data.question.id).toEqual(1);
      expect(Question.findById).toHaveBeenCalledWith(
        'question resolver',
        expect.any(Object),
        1
      );
    });
  });

  describe('Query.triggerQuestionsForQuestion', () => {
    beforeEach(() => {
      query = `
        query triggerQuestionsForQuestion($questionId: Int!) {
          triggerQuestionsForQuestion(questionId: $questionId) {
            id
            questionText
            displayOrder
            sectionId
            errors { general }
          }
        }
      `;
    });

    it('should return prior questions filtered by selectable-options', async () => {
      const targetQuestion = { id: 10, sectionId: 20, displayOrder: 3 };
      const priorQuestions = [
        { id: 1, questionText: 'Radio Q', displayOrder: 1, sectionId: 20 },
        { id: 2, questionText: 'Text Q', displayOrder: 2, sectionId: 20 },
      ];

      jest.spyOn(Question, 'findById').mockResolvedValue(targetQuestion as any);
      jest.spyOn(Question, 'findPriorQuestionsForQuestion').mockResolvedValue(priorQuestions as any);

      // Only the first (radio) question qualifies as an options question
      mockQuestionHasSelectableOptions.mockImplementation((q: any) => q.id === 1);

      const result = await executeQuery(query, { questionId: 10 }, adminToken);

      expect(Question.findPriorQuestionsForQuestion).toHaveBeenCalledWith(
        'triggerQuestionsForQuestion resolver',
        expect.any(Object),
        10
      );
      expect(result.body.singleResult.data.triggerQuestionsForQuestion).toHaveLength(1);
      expect(result.body.singleResult.data.triggerQuestionsForQuestion[0].id).toEqual(1);
    });

    it('should return NotFoundError when the target question does not exist', async () => {
      jest.spyOn(Question, 'findById').mockResolvedValue(null as any);

      const result = await executeQuery(query, { questionId: 999 }, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Question not found');
    });

    it('should return an empty array when no prior questions have selectable options', async () => {
      const targetQuestion = { id: 10, sectionId: 20, displayOrder: 1 };
      jest.spyOn(Question, 'findById').mockResolvedValue(targetQuestion as any);
      jest.spyOn(Question, 'findPriorQuestionsForQuestion').mockResolvedValue([] as any);
      mockQuestionHasSelectableOptions.mockReturnValue(false);

      const result = await executeQuery(query, { questionId: 10 }, adminToken);

      expect(result.body.singleResult.data.triggerQuestionsForQuestion).toEqual([]);
    });

    it('should throw AuthenticationError when no token is present', async () => {
      const result = await executeQuery(query, { questionId: 10 }, null);

      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Unauthorized');
    });
  });

  describe('Mutation.addQuestion', () => {
    beforeEach(() => {
      query = `
        mutation addQuestion($input: AddQuestionInput!) {
          addQuestion(input: $input) {
            id
            questionText
            displayOrder
            errors { general }
          }
        }
      `;
    });

    it('should create a new question successfully', async () => {
      const input = {
        templateId: 100,
        sectionId: 5,
        displayOrder: 1,
        questionText: 'New question',
      };
      const mockCreated = {
        id: 1,
        ...input,
        hasErrors: jest.fn<() => boolean>().mockReturnValue(false),
      };
      const mockFinal = { id: 1, ...input, hasErrors: jest.fn<() => boolean>().mockReturnValue(false) };

      jest.spyOn(Question.prototype, 'create').mockResolvedValue(mockCreated as any);
      jest.spyOn(Question, 'findById').mockResolvedValue(mockFinal as any);
      jest.spyOn(Template, 'markTemplateAsDirty').mockResolvedValue(undefined as any);

      const result = await executeQuery(query, { input }, adminToken);

      expect(result.body.singleResult.data.addQuestion.id).toEqual(1);
      expect(Template.markTemplateAsDirty).toHaveBeenCalledWith(
        'Question resolver - addQuestion',
        expect.any(Object),
        100
      );
    });

    it('should return the question with errors when creation fails without an id', async () => {
      const input = { templateId: 100, sectionId: 5, displayOrder: 1, questionText: '' };
      const mockCreated = { id: null, errors: {}, hasErrors: jest.fn().mockReturnValue(false) };

      jest.spyOn(Question.prototype, 'create').mockResolvedValue(mockCreated as any);

      const result = await executeQuery(query, { input }, adminToken);

      // Should not attempt to mark the template dirty since creation failed
      expect(Template.markTemplateAsDirty).not.toHaveBeenCalled();
      expect(result.body.singleResult.data.addQuestion.id).toBeNull();
    });

    it('should assign provided tags and surface tag errors without failing the mutation', async () => {
      const input = {
        templateId: 100,
        sectionId: 5,
        displayOrder: 1,
        questionText: 'New question',
        tags: [{ id: 7 }],
      };
      const mockCreated = {
        id: 1,
        hasErrors: jest.fn<() => boolean>().mockReturnValue(false),
      };
      const mockTag = {
        id: 7,
        name: 'Tag 7',
        addToQuestion: jest.fn().mockReturnValue(false), // simulate failure to add
      };
      const mockFinal = {
        id: 1,
        questionText: 'New question',
        displayOrder: 1,
        errors: {},
        addError: jest.fn(),
        hasErrors: jest.fn<() => boolean>().mockReturnValue(false),
      };

      jest.spyOn(Question.prototype, 'create').mockResolvedValue(mockCreated as any);
      jest.spyOn(Tag, 'findById').mockResolvedValue(mockTag as any);
      jest.spyOn(Template, 'markTemplateAsDirty').mockResolvedValue(undefined as any);
      jest.spyOn(Question, 'findById').mockResolvedValue(mockFinal as any);

      await executeQuery(query, { input }, adminToken);

      expect(mockTag.addToQuestion).toHaveBeenCalledWith(expect.any(Object), 1);
    });

    it('should throw ForbiddenError when user lacks permission on the section', async () => {
      mockHasPermissionOnSection.mockResolvedValue(false);
      const input = { templateId: 100, sectionId: 5, displayOrder: 1, questionText: 'Q' };

      const result = await executeQuery(query, { input }, adminToken);

      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Forbidden');
    });
  });

  describe('Mutation.updateQuestion', () => {
    beforeEach(() => {
      query = `
        mutation updateQuestion($input: UpdateQuestionInput!) {
          updateQuestion(input: $input) {
            id
            questionText
            displayOrder
            errors { general }
          }
        }
      `;
    });

    it('should update an existing question successfully', async () => {
      const input = { questionId: 1, questionText: 'Updated text' };
      const existingQuestion = {
        id: 1,
        sectionId: 5,
        templateId: 100,
        createdById: 2,
        displayOrder: 1,
        json: '{}',
        isDirty: false,
      };
      const mockUpdated = { id: 1, hasErrors: jest.fn<() => boolean>().mockReturnValue(false) };
      const mockFinal = { id: 1, questionText: 'Updated text', displayOrder: 1 };

      jest.spyOn(Question, 'findById')
        .mockResolvedValueOnce(existingQuestion as any) // initial lookup
        .mockResolvedValueOnce(mockFinal as any); // refetch after update
      jest.spyOn(Question.prototype, 'update').mockResolvedValue(mockUpdated as any);
      jest.spyOn(Template, 'markTemplateAsDirty').mockResolvedValue(undefined as any);
      jest.spyOn(Tag, 'findByQuestionId').mockResolvedValue([] as any);

      const result = await executeQuery(query, { input }, adminToken);

      expect(result.body.singleResult.data.updateQuestion.questionText).toEqual('Updated text');
      expect(Template.markTemplateAsDirty).toHaveBeenCalledWith(
        'Question resolver - updateQuestion',
        expect.any(Object),
        100
      );
    });

    it('should return NotFoundError when the question does not exist', async () => {
      jest.spyOn(Question, 'findById').mockResolvedValue(null as any);

      const result = await executeQuery(query, { input: { questionId: 999 } }, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Question not found');
    });

    it('should reconcile tag associations, removing and adding as needed', async () => {
      const input = { questionId: 1, questionText: 'Q', tags: [{ id: 2 }] };
      const existingQuestion = { id: 1, sectionId: 5, templateId: 100, createdById: 2, displayOrder: 1, isDirty: false };
      const mockUpdated = { id: 1, hasErrors: jest.fn<() => boolean>().mockReturnValue(false) };
      const currentTags = [{ id: 1, name: 'Old Tag' }];
      const newTag = { id: 2, name: 'New Tag', addToQuestion: jest.fn().mockReturnValue(true) };
      const oldTag = { id: 1, name: 'Old Tag', removeFromQuestion: jest.fn().mockReturnValue(true) };
      const mockFinal = { id: 1, questionText: 'Q', displayOrder: 1 };

      jest.spyOn(Question, 'findById')
        .mockResolvedValueOnce(existingQuestion as any)
        .mockResolvedValueOnce(mockFinal as any);
      jest.spyOn(Question.prototype, 'update').mockResolvedValue(mockUpdated as any);
      jest.spyOn(Template, 'markTemplateAsDirty').mockResolvedValue(undefined as any);
      jest.spyOn(Tag, 'findByQuestionId').mockResolvedValue(currentTags as any);
      jest.spyOn(Tag, 'findById')
        .mockResolvedValueOnce(oldTag as any) // for removal
        .mockResolvedValueOnce(newTag as any); // for addition

      await executeQuery(query, { input }, adminToken);

      expect(oldTag.removeFromQuestion).toHaveBeenCalledWith(expect.any(Object), 1);
      expect(newTag.addToQuestion).toHaveBeenCalledWith(expect.any(Object), 1);
    });
  });

  describe('Mutation.updateQuestionDisplayOrder', () => {
    beforeEach(() => {
      query = `
        mutation updateQuestionDisplayOrder($questionId: Int!, $newDisplayOrder: Int!) {
          updateQuestionDisplayOrder(questionId: $questionId, newDisplayOrder: $newDisplayOrder) {
            questions { id displayOrder }
            errors { general }
          }
        }
      `;
    });

    it('should reorder questions successfully', async () => {
      const existingQuestion = { id: 1, sectionId: 5, templateId: 100, displayOrder: 1 };
      const reordered = [
        { id: 1, displayOrder: 2 },
        { id: 2, displayOrder: 1 },
      ];

      jest.spyOn(Question, 'findById').mockResolvedValue(existingQuestion as any);
      mockUpdateDisplayOrders.mockResolvedValue(reordered);
      jest.spyOn(Template, 'markTemplateAsDirty').mockResolvedValue(undefined as any);

      const result = await executeQuery(
        query,
        { questionId: 1, newDisplayOrder: 2 },
        adminToken
      );

      expect(result.body.singleResult.data.updateQuestionDisplayOrder.questions).toHaveLength(2);
      expect(mockUpdateDisplayOrders).toHaveBeenCalledWith(
        expect.any(Object),
        5,
        1,
        2
      );
    });

    it('should return BadRequestError when newDisplayOrder equals current displayOrder', async () => {
      const existingQuestion = { id: 1, sectionId: 5, templateId: 100, displayOrder: 2 };
      jest.spyOn(Question, 'findById').mockResolvedValue(existingQuestion as any);

      const result = await executeQuery(
        query,
        { questionId: 1, newDisplayOrder: 2 },
        adminToken
      );

      expect(result.body.singleResult.errors).toBeDefined();
    });

    it('should return NotFoundError when question does not exist', async () => {
      jest.spyOn(Question, 'findById').mockResolvedValue(null as any);

      const result = await executeQuery(
        query,
        { questionId: 999, newDisplayOrder: 3 },
        adminToken
      );

      expect(result.body.singleResult.errors).toBeDefined();
    });

    it('should return errors array when reordering throws', async () => {
      const existingQuestion = { id: 1, sectionId: 5, templateId: 100, displayOrder: 1 };
      jest.spyOn(Question, 'findById').mockResolvedValue(existingQuestion as any);
      mockUpdateDisplayOrders.mockRejectedValue(new Error('DB error during reorder'));

      const result = await executeQuery(
        query,
        { questionId: 1, newDisplayOrder: 4 },
        adminToken
      );

      expect(result.body.singleResult.data.updateQuestionDisplayOrder.questions).toEqual([]);
      expect(result.body.singleResult.data.updateQuestionDisplayOrder.errors.general).toEqual('DB error during reorder');
    });

    it('should throw AuthenticationError/ForbiddenError when not admin', async () => {
      const nonAdminToken = { ...adminToken, role: 'RESEARCHER' };
      const result = await executeQuery(
        query,
        { questionId: 1, newDisplayOrder: 2 },
        nonAdminToken as any
      );

      expect(result.body.singleResult.errors).toBeDefined();
    });
  });

  describe('Mutation.removeQuestion', () => {
    beforeEach(() => {
      query = `
        mutation removeQuestion($questionId: Int!) {
          removeQuestion(questionId: $questionId) {
            id
            errors { general }
          }
        }
      `;
    });

    it('should delete the question successfully', async () => {
      const existingQuestion = { id: 1, templateId: 100, sectionId: 5 };
      const mockDeleted = { id: 1 };

      jest.spyOn(Question, 'findById').mockResolvedValue(existingQuestion as any);
      jest.spyOn(Template, 'markTemplateAsDirty').mockResolvedValue(undefined as any);
      jest.spyOn(Question.prototype, 'delete').mockResolvedValue(mockDeleted as any);

      const result = await executeQuery(query, { questionId: 1 }, adminToken);

      expect(result.body.singleResult.data.removeQuestion.id).toEqual(1);
      expect(Template.markTemplateAsDirty).toHaveBeenCalledWith(
        'Question resolver - removeQuestion',
        expect.any(Object),
        100
      );
    });

    it('should return NotFoundError when the question does not exist', async () => {
      jest.spyOn(Question, 'findById').mockResolvedValue(null as any);

      const result = await executeQuery(query, { questionId: 999 }, adminToken);

      expect(result.body.kind).toEqual('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Question not found');
    });

    it('should throw ForbiddenError when user lacks permission on the section', async () => {
      const existingQuestion = { id: 1, templateId: 100, sectionId: 5 };
      jest.spyOn(Question, 'findById').mockResolvedValue(existingQuestion as any);
      mockHasPermissionOnSection.mockResolvedValue(false);

      const result = await executeQuery(query, { questionId: 1 }, adminToken);

      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Forbidden');
    });
  });

  describe('Question field resolvers', () => {
    it('tags: should delegate to Tag.findByQuestionId', async () => {
      const mockTags = [{ id: 1, name: 'Tag A' }];
      jest.spyOn(Tag, 'findByQuestionId').mockResolvedValue(mockTags as any);

      query = `
        query question($questionId: Int!) {
          question(questionId: $questionId) {
            id
            tags { id name }
          }
        }
      `;
      jest.spyOn(Question, 'findById').mockResolvedValue({ id: 1 } as any);

      const result = await executeQuery(query, { questionId: 1 }, adminToken);

      expect(Tag.findByQuestionId).toHaveBeenCalledWith(
        'Chained Question.tags',
        expect.any(Object),
        1
      );
      expect(result.body.singleResult.data.question.tags).toHaveLength(1);
    });

    it('conditionGroups: should delegate to QuestionConditionGroup.findByQuestionId', async () => {
      const mockGroups = [{ id: 1, triggerQuestionId: 2 }];
      jest.spyOn(QuestionConditionGroup, 'findByQuestionId').mockResolvedValue(mockGroups as any);
      jest.spyOn(Question, 'findById').mockResolvedValue({ id: 1 } as any);

      query = `
        query question($questionId: Int!) {
          question(questionId: $questionId) {
            id
            conditionGroups { id triggerQuestionId }
          }
        }
      `;

      const result = await executeQuery(query, { questionId: 1 }, adminToken);

      expect(QuestionConditionGroup.findByQuestionId).toHaveBeenCalledWith(
        'Chained Question.conditionGroups',
        expect.any(Object),
        1
      );
      expect(result.body.singleResult.data.question.conditionGroups).toHaveLength(1);
    });
  });
});
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

import type { MyContext } from "../../context.js";

type VersionedQuestionInstance = InstanceType<typeof VersionedQuestion>;
function asVersionedQuestion(value: any): VersionedQuestionInstance {
  return value as VersionedQuestionInstance;
}

type VersionedQuestionConditionInstance = InstanceType<typeof VersionedQuestionCondition>;
function asVersionedQuestionCondition(value: any): VersionedQuestionConditionInstance {
  return value as VersionedQuestionConditionInstance;
}

type VersionedQuestionCustomizationInstance = InstanceType<typeof VersionedQuestionCustomization>;
function asVersionedQuestionCustomization(value: any): VersionedQuestionCustomizationInstance {
  return value as VersionedQuestionCustomizationInstance;
}

type VersionedTemplateInstance = InstanceType<typeof VersionedTemplate>;
function asVersionedTemplate(value: any): VersionedTemplateInstance {
  return value as VersionedTemplateInstance;
}

type AffiliationInstance = InstanceType<typeof Affiliation>;
function asAffiliation(value: any): AffiliationInstance {
  return value as AffiliationInstance;
}

type VersionedQuestionCondition = InstanceType<typeof VersionedQuestionCondition>;


// Dynamic import AFTER mocking the configs and logger
const { typeDefs } = await import("../../schema.js");
const { resolvers } = await import("../../resolver.js");
const { logger } = await import("../../logger.js");
const {
  buildContext,
  mockToken
} = await import("../../__mocks__/context.js");
const { UserRole } = await import("../../models/User.js");
const { VersionedCustomQuestion } = await import('../../models/VersionedCustomQuestion.js');
const { Answer } = await import('../../models/Answer.js');
const { VersionedQuestionCondition } = await import('../../models/VersionedQuestionCondition.js');
const { VersionedQuestion } = await import('../../models/VersionedQuestion.js');
const { VersionedTemplate } = await import('../../models/VersionedTemplate.js');
const { VersionedTemplateCustomization } = await import('../../models/VersionedTemplateCustomization.js');
const { VersionedQuestionCustomization } = await import('../../models/VersionedQuestionCustomization.js');
const { Affiliation } = await import('../../models/Affiliation.js');


let testServer: ApolloServer;
let affiliationId: string;
let researcherToken: MyContext['token'];
let query: string;

async function executeQuery(
  query: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  variables: any,
  token: MyContext['token']
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const context = buildContext(logger, token, null);
  return await testServer.executeOperation(
    { query, variables },
    { contextValue: context },
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeQueryAnon(query: string, variables: any): Promise<any> {
  const context = buildContext(logger, null, null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return await testServer.executeOperation({ query, variables }, { contextValue: context }) as any;
}

beforeEach(async () => {
  jest.resetAllMocks();

  testServer = new ApolloServer({ typeDefs, resolvers });

  affiliationId = casual.url;

  researcherToken = await mockToken();
  researcherToken.affiliationId = affiliationId;
  researcherToken.role = UserRole.RESEARCHER;
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('versionedQuestion resolvers', () => {

  // ============================================================================
  // Query: publishedQuestion
  // ============================================================================
  describe('Query.publishedQuestion', () => {
    beforeEach(() => {
      query = `
        query publishedQuestion($versionedQuestionId: Int!) {
          publishedQuestion(versionedQuestionId: $versionedQuestionId) {
            id
            questionText
            requirementText
            guidanceText
            sampleText
            required
            versionedTemplateId
            versionedSectionId
            versionedQuestionConditions {
              id
            }
          }
        }
      `;
    });

    it('should return the question when found', async () => {
      const mockQuestion = {
        id: 1,
        questionText: 'What is your data management plan?',
        requirementText: 'Required by funder',
        guidanceText: 'Some guidance',
        sampleText: 'Sample answer',
        required: true,
        versionedTemplateId: 10,
        versionedSectionId: 5,
      };

      jest.spyOn(VersionedQuestion, 'findById').mockResolvedValue(mockQuestion as InstanceType<typeof VersionedQuestion>);
      jest.spyOn(VersionedQuestionCondition, 'findByVersionedQuestionConditionGroupId').mockResolvedValue([]);
      jest.spyOn(VersionedQuestionCustomization, 'findActiveByTemplateAffiliationAndQuestion').mockResolvedValue(null);

      const result = await executeQuery(query, { versionedQuestionId: 1 }, researcherToken);

      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.publishedQuestion.id).toEqual(1);
      expect(result.body.singleResult.data.publishedQuestion.questionText).toEqual('What is your data management plan?');
      expect(VersionedQuestion.findById).toHaveBeenCalledWith(
        'publishedQuestion resolver',
        expect.any(Object),
        1
      );
      expect(VersionedQuestionCustomization.findActiveByTemplateAffiliationAndQuestion).toHaveBeenCalledWith(
        'publishedQuestion resolver',
        expect.any(Object),
        affiliationId,
        1
      );
    });

    it('should return customization fields when a customization exists', async () => {
      const mockQuestion = {
        id: 1,
        questionText: 'What is your data management plan?',
        requirementText: 'Required by funder',
        guidanceText: 'Original guidance',
        sampleText: 'Original sample',
        required: true,
        versionedTemplateId: 10,
        versionedSectionId: 5,
      };
      const mockCustomization = {
        id: 99,
        guidanceText: 'Org custom guidance',
        sampleText: 'Org custom sample',
      };

      jest.spyOn(VersionedQuestion, 'findById').mockResolvedValue(mockQuestion as InstanceType<typeof VersionedQuestion>);
      jest.spyOn(VersionedQuestionCondition, 'findByVersionedQuestionConditionGroupId').mockResolvedValue([]);
      jest.spyOn(VersionedQuestionCustomization, 'findActiveByTemplateAffiliationAndQuestion').mockResolvedValue(mockCustomization as InstanceType<typeof VersionedQuestionCustomization>);

      const custQuery = `
        query publishedQuestion($versionedQuestionId: Int!) {
          publishedQuestion(versionedQuestionId: $versionedQuestionId) {
            id
            guidanceText
            sampleText
            customizationId
            customizationGuidanceText
            customizationSampleText
          }
        }
      `;

      const result = await executeQuery(custQuery, { versionedQuestionId: 1 }, researcherToken);

      expect(result.body.singleResult.errors).toBeUndefined();
      const q = result.body.singleResult.data.publishedQuestion;
      expect(q.id).toEqual(1);
      expect(q.guidanceText).toEqual('Original guidance');
      expect(q.sampleText).toEqual('Original sample');
      expect(q.customizationId).toEqual(99);
      expect(q.customizationGuidanceText).toEqual('Org custom guidance');
      expect(q.customizationSampleText).toEqual('Org custom sample');
    });

    it('should return null customization fields when no customization exists', async () => {
      const mockQuestion = {
        id: 1,
        questionText: 'Test question',
        required: false,
        versionedTemplateId: 10,
        versionedSectionId: 5,
      };

      jest.spyOn(VersionedQuestion, 'findById').mockResolvedValue(mockQuestion as InstanceType<typeof VersionedQuestion>);
      jest.spyOn(VersionedQuestionCondition, 'findByVersionedQuestionConditionGroupId').mockResolvedValue([]);
      jest.spyOn(VersionedQuestionCustomization, 'findActiveByTemplateAffiliationAndQuestion').mockResolvedValue(null as InstanceType<typeof VersionedQuestionCustomization>);

      const custQuery = `
        query publishedQuestion($versionedQuestionId: Int!) {
          publishedQuestion(versionedQuestionId: $versionedQuestionId) {
            id
            customizationId
            customizationGuidanceText
            customizationSampleText
          }
        }
      `;

      const result = await executeQuery(custQuery, { versionedQuestionId: 1 }, researcherToken);

      expect(result.body.singleResult.errors).toBeUndefined();
      const q = result.body.singleResult.data.publishedQuestion;
      expect(q.customizationId).toBeNull();
      expect(q.customizationGuidanceText).toBeNull();
      expect(q.customizationSampleText).toBeNull();
    });

    it('should return null when question is not found', async () => {
      jest.spyOn(VersionedQuestion, 'findById').mockResolvedValue(null as InstanceType<typeof VersionedQuestion>);
      jest.spyOn(VersionedQuestionCustomization, 'findActiveByTemplateAffiliationAndQuestion').mockResolvedValue(null as InstanceType<typeof VersionedQuestionCustomization>);

      const result = await executeQuery(query, { versionedQuestionId: 999 }, researcherToken);

      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.publishedQuestion).toBeNull();
    });

    it('should return Authentication error when no token is provided', async () => {
      const result = await executeQueryAnon(query, { versionedQuestionId: 1 });

      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Unauthorized');
    });

    it('should resolve versionedQuestionConditions via chained resolver', async () => {
      const mockQuestion = {
        id: 1,
        questionText: 'Test question',
        required: false,
        versionedTemplateId: 10,
        versionedSectionId: 5,
      };
      const mockConditions = [
        { id: 11 },
        { id: 12 },
      ];

      jest.spyOn(VersionedQuestion, 'findById').mockResolvedValue(mockQuestion as InstanceType<typeof VersionedQuestion>);
      jest.spyOn(VersionedQuestionCondition, 'findByVersionedQuestionConditionGroupId').mockResolvedValue(mockConditions as InstanceType<typeof VersionedQuestionCondition>[]);
      jest.spyOn(VersionedQuestionCustomization, 'findActiveByTemplateAffiliationAndQuestion').mockResolvedValue(null as InstanceType<typeof VersionedQuestionCustomization>);

      const result = await executeQuery(query, { versionedQuestionId: 1 }, researcherToken);

      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.publishedQuestion.versionedQuestionConditions).toHaveLength(2);
      expect(result.body.singleResult.data.publishedQuestion.versionedQuestionConditions[0].id).toEqual(11);
      expect(VersionedQuestionCondition.findByVersionedQuestionConditionGroupId).toHaveBeenCalledWith(
        'Chained VersionedQuestion.versionedQuestionConditions',
        expect.any(Object),
        1
      );
    });

    it('should resolve ownerAffiliation via chained resolver', async () => {
      const mockQuestion = {
        id: 1,
        questionText: 'Test question',
        required: false,
        versionedTemplateId: 10,
        versionedSectionId: 5,
      };
      const mockTemplate = { id: 10, ownerId: 'https://ror.org/abc' };
      const mockAffiliation = { uri: 'https://ror.org/abc', name: 'Test University', displayName: 'Test University' };

      jest.spyOn(VersionedQuestion, 'findById').mockResolvedValue(mockQuestion as InstanceType<typeof VersionedQuestion>);
      jest.spyOn(VersionedQuestionCondition, 'findByVersionedQuestionConditionGroupId').mockResolvedValue([] as InstanceType<typeof VersionedQuestionCondition>[]);
      jest.spyOn(VersionedQuestionCustomization, 'findActiveByTemplateAffiliationAndQuestion').mockResolvedValue(null as InstanceType<typeof VersionedQuestionCustomization>);
      jest.spyOn(VersionedTemplate, 'findById').mockResolvedValue(mockTemplate as InstanceType<typeof VersionedTemplate>);
      jest.spyOn(Affiliation, 'findByURI').mockResolvedValue(mockAffiliation as InstanceType<typeof Affiliation>);

      const ownerQuery = `
        query publishedQuestion($versionedQuestionId: Int!) {
          publishedQuestion(versionedQuestionId: $versionedQuestionId) {
            id
            ownerAffiliation {
              uri
              name
            }
          }
        }
      `;

      const result = await executeQuery(ownerQuery, { versionedQuestionId: 1 }, researcherToken);

      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.publishedQuestion.ownerAffiliation.name).toEqual('Test University');
      expect(VersionedTemplate.findById).toHaveBeenCalledWith(
        'VersionedQuestion.ownerAffiliation resolver',
        expect.any(Object),
        10
      );
    });

    it('should resolve customizationOwnerAffiliation via chained resolver', async () => {
      const mockQuestion = {
        id: 1,
        questionText: 'Test question',
        required: false,
        versionedTemplateId: 10,
        versionedSectionId: 5,
      };
      const mockCustomization = { id: 99, guidanceText: 'Custom guidance', sampleText: null };
      const mockAffiliation = { uri: affiliationId, name: 'Org University', displayName: 'Org University' };

      jest.spyOn(VersionedQuestion, 'findById').mockResolvedValue(mockQuestion as InstanceType<typeof VersionedQuestion>);
      jest.spyOn(VersionedQuestionCondition, 'findByVersionedQuestionConditionGroupId').mockResolvedValue([] as InstanceType<typeof VersionedQuestionCondition>[]);
      jest.spyOn(VersionedQuestionCustomization, 'findActiveByTemplateAffiliationAndQuestion').mockResolvedValue(mockCustomization as InstanceType<typeof VersionedQuestionCustomization>);
      jest.spyOn(Affiliation, 'findByURI').mockResolvedValue(mockAffiliation as InstanceType<typeof Affiliation>);

      const custOwnerQuery = `
        query publishedQuestion($versionedQuestionId: Int!) {
          publishedQuestion(versionedQuestionId: $versionedQuestionId) {
            id
            customizationOwnerAffiliation {
              uri
              name
            }
          }
        }
      `;

      const result = await executeQuery(custOwnerQuery, { versionedQuestionId: 1 }, researcherToken);

      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.publishedQuestion.customizationOwnerAffiliation.name).toEqual('Org University');
      expect(Affiliation.findByURI).toHaveBeenCalledWith(
        'VersionedQuestion.customizationOwnerAffiliation resolver',
        expect.any(Object),
        affiliationId
      );
    });

    it('should return null customizationOwnerAffiliation when no customization exists', async () => {
      const mockQuestion = {
        id: 1,
        questionText: 'Test question',
        required: false,
        versionedTemplateId: 10,
        versionedSectionId: 5,
      };

      jest.spyOn(VersionedQuestion, 'findById').mockResolvedValue(mockQuestion as InstanceType<typeof VersionedQuestion>);
      jest.spyOn(VersionedQuestionCondition, 'findByVersionedQuestionConditionGroupId').mockResolvedValue([] as InstanceType<typeof VersionedQuestionCondition>[]);
      jest.spyOn(VersionedQuestionCustomization, 'findActiveByTemplateAffiliationAndQuestion').mockResolvedValue(null as InstanceType<typeof VersionedQuestionCustomization>);

      const custOwnerQuery = `
        query publishedQuestion($versionedQuestionId: Int!) {
          publishedQuestion(versionedQuestionId: $versionedQuestionId) {
            id
            customizationOwnerAffiliation { uri }
          }
        }
      `;

      const result = await executeQuery(custOwnerQuery, { versionedQuestionId: 1 }, researcherToken);

      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.publishedQuestion.customizationOwnerAffiliation).toBeNull();
    });
  });

  // ============================================================================
  // Query: publishedCustomQuestion
  // ============================================================================
  describe('Query.publishedCustomQuestion', () => {
    beforeEach(() => {
      query = `
        query publishedCustomQuestion($versionedCustomQuestionId: Int!) {
          publishedCustomQuestion(versionedCustomQuestionId: $versionedCustomQuestionId) {
            id
            questionText
            requirementText
            guidanceText
            sampleText
            required
            json
            versionedTemplateCustomizationId
          }
        }
      `;
    });

    it('should return the custom question when found', async () => {
      const mockCustomQuestion = {
        id: 5,
        questionText: 'Custom question text',
        requirementText: 'Custom requirement',
        guidanceText: 'Custom guidance',
        sampleText: 'Custom sample',
        required: false,
        json: '{"type":"textArea"}',
        versionedTemplateCustomizationId: 20,
      };

      jest.spyOn(VersionedCustomQuestion, 'findById').mockResolvedValue(mockCustomQuestion as InstanceType<typeof VersionedCustomQuestion>);

      const result = await executeQuery(query, { versionedCustomQuestionId: 5 }, researcherToken);

      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.publishedCustomQuestion.id).toEqual(5);
      expect(result.body.singleResult.data.publishedCustomQuestion.questionText).toEqual('Custom question text');
      expect(result.body.singleResult.data.publishedCustomQuestion.json).toEqual('{"type":"textArea"}');
      expect(VersionedCustomQuestion.findById).toHaveBeenCalledWith(
        'publishedCustomQuestion resolver',
        expect.any(Object),
        5
      );
    });

    it('should return null when custom question is not found', async () => {
      jest.spyOn(VersionedCustomQuestion, 'findById').mockResolvedValue(null as InstanceType<typeof VersionedCustomQuestion>);

      const result = await executeQuery(query, { versionedCustomQuestionId: 999 }, researcherToken);

      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.publishedCustomQuestion).toBeNull();
    });

    it('should return Authentication error when no token is provided', async () => {
      const result = await executeQueryAnon(query, { versionedCustomQuestionId: 5 });

      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Unauthorized');
    });

    it('should resolve ownerAffiliation via chained resolver', async () => {
      const mockCustomQuestion = {
        id: 5,
        questionText: 'Custom question',
        required: false,
        json: '{"type":"textArea"}',
        versionedTemplateCustomizationId: 20,
      };
      const mockVtc = { id: 20, currentVersionedTemplateId: 10 };
      const mockTemplate = { id: 10, ownerId: 'https://ror.org/xyz' };
      const mockAffiliation = { uri: 'https://ror.org/xyz', name: 'Owner Org', displayName: 'Owner Org' };

      jest.spyOn(VersionedCustomQuestion, 'findById').mockResolvedValue(mockCustomQuestion as InstanceType<typeof VersionedCustomQuestion>);
      jest.spyOn(VersionedTemplateCustomization, 'findById').mockResolvedValue(mockVtc as InstanceType<typeof VersionedTemplateCustomization>);
      jest.spyOn(VersionedTemplate, 'findById').mockResolvedValue(mockTemplate as InstanceType<typeof VersionedTemplate>);
      jest.spyOn(Affiliation, 'findByURI').mockResolvedValue(mockAffiliation as InstanceType<typeof Affiliation>);

      const ownerQuery = `
        query publishedCustomQuestion($versionedCustomQuestionId: Int!) {
          publishedCustomQuestion(versionedCustomQuestionId: $versionedCustomQuestionId) {
            id
            ownerAffiliation {
              uri
              name
            }
          }
        }
      `;

      const result = await executeQuery(ownerQuery, { versionedCustomQuestionId: 5 }, researcherToken);

      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.publishedCustomQuestion.ownerAffiliation.name).toEqual('Owner Org');
      expect(VersionedTemplateCustomization.findById).toHaveBeenCalledWith(
        'VersionedCustomQuestion.ownerAffiliation resolver',
        expect.any(Object),
        20
      );
      expect(VersionedTemplate.findById).toHaveBeenCalledWith(
        'VersionedCustomQuestion.ownerAffiliation resolver',
        expect.any(Object),
        10
      );
    });

    it('should return null ownerAffiliation when versioned template customization is not found', async () => {
      const mockCustomQuestion = {
        id: 5,
        questionText: 'Custom question',
        required: false,
        json: '{"type":"textArea"}',
        versionedTemplateCustomizationId: 20,
      };

      jest.spyOn(VersionedCustomQuestion, 'findById').mockResolvedValue(mockCustomQuestion as InstanceType<typeof VersionedCustomQuestion>);
      jest.spyOn(VersionedTemplateCustomization, 'findById').mockResolvedValue(null as InstanceType<typeof VersionedTemplateCustomization>);

      const ownerQuery = `
        query publishedCustomQuestion($versionedCustomQuestionId: Int!) {
          publishedCustomQuestion(versionedCustomQuestionId: $versionedCustomQuestionId) {
            id
            ownerAffiliation { uri }
          }
        }
      `;

      const result = await executeQuery(ownerQuery, { versionedCustomQuestionId: 5 }, researcherToken);

      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.publishedCustomQuestion.ownerAffiliation).toBeNull();
    });
  });

  // ============================================================================
  // Query: publishedQuestions
  // ============================================================================
  describe('Query.publishedQuestions', () => {
    beforeEach(() => {
      query = `
        query publishedQuestions($planId: Int!, $versionedSectionId: Int!) {
          publishedQuestions(planId: $planId, versionedSectionId: $versionedSectionId) {
            id
            questionText
            hasAnswer
            questionType
            versionedQuestionId
            customQuestionId
          }
        }
      `;
    });

    it('should return ordered base and custom questions with answer flags', async () => {
      const mockBaseQuestions = [
        { id: 1, questionText: 'Base Q1', required: true },
        { id: 2, questionText: 'Base Q2', required: false },
      ];
      const mockCustomQuestions = [
        {
          id: 10,
          questionText: 'Custom Q1',
          required: false,
          pinnedVersionedQuestionId: 1,
          pinnedVersionedQuestionType: 'BASE',
        },
      ];
      const mockBaseAnswers = [{ versionedQuestionId: 1 }];
      const mockCustomAnswers = [];

      jest.spyOn(VersionedQuestion, 'findByVersionedSectionId').mockResolvedValue(mockBaseQuestions as InstanceType<typeof VersionedQuestion>[]);
      jest.spyOn(VersionedCustomQuestion, 'findByVersionedSectionIdAndType').mockResolvedValue(mockCustomQuestions as InstanceType<typeof VersionedCustomQuestion>[]);
      jest.spyOn(Answer, 'findFilledAnswersByQuestionIds').mockResolvedValue(mockBaseAnswers as InstanceType<typeof Answer>[]);
      jest.spyOn(Answer, 'findFilledAnswersByCustomQuestionIds').mockResolvedValue(mockCustomAnswers as InstanceType<typeof Answer>[]);

      const result = await executeQuery(query, { planId: 1, versionedSectionId: 5 }, researcherToken);

      expect(result.body.singleResult.errors).toBeUndefined();
      const questions = result.body.singleResult.data.publishedQuestions;

      // Base Q1 + Custom Q1 (pinned after Q1) + Base Q2
      expect(questions).toHaveLength(3);
      expect(questions[0].id).toEqual(1);
      expect(questions[0].questionType).toEqual('BASE');
      expect(questions[0].hasAnswer).toBe(true);
      expect(questions[0].versionedQuestionId).toEqual(1);

      expect(questions[1].id).toEqual(10);
      expect(questions[1].questionType).toEqual('CUSTOM');
      expect(questions[1].hasAnswer).toBe(false);
      expect(questions[1].customQuestionId).toEqual(10);

      expect(questions[2].id).toEqual(2);
      expect(questions[2].questionType).toEqual('BASE');
      expect(questions[2].hasAnswer).toBe(false);
    });

    it('should place custom question first when pinnedVersionedQuestionId is null', async () => {
      const mockBaseQuestions = [{ id: 1, questionText: 'Base Q1', required: false }];
      const mockCustomQuestions = [
        {
          id: 10,
          questionText: 'Unpinned Custom',
          required: false,
          pinnedVersionedQuestionId: null,
          pinnedVersionedQuestionType: null,
        },
      ];

      jest.spyOn(VersionedQuestion, 'findByVersionedSectionId').mockResolvedValue(mockBaseQuestions as InstanceType<typeof VersionedQuestion>[]);
      jest.spyOn(VersionedCustomQuestion, 'findByVersionedSectionIdAndType').mockResolvedValue(mockCustomQuestions as InstanceType<typeof VersionedCustomQuestion>[]);
      jest.spyOn(Answer, 'findFilledAnswersByQuestionIds').mockResolvedValue([] as InstanceType<typeof Answer>[]);
      jest.spyOn(Answer, 'findFilledAnswersByCustomQuestionIds').mockResolvedValue([] as InstanceType<typeof Answer>[]);

      const result = await executeQuery(query, { planId: 1, versionedSectionId: 5 }, researcherToken);

      expect(result.body.singleResult.errors).toBeUndefined();
      const questions = result.body.singleResult.data.publishedQuestions;
      expect(questions[0].id).toEqual(10);
      expect(questions[0].questionType).toEqual('CUSTOM');
      expect(questions[1].id).toEqual(1);
    });

    it('should return only base questions when no custom questions exist', async () => {
      const mockBaseQuestions = [
        { id: 1, questionText: 'Base Q1', required: true },
        { id: 2, questionText: 'Base Q2', required: false },
      ];

      jest.spyOn(VersionedQuestion, 'findByVersionedSectionId').mockResolvedValue(mockBaseQuestions as InstanceType<typeof VersionedQuestion>[]);
      jest.spyOn(VersionedCustomQuestion, 'findByVersionedSectionIdAndType').mockResolvedValue([] as InstanceType<typeof VersionedCustomQuestion>[]);
      jest.spyOn(Answer, 'findFilledAnswersByQuestionIds').mockResolvedValue([] as InstanceType<typeof Answer>[]);
      jest.spyOn(Answer, 'findFilledAnswersByCustomQuestionIds').mockResolvedValue([] as InstanceType<typeof Answer>[]);

      const result = await executeQuery(query, { planId: 1, versionedSectionId: 5 }, researcherToken);

      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.publishedQuestions).toHaveLength(2);
      expect(result.body.singleResult.data.publishedQuestions.every(q => q.questionType === 'BASE')).toBe(true);
    });

    it('should return empty array when no questions exist', async () => {
      jest.spyOn(VersionedQuestion, 'findByVersionedSectionId').mockResolvedValue([] as InstanceType<typeof VersionedQuestion>[]);
      jest.spyOn(VersionedCustomQuestion, 'findByVersionedSectionIdAndType').mockResolvedValue([] as InstanceType<typeof VersionedCustomQuestion>[]);
      jest.spyOn(Answer, 'findFilledAnswersByQuestionIds').mockResolvedValue([] as InstanceType<typeof Answer>[]);
      jest.spyOn(Answer, 'findFilledAnswersByCustomQuestionIds').mockResolvedValue([] as InstanceType<typeof Answer>[]);


      const result = await executeQuery(query, { planId: 1, versionedSectionId: 5 }, researcherToken);

      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.publishedQuestions).toHaveLength(0);
    });

    it('should return Authentication error when no token', async () => {
      const result = await executeQueryAnon(query, { planId: 1, versionedSectionId: 5 });

      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Unauthorized');
    });
  });

  // ============================================================================
  // Query: publishedCustomQuestions
  // ============================================================================
  describe('Query.publishedCustomQuestions', () => {
    beforeEach(() => {
      query = `
        query publishedCustomQuestions($planId: Int!, $versionedCustomSectionId: Int!) {
          publishedCustomQuestions(planId: $planId, versionedCustomSectionId: $versionedCustomSectionId) {
            id
            questionText
            hasAnswer
            questionType
            customQuestionId
            json
          }
        }
      `;
    });

    it('should return custom questions with answer flags', async () => {
      const mockQuestions = [
        { id: 10, questionText: 'Custom Q1', required: true, json: '{"type":"textArea"}' },
        { id: 11, questionText: 'Custom Q2', required: false, json: '{"type":"checkbox"}' },
      ];
      const mockAnswers = [{ versionedCustomQuestionId: 10 }];

      jest.spyOn(VersionedCustomQuestion, 'findByVersionedCustomSectionId').mockResolvedValue(mockQuestions as InstanceType<typeof VersionedCustomQuestion>[]);
      jest.spyOn(Answer, 'findFilledAnswersByCustomQuestionIds').mockResolvedValue(mockAnswers as InstanceType<typeof Answer>[]);

      const result = await executeQuery(
        query,
        { planId: 1, versionedCustomSectionId: 7 },
        researcherToken
      );

      expect(result.body.singleResult.errors).toBeUndefined();
      const questions = result.body.singleResult.data.publishedCustomQuestions;
      expect(questions).toHaveLength(2);

      expect(questions[0].id).toEqual(10);
      expect(questions[0].questionType).toEqual('CUSTOM');
      expect(questions[0].hasAnswer).toBe(true);
      expect(questions[0].customQuestionId).toEqual(10);
      expect(questions[0].json).toEqual('{"type":"textArea"}');

      expect(questions[1].id).toEqual(11);
      expect(questions[1].hasAnswer).toBe(false);
    });

    it('should return empty array when no custom questions exist', async () => {
      jest.spyOn(VersionedCustomQuestion, 'findByVersionedCustomSectionId').mockResolvedValue([] as InstanceType<typeof VersionedCustomQuestion>[]);
      jest.spyOn(Answer, 'findFilledAnswersByCustomQuestionIds').mockResolvedValue([] as InstanceType<typeof Answer>[]);

      const result = await executeQuery(
        query,
        { planId: 1, versionedCustomSectionId: 7 },
        researcherToken
      );

      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.publishedCustomQuestions).toHaveLength(0);
    });

    it('should return Authentication error when no token', async () => {
      const result = await executeQueryAnon(query, { planId: 1, versionedCustomSectionId: 7 });

      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toEqual('Unauthorized');
    });
  });
});

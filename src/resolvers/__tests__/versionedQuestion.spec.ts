import casual from "casual";

// Mock the authenticatedResolver HOF before importing resolvers
jest.mock('../../services/authService', () => ({
  ...jest.requireActual('../../services/authService'),
  authenticatedResolver: jest.fn((ref, level, resolver) => resolver),
}));

import { ApolloServer } from "@apollo/server";
import { typeDefs } from "../../schema";
import { resolvers } from '../../resolver';

import { logger } from "../../logger";
import { JWTAccessToken } from "../../services/tokenService";
import { VersionedQuestion } from '../../models/VersionedQuestion';
import { VersionedCustomQuestion } from '../../models/VersionedCustomQuestion';
import { Answer } from '../../models/Answer';
import { VersionedQuestionCondition } from '../../models/VersionedQuestionCondition';
import { VersionedTemplate } from '../../models/VersionedTemplate';
import { VersionedTemplateCustomization } from '../../models/VersionedTemplateCustomization';
import { Affiliation } from '../../models/Affiliation';
import { UserRole } from "../../models/User";
import { buildContext, mockToken } from "../../__mocks__/context";

jest.mock('../../context.ts');
jest.mock('../../datasources/cache');

jest.mock('../../models/VersionedQuestion');
jest.mock('../../models/VersionedCustomQuestion');
jest.mock('../../models/Answer');
jest.mock('../../models/VersionedQuestionCondition');

let testServer: ApolloServer;
let affiliationId: string;
let researcherToken: JWTAccessToken;
let query: string;

async function executeQuery(
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

      (VersionedQuestion.findById as jest.Mock).mockResolvedValue(mockQuestion);
      (VersionedQuestionCondition.findByVersionedQuestionId as jest.Mock).mockResolvedValue([]);

      const result = await executeQuery(query, { versionedQuestionId: 1 }, researcherToken);

      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.publishedQuestion.id).toEqual(1);
      expect(result.body.singleResult.data.publishedQuestion.questionText).toEqual('What is your data management plan?');
      expect(VersionedQuestion.findById).toHaveBeenCalledWith(
        'publishedQuestion resolver',
        expect.any(Object),
        1
      );
    });

    it('should return null when question is not found', async () => {
      (VersionedQuestion.findById as jest.Mock).mockResolvedValue(null);

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

      (VersionedQuestion.findById as jest.Mock).mockResolvedValue(mockQuestion);
      (VersionedQuestionCondition.findByVersionedQuestionId as jest.Mock).mockResolvedValue(mockConditions);

      const result = await executeQuery(query, { versionedQuestionId: 1 }, researcherToken);

      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.publishedQuestion.versionedQuestionConditions).toHaveLength(2);
      expect(result.body.singleResult.data.publishedQuestion.versionedQuestionConditions[0].id).toEqual(11);
      expect(VersionedQuestionCondition.findByVersionedQuestionId).toHaveBeenCalledWith(
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

      (VersionedQuestion.findById as jest.Mock).mockResolvedValue(mockQuestion);
      (VersionedQuestionCondition.findByVersionedQuestionId as jest.Mock).mockResolvedValue([]);
      jest.spyOn(VersionedTemplate, 'findById').mockResolvedValue(mockTemplate as unknown as VersionedTemplate);
      jest.spyOn(Affiliation, 'findByURI').mockResolvedValue(mockAffiliation as unknown as Affiliation);

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

      (VersionedCustomQuestion.findById as jest.Mock).mockResolvedValue(mockCustomQuestion);

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
      (VersionedCustomQuestion.findById as jest.Mock).mockResolvedValue(null);

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

      (VersionedCustomQuestion.findById as jest.Mock).mockResolvedValue(mockCustomQuestion);
      jest.spyOn(VersionedTemplateCustomization, 'findById').mockResolvedValue(mockVtc as unknown as VersionedTemplateCustomization);
      jest.spyOn(VersionedTemplate, 'findById').mockResolvedValue(mockTemplate as unknown as VersionedTemplate);
      jest.spyOn(Affiliation, 'findByURI').mockResolvedValue(mockAffiliation as unknown as Affiliation);

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

      (VersionedCustomQuestion.findById as jest.Mock).mockResolvedValue(mockCustomQuestion);
      jest.spyOn(VersionedTemplateCustomization, 'findById').mockResolvedValue(null);

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

      (VersionedQuestion.findByVersionedSectionId as jest.Mock).mockResolvedValue(mockBaseQuestions);
      (VersionedCustomQuestion.findByVersionedSectionIdAndType as jest.Mock).mockResolvedValue(mockCustomQuestions);
      (Answer.findFilledAnswersByQuestionIds as jest.Mock).mockResolvedValue(mockBaseAnswers);
      (Answer.findFilledAnswersByCustomQuestionIds as jest.Mock).mockResolvedValue(mockCustomAnswers);

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

      (VersionedQuestion.findByVersionedSectionId as jest.Mock).mockResolvedValue(mockBaseQuestions);
      (VersionedCustomQuestion.findByVersionedSectionIdAndType as jest.Mock).mockResolvedValue(mockCustomQuestions);
      (Answer.findFilledAnswersByQuestionIds as jest.Mock).mockResolvedValue([]);
      (Answer.findFilledAnswersByCustomQuestionIds as jest.Mock).mockResolvedValue([]);

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

      (VersionedQuestion.findByVersionedSectionId as jest.Mock).mockResolvedValue(mockBaseQuestions);
      (VersionedCustomQuestion.findByVersionedSectionIdAndType as jest.Mock).mockResolvedValue([]);
      (Answer.findFilledAnswersByQuestionIds as jest.Mock).mockResolvedValue([]);
      (Answer.findFilledAnswersByCustomQuestionIds as jest.Mock).mockResolvedValue([]);

      const result = await executeQuery(query, { planId: 1, versionedSectionId: 5 }, researcherToken);

      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data.publishedQuestions).toHaveLength(2);
      expect(result.body.singleResult.data.publishedQuestions.every(q => q.questionType === 'BASE')).toBe(true);
    });

    it('should return empty array when no questions exist', async () => {
      (VersionedQuestion.findByVersionedSectionId as jest.Mock).mockResolvedValue([]);
      (VersionedCustomQuestion.findByVersionedSectionIdAndType as jest.Mock).mockResolvedValue([]);
      (Answer.findFilledAnswersByQuestionIds as jest.Mock).mockResolvedValue([]);
      (Answer.findFilledAnswersByCustomQuestionIds as jest.Mock).mockResolvedValue([]);

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

      (VersionedCustomQuestion.findByVersionedCustomSectionId as jest.Mock).mockResolvedValue(mockQuestions);
      (Answer.findFilledAnswersByCustomQuestionIds as jest.Mock).mockResolvedValue(mockAnswers);

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
      (VersionedCustomQuestion.findByVersionedCustomSectionId as jest.Mock).mockResolvedValue([]);
      (Answer.findFilledAnswersByCustomQuestionIds as jest.Mock).mockResolvedValue([]);

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

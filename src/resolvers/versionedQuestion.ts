import { Resolvers, CustomizableObjectOwnership } from "../types";
import { MyContext } from "../context";
import { VersionedQuestion } from "../models/VersionedQuestion";
import { VersionedCustomQuestion } from "../models/VersionedCustomQuestion";
import { Answer } from "../models/Answer";
import { AuthenticationError, ForbiddenError, InternalServerError } from "../utils/graphQLErrors";
import { VersionedQuestionCondition } from "../models/VersionedQuestionCondition";
import { prepareObjectForLogs } from "../logger";
import { isAuthorized } from "../services/authService";
import { GraphQLError } from "graphql";
import { normaliseDateTime } from "../utils/helpers";
import { VersionedTemplate } from "../models/VersionedTemplate";
import { Affiliation } from "../models/Affiliation";


interface PublishedQuestionResult {
  id: number;
  questionText: string;
  requirementText?: string;
  guidanceText?: string;
  sampleText?: string;
  required: boolean;
  hasAnswer: boolean;
  questionType: CustomizableObjectOwnership;
  // Type-specific IDs — one will always be present depending on questionType
  versionedQuestionId?: number;  // present when questionType === 'BASE'
  customQuestionId?: number;     // present when questionType === 'CUSTOM'
}


export const resolvers: Resolvers = {
  Query: {
    // return all published questions for the specified versioned section. Returns both base and custom questions, and 
    // includes a flag for if the question has an answer for the specified plan
    publishedQuestions: async (_, { planId, versionedSectionId }, context: MyContext): Promise<PublishedQuestionResult[]> => {
      const reference = 'publishedQuestionsWithAnsweredFlag resolver';
      try {
        if (isAuthorized(context.token)) {
          const [baseQuestions, customQuestions] = await Promise.all([
            VersionedQuestion.findByVersionedSectionId(reference, context, versionedSectionId),
            VersionedCustomQuestion.findByVersionedSectionIdAndType(reference, context, versionedSectionId, 'BASE')
          ]);

          const baseIds = baseQuestions.map(q => q.id);
          const customIds = customQuestions.map(q => q.id);

          const [baseAnswers, customAnswers] = await Promise.all([
            Answer.findFilledAnswersByQuestionIds(reference, context, planId, baseIds),
            Answer.findFilledAnswersByCustomQuestionIds(reference, context, planId, customIds)
          ]);

          const baseAnswersMap = new Set(baseAnswers.map(a => a.versionedQuestionId));
          const customAnswersMap = new Set(customAnswers.map(a => a.versionedCustomQuestionId));

          // Build ordered list starting with base questions
          const ordered: PublishedQuestionResult[] = baseQuestions.map(q => ({
            id: q.id,
            questionText: q.questionText,
            requirementText: q.requirementText,
            guidanceText: q.guidanceText,
            sampleText: q.sampleText,
            required: q.required,
            hasAnswer: baseAnswersMap.has(q.id),
            questionType: 'BASE' as CustomizableObjectOwnership,
            versionedQuestionId: q.id,
            customQuestionId: undefined,
          }));

          // Sort custom questions by id (same as injectCustomQuestions)
          const sortedCustom = [...customQuestions].sort((a, b) => a.id - b.id);

          // Splice each custom question in after its pinned question
          for (const q of sortedCustom) {
            const result: PublishedQuestionResult = {
              id: q.id,
              questionText: q.questionText,
              requirementText: q.requirementText,
              guidanceText: q.guidanceText,
              sampleText: q.sampleText,
              required: q.required,
              hasAnswer: customAnswersMap.has(q.id),
              questionType: 'CUSTOM' as CustomizableObjectOwnership,
              versionedQuestionId: undefined,
              customQuestionId: q.id,
            };

            if (q.pinnedVersionedQuestionId === null) {
              // No pin — goes first
              ordered.unshift(result);
            } else {
              const pinIdx = ordered.findIndex(o =>
                o.questionType === q.pinnedVersionedQuestionType && o.id === q.pinnedVersionedQuestionId
              );
              if (pinIdx !== -1) {
                ordered.splice(pinIdx + 1, 0, result);
              } else {
                // Pinned question not found — append to end
                ordered.push(result);
              }
            }
          }

          return ordered;
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;
        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // This only returns custom questions for a specified custom section, and include a flag for if the question has an answer for the specified plan
    publishedCustomQuestions: async (_, { planId, versionedCustomSectionId }, context: MyContext): Promise<PublishedQuestionResult[]> => {
      const reference = 'publishedCustomQuestionsWithAnsweredFlag resolver';
      try {
        if (isAuthorized(context.token)) {
          const questions = await VersionedCustomQuestion.findByVersionedCustomSectionId(
            reference, context, versionedCustomSectionId
          );

          const questionIds = questions.map(q => q.id);
          const answers = await Answer.findFilledAnswersByCustomQuestionIds(
            reference, context, planId, questionIds
          );

          const answersMap = new Set(answers.map(a => a.versionedCustomQuestionId));

          return questions.map(q => ({
            id: q.id,
            questionText: q.questionText,
            requirementText: q.requirementText,
            guidanceText: q.guidanceText,
            sampleText: q.sampleText,
            required: q.required,
            hasAnswer: answersMap.has(q.id),
            questionType: 'CUSTOM' as const,
            versionedQuestionId: undefined,
            customQuestionId: q.id,
            json: q.json,
          }));
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;
        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    publishedQuestion: async (_, { versionedQuestionId }, context: MyContext): Promise<VersionedQuestion> => {
      const reference = 'publishedQuestion resolver';
      try {
        if (isAuthorized(context?.token)) {
          // Grab the versionedSection so we can get the section, and then the templateId
          return await VersionedQuestion.findById(reference, context, versionedQuestionId);
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },
  },

  VersionedQuestion: {
    // Chained resolver to return the VersionedQuestionConditions associated with this VersionedQuestion
    versionedQuestionConditions: async (parent: VersionedQuestion, _, context: MyContext): Promise<VersionedQuestionCondition[]> => {
      return await VersionedQuestionCondition.findByVersionedQuestionId(
        'Chained VersionedQuestion.versionedQuestionConditions',
        context,
        parent.id
      );
    },
    ownerAffiliation: async (parent: VersionedQuestion, _, context: MyContext): Promise<Affiliation | null> => {
      const reference = 'VersionedQuestion.ownerAffiliation resolver';
      const versionedTemplate = await VersionedTemplate.findById(
        reference,
        context,
        parent.versionedTemplateId
      );
      if (!versionedTemplate?.ownerId) return null;
      return await Affiliation.findByURI(
        reference,
        context,
        versionedTemplate.ownerId
      );
    },
    created: (parent: VersionedQuestion) => {
      return normaliseDateTime(parent.created);
    },
    modified: (parent: VersionedQuestion) => {
      return normaliseDateTime(parent.modified);
    }
  }
};

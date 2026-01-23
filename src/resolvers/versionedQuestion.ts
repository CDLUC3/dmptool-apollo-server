import { Resolvers } from "../types";
import { MyContext } from "../context";
import { VersionedQuestion } from "../models/VersionedQuestion";
import { Answer } from "../models/Answer";
import { AuthenticationError, ForbiddenError, InternalServerError } from "../utils/graphQLErrors";
import { VersionedQuestionCondition } from "../models/VersionedQuestionCondition";
import { prepareObjectForLogs } from "../logger";
import { isAuthorized } from "../services/authService";
import { GraphQLError } from "graphql";
import { normaliseDateTime } from "../utils/helpers";
import { VersionedTemplate } from "../models/VersionedTemplate";
import { Affiliation } from "../models/Affiliation";
import { Tag } from "../models/Tag";

// Define new output structure for the published questions including whether they have an answer
type VersionedQuestionWithFilled = VersionedQuestion & { hasAnswer: boolean };

export const resolvers: Resolvers = {
  Query: {
    // return all published questions for the specified versioned section
    publishedQuestions: async (_, { planId, versionedSectionId }, context: MyContext): Promise<VersionedQuestionWithFilled[]> => {
      const reference = 'publishedQuestionsWithAnsweredFlag resolver';
      try {
        if (isAuthorized(context.token)) {
          const questions = await VersionedQuestion.findByVersionedSectionId(reference, context, versionedSectionId);

          // Fetch answers for the questions
          const questionIds = questions.map(q => q.id);
          const answers = await Answer.findFilledAnswersByQuestionIds(reference, context, planId, questionIds);

          // Map the answers to the questions
          const answersMap = new Set(answers.map(a => a.versionedQuestionId));
          return questions.map(question => ({
            ...question,
            hasAnswer: answersMap.has(question.id),
          })) as VersionedQuestionWithFilled[];
        }
        // Unauthorized!
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
    sectionTags: async (parent: VersionedQuestion, _, context: MyContext): Promise<Tag[]> => {
      // Returns an array of Tag objects for the section this question belongs to
      return await Tag.findByVersionedSectionId(
        'VersionedQuestion.sectionTags resolver',
        context,
        parent.versionedSectionId
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

import { Resolvers } from "../types";
import { MyContext } from "../context";
import { QuestionCondition } from "../models/QuestionCondition";
import {
  NotFoundError,
  ForbiddenError,
  AuthenticationError,
  InternalServerError,
  BadRequestError,
  BAD_REQUEST_ERROR_CODE,
} from "../utils/graphQLErrors";
import { isAdmin } from "../services/authService";
import { hasPermissionOnQuestion } from "../services/questionService";
import { QuestionConditionGroup } from "../models/QuestionConditionGroup";
import { Question } from "../models/Question";
import { Template } from "../models/Template";
import { prepareObjectForLogs } from "../logger";
import { GraphQLError } from "graphql";
import { normaliseDateTime } from "../utils/helpers";


export const resolvers: Resolvers = {
  Query: {
    // Return the full display-logic tree (groups + their conditions) for the
    // specified question. Returns an empty array if no display logic is
    // configured — the client treats that as "no logic configured yet".
    questionConditionGroups: async (_, { questionId }, context: MyContext): Promise<QuestionConditionGroup[]> => {
      try {
        return await QuestionConditionGroup.findByQuestionId('questionConditionGroups resolver', context, questionId);
      } catch (err) {
        context.logger.error(prepareObjectForLogs(err), `Failure in questionConditionGroups resolver`);
        throw InternalServerError();
      }
    },
  },
  Mutation: {
    // Replace all display logic for a question in one transactional operation:
    // update the question's action/matchType, wipe its existing groups
    // (cascades to their conditions), then bulk-insert the new set.
    saveQuestionDisplayLogic: async (_, { input: {
      questionId,
      action,
      matchType,
      groups } }, context: MyContext): Promise<Question> => {

      const reference = 'saveQuestionDisplayLogic resolver';

      const question = await Question.findById(reference, context, questionId);
      if (!question) {
        throw NotFoundError('Question not found');
      }

      if (!isAdmin(context.token) || !(await hasPermissionOnQuestion(context, question.templateId))) {
        throw context?.token ? ForbiddenError() : AuthenticationError();
      }

      let updatedQuestion: Question = question;

      try {
        return await context.dataSources.sqlDataSource.withTransaction(context, async (): Promise<Question> => {
          question.displayLogicAction = action;
          question.displayLogicMatchType = matchType;
          question.isDirty = true;
          updatedQuestion = await question.update(context);
          if (updatedQuestion.hasErrors()) {
            throw BadRequestError();
          }

          const existingGroups = await QuestionConditionGroup.findByQuestionId(reference, context, questionId);
          for (const existing of existingGroups) {
            const toDelete = new QuestionConditionGroup({ ...existing });
            await toDelete.delete(context);
          }

          // Recreate the groups and their conditions from the input
          for (const groupInput of groups) {
            const group = new QuestionConditionGroup({
              questionId,
              triggerQuestionId: groupInput.triggerQuestionId,
            });
            const createdGroup = await group.create(context);

            if (createdGroup.hasErrors()) {
              updatedQuestion.addError('general', 'Unable to save one or more display logic groups');
              throw BadRequestError();
            }

            for (const conditionInput of groupInput.conditions) {
              const condition = new QuestionCondition({
                groupId: createdGroup.id,
                conditionType: conditionInput.conditionType,
                conditionMatch: conditionInput.conditionMatch,
              });

              const createdCondition = await condition.create(context);

              if (createdCondition.hasErrors()) {
                updatedQuestion.addError('general', 'Unable to save one or more display logic conditions');
                throw BadRequestError();
              }
            }
          }

          await Template.markTemplateAsDirty(reference, context, question.templateId);
          return await Question.findById(reference, context, questionId);
        });
      } catch (error) {
        if (error instanceof GraphQLError) {
          if (error.extensions?.code === BAD_REQUEST_ERROR_CODE) {
            if (updatedQuestion.hasErrors() && !updatedQuestion.errors['general']) {
              updatedQuestion.addError('general', 'Unable to process your request.');
            }
            return updatedQuestion;
          }
          throw error;
        }

        context.logger.error(prepareObjectForLogs(error), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Remove all display logic for a question: delete its groups (cascades
    // to conditions) and reset action/matchType to their column defaults.
    // Wrapped with a transaction to ensure that either all groups are deleted or none are.
    removeQuestionDisplayLogic: async (_, { questionId }, context: MyContext): Promise<boolean> => {
      const reference = 'removeQuestionDisplayLogic resolver';
      try {
        return await context.dataSources.sqlDataSource.withTransaction(context, async (): Promise<boolean> => {
          const question = await Question.findById(reference, context, questionId);
          if (!question) {
            throw NotFoundError('Question not found');
          }

          if (!isAdmin(context.token) || !(await hasPermissionOnQuestion(context, question.templateId))) {
            throw context?.token ? ForbiddenError() : AuthenticationError();
          }

          const existingGroups = await QuestionConditionGroup.findByQuestionId(reference, context, questionId);
          for (const existing of existingGroups) {
            const toDelete = new QuestionConditionGroup({ ...existing });
            const deleted = await toDelete.delete(context);
            if (!deleted) {
              throw InternalServerError();
            }
          }

          // Reset to defaults now that no groups remain
          question.displayLogicAction = 'SHOW_QUESTION';
          question.displayLogicMatchType = 'ANY';
          question.isDirty = true;
          const updated = await question.update(context);
          if (updated.hasErrors()) {
            throw InternalServerError();
          }

          await Template.markTemplateAsDirty(reference, context, question.templateId);
          return true;
        });
      } catch (err) {
        if (err instanceof GraphQLError) throw err;
        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },
  },
  QuestionConditionGroup: {
    triggerQuestion: async (parent: QuestionConditionGroup, _, context: MyContext) => {
      return await Question.findById('QuestionConditionGroup.triggerQuestion resolver', context, parent.triggerQuestionId);
    },
    conditions: async (parent: QuestionConditionGroup, _, context: MyContext) => {
      return await QuestionCondition.findByGroupId('QuestionConditionGroup.conditions resolver', context, parent.id);
    },
    created: (parent: QuestionConditionGroup) => normaliseDateTime(parent.created),
    modified: (parent: QuestionConditionGroup) => normaliseDateTime(parent.modified),
  },
  QuestionCondition: {
    created: (parent: QuestionCondition) => normaliseDateTime(parent.created),
    modified: (parent: QuestionCondition) => normaliseDateTime(parent.modified),
  }

};

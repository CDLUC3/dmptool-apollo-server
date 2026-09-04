import { Resolvers } from "../types.js";
import { MyContext } from "../context.js";
import { QuestionCondition } from "../models/QuestionCondition.js";
import {
  NotFoundError,
  ForbiddenError,
  AuthenticationError,
  InternalServerError,
  BadRequestError,
  BAD_REQUEST_ERROR_CODE,
} from "../utils/graphQLErrors.js";
import { isAdmin } from "../services/authService.js";
import { hasPermissionOnQuestion, extractTriggerQuestionOptionValues } from "../services/questionService.js";
import { QuestionConditionGroup } from "../models/QuestionConditionGroup.js";
import { Question } from "../models/Question.js";
import { Template } from "../models/Template.js";
import { prepareObjectForLogs } from "../logger.js";
import { GraphQLError } from "graphql";
import { normaliseDateTime } from "../utils/helpers.js";


export const resolvers: Resolvers = {
  Query: {
    // Return the QuestionConditionGroups (and their nested conditions via chained resolvers) for the specified question
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

      const priorQuestions = await Question.findPriorQuestionsForQuestion(
        `${reference}.priorQuestions`,
        context,
        questionId
      );
      const priorQuestionMap = new Map<number, Question>(
        priorQuestions.map((entry) => [entry.id, entry])
      );

      const addGeneralValidationError = (message: string): void => {
        const existingMessage = question.errors.general;
        question.addError(
          'general',
          existingMessage ? `${existingMessage}; ${message}` : message
        );
      };

      // Validate input semantics before persisting any mutations.
      groups.forEach((groupInput, groupIndex) => {
        const groupNumber = groupIndex + 1;

        if (!Array.isArray(groupInput.conditions) || groupInput.conditions.length < 1) {
          addGeneralValidationError(
            `Group ${groupNumber} must include at least one condition.`
          );
          return;
        }

        // Ensure that the trigger question is a prior question in the same template
        const triggerQuestion = priorQuestionMap.get(groupInput.triggerQuestionId);
        if (!triggerQuestion) {
          addGeneralValidationError(
            `Group ${groupNumber} trigger question must be a prior template question.`
          );
          return;
        }

        // Ensure that each condition's match value is one of the trigger question's selectable options
        const optionValues = extractTriggerQuestionOptionValues(triggerQuestion);
        if (optionValues.size < 1) {
          addGeneralValidationError(
            `Group ${groupNumber} trigger question has no selectable options.`
          );
          return;
        }

        // Validate each condition's match value against the trigger question's options
        groupInput.conditions.forEach((conditionInput, conditionIndex) => {
          const conditionNumber = conditionIndex + 1;
          if (!conditionInput.conditionMatch || !optionValues.has(conditionInput.conditionMatch)) {
            addGeneralValidationError(
              `Group ${groupNumber} condition ${conditionNumber} must match one of the trigger question options.`
            );
          }
        });
      });

      if (question.hasErrors()) {
        return question;
      }

      let updatedQuestion: Question = question;

      // Wrap the entire operation in a transaction so that either all changes are persisted or none are.
      try {
        return await context.dataSources.sqlDataSource.withTransaction(context, async (): Promise<Question> => {
          question.displayLogicAction = action;
          question.displayLogicMatchType = matchType;
          question.isDirty = true;
          updatedQuestion = await question.update(context);
          if (updatedQuestion.hasErrors()) {
            throw BadRequestError();
          }

          // Delete any existing groups (cascades to conditions) for the question
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

import { Resolvers } from "../types";
import { MyContext } from "../context";
import { QuestionCondition } from "../models/QuestionCondition";
import { NotFoundError, ForbiddenError, AuthenticationError, InternalServerError } from "../utils/graphQLErrors";
import { isAdmin } from "../services/authService";
import { hasPermissionOnQuestion } from "../services/questionService";
import { QuestionConditionGroup } from "../models/QuestionConditionGroup";
import { Question } from "../models/Question";
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
      try {
        const question = await Question.findById(reference, context, questionId);
        if (!question) {
          throw NotFoundError('Question not found');
        }

        if (!isAdmin(context.token) || !(await hasPermissionOnQuestion(context, question.templateId))) {
          throw context?.token ? ForbiddenError() : AuthenticationError();
        }

        // NOTE: wrap this whole block in your actual transaction helper —
        // e.g. context.dataSources.sqlDataSource.transaction(async (trx) => { ... })
        // Shown here without one since MySqlModel's transaction API isn't
        // visible to me; the sequence below MUST be atomic in production so a
        // partial failure can't leave a question with wiped groups and no
        // replacement, or mismatched action/matchType vs. groups.

        question.displayLogicAction = action;
        question.displayLogicMatchType = matchType;
        const updatedQuestion = await question.update(context);
        if (updatedQuestion.hasErrors()) {
          return updatedQuestion;
        }

        // Wipe existing groups — cascades to their conditions via FK
        const existingGroups = await QuestionConditionGroup.findByQuestionId(reference, context, questionId);
        for (const existing of existingGroups) {
          const toDelete = new QuestionConditionGroup({ ...existing });
          await toDelete.delete(context);
        }

        console.log("***Groups to create: ", groups);
        // Recreate groups + conditions from the incoming payload
        for (const groupInput of groups) {

          const group = new QuestionConditionGroup({
            questionId,
            triggerQuestionId: groupInput.triggerQuestionId,
          });
          const createdGroup = await group.create(context);

          if (createdGroup.hasErrors()) {
            // Bail out — see transaction note above; without a real
            // transaction this can leave a partially-saved set of groups.
            updatedQuestion.addError('general', 'Unable to save one or more display logic groups');
            return updatedQuestion;
          }

          console.log("***Group Input conditions: ", groupInput.conditions);
          for (const conditionInput of groupInput.conditions) {
            const condition = new QuestionCondition({
              groupId: createdGroup.id,
              conditionType: conditionInput.conditionType,
              conditionMatch: conditionInput.conditionMatch,
            });

            console.log("***Condition before create - groupId:", createdGroup.id, "condition:", condition);
            const createdCondition = await condition.create(context);
            console.log("***Created condition result:", createdCondition, "hasErrors:", createdCondition.hasErrors(), "errors:", createdCondition.errors);

            if (createdCondition.hasErrors()) {
              updatedQuestion.addError('general', 'Unable to save one or more display logic conditions');
              return updatedQuestion;
            }
          }
        }

        return await Question.findById(reference, context, questionId);
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Remove all display logic for a question: delete its groups (cascades
    // to conditions) and reset action/matchType to their column defaults.
    removeQuestionDisplayLogic: async (_, { questionId }, context: MyContext): Promise<boolean> => {
      const reference = 'removeQuestionDisplayLogic resolver';
      try {
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
            return false;
          }
        }

        // Reset to defaults now that no groups remain
        question.displayLogicAction = 'SHOW_QUESTION';
        question.displayLogicMatchType = 'ANY';
        const updated = await question.update(context);
        return !updated.hasErrors();
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

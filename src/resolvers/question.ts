import { ReorderQuestionsResult, Resolvers } from "../types.js";
import { MyContext } from "../context.js";
import { Question } from "../models/Question.js";
import { Template } from "../models/Template.js";
import { QuestionConditionGroup } from "../models/QuestionConditionGroup.js";
import {
  findQuestionMoveConflicts,
  findQuestionOptionConflicts,
  findQuestionRemoveConflicts,
  lockQuestionTemplate,
  updateDisplayOrders,
  questionSupportsSelectableOptions
} from "../services/questionService.js";
import {
  AuthenticationError,
  BadRequestError,
  ForbiddenError,
  InternalServerError,
  NotFoundError
} from "../utils/graphQLErrors.js";
import { Tag } from "../models/Tag.js";
import { prepareObjectForLogs } from "../logger.js";
import { isAdmin, isAuthorized } from "../services/authService.js";
import { hasPermissionOnSection } from "../services/sectionService.js";
import { GraphQLError } from "graphql";
import { normaliseDateTime } from "../utils/helpers.js";


export const resolvers: Resolvers = {
  Query: {
    // return all of the questions for the specified section
    questions: async (_, { sectionId }, context: MyContext): Promise<Question[]> => {
      const reference = 'questions resolver';
      try {
        if (isAuthorized(context.token)) {
          return await Question.findBySectionId(reference, context, sectionId);
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // return a specific question
    question: async (_, { questionId }, context: MyContext): Promise<Question> => {
      const reference = 'question resolver';
      try {
        if (isAuthorized(context.token)) {
          return await Question.findById(reference, context, questionId);
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // return all prior questions in the template that can be used as
    // display-logic triggers for the specified question
    triggerQuestionsForQuestion: async (_, { questionId }, context: MyContext): Promise<Question[]> => {
      const reference = 'triggerQuestionsForQuestion resolver';
      try {
        if (!isAuthorized(context.token)) {
          throw context?.token ? ForbiddenError() : AuthenticationError();
        }

        const targetQuestion = await Question.findById(reference, context, questionId);
        if (!targetQuestion) {
          throw NotFoundError('Question not found');
        }

        const priorQuestions = await Question.findPriorQuestionsForQuestion(
          reference,
          context,
          questionId
        );

        return priorQuestions.filter(questionSupportsSelectableOptions);
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    }
  },
  Mutation: {
    // add a new question
    addQuestion: async (_, { input: {
      templateId,
      sectionId,
      displayOrder,
      isDirty,
      json,
      questionText,
      requirementText,
      guidanceText,
      sampleText,
      useSampleTextAsDefault,
      required,
      tags,
    } }, context: MyContext): Promise<Question> => {

      const reference = 'addQuestion resolver';
      try {
        // if the user is an admin and has permission on the section
        if (isAdmin(context.token) && await hasPermissionOnSection(context, templateId)) {
          const question = new Question({
            templateId,
            sectionId,
            displayOrder,
            isDirty,
            json,
            questionText,
            requirementText,
            guidanceText,
            sampleText,
            useSampleTextAsDefault,
            required
          });

          // create the new question
          const newQuestion = await question.create(context);

          if (!newQuestion?.id) {
            // A null was returned so add a generic error and return it
            if (!question.errors['general']) {
              question.addError('general', 'Unable to create Question');
            }
            return question;
          }

          if (newQuestion && !newQuestion.hasErrors()) {
            const questionId = newQuestion.id;
            // Update the associated template to set isDirty=1
            await Template.markTemplateAsDirty('Question resolver - addQuestion', context, templateId);

            // Add any new Tags provided in the request
            const addTagErrors = [];
            if (Array.isArray(tags) && tags.length > 0) {
              for (const item of tags) {
                const tag = await Tag.findById(reference, context, item.id);

                if (!tag) {
                  addTagErrors.push(`Tag ${item.id} not found`);
                }

                const wasAdded = await tag.addToQuestion(context, questionId);
                if (!wasAdded) {
                  addTagErrors.push(tag.name);
                }

              }
            }

            if (addTagErrors.length > 0) {
              newQuestion.addError('tags', `Saved but we were unable to assign tags: ${addTagErrors.join(', ')}`);
            }

            // Return newly created section with tags
            return newQuestion.hasErrors() ? newQuestion : await Question.findById(reference, context, newQuestion.id);
          }
          // Otherwise it had errors so return it as-is
          return newQuestion;
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // update an existing question
    updateQuestion: async (_, { input: {
      questionId,
      displayOrder,
      json,
      questionText,
      requirementText,
      guidanceText,
      sampleText,
      useSampleTextAsDefault,
      required,
      tags
    } }, context: MyContext): Promise<Question> => {
      const reference = 'updateQuestion resolver';
      try {
        // Get Question based on provided questionId
        const questionData = await Question.findById(reference, context, questionId);

        // Throw Not Found error if Question is not found
        if (!questionData) {
          throw NotFoundError('Question not found');
        }

        // Check that user has permission to update this question
        if (isAdmin(context.token) && await hasPermissionOnSection(context, questionData.templateId)) {
          let updatedQuestion: Question | null = null;
          await context.dataSources.sqlDataSource.withTransaction(context, async () => {
            await lockQuestionTemplate(context, questionData.templateId);
            const currentQuestionData = await Question.findById(reference, context, questionId);
            if (!currentQuestionData) {
              throw NotFoundError('Question not found');
            }

            const question = new Question({
              id: questionId,
              sectionId: currentQuestionData.sectionId,
              templateId: currentQuestionData.templateId,
              createdById: currentQuestionData.createdById,
              displayOrder: displayOrder ?? currentQuestionData.displayOrder,
              json: json ?? currentQuestionData.json,
              questionText: questionText,
              requirementText: requirementText,
              guidanceText: guidanceText,
              sampleText: sampleText,
              useSampleTextAsDefault: useSampleTextAsDefault,
              required: required,
              isDirty: currentQuestionData.isDirty
            });

            // Removing or renaming an option that another question's display logic matches, or changing to a
            // question type without options, would silently break that display logic, so don't allow it.
            const conflicts = await findQuestionOptionConflicts(
              context,
              currentQuestionData,
              json ?? currentQuestionData.json
            );
            if (conflicts.length > 0) {
              question.addError('json', 'Your changes were not saved. One or more of this question\'s options are used in the display logic of another question. Remove that display logic condition before removing or renaming the option, or changing the question type.');
              updatedQuestion = question;
              return;
            }

            updatedQuestion = await question.update(context);
          });

          if (updatedQuestion && !updatedQuestion.hasErrors()) {
            // Update the associated template to set isDirty=1
            await Template.markTemplateAsDirty('Question resolver - updateQuestion', context, questionData.templateId);

            // Get current tags for the question
            const currentTags = await Tag.findByQuestionId(reference, context, questionData.id);
            const currentTagIds = currentTags.map((tag) => tag.id);

            // Use the helper function to determine which Tags to keep and which to remove
            const { idsToBeRemoved, idsToBeSaved } = Question.reconcileAssociationIds(
              currentTagIds,
              tags ? (tags as Tag[]).map((d) => d.id) : []
            );

            // Delete any Tag associations that were removed
            const removeTagErrors = [];
            for (const id of idsToBeRemoved) {
              const tag = await Tag.findById(reference, context, id as number);
              if (tag) {
                const wasRemoved = await tag.removeFromQuestion(context, updatedQuestion.id);
                if (!wasRemoved) {
                  removeTagErrors.push(tag.name);
                }
              }
            }
            // if any errors were found when adding/removing tags then return them
            if (removeTagErrors.length > 0) {
              updatedQuestion.addError('tags', `Saved but we were unable to remove tags: ${removeTagErrors.join(', ')}`);
            }

            // Add any new Tag associations
            const addTagErrors = [];
            for (const id of idsToBeSaved) {
              const tag = await Tag.findById(reference, context, id as number);
              if (tag) {
                const wasAdded = await tag.addToQuestion(context, updatedQuestion.id);
                if (!wasAdded) {
                  addTagErrors.push(tag.name);
                }
              }
            }
            if (addTagErrors.length > 0) {
              updatedQuestion.addError('tags', `Saved but we were unable to assign tags: ${addTagErrors.join(', ')}`);
            }

            // Refetch the question or the updated question with errors
            const final = await Question.findById(reference, context, questionId);

            return final;
          }

          // Otherwise return the Question with errors
          return updatedQuestion;
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Change the section's display order
    updateQuestionDisplayOrder: async (
      _,
      { questionId, newDisplayOrder },
      context: MyContext
    ): Promise<ReorderQuestionsResult> => {
      const reference = 'updateQuestionDisplayOrder resolver';
      try {
        if (isAdmin(context.token)) {
          // Find the question that is being repositioned
          const question = await Question.findById(reference, context, questionId);

          if (!question) {
            throw NotFoundError();
          }

          // Check that the new display order has actually changed
          if (question.displayOrder === newDisplayOrder) {
            throw BadRequestError('The new display order is the same as the current one');
          }

          // Check that user has permission to update this question
          if (await hasPermissionOnSection(context, question.templateId)) {
            try {
              const reordered = await context.dataSources.sqlDataSource.withTransaction(
                context,
                async () => {
                  await lockQuestionTemplate(context, question.templateId);
                  const currentQuestion = await Question.findById(reference, context, questionId);
                  if (!currentQuestion) {
                    throw NotFoundError();
                  }

                  if (currentQuestion.displayOrder === newDisplayOrder) {
                    throw BadRequestError('The new display order is the same as the current one');
                  }

                  // Display logic can only be triggered by prior questions, so don't allow a move that would
                  // put a question above one of its trigger questions
                  const conflicts = await findQuestionMoveConflicts(
                    context,
                    currentQuestion.sectionId,
                    questionId,
                    newDisplayOrder
                  );
                  if (conflicts.length > 0) {
                    return null;
                  }

                  // Reorder the sections
                  const updated = await updateDisplayOrders(
                    context,
                    currentQuestion.sectionId,
                    questionId,
                    newDisplayOrder
                  );

                  // Update the associated template to set isDirty=1
                  await Template.markTemplateAsDirty(
                    'Question resolver - updateQuestionDisplayOrder',
                    context,
                    currentQuestion.templateId
                  );

                  return updated;
                }
              );

              if (reordered === null) {
                return {
                  questions: [],
                  errors: {
                    general: 'This question is used in display logic. Remove the display logic condition before moving it so that the trigger question stays before the question it controls.'
                  }
                };
              }

              return { questions: reordered ?? [] };

            } catch (err) {
              context.logger.error(prepareObjectForLogs(err), `${reference} failed: questionId: ${questionId}`);
              return { questions: [], errors: { general: err.message } };
            }
          }
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // remove a question
    removeQuestion: async (_, { questionId }, context: MyContext): Promise<Question> => {
      const reference = 'removeQuestion resolver';
      try {
        // Retrieve existing Question
        const questionData = await Question.findById(reference, context, questionId);

        // Throw Not Found error if Question is not found
        if (!questionData) {
          throw NotFoundError('Question not found');
        }

        // if the user is an admin and has permission on the section
        if (isAdmin(context.token) && await hasPermissionOnSection(context, questionData.templateId)) {
          return await context.dataSources.sqlDataSource.withTransaction(
            context,
            async () => {
              await lockQuestionTemplate(context, questionData.templateId);
              const currentQuestion = await Question.findById(reference, context, questionId);
              if (!currentQuestion) {
                throw NotFoundError('Question not found');
              }

              //Need to create a new instance of Question so that it recognizes the 'delete' function of that instance
              const question = new Question({ ...currentQuestion, id: questionId });

              // Deleting the question would also delete the display logic of any questions it triggers, so don't
              // allow it until that display logic is removed
              const conflicts = await findQuestionRemoveConflicts(context, questionId);
              if (conflicts.length > 0) {
                question.addError('general', 'This question is a trigger question in the display logic of another question. Remove that display logic condition before deleting this question.');
                return question;
              }

              // Update the associated template to set isDirty=1
              await Template.markTemplateAsDirty('Question resolver - removeQuestion', context, currentQuestion.templateId);

              // The delete will also delete all associated questionOptions
              return await question.delete(context);
            }
          );

        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    }
  },

  Question: {
    // Chained resolver to fetch the Tag info
    tags: async (parent: Question, _, context: MyContext): Promise<Tag[]> => {
      return await Tag.findByQuestionId('Chained Question.tags', context, parent.id);
    },
    conditionGroups: async (parent: Question, _, context: MyContext): Promise<QuestionConditionGroup[]> => {
      return await QuestionConditionGroup.findByQuestionId(
        'Chained Question.conditionGroups',
        context,
        parent.id
      );
    },
    created: (parent: Question) => {
      return normaliseDateTime(parent.created);
    },
    modified: (parent: Question) => {
      return normaliseDateTime(parent.modified);
    }
  }
};

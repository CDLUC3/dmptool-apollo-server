import { GraphQLError } from "graphql";
import { MyContext } from "../context";
import { Plan } from "../models/Plan";
import { prepareObjectForLogs } from "../logger";
import {
  AuthenticationError,
  ForbiddenError,
  InternalServerError,
  NotFoundError
} from "../utils/graphQLErrors";
import { isAuthorized } from "../services/authService";
import { sendProjectCollaboratorsCommentsAddedEmail } from '../services/emailService';
import { canDeleteComment } from "../services/commentPermissions";
import { Resolvers } from "../types";
import { Answer } from "../models/Answer";
import { VersionedQuestion } from "../models/VersionedQuestion";
import { VersionedSection } from "../models/VersionedSection";
import { AnswerComment } from "../models/AnswerComment";
import { ProjectCollaborator, ProjectCollaboratorAccessLevel } from "../models/Collaborator";
import { User } from "../models/User";
import { PlanFeedbackComment } from "../models/PlanFeedbackComment";
import { normaliseDateTime } from "../utils/helpers";
import { hasPermissionOnProject } from "../services/projectService";
import { Project } from "../models/Project";
import { saveMaDMPVersion } from "../services/planService";


export const resolvers: Resolvers = {
  Query: {
    // return all of the answers for the given plan
    answers: async (_, { planId, versionedSectionId }, context: MyContext): Promise<Answer[]> => {
      const reference = 'planSectionAnswers resolver';
      try {
        if (isAuthorized(context.token)) {
          const plan = await Plan.findById(reference, context, planId);
          if (!plan) {
            throw NotFoundError(`Plan with ID ${planId} not found`);
          }
          const project = await Project.findById(reference, context, plan.projectId);
          if (await hasPermissionOnProject(context, project)) {
            return await Answer.findByPlanIdAndVersionedSectionId(reference, context, planId, versionedSectionId);
          }
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // return the answer for the given versionedQuestionId
    answerByVersionedQuestionId: async (_, { planId, versionedQuestionId }, context: MyContext): Promise<Answer> => {
      const reference = 'planSectionAnswers resolver';
      try {
        if (isAuthorized(context.token)) {
          const plan = await Plan.findById(reference, context, planId);
          if (!plan) {
            throw NotFoundError(`Plan with ID ${planId} not found`);
          }
          const project = await Project.findById(reference, context, plan.projectId);
          if (await hasPermissionOnProject(context, project, ProjectCollaboratorAccessLevel.COMMENT)) {
            const temp = await Answer.findByPlanIdAndVersionedQuestionId(reference, context, planId, versionedQuestionId);
            return temp;
          }
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Find the answer by its answerId
    answer: async (_, { answerId }, context: MyContext): Promise<Answer> => {
      const reference = 'plan resolver';
      try {
        const answer = await Answer.findById(reference, context, answerId);
        if (!answer) {
          throw NotFoundError(`Answer with ID: ${answerId} not found`);
        }

        const plan = await Plan.findById(reference, context, answer.planId);
        const project = await Project.findById(reference, context, plan.projectId);

        if (project && await hasPermissionOnProject(context, project, ProjectCollaboratorAccessLevel.COMMENT)) {
          return await Answer.findById(reference, context, answerId);
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },
  },

  Mutation: {
    // Create a new answer
    addAnswer: async (_, { planId, versionedSectionId, versionedQuestionId, json }, context: MyContext): Promise<Answer> => {
      const reference = 'addAnswer resolver';
      try {
        if (isAuthorized(context.token)) {
          const plan = await Plan.findById(reference, context, planId);
          if (!plan) {
            throw NotFoundError(`Plan with ID ${planId} not found`);
          }

          const project = await Project.findById(reference, context, plan.projectId);
          if (await hasPermissionOnProject(context, project)) {
            const answer = new Answer({ planId, versionedSectionId, versionedQuestionId, json });
            const newAnswer = await answer.create(context);
            if (newAnswer && !newAnswer.hasErrors()) {
              // Update the maDMP version of the Plan
              await saveMaDMPVersion(reference, context, plan.id, plan.registered);
            }
            return newAnswer;
          }
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Delete an answer
    updateAnswer: async (_, { answerId, json }, context: MyContext): Promise<Answer> => {
      const reference = 'updateAnswer resolver';
      try {
        if (isAuthorized(context.token)) {
          const answer = await Answer.findById(reference, context, answerId);
          if (!answer) {
            throw NotFoundError(`Answer with ID ${answerId} not found`);
          }
          const plan = await Plan.findById(reference, context, answer.planId);
          if (!plan) {
            throw NotFoundError(`Plan ${answer.planId} not found`);
          }
          const project = await Project.findById(reference, context, plan.projectId);
          if (await hasPermissionOnProject(context, project)) {
            answer.json = json;
            const updatedAnswer = await answer.update(context);

            if (updatedAnswer && !updatedAnswer.hasErrors()) {
              // Update the maDMP version of the Plan
              await saveMaDMPVersion(reference, context, plan.id, plan.registered);
            }

            return updatedAnswer;
          }
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },
    // Add answer comment
    addAnswerComment: async (_, { answerId, commentText }, context: MyContext): Promise<AnswerComment> => {
      const reference = 'addAnswerComment resolver';
      try {
        if (isAuthorized(context.token)) {
          const answer = await Answer.findById(reference, context, answerId);
          if (!answer) {
            throw NotFoundError(`Answer with ID ${answerId} not found`);
          }
          const plan = await Plan.findById(reference, context, answer.planId);
          if (!plan) {
            throw NotFoundError(`Plan ${answer.planId} not found`);
          }
          const project = await Project.findById(reference, context, plan.projectId);
          if (await hasPermissionOnProject(context, project, ProjectCollaboratorAccessLevel.COMMENT)) {
            // Send out email to project collaborators to let them know that comments were added
            // Get project collaborators emails, minus the user's own email
            const collaborators = await ProjectCollaborator.findByProjectId(reference, context, plan.projectId);
            // Filter out the user's own email if it exists in the collaborators list
            const collaboratorEmails = collaborators.map(c => c.email).filter(email => email !== context.token.email);

            // Send emails to
            await sendProjectCollaboratorsCommentsAddedEmail(context, collaboratorEmails);

            //Return answerComment response
            const answerComment = new AnswerComment({ answerId, commentText });
            return await answerComment.create(context);
          }
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },
    // Update answer comment
    updateAnswerComment: async (_, { answerCommentId, answerId, commentText }, context: MyContext): Promise<AnswerComment> => {
      const reference = 'updateAnswerComment resolver';
      try {

        if (isAuthorized(context.token)) {
          const answer = await Answer.findById(reference, context, answerId);

          if (!answer) {
            throw NotFoundError(`Answer with ID ${answerId} not found`);
          }

          const plan = await Plan.findById(reference, context, answer.planId);
          if (!plan) {
            throw NotFoundError(`Plan ${answer.planId} not found`);
          }

          const project = await Project.findById(reference, context, plan.projectId);
          if (await hasPermissionOnProject(context, project, ProjectCollaboratorAccessLevel.COMMENT)) {
            const answerComment = await AnswerComment.findById(reference, context, answerCommentId);

            if (!answerComment) {
              throw NotFoundError(`Answer comment ${answerCommentId} not found`);
            }

            // Only user who added the comment can update it
            if (answerComment.createdById === context.token.id) {
              answerComment.commentText = commentText;
              return await answerComment.update(context);
            }

            throw ForbiddenError(`Inadequate permission to update answer comment ${answerComment.id}`)

          }
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },
    // Remove answer comment
    removeAnswerComment: async (_, { answerCommentId, answerId }, context: MyContext): Promise<AnswerComment> => {
      const reference = 'removeAnswerComment resolver';
      try {
        if (isAuthorized(context.token)) {
          const answer = await Answer.findById(reference, context, answerId);

          if (!answer) {
            throw NotFoundError(`Answer with ID ${answerId} not found`);
          }

          const plan = await Plan.findById(reference, context, answer.planId);
          if (!plan) {
            throw NotFoundError(`Plan ${answer.planId} not found`);
          }

          const project = await Project.findById(reference, context, plan.projectId);
          if (await hasPermissionOnProject(context, project, ProjectCollaboratorAccessLevel.COMMENT)) {
            const answerComment = await AnswerComment.findById(reference, context, answerCommentId);

            if (!answerComment) {
              throw NotFoundError(`Answer comment ${answerCommentId} not found`);
            }
            // Get project collaborators emails, minus the user's own email
            const collaborators = await ProjectCollaborator.findByProjectId(reference, context, plan.projectId);

            // Allow deletion by comment creator, plan creator, or OWN-level collaborator
            if (canDeleteComment({
              commentCreatedById: answerComment.createdById,
              planCreatedById: plan.createdById,
              userId: context.token.id,
              collaborators
            })) {
              // Delete the comment
              return await answerComment.delete(context);
            }

            throw ForbiddenError(`Inadequate permission to delete answer comment ${answerComment.id}`)

          }
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },
  },

  Answer: {
    // The plan the answer is associated with
    plan: async (parent: Answer, _, context: MyContext): Promise<Plan> => {
      if (parent?.planId) {
        return await Plan.findById('Answer plan resolver', context, parent.planId);
      }
      return null;
    },
    // The section the answer's question belongs to
    versionedSection: async (parent: Answer, _, context: MyContext): Promise<VersionedSection> => {
      if (parent?.versionedSectionId) {
        return await VersionedSection.findById('Answer versionedSection resolver', context, parent.versionedSectionId);
      }
      return null;
    },
    // The question the answer is associated with
    versionedQuestion: async (parent: Answer, _, context: MyContext): Promise<VersionedQuestion> => {
      if (parent?.versionedQuestionId) {
        return await VersionedQuestion.findById('Answer versionedQuestion resolver', context, parent.versionedQuestionId);
      }
      return null;
    },
    // The comments associated with the answer
    comments: async (parent: Answer, _, context: MyContext): Promise<AnswerComment[]> => {
      if (parent?.id) {
        return await AnswerComment.findByAnswerId('Answer comments resolver', context, parent.id);
      }
      return [];
    },
    //Feedback comments associated with answer
    feedbackComments: async (parent: PlanFeedbackComment, _, context: MyContext): Promise<PlanFeedbackComment[]> => {
      if (parent?.id) {
        return await PlanFeedbackComment.findByAnswerId('Answer feedbackComemnts resolver', context, parent.id);
      }
      return [];
    },
    created: (parent: Answer) => {
      return normaliseDateTime(parent.created);
    },
    modified: (parent: Answer) => {
      return normaliseDateTime(parent.modified);
    }
  },
  AnswerComment: {
    // Resolver to get the user who created the comment
    user: async (parent: AnswerComment, _, context: MyContext): Promise<User> => {
      if (parent?.createdById) {
        return await User.findById('AnswerComment user resolver', context, parent.createdById);
      }
      return null;
    },
  }
}

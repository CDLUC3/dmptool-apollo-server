import { GraphQLError } from "graphql";
import { MyContext } from "../context";
import { prepareObjectForLogs } from "../logger";
import {
  AuthenticationError,
  ForbiddenError,
  InternalServerError,
  NotFoundError
} from "../utils/graphQLErrors";

import { isAuthorized } from "../services/authService";
import { hasPermissionOnProject } from "../services/projectService";
import {
  sendProjectCollaboratorsCommentsAddedEmail,
  sendFeedbackRequestEmail,
  sendFeedbackCompleteEmail
} from '../services/emailService';
import { isAdmin, isSuperAdmin } from "../services/authService";
import { canDeleteComment } from "../services/commentPermissions";
import { Project } from "../models/Project";
import { Plan } from "../models/Plan";
import { PlanFeedback } from "../models/PlanFeedback";
import { User } from "../models/User";
import { ProjectCollaborator, ProjectCollaboratorAccessLevel } from "../models/Collaborator";
import { PlanFeedbackComment } from "../models/PlanFeedbackComment";
import { VersionedTemplate } from "../models/VersionedTemplate";
import { Affiliation } from "../models/Affiliation";
import { ResolversParentTypes } from "../types";
import { Resolvers, PlanFeedbackStatus } from "../types";
import { getCurrentDate } from "../utils/helpers";

type PlanFeedbackParent = ResolversParentTypes['PlanFeedback'] & {
  requestedById?: number;
  completedById?: number;
};


export const resolvers: Resolvers = {
  Query: {
    // return all rounds of admin feedback for the plan
    planFeedback: async (_, { planId }, context: MyContext): Promise<PlanFeedback[]> => {
      const reference = 'feedback resolver';
      try {
        // if the user is an admin
        if (isAdmin(context.token)) {
          // Check to see if planId exists in our records
          const plan = await Plan.findById(reference, context, planId);
          if (!plan) {
            throw NotFoundError(`Plan with ID ${planId} not found`);
          }

          // Get versionedTemplate associated with the plan
          const versionedTemplate = await VersionedTemplate.findById(reference, context, plan.versionedTemplateId);

          // If the user is a superAdmin or an admin for the same affiliation
          if (isSuperAdmin(context.token) || (isAdmin(context.token) && context.token.affiliationId === versionedTemplate.ownerId)) {

            // Check that user has permissions to access feedback
            const projectId = plan.projectId;
            const project = await Project.findById(reference, context, projectId);
            if (!project) {
              throw NotFoundError(`Project with ID ${projectId} not found`);
            }
            if (await hasPermissionOnProject(context, project)) {
              return await PlanFeedback.findByPlanId(reference, context, planId);
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

    // Get all of the comments associated with the round of admin feedback
    planFeedbackComments: async (_, { planId, planFeedbackId }, context: MyContext): Promise<PlanFeedbackComment[]> => {
      const reference = 'feedback resolver';
      try {
        if (isAuthorized(context.token)) {
          // Check to see if planId exists in our records
          const plan = await Plan.findById(reference, context, planId);
          if (!plan) {
            throw NotFoundError(`Plan with ID ${planId} not found`);
          }

          // Check that user has permissions to access feedback
          const projectId = plan.projectId;
          const project = await Project.findById(reference, context, projectId);
          if (!project) {
            throw NotFoundError(`Project with ID ${projectId} not found`);
          }
          if (await hasPermissionOnProject(context, project)) {
            return await PlanFeedbackComment.findByFeedbackId(reference, context, planFeedbackId);
          }
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Get the current feedback status for a plan
    planFeedbackStatus: async (_, { planId }, context: MyContext): Promise<PlanFeedbackStatus> => {
      const reference = 'planFeedbackStatus resolver';
      try {
        // Check to see if planId exists in our records
        const plan = await Plan.findById(reference, context, planId);
        if (!plan) {
          throw NotFoundError(`Plan with ID ${planId} not found`);
        }

        if (!plan.createdById) {
          throw NotFoundError(`Plan with ID ${planId} has no creator`);
        }

        // Fetch the plan creator to compare affiliations
        const planCreator = await User.findById(reference, context, plan.createdById);
        if (!planCreator) {
          throw NotFoundError(`User who created plan ${planId} not found`);
        }

        const projectId = plan.projectId;
        const project = await Project.findById(reference, context, projectId);
        if (!project) {
          throw NotFoundError(`Project with ID ${projectId} not found`);
        }
        if (await hasPermissionOnProject(context, project)) {
          return await PlanFeedback.statusForPlan(reference, context, planId);
        }


        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    }
  },

  Mutation: {
    //Request a round of admin feedback
    requestFeedback: async (_, { planId, messageToOrg }, context: MyContext): Promise<PlanFeedback | null> => {
      const reference = 'requestFeedback resolver';

      try {
        if (isAuthorized(context.token)) {
          const plan = await Plan.findById(reference, context, planId);
          if (!plan) {
            throw NotFoundError(`Plan with ID ${planId} not found`);
          }
          const project = await Project.findById(reference, context, plan.projectId);
          if (!project) {
            throw NotFoundError(`Project with ID ${plan.projectId} not found`);
          }

          // Get existing feedback for the given planId
          const existingFeedback = await PlanFeedback.findByPlanId(
            reference,
            context,
            planId,
          );

          // If there is already an active feedback round, then do not allow creation of a new one
          const hasOpenFeedback = existingFeedback.some(
            (fb) => fb.completed === null
          );

          if (hasOpenFeedback) {
            throw ForbiddenError(`There is already feedback in progress for plan ${planId}`);
          }

          //Feedback request can only be made by ADMINs and SUPERADMINs or a collaborator with PRIMARY access
          if (await hasPermissionOnProject(context, project, ProjectCollaboratorAccessLevel.PRIMARY)) {
            const feedbackComment = new PlanFeedback({
              planId,
              messageToOrg: messageToOrg ?? '',
              requestedById: context.token.id,
              requested: getCurrentDate()
            });

            const affiliationId = context.token.affiliationId;
            if (!affiliationId) {
              throw NotFoundError(`Affiliation for user not found`);
            }

            const affiliation = await Affiliation.findByURI(reference, context, affiliationId);

            if (affiliation.feedbackEmails.length === 0) {
              context.logger.warn(prepareObjectForLogs({ affiliationId }), `Affiliation with ID ${affiliationId} has no feedback emails configured, so no notifications will be sent when requesting feedback`);
            }

            const planURL = `/projects/${project.id}/dmp/${planId}`;
            const planOwnerName = [context.token.givenName, context.token.surname].filter(Boolean).join(' ');
            const planTitle = plan.title || 'Untitled Plan';

            // Send emails to the feedback recipients
            await sendFeedbackRequestEmail(context, planOwnerName, planURL, planTitle, affiliation.feedbackEmails, messageToOrg ?? '');

            return await feedbackComment.create(context);
          }
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },
    // Mark the feedback round as complete
    completeFeedback: async (_, { planId, planFeedbackId, summaryText, sendEmail = true }, context: MyContext): Promise<PlanFeedback> => {
      const reference = 'completeFeedback resolver';
      try {
        if (isAuthorized(context.token)) {
          const plan = await Plan.findById(reference, context, planId);
          if (!plan) {
            throw NotFoundError(`Plan with ID ${planId} not found`);
          }
          const project = await Project.findById(reference, context, plan.projectId);
          if (!project) {
            throw NotFoundError(`Project with ID ${plan.projectId} not found`);
          }

          if (await hasPermissionOnProject(context, project)) {
            const feedback = await PlanFeedback.findById(reference, context, planFeedbackId);
            if (!feedback) {
              throw NotFoundError(`PlanFeedback with ID ${planFeedbackId} not found`);
            }

            const newFeedback = new PlanFeedback({
              id: feedback.id,
              planId: feedback.planId,
              requested: feedback.requested,
              requestedById: feedback.requestedById,
              completedById: context.token.id,
              completed: getCurrentDate(),
              summaryText: summaryText ?? ''
            });

            const updatedFeedback = await newFeedback.update(context);
            if (!updatedFeedback) {
              throw NotFoundError(`PlanFeedback with ID ${planFeedbackId} not found`);
            }

            if (sendEmail) {
              const planURL = `/projects/${project.id}/dmp/${planId}`;
              const adminName = [context.token.givenName, context.token.surName]
                .filter(Boolean).join(' ');

              await sendFeedbackCompleteEmail(
                context,
                feedback.requestedById,
                adminName,
                plan.title,
                planURL,
              );
            }

            return updatedFeedback;

          }
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },
    // Add feedback comment to an answer within a round of feedback
    addFeedbackComment: async (_, { planId, planFeedbackId, answerId, commentText }, context: MyContext): Promise<PlanFeedbackComment> => {
      const reference = 'addFeedbackComment resolver';
      try {
        // All collaborators can always submit feedback comments, but org admins/superadmins can only submit feedback comments when feedback is open
        const plan = await Plan.findById(reference, context, planId);
        if (!plan) throw NotFoundError(`Plan with ID ${planId} not found`);

        const project = await Project.findById(reference, context, plan.projectId);
        if (!project?.id) throw NotFoundError(`Project with ID ${plan.projectId} not found`);

        const primaryCollaborator = await ProjectCollaborator.findPrimaryUserByProjectId(reference, context, project.id);

        const isCollaborator = await hasPermissionOnProject(context, project, ProjectCollaboratorAccessLevel.COMMENT);
        const isAdminOfSameOrg = isSuperAdmin(context.token) || (isAdmin(context.token) && context.token.affiliationId === primaryCollaborator.affiliationId);

        if (!isCollaborator && !isAdminOfSameOrg) {
          throw context?.token ? ForbiddenError() : AuthenticationError();
        }

        // Admins/superadmins who are not collaborators can only comment when feedback is open
        if (!isCollaborator && isAdminOfSameOrg) {
          const feedback = await PlanFeedback.findById(reference, context, planFeedbackId);
          if (!feedback) throw NotFoundError(`Feedback with ID ${planFeedbackId} not found`);

          if (!feedback.requested || feedback.completed !== null) {
            throw ForbiddenError(`Feedback with ID ${planFeedbackId} is not requested or is already completed`);
          }
        }

        // Notify collaborators (excluding the commenter) that a comment was added
        const collaborators = await ProjectCollaborator.findByProjectId(reference, context, project.id);
        const collaboratorEmails = collaborators.map(c => c.email).filter(email => email !== context.token.email);
        await sendProjectCollaboratorsCommentsAddedEmail(context, collaboratorEmails);

        const feedbackComment = new PlanFeedbackComment({ answerId, feedbackId: planFeedbackId, commentText });
        return await feedbackComment.create(context);

      } catch (err) {
        if (err instanceof GraphQLError) throw err;
        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },
    // Update feedback comment for an answer within a round of feedback
    updateFeedbackComment: async (_, { planId, planFeedbackCommentId, commentText }, context: MyContext): Promise<PlanFeedbackComment> => {
      const reference = 'updateFeedbackComment resolver';
      console.log("***Updating feedback comment with ID", planFeedbackCommentId);
      try {
        if (!context?.token) throw AuthenticationError();

        const feedbackComment = await PlanFeedbackComment.findById(reference, context, planFeedbackCommentId);
        if (!feedbackComment) throw NotFoundError(`Feedback comment with ID ${planFeedbackCommentId} not found`);

        if (feedbackComment.createdById !== context.token.id) {
          throw ForbiddenError(`You can only update your own comments`);
        }

        feedbackComment.commentText = commentText;
        return await feedbackComment.update(context);

      } catch (err) {
        if (err instanceof GraphQLError) throw err;
        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },
    //Remove comment for an answer within a round of feedback
    removeFeedbackComment: async (_, { planId, planFeedbackCommentId }, context: MyContext): Promise<PlanFeedbackComment> => {
      const reference = 'removeFeedbackComment resolver';
      try {
        if (!context?.token) throw AuthenticationError();

        const feedbackComment = await PlanFeedbackComment.findById(reference, context, planFeedbackCommentId);
        if (!feedbackComment) throw NotFoundError(`Feedback comment with ID ${planFeedbackCommentId} not found`);

        const plan = await Plan.findById(reference, context, planId);
        if (!plan) throw NotFoundError(`Plan with ID ${planId} not found`);

        const project = await Project.findById(reference, context, plan.projectId);
        if (!project?.id) throw NotFoundError(`Project with ID ${plan.projectId} not found`);

        const primaryCollaborator = await ProjectCollaborator.findPrimaryUserByProjectId(reference, context, project.id);
        const isPrimaryCollaborator = primaryCollaborator?.userId === context.token.id;
        const isOwnComment = feedbackComment.createdById === context.token.id;


        // Primary collaborator can delete anyone's comments; others can only delete their own
        if (!isPrimaryCollaborator && !isOwnComment) {
          throw ForbiddenError(`You can only remove your own comments`);
        }

        return await feedbackComment.delete(context);

      } catch (err) {
        if (err instanceof GraphQLError) throw err;
        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },
  },

  PlanFeedback: {
    // The plan the feedback is associated with
    plan: async (parent, _, context: MyContext): Promise<Plan | null> => {
      if (parent?.plan?.id) {
        return await Plan.findById('Feedback plan resolver', context, parent.plan?.id);
      }
      return null;
    },
    // The user id that the feedback belongs to
    requestedBy: async (parent: PlanFeedbackParent, _, context: MyContext): Promise<User | null> => {
      if (parent?.requestedById) {
        return await User.findById('User resolver', context, parent?.requestedById);
      }
      return null;
    },
    // The completed by user id that the feedback belongs to
    completedBy: async (parent: PlanFeedbackParent, _, context: MyContext): Promise<User | null> => {
      if (parent?.completedById) {
        return await User.findById('User resolver', context, parent?.completedById);
      }
      return null;
    },
    feedbackComments: async (parent, _, context: MyContext): Promise<PlanFeedbackComment[]> => {
      if (!parent.id) return [];
      return await PlanFeedbackComment.findByFeedbackId('Chained PlanFeedback.feedbackComments', context, parent.id)
    }
  },
  PlanFeedbackComment: {
    // Resolver to get the user who created the comment
    user: async (parent: ResolversParentTypes['PlanFeedbackComment'], _, context: MyContext): Promise<User | null> => {
      if (parent?.createdById) {
        return await User.findById('PlanFeedbackComment user resolver', context, parent.createdById);
      }
      return null;
    },
  }
}

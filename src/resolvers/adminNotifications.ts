import { Resolvers } from "../types.js";
import { MyContext } from '../context.js';
import {
  AdminNotificationResults,
  AdminNotification,
} from '../models/AdminNotifications.js';
import { Plan } from '../models/Plan.js';
import { Template } from '../models/Template.js';
import { PlanFeedback } from '../models/PlanFeedback.js';
import { User } from '../models/User.js';
import {
  authenticatedResolver,
} from "../services/authService.js";
import {
  ForbiddenError,
  InternalServerError,
  NotFoundError
} from "../utils/graphQLErrors.js";
import { prepareObjectForLogs } from "../logger.js";
import { GraphQLError } from "graphql";
import { UserRole } from "../models/User.js";
import { PaginatedQueryResults, PaginationOptions } from "../types/general.js";
import { TemplateCustomization } from "../models/TemplateCustomization.js";

export const resolvers: Resolvers = {
  Query: {
    adminNotificationsRead: authenticatedResolver(
      'adminNotifications resolver',
      UserRole.ADMIN,
      async (
        _: Record<PropertyKey, never>,
        { paginationOptions }: { paginationOptions: PaginationOptions },
        context: MyContext
      ): Promise<PaginatedQueryResults<AdminNotificationResults>> => {
        const reference = 'adminNotifications resolver';
        const userId = context.token.id;
        return await AdminNotificationResults.findReadByUserId(reference, context, userId, paginationOptions)
      }
    ),

    adminNotificationsUnread: authenticatedResolver(
      'unreadAdminNotifications resolver',
      UserRole.ADMIN,
      async (
        _: Record<PropertyKey, never>,
        { paginationOptions }: { paginationOptions: PaginationOptions },
        context: MyContext
      ): Promise<PaginatedQueryResults<AdminNotificationResults>> => {
        const reference = 'unreadAdminNotifications resolver';
        const userId = context.token.id;

        return await AdminNotificationResults.findUnreadByUserId(
          reference,
          context,
          userId,
          paginationOptions
        );
      }
    ),
    adminNotifications: authenticatedResolver(
      'adminNotifications resolver',
      UserRole.ADMIN,
      async (
        _: Record<PropertyKey, never>,
        { paginationOptions }: { paginationOptions: PaginationOptions },
        context: MyContext
      ): Promise<PaginatedQueryResults<AdminNotificationResults>> => {
        const reference = 'unreadAdminNotifications resolver';
        const userId = context.token.id;

        return await AdminNotificationResults.findByUserId(
          reference,
          context,
          userId,
          paginationOptions
        );
      }
    ),
  },

  Mutation: {
    markNotificationAsRead: authenticatedResolver(
      'markNotificationAsRead resolver',
      UserRole.ADMIN,
      async (
        _: Record<PropertyKey, never>,
        { id }: { id: number },
        context: MyContext
      ): Promise<boolean> => {
        const reference = 'markNotificationAsRead resolver';
        try {
          const notification = await AdminNotification.findById(reference, context, id);

          if (!notification) {
            throw NotFoundError(`AdminNotification with ID ${id} not found`);
          }

          if (context.token.id === notification.userId) {
            const updated = await notification.markAsRead(context);
            return updated !== null;
          }
          throw ForbiddenError();
        } catch (err) {
          if (err instanceof GraphQLError) throw err;
          context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
          throw InternalServerError();
        }
      }
    ),

    markNotificationAsUnRead: authenticatedResolver(
      'markNotificationAsUnRead resolver',
      UserRole.ADMIN,
      async (
        _: Record<PropertyKey, never>,
        { id }: { id: number },
        context: MyContext
      ): Promise<boolean> => {
        const reference = 'markNotificationAsUnRead resolver';
        try {
          const notification = await AdminNotification.findById(reference, context, id);

          if (!notification) {
            throw NotFoundError(`AdminNotification with ID ${id} not found`);
          }

          if (context.token.id === notification.userId) {
            const updated = await notification.markAsUnRead(context);
            return updated !== null;
          }
          throw ForbiddenError();
        } catch (err) {
          if (err instanceof GraphQLError) throw err;
          context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
          throw InternalServerError();
        }
      }
    ),
  },
  AdminNotificationResults: {
    // Fetch the plan associated with the notification if metadata contains a planId
    plan: async (parent: AdminNotificationResults, _, context: MyContext): Promise<Plan | null> => {
      if (parent.metadata?.planId) {
        return await Plan.findById('Chained AdminNotificationResults.plan', context, parent.metadata.planId);
      }
      return null;
    },

    // Fetch the template associated with the notification if metadata contains a templateId
    template: async (parent: AdminNotificationResults, _, context: MyContext): Promise<Template | null> => {
      if (parent.metadata?.templateId) {
        return await Template.findById('Chained AdminNotificationResults.template', context, parent.metadata.templateId);
      }
      return null;
    },

    // Fetch the templateCustomization associated with the notification if metadata contains a templateCustomizationId
    templateCustomization: async (parent: AdminNotificationResults, _, context: MyContext): Promise<TemplateCustomization | null> => {
      if (parent.metadata?.templateCustomizationId) {
        return await TemplateCustomization.findByIdWithTemplateName('Chained AdminNotificationResults.templateCustomization', context, parent.metadata.templateCustomizationId);
      }
      return null;
    },

    // Fetch the feedback round this notification was created for. Each feedback request creates a
    // new row in the feedback table, so pinning the notification to its round means read (older)
    // notifications keep their original messageToOrg while new ones show the latest message.
    feedback: async (parent: AdminNotificationResults, _, context: MyContext): Promise<PlanFeedback | null> => {
      const reference = 'Chained AdminNotificationResults.feedback';
      if (parent.metadata?.feedbackId) {
        return await PlanFeedback.findById(reference, context, parent.metadata.feedbackId);
      }

      // Legacy notifications (created before feedbackId was stored in metadata) only have a planId,
      // so use the latest feedback round that was requested at or before the notification was created
      if (parent.metadata?.planId) {
        const feedbackList = await PlanFeedback.findByPlanId(reference, context, parent.metadata.planId);
        const sorted = [...feedbackList].sort((a, b) => b.id - a.id);// newest round first
        const notificationCreated = new Date(parent.created).getTime();
        return sorted.find((fb) => new Date(fb.requested).getTime() <= notificationCreated) // newest round requested at or before the notification was created
          ?? sorted[0] // no matching round found, return the latest round
          ?? null; // plan has no feedback rows at all
      }
      return null;
    },

    // Fetch the user who created the notification
    createdBy: async (parent: AdminNotificationResults, _, context: MyContext): Promise<User | null> => {
      if (parent.createdById) {
        return await User.findById('Chained AdminNotificationResults.createdBy', context, parent.createdById);
      }
      return null;
    },
  },
};

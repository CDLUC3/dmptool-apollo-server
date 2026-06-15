import { Resolvers } from "../types";
import { MyContext } from '../context';
import {
  AdminNotificationResults,
  AdminNotification,
  AdminNotificationOptions,
} from '../models/AdminNotifications';
import { Plan } from '../models/Plan';
import { Template } from '../models/Template';
import { PlanFeedback } from '../models/PlanFeedback';
import { User } from '../models/User';
import {
  authenticatedResolver,
  isAdmin,
  isSuperAdmin,
} from "../services/authService";
import {
  ForbiddenError,
  InternalServerError,
  NotFoundError
} from "../utils/graphQLErrors";
import { prepareObjectForLogs } from "../logger";
import { GraphQLError } from "graphql";
import { UserRole } from "../models/User";
import { PaginatedQueryResults, PaginationOptions } from "../types/general";
import { TemplateCustomization } from "../models/TemplateCustomization";

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
        // SuperAdmins get all notifications in the response, and Admins get notifications filtered by their affiliation
        const affiliationId = isSuperAdmin(context.token) ? null : context.token.affiliationId;
        return await AdminNotificationResults.findReadByAffiliationId(
          reference,
          context,
          affiliationId,
          paginationOptions
        );
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
        // SuperAdmins get all notifications in the response, and Admins get notifications filtered by their affiliation
        const affiliationId = isSuperAdmin(context.token) ? null : context.token.affiliationId;

        return await AdminNotificationResults.findUnreadByAffiliationId(
          reference,
          context,
          affiliationId,
          paginationOptions
        );
      }
    ),
    adminNotifications: authenticatedResolver(
      'unreadAdminNotifications resolver',
      UserRole.ADMIN,
      async (
        _: Record<PropertyKey, never>,
        { paginationOptions }: { paginationOptions: PaginationOptions },
        context: MyContext
      ): Promise<PaginatedQueryResults<AdminNotificationResults>> => {
        const reference = 'unreadAdminNotifications resolver';
        // SuperAdmins get all notifications in the response, and Admins get notifications filtered by their affiliation
        const affiliationId = isSuperAdmin(context.token) ? null : context.token.affiliationId;

        return await AdminNotificationResults.findByAffiliationId(
          reference,
          context,
          affiliationId,
          paginationOptions
        );
      }
    ),
  },

  Mutation: {
    addAdminNotification: authenticatedResolver(
      'addAdminNotification resolver',
      UserRole.ADMIN,
      async (
        _: Record<PropertyKey, never>,
        { input }: { input: AdminNotificationOptions },
        context: MyContext
      ): Promise<AdminNotification> => {
        if (!isSuperAdmin(context.token) && context.token.affiliationId !== input.affiliationId) {
          throw ForbiddenError();
        }

        const notification = new AdminNotification(input);
        const created = await notification.create(context);

        if (created?.id) {
          return created;
        }

        if (!notification.errors['general']) {
          notification.addError('general', 'Unable to create AdminNotification');
        }
        return notification;
      }
    ),
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

          if (isSuperAdmin(context.token) || (isAdmin(context.token) && context.token.affiliationId === notification.affiliationId)) {
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

          if (isSuperAdmin(context.token) || (isAdmin(context.token) && context.token.affiliationId === notification.affiliationId)) {
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

    // Fetch the feedback associated with the plan if metadata contains a planId
    feedback: async (parent: AdminNotificationResults, _, context: MyContext): Promise<PlanFeedback | null> => {
      if (parent.metadata?.planId) {
        const feedbackList = await PlanFeedback.findByPlanId('Chained AdminNotificationResults.feedback', context, parent.metadata.planId);
        // Return the most recent open feedback round
        return feedbackList.find(fb => fb.completed === null) ?? null;
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
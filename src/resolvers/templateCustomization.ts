import {
  AddTemplateCustomizationInput,
  Resolvers,
  UpdateTemplateCustomizationInput
} from "../types";
import { authenticatedResolver, isAdmin } from "../services/authService";
import { MyContext } from "../context";
import { VersionedTemplate } from "../models/VersionedTemplate";
import { normaliseDateTime } from "../utils/helpers";
import {
  TemplateCustomization, TemplateCustomizationOverview,
  TemplateCustomizationStatus
} from "../models/TemplateCustomization";
import {
  checkForFunderTemplateDrift,
  getValidatedCustomization,
} from "../services/templateCustomizationService";
import {
  AuthenticationError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
} from "../utils/graphQLErrors";
import { GraphQLError } from "graphql";
import { prepareObjectForLogs } from "../logger";
import { UserRole } from "../models/User";

export const resolvers: Resolvers = {
  Query: {
    // Fetch the specific customization of a funder template (must be an admin)
    templateCustomizationOverview: authenticatedResolver(
      'sectionCustomization resolver',
      UserRole.ADMIN,
      async (
        _: Record<PropertyKey, never>,
        { templateCustomizationId }: { templateCustomizationId: number },
        context: MyContext
      ): Promise<TemplateCustomizationOverview | null> => {
      const reference = 'templateCustomization resolver';

      const customization: TemplateCustomizationOverview = await TemplateCustomizationOverview.generateOverview(
        reference,
        context,
        templateCustomizationId
      );
      if (!customization) throw NotFoundError();

      // Find the parent template customization and verify the user has access.
      // This will throw a forbidden error if they do not.
      await getValidatedCustomization(
        reference,
        context,
        templateCustomizationId
      );

      return customization;
    }),
  },

  Mutation: {
    // Add a new customization of a funder template (must be an admin)
    addTemplateCustomization: async (
      _: Record<PropertyKey, never>,
      { input }: { input: AddTemplateCustomizationInput },
      context: MyContext
    ): Promise<TemplateCustomization> => {
      const reference = 'addTemplateCustomization resolver';
      const { versionedTemplateId, status } = input;

      try {
        // Only Admins can create template customizations
        if (isAdmin(context.token)) {
          // Fetch the versioned funder template
          const versionedTemplate: VersionedTemplate = await VersionedTemplate.findById(
            reference,
            context,
            versionedTemplateId
          );
          if (!versionedTemplate) throw NotFoundError();

          const customization = new TemplateCustomization({
            affiliationId: context.token.affiliationId,
            templateId: versionedTemplate.templateId,
            currentVersionedTemplateId: versionedTemplate.id,
            status
          });

          // Save the new template customization
          const created: TemplateCustomization = await customization.create(context);
          if (created && !created.hasErrors()) {
            // Check to see if the published funder template that this tracks has changed
            return await checkForFunderTemplateDrift(reference, context, created);
          }

          return created;
        }
        // Caller is Unauthorized!
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Update the customization of a funder template (must be an admin)
    updateTemplateCustomization: async (
      _: Record<PropertyKey, never>,
      { input }: { input: UpdateTemplateCustomizationInput },
      context: MyContext
    ): Promise<TemplateCustomization> => {
      const reference = 'updateTemplateCustomization resolver';
      const { templateCustomizationId, versionedTemplateId, status } = input;

      try {
        // Only Admins can update a template customization
        if (isAdmin(context.token)) {
          const customization: TemplateCustomization = await TemplateCustomization.findById(
            reference,
            context,
            templateCustomizationId
          )
          if (!customization) throw NotFoundError();

          // If the versioned funder template has changed, make sure it exists
          if (customization.currentVersionedTemplateId !== versionedTemplateId) {
            const versionedTemplate: VersionedTemplate = await VersionedTemplate.findById(
              reference,
              context,
              versionedTemplateId
            );
            if (!versionedTemplate) throw NotFoundError();

            customization.currentVersionedTemplateId = versionedTemplateId;
          }

          // Update the customization
          customization.status = TemplateCustomizationStatus[status];
          const updated = await customization.update(context);
          if (updated && !updated.hasErrors()) {
            // Check to see if the published funder template that this tracks has changed
            return await checkForFunderTemplateDrift(reference, context, updated);
          }

          return updated;
        }
        // Caller is Unauthorized!
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Delete the customization of the funder template (must be an admin)
    removeTemplateCustomization: async (
      _: Record<PropertyKey, never>,
      { templateCustomizationId }: { templateCustomizationId: number },
      context: MyContext
    ): Promise<TemplateCustomization> => {
      const reference = 'removeTemplateCustomization resolver';

      try {
        // Only Admins can delete a template customization
        if (isAdmin(context.token)) {
          const customization: TemplateCustomization = await TemplateCustomization.findById(
            reference,
            context,
            templateCustomizationId
          )
          if (!customization) throw NotFoundError();

          return await customization.delete(context);
        }
        // Caller is Unauthorized!
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Publish the customization of the funder template (must be an admin)
    publishTemplateCustomization: async (
      _: Record<PropertyKey, never>,
      { templateCustomizationId }: { templateCustomizationId: number },
      context: MyContext
    ): Promise<TemplateCustomization> => {
      const reference = 'publishTemplateCustomization resolver';

      try {
        // Only Admins can delete a template customization
        if (isAdmin(context.token)) {
          const customization: TemplateCustomization = await TemplateCustomization.findById(
            reference,
            context,
            templateCustomizationId
          )

          if (!customization) throw NotFoundError();

          // Only publish if its not already published
          if (customization.status !== TemplateCustomizationStatus.PUBLISHED
            && !customization.latestPublishedVersionId) {
            return await customization.publish(context);
          }

          customization.addError('general', 'Customization is already published');
          return await customization.publish(context);
        }
        // Caller is Unauthorized!
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Unpublish the customization of the funder template (must be an admin)
    unpublishTemplateCustomization: async (
      _: Record<PropertyKey, never>,
      { templateCustomizationId }: { templateCustomizationId: number },
      context: MyContext
    ): Promise<TemplateCustomization> => {
      const reference = 'unpublishTemplateCustomization resolver';

      try {
        // Only Admins can delete a template customization
        if (isAdmin(context.token)) {
          const customization: TemplateCustomization = await TemplateCustomization.findById(
            reference,
            context,
            templateCustomizationId
          )
          if (!customization) throw NotFoundError();
          // Only unpublish it if it is published
          if (customization.status === TemplateCustomizationStatus.PUBLISHED
            && customization.latestPublishedVersionId) {
            return await customization.unpublish(context);
          }

          customization.addError('general', 'Customization is not published');
          return customization;
        }
        // Caller is Unauthorized!
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },
  },

  TemplateCustomization: {
    latestPublishedDate: (parent: TemplateCustomization): string => {
      return normaliseDateTime(parent.latestPublishedDate);
    },
    created: (parent: TemplateCustomization): string => {
      return normaliseDateTime(parent.created);
    },
    modified: (parent: TemplateCustomization): string => {
      return normaliseDateTime(parent.modified);
    }
  }
};

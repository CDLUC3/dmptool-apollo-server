import {
  AddTemplateCustomizationInput,
  Resolvers,
  UpdateTemplateCustomizationInput
} from "../types";
import { isAdmin } from "../services/authService";
import { MyContext } from "../context";
import { VersionedTemplate } from "../models/VersionedTemplate";
import { normaliseDateTime } from "../utils/helpers";
import {
  TemplateCustomization,
  TemplateCustomizationStatus
} from "../models/TemplateCustomization";
import {
  checkForFunderTemplateDrift,
  hasPermissionOnTemplateCustomization
} from "../services/templateCustomizationService";
import {
  AuthenticationError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
} from "../utils/graphQLErrors";
import { GraphQLError } from "graphql";
import { prepareObjectForLogs } from "../logger";

export const resolvers: Resolvers = {
  Query: {
    // Fetch the specific customization of a funder template (must be an admin)
    templateCustomization: async (
      _: Record<PropertyKey, never>,
      { templateCustomizationId }: { templateCustomizationId: number },
      context: MyContext
    ): Promise<TemplateCustomization> => {
      const reference = 'templateCustomization resolver';
      try {
        // Only Admins can retrieve a template customization
        if (isAdmin(context.token)) {
          const customization: TemplateCustomization = await TemplateCustomization.findById(
            reference,
            context,
            templateCustomizationId
          );

          if (!customization) throw NotFoundError();

          // Verify that the current user has permission to access the Customization
          if (await hasPermissionOnTemplateCustomization(context, customization)) {
            // Check to see if the published funder template that this tracks has changed
            return await checkForFunderTemplateDrift(reference, context, customization);
          }
          throw ForbiddenError();
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
      const reference = 'archiveTemplateCustomization resolver';

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
  },

  TemplateCustomization: {
    created: (parent: TemplateCustomization): string => {
      return normaliseDateTime(parent.created);
    },
    modified: (parent: TemplateCustomization): string => {
      return normaliseDateTime(parent.modified);
    }
  }
};

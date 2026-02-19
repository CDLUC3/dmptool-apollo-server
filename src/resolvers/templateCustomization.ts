import {
  AddTemplateCustomizationInput,
  Resolvers,
  UpdateTemplateCustomizationInput
} from "../types";
import { authenticatedResolver } from "../services/authService";
import { MyContext } from "../context";
import { VersionedTemplate } from "../models/VersionedTemplate";
import { isNullOrUndefined, normaliseDateTime } from "../utils/helpers";
import {
  TemplateCustomization, TemplateCustomizationOverview,
  TemplateCustomizationStatus
} from "../models/TemplateCustomization";
import { getValidatedCustomization } from "../services/templateCustomizationService";
import { NotFoundError } from "../utils/graphQLErrors";
import { UserRole } from "../models/User";

export const resolvers: Resolvers = {
  Query: {
    // Fetch the specific customization of a funder template (must be an admin)
    templateCustomizationOverview: authenticatedResolver(
      'templateCustomizationOverview resolver',
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
    addTemplateCustomization: authenticatedResolver(
      'addTemplateCustomization resolver',
      UserRole.ADMIN,
      async (
        _: Record<PropertyKey, never>,
        { input }: { input: AddTemplateCustomizationInput },
        context: MyContext
      ): Promise<TemplateCustomizationOverview | null> => {
      const reference = 'addTemplateCustomization resolver';
      const { versionedTemplateId, status } = input;

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

      // If there were no problems, then generate the overview and return it
      if (!isNullOrUndefined(created)) {
        const overview: TemplateCustomizationOverview = await TemplateCustomizationOverview.generateOverview(
          reference,
          context,
          created.id
        );

        // Transfer any errors encountered during the creation to the Overview
        overview.errors = created.errors;
        return overview;
      }
      return undefined;
    }),

    // Update the customization of a funder template (must be an admin)
    updateTemplateCustomization: authenticatedResolver(
      'updateTemplateCustomization resolver',
      UserRole.ADMIN,
      async (
        _: Record<PropertyKey, never>,
        { input }: { input: UpdateTemplateCustomizationInput },
        context: MyContext
      ): Promise<TemplateCustomizationOverview | null> => {
      const reference = 'updateTemplateCustomization resolver';
      const { templateCustomizationId, status } = input;

      const customization: TemplateCustomization = await getValidatedCustomization(
        reference,
        context,
        templateCustomizationId
      );
      if (!customization) throw NotFoundError();

      // Update the customization
      customization.status = TemplateCustomizationStatus[status];
      const updated: TemplateCustomization = await customization.update(context);

      if (!isNullOrUndefined(updated)) {
        const overview: TemplateCustomizationOverview = await TemplateCustomizationOverview.generateOverview(
          reference,
          context,
          updated.id
        );

        // Transfer any errors encountered during the update to the Overview
        overview.errors = updated.errors;
        return overview;
      }
      return undefined;
    }),

    // Delete the customization of the funder template (must be an admin)
    removeTemplateCustomization: authenticatedResolver(
      'removeTemplateCustomization resolver',
      UserRole.ADMIN,
      async (
        _: Record<PropertyKey, never>,
        { templateCustomizationId }: { templateCustomizationId: number },
        context: MyContext
      ): Promise<TemplateCustomizationOverview | null> => {
      const reference = 'removeTemplateCustomization resolver';

      const customization: TemplateCustomization = await getValidatedCustomization(
        reference,
        context,
        templateCustomizationId
      );
      if (!customization) throw NotFoundError();

      const deleted: TemplateCustomization = await customization.delete(context);

      if (!isNullOrUndefined(deleted)) {
        const overview: TemplateCustomizationOverview = await TemplateCustomizationOverview.generateOverview(
          reference,
          context,
          deleted.id
        );

        // Transfer any errors encountered during the deletion to the Overview
        overview.errors = deleted.errors;
        return overview;
      }
      return undefined;
    }),

    // Publish the customization of the funder template (must be an admin)
    publishTemplateCustomization: authenticatedResolver(
      'publishTemplateCustomization resolver',
      UserRole.ADMIN,
      async (
        _: Record<PropertyKey, never>,
        { templateCustomizationId }: { templateCustomizationId: number },
        context: MyContext
      ): Promise<TemplateCustomizationOverview | null> => {
      const reference = 'publishTemplateCustomization resolver';

      const customization: TemplateCustomization = await getValidatedCustomization(
        reference,
        context,
        templateCustomizationId
      );
      if (!customization) throw NotFoundError();

      const published: TemplateCustomization = await customization.publish(context);

      if (!isNullOrUndefined(published)) {
        const overview: TemplateCustomizationOverview = await TemplateCustomizationOverview.generateOverview(
          reference,
          context,
          published.id
        );
        // Transfer any errors
        overview.errors = published.errors;
        return overview;
      }
      return undefined;
    }),

    // Unpublish the customization of the funder template (must be an admin)
    unpublishTemplateCustomization: authenticatedResolver(
      'unpublishTemplateCustomization resolver',
      UserRole.ADMIN,
      async (
        _: Record<PropertyKey, never>,
        { templateCustomizationId }: { templateCustomizationId: number },
        context: MyContext
      ): Promise<TemplateCustomizationOverview | null> => {
      const reference = 'unpublishTemplateCustomization resolver';
      const customization: TemplateCustomization = await getValidatedCustomization(
        reference,
        context,
        templateCustomizationId
      );
      if (!customization) throw NotFoundError();

      const unpublished: TemplateCustomization = await customization.unpublish(context);

      if (!isNullOrUndefined(unpublished)) {
        const overview: TemplateCustomizationOverview = await TemplateCustomizationOverview.generateOverview(
          reference,
          context,
          unpublished.id
        );
        // Transfer any errors
        overview.errors = unpublished.errors;
        return overview;
      }
      return undefined;
    }),
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

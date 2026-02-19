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
    /**
     * ADMIN ONLY: Fetch an overview of the TemplateCustomization including the
     * funder's sections and questions splicing in any custom sections and questions
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args the identifier of the TemplateCustomization
     * @param context The Apollo context
     * @returns The an overview of the TemplateCustomization (with errors if applicable)
     * @throws NotFoundError when the TemplateCustomization was not found
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws InternalServerError when a fatal error has occurred
     */
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
    /**
     * ADMIN ONLY: Create a TemplateCustomization
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args the identifier of the TemplateCustomization
     * @param context The Apollo context
     * @returns The an overview of the new TemplateCustomization (with errors if applicable)
     * @throws NotFoundError when the TemplateCustomization was not found
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws InternalServerError when a fatal error has occurred
     */
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

    /**
     * ADMIN ONLY: Update the specified TemplateCustomization
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args the identifier of the TemplateCustomization
     * @param context The Apollo context
     * @returns The an overview of the TemplateCustomization (with errors if applicable)
     * @throws NotFoundError when the TemplateCustomization was not found
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws InternalServerError when a fatal error has occurred
     */
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

    /**
     * ADMIN ONLY: Delete the specified TemplateCustomization
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args the identifier of the TemplateCustomization
     * @param context The Apollo context
     * @returns The an overview of the original TemplateCustomization (with errors if applicable)
     * @throws NotFoundError when the TemplateCustomization was not found
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws InternalServerError when a fatal error has occurred
     */
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

    /**
     * ADMIN ONLY: Publish the specified TemplateCustomization
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args the identifier of the TemplateCustomization
     * @param context The Apollo context
     * @returns The an overview of the TemplateCustomization (with errors if applicable)
     * @throws NotFoundError when the TemplateCustomization was not found
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws InternalServerError when a fatal error has occurred
     */
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

    /**
     * ADMIN ONLY: Unpublish the specified TemplateCustomization
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args the identifier of the TemplateCustomization
     * @param context The Apollo context
     * @returns The an overview of the TemplateCustomization (with errors if applicable)
     * @throws NotFoundError when the TemplateCustomization was not found
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws InternalServerError when a fatal error has occurred
     */
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
    /**
     * Format the date time the customization was last published
     * @param parent The TemplateCustomization
     * @returns the formatted date
     */
    latestPublishedDate: (parent: TemplateCustomization): string => {
      return normaliseDateTime(parent.latestPublishedDate);
    },
    /**
     * Format the created date time
     * @param parent The TemplateCustomization
     * @returns the formatted date
     */
    created: (parent: TemplateCustomization): string => {
      return normaliseDateTime(parent.created);
    },
    /**
     * Format the modified date time
     * @param parent The TemplateCustomization
     * @returns the formatted date
     */
    modified: (parent: TemplateCustomization): string => {
      return normaliseDateTime(parent.modified);
    }
  }
};

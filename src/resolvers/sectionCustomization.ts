import {
  AddCustomSectionInput,
  AddSectionCustomizationInput,
  MoveCustomSectionInput,
  Resolvers,
  UpdateCustomSectionInput, UpdateSectionCustomizationInput
} from "../types";
import { MyContext } from "../context";
import {
  TemplateCustomization,
  TemplateCustomizationMigrationStatus
} from "../models/TemplateCustomization";
import { authenticatedResolver } from "../services/authService";
import { NotFoundError } from "../utils/graphQLErrors";
import {
  getValidatedCustomization,
  markTemplateCustomizationAsDirty
} from "../services/templateCustomizationService";
import { SectionCustomization } from "../models/SectionCustomization";
import { VersionedSection } from "../models/VersionedSection";
import { CustomSection, PinnedSectionTypeEnum } from "../models/CustomSection";
import { isNullOrUndefined, normaliseDateTime } from "../utils/helpers";
import { UserRole } from "../models/User";

export const resolvers: Resolvers = {
  Query: {
    /**
     * ADMIN ONLY: Fetch the specified SectionCustomization
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args the identifier of the SectionCustomization
     * @param context The Apollo context
     * @returns The SectionCustomization (with errors if applicable)
     * @throws NotFoundError when the SectionCustomization or TemplateCustomization
     * are not found
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws InternalServerError when a fatal error has occurred
     */
    sectionCustomization: authenticatedResolver(
      'sectionCustomization resolver',
      UserRole.ADMIN,
      async (
        _: Record<PropertyKey, never>,
        { sectionCustomizationId }: { sectionCustomizationId: number },
        context: MyContext
      ): Promise<SectionCustomization> => {
      const ref = 'sectionCustomization resolver';

      const customization: SectionCustomization = await SectionCustomization.findById(
        ref,
        context,
        sectionCustomizationId
      );
      if (!customization) throw NotFoundError();

      // Find the parent template customization and verify the user has access.
      // This will throw a forbidden error if they do not.
      const parent: TemplateCustomization = await getValidatedCustomization(
        ref,
        context,
        customization.templateCustomizationId
      );
      if (isNullOrUndefined(parent)) throw NotFoundError();

      return customization;
    }),

    /**
     * ADMIN ONLY: Fetch the specified CustomSection
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args the identifier of the CustomSection
     * @param context The Apollo context
     * @returns The CustomSection or null
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws InternalServerError when a fatal error has occurred
     */
    customSection: authenticatedResolver(
      'customSection resolver',
      UserRole.ADMIN,
      async (
        _: Record<PropertyKey, never>,
        { customSectionId }: { customSectionId: number },
        context: MyContext
    ): Promise<CustomSection> => {
      const ref = 'customSection resolver'
      // Fetch the CustomSection
      const customization: CustomSection = await CustomSection.findById(
        ref,
        context,
        customSectionId
      );
      if (!customization) throw NotFoundError();

      // Find the parent template customization and verify the user has access.
      // This will throw a forbidden error if they do not.
      const parent: TemplateCustomization = await getValidatedCustomization(
        ref,
        context,
        customization.templateCustomizationId
      );
      if (isNullOrUndefined(parent)) throw NotFoundError();

      return customization;
    }),
  },

  Mutation: {
    /**
     * ADMIN ONLY: Create a new SectionCustomization
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args an object containing { templateCustomizationId, versionedSectionId }
     * @param context The Apollo context
     * @returns The SectionCustomization (with errors if applicable)
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws NotFoundError when the CustomSection or TemplateCustomization
     * cannot be found
     * @throws InternalServerError when a fatal error has occurred
     */
    addSectionCustomization: authenticatedResolver(
      'addSectionCustomization resolver',
      UserRole.ADMIN,
      async (
        _: Record<PropertyKey, never>,
        { input }: { input: AddSectionCustomizationInput },
        context: MyContext
      ): Promise<SectionCustomization> => {
      const ref = 'addSectionCustomization resolver';
      const { templateCustomizationId, versionedSectionId } = input;

      // Fetch the versioned section
      const section: VersionedSection = await VersionedSection.findById(
        ref,
        context,
        versionedSectionId
      );
      if (!section) throw NotFoundError();

      // Fetch the parent template customization and verify that the user has access
      const parent: TemplateCustomization = await getValidatedCustomization(
        ref,
        context,
        templateCustomizationId
      );

      const customization = new SectionCustomization({
        templateCustomizationId,
        sectionId: section.sectionId,
        migrationStatus: TemplateCustomizationMigrationStatus.OK
      });

      // Save the new section customization
      const created: SectionCustomization = await customization.create(context);

      // If it was successfully created, update the parent's isDirty flag
      if (created && !created.hasErrors() && !parent.isDirty) {
        await markTemplateCustomizationAsDirty(ref, context, parent.id, created);
      }
      return created;
    }),

    /**
     * ADMIN ONLY: Update the specified SectionCustomization
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args an object containing { sectionCustomizationId, guidance }
     * @param context The Apollo context
     * @returns The SectionCustomization (with errors if applicable)
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws NotFoundError when the CustomSection or TemplateCustomization
     * cannot be found
     * @throws InternalServerError when a fatal error has occurred
     */
    updateSectionCustomization: authenticatedResolver(
      'updateSectionCustomization resolver',
      UserRole.ADMIN,
      async (
        _: Record<PropertyKey, never>,
        { input }: { input: UpdateSectionCustomizationInput },
        context: MyContext
      ): Promise<SectionCustomization> => {
        const { sectionCustomizationId, guidance } = input;
        const ref = 'updateSectionCustomization resolver';

        // Fetch the specified SectionCustomization
        const customization: SectionCustomization = await SectionCustomization.findById(
          ref,
          context,
          sectionCustomizationId
        );
        if (!customization) throw NotFoundError();

        // Fetch the parent templateCustomization and make sure the user has access
        const parent = await getValidatedCustomization(
          ref,
          context,
          customization.templateCustomizationId
        );

        // Update the guidance
        customization.guidance = guidance;
        const updated: SectionCustomization = await customization.update(context);

        // If it was successfully updated, update the parent's isDirty flag
        if (updated && !updated.hasErrors() && !parent.isDirty) {
          await markTemplateCustomizationAsDirty(ref, context, parent.id, updated);
        }
        return updated;
      }
    ),

    /**
     * ADMIN ONLY: Delete the specified SectionCustomization
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args the identifier of the SectionCustomization to remove
     * @param context The Apollo context
     * @returns The SectionCustomization (with errors if applicable)
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws NotFoundError when the CustomSection or TemplateCustomization
     * cannot be found
     * @throws InternalServerError when a fatal error has occurred
     */
    removeSectionCustomization: authenticatedResolver(
      'removeSectionCustomization resolver',
      UserRole.ADMIN,
      async (
        _: Record<PropertyKey, never>,
        { sectionCustomizationId }: { sectionCustomizationId: number },
        context: MyContext
      ): Promise<SectionCustomization> => {
      const ref = 'removeSectionCustomization resolver';
      const customization: SectionCustomization = await SectionCustomization.findById(
        ref,
        context,
        sectionCustomizationId
      );
      if (!customization) throw NotFoundError();

      // Fetch the parent template customization and verify the user has access
      const parent: TemplateCustomization = await getValidatedCustomization(
        ref,
        context,
        customization.templateCustomizationId
      );

      const deleted: SectionCustomization = await customization.delete(context);
      // If it was successfully deleted, update the parent's isDirty flag
      if (deleted && !deleted.hasErrors() && !parent.isDirty) {
        await markTemplateCustomizationAsDirty(ref, context, parent.id, deleted);
      }
      return deleted;
    }),

    /**
     * ADMIN ONLY: Create a new CustomSection.
     * The section will appear first in the template if the pinnedSectionId is null
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args an object containing { templateCustomizationId, pinnedSectionType,
     * pinnedSectionId }
     * @param context The Apollo context
     * @returns The CustomSection (with errors if applicable)
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws NotFoundError when the CustomSection or TemplateCustomization
     * cannot be found
     * @throws InternalServerError when a fatal error has occurred
     */
    addCustomSection: authenticatedResolver(
      'addCustomSection resolver',
      UserRole.ADMIN,
      async (
        _: Record<PropertyKey, never>,
        { input }: { input: AddCustomSectionInput },
        context: MyContext
      ): Promise<CustomSection> => {
      const ref = 'addCustomSection resolver';
      const { templateCustomizationId, pinnedSectionType, pinnedSectionId } = input;

      // Fetch the parent template customization and verify the user has access
      const parent: TemplateCustomization = await getValidatedCustomization(
        ref,
        context,
        templateCustomizationId
      );

      const customSection = new CustomSection({
        templateCustomizationId,
        pinnedSectionType,
        pinnedSectionId,
        migrationStatus: TemplateCustomizationMigrationStatus.OK
      });

      // Save the new custom section
      const created: CustomSection = await customSection.create(context);

      // If it was successfully created, update the parent's isDirty flag
      if (created && !created.hasErrors() && !parent.isDirty) {
        await markTemplateCustomizationAsDirty(ref, context, parent.id, created);
      }
      return created;
    }),

    /**
     * ADMIN ONLY: Update the specified CustomSection
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args an object containing { customSectionId, name, introduction,
     * requirements, guidance }
     * @param context The Apollo context
     * @returns The CustomSection (with errors if applicable)
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws NotFoundError when the CustomSection or TemplateCustomization
     * cannot be found
     * @throws InternalServerError when a fatal error has occurred
     */
    updateCustomSection: authenticatedResolver(
      'updateCustomSection resolver',
      UserRole.ADMIN,
      async (
        _: Record<PropertyKey, never>,
        { input }: { input: UpdateCustomSectionInput },
        context: MyContext
      ): Promise<CustomSection> => {
      const ref = 'updateCustomSection resolver';
      const { customSectionId, name, introduction, requirements, guidance } = input;

      const customization: CustomSection = await CustomSection.findById(
        ref,
        context,
        customSectionId
      );
      if (!customization) throw NotFoundError();

      // Fetch the parent template customization and verify that the user has access
      const parent: TemplateCustomization = await getValidatedCustomization(
        ref,
        context,
        customization.templateCustomizationId
      );

      // Update the section
      customization.name = name;
      customization.introduction = introduction;
      customization.requirements = requirements;
      customization.guidance = guidance;
      const updated: CustomSection =  await customization.update(context);

      // If it was successfully updated, update the parent's isDirty flag
      if (updated && !updated.hasErrors() && !parent.isDirty) {
        await markTemplateCustomizationAsDirty(ref, context, parent.id, updated);
      }
      return updated;
    }),

    /**
     * ADMIN ONLY: Delete the specified CustomSection
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args the identifier of the CustomSection to remove
     * @param context The Apollo context
     * @returns The original CustomSection (with errors if applicable)
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws NotFoundError when the CustomSection or TemplateCustomization
     * cannot be found
     * @throws InternalServerError when a fatal error has occurred
     */
    removeCustomSection: authenticatedResolver(
      'updateCustomSection resolver',
      UserRole.ADMIN,
      async (
        _: Record<PropertyKey, never>,
        { customSectionId }: { customSectionId: number },
        context: MyContext
      ): Promise<CustomSection> => {
      const ref = 'removeCustomSection resolver';
      const customization: CustomSection = await CustomSection.findById(
        ref,
        context,
        customSectionId
      );
      if (!customization) throw NotFoundError();

      // Fetch the parent template customization and verify that the user has access
      const parent: TemplateCustomization = await getValidatedCustomization(
        ref,
        context,
        customization.templateCustomizationId
      );

      const deleted: CustomSection = await customization.delete(context);
      // If it was successfully deleted, update the parent's isDirty flag
      if (deleted && !deleted.hasErrors() && !parent.isDirty) {
        await markTemplateCustomizationAsDirty(ref, context, parent.id, deleted);
      }
      return deleted;
    }),

    /**
     * ADMIN ONLY: Move the specified CustomSection by pinning it to the designated section.
     * It will become the first section of the template if newSectionId is `null`.
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args an object containing { customSectionId, newSectionType, newSectionId }
     * @param context The Apollo context
     * @returns The CustomSection (with errors if applicable)
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws NotFoundError when the CustomSection or TemplateCustomization
     * cannot be found
     * @throws InternalServerError when a fatal error has occurred
     */
    moveCustomSection: authenticatedResolver(
      'moveCustomSection resolver',
      UserRole.ADMIN,
      async (
        _: Record<PropertyKey, never>,
        { input }: { input: MoveCustomSectionInput },
        context: MyContext
      ): Promise<CustomSection> => {
      const ref = 'moveCustomSection resolver';
      const { customSectionId, newSectionType, newSectionId } = input;

      const customization: CustomSection = await CustomSection.findById(
        ref,
        context,
        customSectionId
      );
      if (!customization) throw NotFoundError();

      // Fetch the parent template customization and verify the user has access
      const parent: TemplateCustomization = await getValidatedCustomization(
        ref,
        context,
        customization.templateCustomizationId
      );

      const newPinType: PinnedSectionTypeEnum = PinnedSectionTypeEnum[newSectionType];
      customization.pinnedSectionType = isNullOrUndefined(newPinType) ? null : newPinType;
      customization.pinnedSectionId = isNullOrUndefined(newSectionId) ? null : newSectionId;
      const moved: CustomSection = await customization.update(context);

      // If it was successfully moved, update the parent's isDirty flag
      if (moved && !moved.hasErrors() && !parent.isDirty) {
        await markTemplateCustomizationAsDirty(ref, context, parent.id, moved);
      }

      return moved;
    }),
  },

  SectionCustomization: {
    /**
     * The VersionedSection that the SectionCustomization applies to
     * @param parent The SectionCustomization
     * @param _ TArgs not used here
     * @param context The Apollo context
     * @returns The VersionedSection
     */
    versionedSection: async (
      parent: SectionCustomization,
      _: Record<PropertyKey, never>,
      context: MyContext
    ): Promise<VersionedSection> => {
      return parent?.sectionId
        ? await VersionedSection.findActiveBySectionId(
            'SectionCustomization.versionedSection chained resolver',
            context,
            parent.sectionId
          )
        : null;
    },
    /**
     * Format the created date time
     * @param parent The SectionCustomization
     * @returns the formatted date
     */
    created: (parent: SectionCustomization): string => {
      return normaliseDateTime(parent.created);
    },
    /**
     * Format the modified date time
     * @param parent The SectionCustomization
     * @returns the formatted date time
     */
    modified: (parent: SectionCustomization): string => {
      return normaliseDateTime(parent.modified);
    }
  },

  CustomSection: {
    /**
     * Format the created date time
     * @param parent The CustomSection
     * @returns the formatted date time
     */
    created: (parent: CustomSection): string => {
      return normaliseDateTime(parent.created);
    },
    /**
     * Format the modified date time
     * @param parent The CustomSection
     * @returns the formatted date time
     */
    modified: (parent: CustomSection): string => {
      return normaliseDateTime(parent.modified);
    }
  },
};

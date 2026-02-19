import { MyContext } from "../context";
import { isSuperAdmin } from "./authService";
import { VersionedTemplate } from "../models/VersionedTemplate";
import {
  TemplateCustomization,
  TemplateCustomizationMigrationStatus
} from "../models/TemplateCustomization";
import { CustomSection } from "../models/CustomSection";
import { CustomQuestion } from "../models/CustomQuestion";
import { SectionCustomization } from "../models/SectionCustomization";
import { QuestionCustomization } from "../models/QuestionCustomization";
import { ForbiddenError, NotFoundError } from "../utils/graphQLErrors";

/**
 * Fetch the TemplateCustomization and make sure the current user has permission
 * to access it.
 *
 * @param reference
 * @param context
 * @param templateCustomizationId
 */
export const getValidatedCustomization = async (
  reference: string,
  context: MyContext,
  templateCustomizationId: number
): Promise<TemplateCustomization> => {
  // Fetch the TemplateCustomization
  const customization: TemplateCustomization = await TemplateCustomization.findById(
    reference,
    context,
    templateCustomizationId
  );

  // If it was not found, throw a NotFoundError
  if (!customization) throw NotFoundError();

  // Check if the current user has permission to access the Customization
  if (!(await hasPermissionOnTemplateCustomization(context, customization))) {
    throw ForbiddenError();
  }
  return customization;
}

/**
 * Check if the user has permission to edit the template customization.
 *
 * @param context The apollo context object.
 * @param templateCustomization The template customization to check.
 * @returns true if the user has permission to edit the template customization.
 */
export const hasPermissionOnTemplateCustomization = (
  context: MyContext,
  templateCustomization: TemplateCustomization
): boolean => {
  if (!context || !context.token || !templateCustomization) return false;

  // If the user is a super admin they have access
  if (isSuperAdmin(context.token)) return true;

  // If the current user belongs to the same affiliation
  if (context.token?.affiliationId === templateCustomization?.affiliationId) {
    return true;
  }
}

/**
 * Set the specified TemplateCustomization's isDirty flag to true
 *
 * @param reference A reference to use for logging errors.
 * @param context
 * @param templateCustomizationId The id of the TemplateCustomization to update.
 * @param entity The entity that the TemplateCustomization belongs to. This is
 * used to add an error to the entity if it supports it.
 * @returns true if the TemplateCustomization was successfully updated.
 */
export const markTemplateCustomizationAsDirty = async (
  reference: string,
  context: MyContext,
  templateCustomizationId: number,
  entity: CustomSection | CustomQuestion | SectionCustomization | QuestionCustomization
) => {
  const success = await TemplateCustomization.markAsDirty(
    reference,
    context,
    templateCustomizationId
  );
  if (!success) {
    const msg = `Unable to update TemplateCustomization timestamp`;
    context.logger.error({ templateCustomizationId }, msg);
    // Optionally add error to the entity if it supports it
    if (entity?.addError) entity.addError('general', msg);
  }
};

/**
 * Check the customization to see if the latest published version of the funder
 * template differs from the currentVersionedTemplateId. If so, set the
 * migrationStatus to STALE.
 *
 * If the funder template is no longer available, set the migrationStatus to ORPHANED.
 *
 * @param reference The reference to use for logging errors.
 * @param context The Apollo context.
 * @param templateCustomization The customization to check.
 * @returns the updated customization.
 */
export const checkForFunderTemplateDrift = async (
  reference: string,
  context: MyContext,
  templateCustomization: TemplateCustomization
): Promise<TemplateCustomization> => {
  const currentVersion: VersionedTemplate = await VersionedTemplate.findActiveByTemplateId(
    reference,
    context,
    templateCustomization.templateId
  );

  if (!currentVersion) {
    // There is no current published version of the funder template
    templateCustomization.migrationStatus = TemplateCustomizationMigrationStatus.ORPHANED;
    templateCustomization.addError(
      'general',
      'Funder template is no longer available.'
    );

  } else if (templateCustomization.currentVersionedTemplateId !== currentVersion.id) {
    // The funder template has changed since the customization was last published
    templateCustomization.currentVersionedTemplateId = currentVersion.id;
    templateCustomization.migrationStatus = TemplateCustomizationMigrationStatus.STALE;
    templateCustomization.addError(
      'general',
      'Funder template has changed since customization was last published.'
    );

    // TODO: Process all SectionCustomizations and QuestionCustomizations and
    //       check for drift. If drift is detected, mark them as `STALE` or `ORPHANED`

    // TODO: Process all CustomSections and CustomQuestions and
    //       check for drift. If drift is detected, mark them as `STALE` or `ORPHANED`
  }
  return templateCustomization;
}

/**
 * Check for customizations that will be impacted by the republication of a
 * funder template. Mark all customizations as `STALE`.
 *
 * @param reference The reference to use for logging errors.
 * @param context The Apollo context.
 * @param oldVersionedTemplateId The id of the funder template as it was when the customization was created.
 * @param newVersionedTemplateId The id of the funder template as it is now.
 * @returns the number of customizations that were impacted by the republication.
 */
export const handleFunderTemplateRepublication = async (
  reference: string,
  context: MyContext,
  oldVersionedTemplateId: number,
  newVersionedTemplateId: number | undefined
): Promise<number> => {
  // The funder template was archived if the new version is not defined
  if (newVersionedTemplateId === undefined) {
    return await handleFunderTemplateArchive(reference, context, oldVersionedTemplateId);
  }

  const customizations: TemplateCustomization[] = await TemplateCustomization.findByVersionedTemplateId(
    reference,
    context,
    oldVersionedTemplateId
  );

  if (Array.isArray(customizations) && customizations.length > 0) {
    await Promise.all(customizations.map(async (customization: TemplateCustomization) => {
      // Mark all impacted customizations as stale
      customization.migrationStatus = TemplateCustomizationMigrationStatus.STALE;
      await customization.update(context, true);

      // TODO: Process all SectionCustomizations and QuestionCustomizations and
      //       check for drift. If drift is detected, mark them as `STALE` or `ORPHANED`

      // TODO: Process all CustomSections and CustomQuestions and
      //       check for drift. If drift is detected, mark them as `STALE` or `ORPHANED`
    }));
    return customizations.length;
  }
  return 0;
}

/**
 * Check for customizations that will be impacted by the archiving of a funder
 * template. Mark all impacted customizations as orphaned.
 *
 * @param reference The reference to use for logging errors.
 * @param context The Apollo context.
 * @param templateId The id of the funder template that is being archived.
 * @returns the number of customizations that were impacted by the archival.
 */
export const handleFunderTemplateArchive = async (
  reference: string,
  context: MyContext,
  templateId: number
): Promise<number> => {
  const customizations: TemplateCustomization[] = await TemplateCustomization.findByTemplateId(
    reference,
    context,
    templateId,
  );

  if (Array.isArray(customizations) && customizations.length > 0) {
    await Promise.all(customizations.map(async (customization: TemplateCustomization) => {
      // Mark the impacted customizations as orphaned
      customization.migrationStatus = TemplateCustomizationMigrationStatus.ORPHANED;
      await customization.update(context, true);

      // TODO: Process all SectionCustomizations and QuestionCustomization by
      //       marking them as `ORPHANED` as well.

      // TODO: Process all CustomSections and CustomQuestions by marking them as
      //       `ORPHANED` as well.
    }));
    return customizations.length;
  }
  return 0;
}

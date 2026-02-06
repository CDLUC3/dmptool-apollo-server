import { MyContext } from "../context";
import {
  TemplateCustomization,
  TemplateCustomizationMigrationStatus
} from "../models/TemplateCustomization";

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
    for (const customization of customizations) {
      // Mark all impacted customizations as stale
      customization.migrationStatus = TemplateCustomizationMigrationStatus.STALE;
      await customization.update(context, true);
    }
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
    for (const customization of customizations) {
      // Mark the impacted customizations as orphaned
      customization.migrationStatus = TemplateCustomizationMigrationStatus.ORPHANED;
      await customization.update(context, true);
    }
    return customizations.length;
  }
  return 0;
}

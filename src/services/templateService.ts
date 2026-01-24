import { incrementVersionNumber } from "../utils/helpers";
import { Template, TemplateVisibility } from "../models/Template";
import { Tag } from "../models/Tag";
import { VersionedTemplate, TemplateVersionType } from "../models/VersionedTemplate";
import { MyContext } from "../context";
import { isSuperAdmin } from "./authService";
import { TemplateCollaborator } from "../models/Collaborator";
import { Section } from "../models/Section";
import { generateSectionVersion } from "./sectionService";
import { prepareObjectForLogs } from "../logger";

// Determine whether the specified user has permission to access the Template
export const hasPermissionOnTemplate = async (context: MyContext, template: Template): Promise<boolean> => {
  if (!context || !context.token) return false;

  // If the user is a super admin they have access
  if (isSuperAdmin(context.token)) return true;

  // If the current user belongs to the same affiliation
  if (context.token?.affiliationId === template?.ownerId) {
    return true;
  }

  // Otherwise see if the user is one of the invited collaborators
  const collaborator = await TemplateCollaborator.findByTemplateIdAndEmail(
    'template resolver.hasPermission',
    context,
    template?.id,
    context.token?.email,
  )
  if (collaborator) {
    return true;
  }

  const payload = { templateId: template?.id, userId: context.token?.id };
  context.logger.error(prepareObjectForLogs(payload), 'AUTH failure: hasPermissionOnTemplate');
  return false;
}

// Creates a new Version/Snapshot the specified Template (as a point in time snapshot)
//    - bumps the `latestPublishVersion` on the specified `template`
//    - deactivates all of the existing VersionedTemplates in the `versions` array
//    - creates a new VersionedTemplate that is active and adds it to the `versions` array
export const generateTemplateVersion = async (
  context: MyContext,
  template: Template,
  versions: VersionedTemplate[],
  versionerId: number,
  comment = '',
  latestPublishVisibility = TemplateVisibility.ORGANIZATION,
  versionType = TemplateVersionType.DRAFT,
): Promise<VersionedTemplate> => {
  // If the template has no id then it has not yet been saved so throw an error
  if (!template.id) {
    throw new Error('Cannot publish unsaved Template');
  }

  // If the template has a current version but no recent changes throw an error
  if (template.latestPublishVersion && !template.isDirty) {
    throw new Error('There are no changes to publish');
  }

  // Figure out the next version number
  let newVersion = 'v1';
  if (versions.length > 0) {
    const sortedVersions = versions.sort((a, b) => b.version.localeCompare(a.version));
    newVersion = incrementVersionNumber(sortedVersions[0].version);
  }

  // Intialize the new Version
  const versionedTemplate = new VersionedTemplate({
    version: newVersion,
    templateId: template.id,
    name: template.name,
    description: template.description,
    ownerId: template.ownerId,
    versionedById: versionerId,
    visibility: latestPublishVisibility || template.latestPublishVisibility,
    bestPactice: template.bestPractice,
    languageId: template.languageId,
    versionType,
    comment,
    active: true,
    createdById: template.createdById,
    created: template.created,
    modifiedById: template.modifiedById,
    modified: template.modified,
  });
  const created = await versionedTemplate.create(context);

  console.log("***Created VersionedTemplate:", created); // --- IGNORE ---

  // If the version was successfully created and there are no errors
  if (created && !created.hasErrors()) {

    // Deactivate previous versions only *after* successful creation
    for (const v of versions) {
      if (v.active) {
        const versionInstance = new VersionedTemplate({ ...v, active: false });
        await versionInstance.update(context);
      }
    }

    const sections = await Section.findByTemplateId('generateTemplateVersion', context, template.id);


    console.log("***Sections to version:", sections); // --- IGNORE ---
    try {
      let allSectionsWereVersioned = true;

      for (const section of sections) {
        const sectionInstance = new Section({
          ...section
        });

        // Get current tags for the section so we can add it to versionedSectionTags table
        const currentTags = await Tag.findBySectionId('generateTemplateVersion', context, sectionInstance.id);

        console.log("***Current Tags for Section:", currentTags); // --- IGNORE ---
        sectionInstance.tags = currentTags;

        const passed = await generateSectionVersion(context, sectionInstance, created.id);
        if (!passed) {
          allSectionsWereVersioned = false;
        }
      }

      // Only continue if all of the sections were properly versioned
      if (allSectionsWereVersioned) {
        // Update the template's version and reset the dirty flag
        template.latestPublishVersion = newVersion;
        template.latestPublishDate = created.created;
        template.latestPublishVisibility = latestPublishVisibility;
        // Only set isDirty to true if it's published. Otherwise, publishing is prevented when we save any drafts.
        template.isDirty = versionType !== TemplateVersionType.PUBLISHED;

        // Pass the noTouch flag to avoid default behavior of setting isDirty, modified, etc.
        const updated = await template.update(context, true);
        if (updated && !updated.hasErrors()) return created;

        const msg = `Unable to update template: ${template.id}`;
        context.logger.error(prepareObjectForLogs(updated.errors), msg);
        throw new Error(msg);
      }
    } catch (err) {
      context.logger.error(prepareObjectForLogs(err), `Unable to create a new version for template: ${template.id}`);
      throw new Error(err.message);
    }
  } else {
    const msg = `Unable to generate a new version of template ${template.id}`;
    context.logger.error(prepareObjectForLogs(created.errors), msg);
    throw new Error(msg);
  }
  // Something went wrong, so return a null instead
  return null;
}

// Make a copy of the specified Template or PublishedTemplate
export const cloneTemplate = (
  clonedById: number,
  newOwnerId: string,
  template: Template | VersionedTemplate
): Template => {
  // If the incoming is a VersionedTemplate, then use the templateId (the template it was based off of)
  const sourceId = Object.keys(template).includes('templateId') ? template['templateId'] : template.id;
  const templateCopy = new Template({
    name: template.name,
    description: template.description,
    languageId: template.languageId,
    ownerId: newOwnerId,
    sourceTemplateId: sourceId,
  });
  // Fo some reason this doesn't work when passing in the constructor.
  templateCopy.createdById = clonedById;

  // TODO: Copy all of the Sections and Questions

  return templateCopy;
}

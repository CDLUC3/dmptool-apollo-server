import { MyContext } from "../context";
import { GuidanceGroup } from "../models/GuidanceGroup";
import { Guidance } from "../models/Guidance";
import { PlanGuidance } from "../models/Guidance";
import { Affiliation } from "../models/Affiliation";
import { VersionedGuidanceGroup } from "../models/VersionedGuidanceGroup";
import { VersionedGuidance } from "../models/VersionedGuidance";
import { VersionedSection } from "../models/VersionedSection";
import { VersionedQuestion } from "../models/VersionedQuestion";
import { Plan } from "../models/Plan";
import { VersionedTemplate } from "../models/VersionedTemplate";
import { prepareObjectForLogs } from "../logger";
import { getCurrentDate } from "../utils/helpers";
import { isSuperAdmin } from "./authService";

export enum GuidanceSourceType {
  BEST_PRACTICE = 'BEST_PRACTICE',
  TEMPLATE_OWNER = 'TEMPLATE_OWNER',
  USER_AFFILIATION = 'USER_AFFILIATION',
  USER_SELECTED = 'USER_SELECTED'
}

export interface GuidanceItem {
  id?: number;
  title?: string;
  guidanceText: string;
}

export interface GuidanceSource {
  id: string;
  type: GuidanceSourceType;
  label: string;
  shortName: string;
  orgURI: string;
  items: GuidanceItem[];
  hasGuidance: boolean;
}
interface TagRow { 
  id: number; 
  name: string 
};

// Check if the user has permission to access the GuidanceGroup
export const hasPermissionOnGuidanceGroup = async (
  context: MyContext,
  guidanceGroupId: number
): Promise<boolean> => {
  const guidanceGroup = await GuidanceGroup.findById('hasPermissionOnGuidanceGroup', context, guidanceGroupId);

  if (!guidanceGroup) {
    return false;
  }

  // User must be from the same organization as the guidance group OR be a super admin
  return context?.token?.affiliationId === guidanceGroup.affiliationId || isSuperAdmin(context?.token);
};

// Creates a new Version/Snapshot of the specified GuidanceGroup
// - Creates a new VersionedGuidanceGroup including all of the related Guidance
// - Resets the isDirty flag on the GuidanceGroup
// - Sets active flag to true on new version and false on all previous versions
export const publishGuidanceGroup = async (
  context: MyContext,
  guidanceGroup: GuidanceGroup,
): Promise<boolean> => {
  const reference = 'publishGuidanceGroup';

  // If the guidance group has no id then it has not yet been saved so throw an error
  if (!guidanceGroup.id) {
    throw new Error('Cannot publish unsaved GuidanceGroup');
  }

  // Get the current version number
  const existingVersions = await VersionedGuidanceGroup.findByGuidanceGroupId(reference, context, guidanceGroup.id);
  const nextVersion = existingVersions.length > 0 ? Math.max(...existingVersions.map(v => v.version || 0)) + 1 : 1;

  // Create the new Version
  const versionedGuidanceGroup = new VersionedGuidanceGroup({
    guidanceGroupId: guidanceGroup.id,
    version: nextVersion,
    bestPractice: guidanceGroup.bestPractice,
    optionalSubset: guidanceGroup.optionalSubset,
    active: true,
    name: guidanceGroup.name,
    description: guidanceGroup.description,
    createdById: context.token?.id,
    modifiedById: context.token?.id,
  });

  try {
    const created = await versionedGuidanceGroup.create(context);

    // If the creation was successful
    if (created && !created.hasErrors()) {
      // Deactivate all previous versions
      await VersionedGuidanceGroup.deactivateAll(reference, context, guidanceGroup.id);

      // Set this version as active (in case deactivateAll affected it)
      created.active = true;
      await created.update(context, true);

      // Create a version for all the associated guidance items
      const guidanceItems = await Guidance.findByGuidanceGroupId(reference, context, guidanceGroup.id);
      let allGuidanceWereVersioned = true;

      for (const guidance of guidanceItems) {
        const guidanceInstance = new Guidance({
          ...guidance
        });
        const passed = await generateGuidanceVersion(context, guidanceInstance, created.id);
        if (!passed) {
          allGuidanceWereVersioned = false;
        }
      }

      // Only continue if all the associated guidance were properly versioned
      if (allGuidanceWereVersioned) {
        // Reset the dirty flag on the guidance group and update the published info
        guidanceGroup.isDirty = false;
        guidanceGroup.latestPublishedVersion = nextVersion.toString();
        guidanceGroup.latestPublishedDate = getCurrentDate();
        const updated = await guidanceGroup.update(context, true);

        if (updated && !updated.hasErrors()) return true;

        const msg = `Unable to set the isDirty flag for guidance group: ${guidanceGroup.id}`;
        context.logger.error(prepareObjectForLogs(updated), msg);
        throw new Error(msg);
      }
    } else {
      const msg = `Unable to create a new version for guidance group: ${guidanceGroup.id}`;
      context.logger.error(prepareObjectForLogs(created), msg);
      throw new Error(msg);
    }
  } catch (err) {
    context.logger.error(prepareObjectForLogs(err), `Unable to generate a new version for guidance group: ${guidanceGroup.id}`);
    throw err;
  }

  return false;
};

// Unpublish a GuidanceGroup by setting all versions to inactive
export const unpublishGuidanceGroup = async (
  context: MyContext,
  guidanceGroup: GuidanceGroup,
): Promise<boolean> => {
  const reference = 'unpublishGuidanceGroup';

  if (!guidanceGroup.id) {
    throw new Error('Cannot unpublish unsaved GuidanceGroup');
  }

  try {
    // Deactivate all versions
    const success = await VersionedGuidanceGroup.deactivateAll(reference, context, guidanceGroup.id);

    if (success) {
      return true;
    } else {
      const msg = `Unable to unpublish guidance group: ${guidanceGroup.id}`;
      context.logger.error(prepareObjectForLogs({ guidanceGroupId: guidanceGroup.id }), msg);
      throw new Error(msg);
    }
  } catch (err) {
    context.logger.error(prepareObjectForLogs(err), `Unable to unpublish guidance group: ${guidanceGroup.id}`);
    throw err;
  }
};

// Helper function to create a version of a Guidance item
const generateGuidanceVersion = async (
  context: MyContext,
  guidance: Guidance,
  versionedGuidanceGroupId: number,
): Promise<boolean> => {

  if (!guidance.id) {
    throw new Error('Cannot publish unsaved Guidance');
  }

  try {
    // Create a single VersionedGuidance entry (not one per tag)
    const versionedGuidance = new VersionedGuidance({
      versionedGuidanceGroupId: versionedGuidanceGroupId,
      guidanceId: guidance.id,
      guidanceText: guidance.guidanceText,
      tagId: guidance.tagId,
      createdById: guidance.createdById,
      created: guidance.created,
      modifiedById: guidance.modifiedById,
      modified: guidance.modified,
    });

    const created = await versionedGuidance.create(context);

    if (!created || created.hasErrors()) {
      const msg = `Unable to create versioned guidance for guidance: ${guidance.id}`;
      context.logger.error(prepareObjectForLogs(created), msg);
      return false;
    }

    return true;
  } catch (err) {
    context.logger.error(prepareObjectForLogs(err), `Unable to generate version for guidance: ${guidance.id}`);
    return false;
  }
};

// Mark a GuidanceGroup as dirty when any of its guidance is modified
export const markGuidanceGroupAsDirty = async (
  context: MyContext,
  guidanceGroupId: number,
): Promise<void> => {
  const reference = 'markGuidanceGroupAsDirty';

  try {
    const guidanceGroup = await GuidanceGroup.findById(reference, context, guidanceGroupId);

    if (guidanceGroup) {
      // Only mark as dirty if there's an active version
      const activeVersion = await VersionedGuidanceGroup.findActiveByGuidanceGroupId(reference, context, guidanceGroupId);

      if (activeVersion) {
        guidanceGroup.isDirty = true;
        await guidanceGroup.update(context, true);
      }
    }
  } catch (err) {
    context.logger.error(prepareObjectForLogs(err), `Unable to mark guidance group as dirty: ${guidanceGroupId}`);
    throw err;
  }
};


/**
 * Group guidance by tag and combine text so we can display together for each affiliation/source
 */
function groupGuidanceByTag(
  versionedGuidanceItems: VersionedGuidance[],
  sectionTagIds: number[],
  tagsMap: Record<number, string>
): GuidanceItem[] {

  // Filter to only include guidance for tags in this section
  const relevantGuidance = versionedGuidanceItems.filter(vg =>
    vg.tagId && sectionTagIds.includes(vg.tagId)
  );

  // Group by tagId and combine texts
  const itemsByTag = new Map<number, string[]>();

  relevantGuidance.forEach(vg => {
    if (!vg.tagId || !vg.guidanceText) return;

    if (!itemsByTag.has(vg.tagId)) {
      itemsByTag.set(vg.tagId, []);
    }
    const arr = itemsByTag.get(vg.tagId);
    if (arr) {
      arr.push(vg.guidanceText);
    }
  });

  // Convert to items array
  const items: GuidanceItem[] = [];
  itemsByTag.forEach((texts, tagId) => {
    items.push({
      id: tagId,
      title: tagsMap[tagId] || '', // Get tag name from tagsMap
      guidanceText: texts.join('\n\n') // Join multiple guidance texts
    });
  });

  return items;
}

/**
 * Get all guidance sources for a plan (optionally filtered by section or question)
 * And order them by priority:
 * 1. Best Practice Guidance
 * 2. User's Affiliation Guidance
 * 3. Template Owner's Guidance
 * 4. User-Selected Guidance
 */
export async function getGuidanceSourcesForPlan(
  context: MyContext,
  planId: number,
  versionedSectionId?: number,
  versionedQuestionId?: number
): Promise<GuidanceSource[]> {
  const reference = 'getGuidanceSourcesForPlan';

  try {
    // Get plan details
    const plan = await Plan.findById(reference, context, planId);
    if (!plan) {
      throw new Error(`Plan ${planId} not found`);
    }

    // Get the versioned template id from the plan
    const versionedTemplateId = plan.versionedTemplateId;

    if (!versionedTemplateId) {
      return [];
    }

    // Get user ID from token
    const userId = context.token?.id;
    if (!userId) {
      return [];
    }

    // Get user's affiliation
    const userAffiliationUri = context.token?.affiliationId || null;

    // ============================================================
    // First, get guidance text from template/section/question, and tagsMap
    // ============================================================

    // Get section tag IDs and section-level guidance
    let tagsMap: Record<number, string>;
    let guidanceText: string | null = null;

    // If there is a versionedQuestionId provided, get tags and guidance for that question's section
    if (versionedQuestionId) {
      // Question-specific query: get question's tags and guidance
      const question = await VersionedQuestion.findById(reference, context, versionedQuestionId);
      if (!question) {
        return [];
      }

      // Get tags for the question's section
      tagsMap = await getSectionTags(context, question.versionedSectionId);
      guidanceText = question.guidanceText || null; // Question-level guidance
    } else if (versionedSectionId) { // Otherwise, get tags and guidance for the section id provided

      tagsMap = await getSectionTags(context, versionedSectionId);
      const section = await VersionedSection.findById(reference, context, versionedSectionId);
      guidanceText = section?.guidance || null; // Section-level guidance
    } 

    // Get template owner info
    const versionedTemplate = await VersionedTemplate.findById(reference, context, versionedTemplateId);
    const templateOwnerUri = versionedTemplate?.ownerId;

    // If there are no tag ids, then just return the guidanceText from the template owner
    const sectionTagIds = Object.keys(tagsMap).map(Number);
    if (sectionTagIds.length === 0) {
      // If there's guidance text, return it as template owner's guidance
      if (guidanceText) {
        if (templateOwnerUri) {
          const affiliation = await Affiliation.findByURI(reference, context, templateOwnerUri);
          if (affiliation) {
            return [{
              id: `affiliation-${templateOwnerUri}`,
              type: GuidanceSourceType.TEMPLATE_OWNER,
              label: affiliation.displayName || affiliation.name,
              shortName: (affiliation.acronyms && affiliation.acronyms[0]) ||
                affiliation.displayName ||
                affiliation.name,
              orgURI: templateOwnerUri,
              items: [{
                title: affiliation.displayName || affiliation.name,
                guidanceText
              }],
              hasGuidance: true
            }];
          }
        }
      }
      return [];
    }

    // Get user-selected affiliations from planGuidance table
    const userSelections = await PlanGuidance.findByPlanAndUserId(
      reference,
      context,
      planId,
      userId
    );


    const guidanceSources: GuidanceSource[] = [];
    const processedOrgURIs = new Set<string>();

    // ============================================================
    // Now check guidance from guidance groups in order of priority
    // ============================================================

    // ============================================================
    // 1. Best Practice Guidance
    // ============================================================
    const bestPracticeGuidance = await VersionedGuidance.findBestPracticeByTagIds(
      reference,
      context,
      sectionTagIds
    );

    if (bestPracticeGuidance.length > 0) {
      const items = groupGuidanceByTag(bestPracticeGuidance, sectionTagIds, tagsMap);
      if (items.length > 0) {
        guidanceSources.push({
          id: 'bestPractice',
          type: GuidanceSourceType.BEST_PRACTICE,
          label: 'DMP Tool',
          shortName: 'DMP Tool',
          orgURI: 'bestPractice',
          items,
          hasGuidance: true
        });
      }
    }

    // ============================================================
    // 2. Get user's affiliation guidance
    // ============================================================
    if (userAffiliationUri) {
      const userAffiliationSelection = userSelections.find(
        selection => selection.affiliationId === userAffiliationUri
      );

      if (userAffiliationSelection) {
        const affiliation = await Affiliation.findByURI(reference, context, userAffiliationUri);
        
        if (affiliation) {
          // Fetch TAG-BASED guidance
          const tagBasedGuidance = await VersionedGuidance.findByAffiliationAndTagIds(
            reference,
            context,
            userAffiliationUri,
            sectionTagIds
          );

          const items = groupGuidanceByTag(tagBasedGuidance, sectionTagIds, tagsMap);

          if (items.length > 0) {
            guidanceSources.push({
              id: `affiliation-${userAffiliationUri}`,
              type: GuidanceSourceType.USER_AFFILIATION,
              label: affiliation.displayName || affiliation.name,
              shortName: (affiliation.acronyms && affiliation.acronyms[0]) ||
                affiliation.displayName ||
                affiliation.name,
              orgURI: userAffiliationUri,
              items,
              hasGuidance: true
            });

            processedOrgURIs.add(userAffiliationUri);
          }
        }
      }
    }

    // ============================================================
    // 3. Template Owner's Guidance
    // ============================================================
    if (templateOwnerUri && !processedOrgURIs.has(templateOwnerUri)) {
      const templateOwnerSelection = userSelections.find(
        selection => selection.affiliationId === templateOwnerUri
      );

      if (templateOwnerSelection) {
        const affiliation = await Affiliation.findByURI(reference, context, templateOwnerUri);
        
        if (affiliation) {
          // Fetch TAG-BASED guidance
          const tagBasedGuidance = await VersionedGuidance.findByAffiliationAndTagIds(
            reference,
            context,
            templateOwnerUri,
            sectionTagIds
          );

          const items = groupGuidanceByTag(tagBasedGuidance, sectionTagIds, tagsMap);

          // If there's section-level guidance, add it FIRST
          if (guidanceText) {
            items.unshift({
              title: affiliation.displayName || affiliation.name,
              guidanceText
            });
          }

          if (items.length > 0) {
            guidanceSources.push({
              id: `affiliation-${templateOwnerUri}`,
              type: GuidanceSourceType.TEMPLATE_OWNER,
              label: affiliation.displayName || affiliation.name,
              shortName: (affiliation.acronyms && affiliation.acronyms[0]) ||
                affiliation.displayName ||
                affiliation.name,
              orgURI: templateOwnerUri,
              items,
              hasGuidance: true
            });

            processedOrgURIs.add(templateOwnerUri);
          }
        }
      }
    }

    // ============================================================
    // 4. User-Selected Guidance (everything else)
    // ============================================================
    for (const selection of userSelections) {
      const affiliationUri = selection.affiliationId;

      if (!affiliationUri || processedOrgURIs.has(affiliationUri)) {
        continue;
      }

      // Fetch affiliation details
      const affiliation = await Affiliation.findByURI(reference, context, affiliationUri);
      if (!affiliation) {
        continue;
      }

      const tagBasedGuidance = await VersionedGuidance.findByAffiliationAndTagIds(
        reference,
        context,
        affiliationUri,
        sectionTagIds
      );

      const items = groupGuidanceByTag(tagBasedGuidance, sectionTagIds, tagsMap);

      if (items.length > 0) {
        guidanceSources.push({
          id: `affiliation-${affiliationUri}`,
          type: GuidanceSourceType.USER_SELECTED,
          label: affiliation.displayName || affiliation.name,
          shortName: (affiliation.acronyms && affiliation.acronyms[0]) ||
            affiliation.displayName ||
            affiliation.name,
          orgURI: affiliationUri,
          items,
          hasGuidance: true
        });

        processedOrgURIs.add(affiliationUri);
      }
    }

    return guidanceSources;
  } catch (err) {
    context.logger.error({ err, planId, versionedSectionId, versionedQuestionId }, 'Error getting guidance sources for plan');
    return [];
  }
}


/**
 * Get section tags for a specific section (tagId -> tagName)
 */
export async function getSectionTags(
  context: MyContext,
  versionedSectionId: number
): Promise<Record<number, string>> {
  const sql = `
    SELECT DISTINCT
      t.id,
      t.name
    FROM tags t
    JOIN versionedSectionTags vst ON t.id = vst.tagId
    WHERE vst.versionedSectionId = ?
    ORDER BY t.name;
  `;

  try {
    const results = await PlanGuidance.query(context, sql, [versionedSectionId.toString()]);
    const tagsMap: Record<number, string> = {};

    if (results) {
      (results as TagRow[]).forEach((row) => {
        tagsMap[row.id] = row.name;
      });
    }

    return tagsMap;
  } catch (err) {
    context.logger.error({ err, sql, versionedSectionId }, 'Error fetching section tags');
    return {};
  }
}

/**
 * Get section tag IDs for all sections in a template (just IDs, no names)
 */
export async function getSectionTagIds(
  context: MyContext,
  versionedTemplateId: number
): Promise<number[]> {
  const sql = `
    SELECT DISTINCT vst.tagId
    FROM versionedSectionTags vst
    JOIN versionedSections vs ON vst.versionedSectionId = vs.id
    WHERE vs.versionedTemplateId = ?
    ORDER BY vst.tagId;
  `;

  try {
    const results = await PlanGuidance.query(context, sql, [versionedTemplateId.toString()]);
    return results ? results.map((row: { tagId: number }) => row.tagId) : [];
  } catch (err) {
    context.logger.error({ err, sql, versionedTemplateId }, 'Error fetching section tag IDs');
    return [];
  }
}

/**
 * Get section tags map (tagId -> tagName) for all sections in a template
 */
export async function getSectionTagsMap(
  context: MyContext,
  versionedTemplateId: number
): Promise<Record<number, string>> {
  const sql = `
    SELECT DISTINCT
      t.id,
      t.name
    FROM tags t
    JOIN versionedSectionTags vst ON t.id = vst.tagId
    JOIN versionedSections vs ON vst.versionedSectionId = vs.id
    WHERE vs.versionedTemplateId = ?
    ORDER BY t.name;
  `;

  try {
    const results = await PlanGuidance.query(context, sql, [versionedTemplateId.toString()]);
    const tagsMap: Record<number, string> = {};

    if (results) {
      (results as TagRow[]).forEach((row) => {
        tagsMap[row.id] = row.name;
      });
    }

    return tagsMap;
  } catch (err) {
    context.logger.error({ err, sql, versionedTemplateId }, 'Error fetching section tags');
    return {};
  }
}

/**
 * Add a PlanGuidance record for a plan, affiliation, and user.
 */
export async function addPlanGuidance(
  context: MyContext,
  planId: number,
  affiliationId: number | string,
  userId: number
): Promise<boolean> {
  try {
    const planGuidance = new PlanGuidance({
      planId,
      affiliationId,
      userId
    });
    const created = await planGuidance.create(context);
    return !!created && !created.hasErrors?.();
  } catch (err) {
    context.logger.error(prepareObjectForLogs(err), 'Failed to add PlanGuidanceAffiliation');
    return false;
  }
}

/**
 * Get managed affiliations with published template-specific or tag-based guidance
 * Returns affiliation URIs that have:
 * 1. Template-specific guidance (section/question level) as template owner
 * 2. Published versionedGuidance matching all tags in the template
 */
export async function getAffiliationsWithGuidanceForTemplate(
  context: MyContext,
  versionedTemplateId: number
): Promise<string[]> {
  const reference = 'getAffiliationsWithGuidanceForTemplate';

  try {
    const affiliationUris = new Set<string>();

    // ============================================================
    // 1. Check for template-specific guidance (section/question level)
    // ============================================================
    
    // Get the template to find its owner
    const template = await VersionedTemplate.findById(reference, context, versionedTemplateId);
    if (!template) {
      return [];
    }

    const templateOwnerUri = template.ownerId;
    const userAffilitationUri = context.token?.affiliationId || null;

    // Check if ANY section or question in the template has guidance
    const sectionsQuery = `
      SELECT COUNT(*) as count
      FROM versionedSections
      WHERE versionedTemplateId = ?
        AND guidance IS NOT NULL
        AND guidance != ''
    `;
    const sectionsResult = await Affiliation.query(context, sectionsQuery, [versionedTemplateId.toString()], reference);
    
    const questionsQuery = `
      SELECT COUNT(*) as count
      FROM versionedQuestions
      WHERE versionedTemplateId = ?
        AND guidanceText IS NOT NULL
        AND guidanceText != ''
    `;
    const questionsResult = await Affiliation.query(context, questionsQuery, [versionedTemplateId.toString()], reference);

    const hasGuidance = (sectionsResult[0]?.count > 0) || (questionsResult[0]?.count > 0);

    if (hasGuidance && templateOwnerUri) {
      affiliationUris.add(templateOwnerUri);
    }

    // ============================================================
    // 2. Check if template owner and/or user affiliation have guidance matching any tags in the template
    // ============================================================
    
    // Get all section tag IDs for the template
    const sectionTagIds = await getSectionTagIds(context, versionedTemplateId);

    if (sectionTagIds.length > 0) {
      const tagPlaceholders = sectionTagIds.map(() => '?').join(',');
      
      const sql = `
        SELECT COUNT(*) as count
        FROM guidanceGroups gg
        INNER JOIN versionedGuidanceGroups vgg ON vgg.guidanceGroupId = gg.id
        INNER JOIN versionedGuidance vg ON vg.versionedGuidanceGroupId = vgg.id
        INNER JOIN guidance g ON g.id = vg.guidanceId
        WHERE gg.affiliationId = ?
          AND vgg.active = 1
          AND vg.tagId IN (${tagPlaceholders})
          AND g.guidanceText IS NOT NULL
          AND g.guidanceText != ''
      `;

      // Check template owner
      if (templateOwnerUri) {
        const values = [templateOwnerUri, ...sectionTagIds.map(id => id.toString())];
        const results = await Affiliation.query(context, sql, values, reference);

        if (results && results[0]?.count > 0) {
          affiliationUris.add(templateOwnerUri);
        }
      }

      // Check user affiliation (if different from template owner)
      if (userAffilitationUri && userAffilitationUri !== templateOwnerUri) {
        const values = [userAffilitationUri, ...sectionTagIds.map(id => id.toString())];
        const results = await Affiliation.query(context, sql, values, reference);

        if (results && results[0]?.count > 0) {
          affiliationUris.add(userAffilitationUri);
        }
      }
    }

    return Array.from(affiliationUris);
  } catch (err) {
    context.logger.error({ err, versionedTemplateId }, 'Error getting affiliations with guidance for template');
    return [];
  }
}
import { MyContext } from "../context";
import { GuidanceGroup } from "../models/GuidanceGroup";
import { Guidance } from "../models/Guidance";
import { PlanGuidance } from "../models/Guidance";
import { Affiliation } from "../models/Affiliation";
import { VersionedGuidanceGroup } from "../models/VersionedGuidanceGroup";
import { VersionedGuidance } from "../models/VersionedGuidance";
import { prepareObjectForLogs } from "../logger";
import { getCurrentDate } from "../utils/helpers";
import { isSuperAdmin } from "./authService";

export interface GuidanceItem {
  id?: number;
  title?: string;
  guidanceText: string;
}

export interface GuidanceSource {
  id: string;
  type: 'BEST_PRACTICE' | 'TEMPLATE_OWNER' | 'USER_AFFILIATION' | 'USER_SELECTED';
  label: string;
  shortName: string | null;
  orgURI: string;
  items: GuidanceItem[];
  hasGuidance: boolean;
}

interface VersionedGuidanceRow {
  guidanceText: string;
  tagId: number;
  tagName: string;
  affiliationId: string;
}

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
 * Group guidance by tag and combine texts
 */
function groupGuidanceByTag(
  guidanceRows: VersionedGuidanceRow[],
  sectionTagIds: number[]
): GuidanceItem[] {
  // Filter to only include guidance for tags in this section
  const relevantGuidance = guidanceRows.filter(row =>
    sectionTagIds.includes(row.tagId)
  );

  // Group by tagId and combine texts
  const itemsByTag = new Map<number, { texts: string[]; tagName: string }>();

  relevantGuidance.forEach(row => {
    if (!itemsByTag.has(row.tagId)) {
      itemsByTag.set(row.tagId, { texts: [], tagName: row.tagName });
    }
    itemsByTag.get(row.tagId)!.texts.push(row.guidanceText);
  });

  // Convert to items array
  const items: GuidanceItem[] = [];
  itemsByTag.forEach((value, tagId) => {
    items.push({
      id: tagId,
      title: value.tagName,
      guidanceText: value.texts.join('')
    });
  });

  return items;
}

/**
 * Fetch guidance for a specific affiliation
 */
async function fetchAffiliationGuidance(
  context: MyContext,
  affiliationId: string,
  reference: string,
  tagIds: number[]
): Promise<VersionedGuidanceRow[]> {
  if (tagIds.length === 0) {
    return [];
  }

  const placeholders = tagIds.map(() => '?').join(',');
  const sql = `
    SELECT 
      vg.guidanceText,
      vg.tagId,
      t.name as tagName,
      gg.affiliationId
    FROM versionedGuidance vg
    JOIN guidanceGroups gg ON vg.guidanceGroupId = gg.id
    JOIN tags t ON vg.tagId = t.id
    WHERE gg.affiliationId = ?
      AND vg.tagId IN (${placeholders})
      AND vg.versionNumber = gg.latestPublishedVersion
    ORDER BY vg.tagId
  `;

  try {

    const results = await PlanGuidance.query(context, sql, [affiliationId.toString()], reference);
    return Array.isArray(results) ? results : [];
  } catch (err) {
    context.logger.error({ err, sql, affiliationId, tagIds }, 'Error fetching affiliation guidance');
    return [];
  }
}

/**
 * Fetch best practice guidance
 */
async function fetchBestPracticeGuidance(
  context: MyContext,
  reference: string,
  tagIds: number[]
): Promise<VersionedGuidanceRow[]> {
  if (tagIds.length === 0) {
    return [];
  }

  const placeholders = tagIds.map(() => '?').join(',');
  const sql = `
    SELECT 
      vg.guidanceText,
      vg.tagId,
      t.name as tagName,
      'bestPractice' as affiliationId
    FROM versionedGuidance vg
    JOIN guidanceGroups gg ON vg.guidanceGroupId = gg.id
    JOIN tags t ON vg.tagId = t.id
    WHERE gg.bestPractice = 1
      AND vg.tagId IN (${placeholders})
      AND vg.versionNumber = gg.latestPublishedVersion
    ORDER BY vg.tagId
  `;

  try {
    // Convert tagIds to strings to match expected parameter type
    const tagIdParams = tagIds.map(String);
    const results = await PlanGuidance.query(context, sql, tagIdParams, reference);
    return Array.isArray(results) ? results : [];
  } catch (err) {
    context.logger.error({ err, sql, tagIds }, 'Error fetching best practice guidance');
    return [];
  }
}

/**
 * Get guidance sources for a specific section
 * This is the main function that combines all guidance from different sources
 */
export async function getGuidanceSourcesForSection(
  context: MyContext,
  reference: string,
  planId: number,
  sectionTagIds: number[],
  sectionGuidance: string | null,
  templateOwnerUri: string | null,
  templateOwnerName: string | null,
  templateOwnerAcronyms: string[] | null,
  userAffiliationUri: string | null,
  userAffiliationName: string | null,
  userAffiliationAcronyms: string[] | null,
  userId: number
): Promise<GuidanceSource[]> {
  const guidanceSources: GuidanceSource[] = [];
  const processedOrgURIs = new Set<string>();

  // Skip if no tags
  if (sectionTagIds.length === 0) {
    return guidanceSources;
  }

  // 1. Best Practice Guidance
  const bestPracticeGuidance = await fetchBestPracticeGuidance(context, reference, sectionTagIds);
  if (bestPracticeGuidance.length > 0) {
    const items = groupGuidanceByTag(bestPracticeGuidance, sectionTagIds);
    if (items.length > 0) {
      guidanceSources.push({
        id: 'bestPractice',
        type: 'BEST_PRACTICE',
        label: 'DMP Tool',
        shortName: 'DMP Tool',
        orgURI: 'bestPractice',
        items,
        hasGuidance: true
      });
    }
  }

  // 2. Template Owner Guidance
  if (templateOwnerUri && !processedOrgURIs.has(templateOwnerUri)) {
    const ownerGuidance = await fetchAffiliationGuidance(context, templateOwnerUri, reference, sectionTagIds);
    const items = groupGuidanceByTag(ownerGuidance, sectionTagIds);

    // Also include section-level guidance if it exists
    if (sectionGuidance) {
      items.unshift({
        title: templateOwnerName || 'Template Owner',
        guidanceText: sectionGuidance
      });
    }

    if (items.length > 0) {
      guidanceSources.push({
        id: `template-owner-${templateOwnerUri}`,
        type: 'TEMPLATE_OWNER',
        label: templateOwnerName || 'Template Owner',
        shortName: (templateOwnerAcronyms && templateOwnerAcronyms[0]) || templateOwnerName || 'Template Owner',
        orgURI: templateOwnerUri,
        items,
        hasGuidance: true
      });
      processedOrgURIs.add(templateOwnerUri);
    }
  }

  // 3. User Affiliation Guidance
  if (userAffiliationUri && !processedOrgURIs.has(userAffiliationUri)) {
    const userAffGuidance = await fetchAffiliationGuidance(context, userAffiliationUri, reference, sectionTagIds);
    const items = groupGuidanceByTag(userAffGuidance, sectionTagIds);

    if (items.length > 0) {
      guidanceSources.push({
        id: `user-affiliation-${userAffiliationUri}`,
        type: 'USER_AFFILIATION',
        label: userAffiliationName || 'Your Organization',
        shortName: (userAffiliationAcronyms && userAffiliationAcronyms[0]) || userAffiliationName || 'Your Org',
        orgURI: userAffiliationUri,
        items,
        hasGuidance: true
      });
      processedOrgURIs.add(userAffiliationUri);
    }
  }

  // 4. User-Selected Affiliations Guidance
  const userSelections = await PlanGuidance.findByPlanIdAndUserId(
    'getGuidanceSourcesForSection',
    context,
    planId,
    userId
  );

  for (const selection of userSelections) {
    const affiliationUri = selection.affiliationId;

    // Skip if already processed
    if (!affiliationUri || processedOrgURIs.has(affiliationUri)) {
      continue;
    }

    // Fetch the affiliation object using the affiliationId
    const affiliation = await Affiliation.findByURI(reference, context, affiliationUri);
    if (!affiliation) {
      continue;
    }

    const selectedGuidance = await fetchAffiliationGuidance(context, affiliationUri, reference, sectionTagIds);
    const items = groupGuidanceByTag(selectedGuidance, sectionTagIds);

    if (items.length > 0) {
      guidanceSources.push({
        id: `user-selected-${affiliationUri}`,
        type: 'USER_SELECTED',
        label: affiliation.displayName || affiliation.name,
        shortName: (affiliation.acronyms && affiliation.acronyms[0]) || affiliation.displayName || affiliation.name,
        orgURI: affiliationUri,
        items,
        hasGuidance: true
      });
      processedOrgURIs.add(affiliationUri);
    }
  }

  return guidanceSources;
}

/**
 * Get section tags map (tagId -> tagName)
 */
export async function getSectionTagsMap(
  context: MyContext,
  versionedSectionId: number
): Promise<Record<number, string>> {
  const sql = `
    SELECT t.id, t.name
    FROM tags t
    JOIN versionedSectionTags vst ON t.id = vst.tagId
    WHERE vst.versionedSectionId = ?
  `;

  try {
    const results = await PlanGuidance.query(context, sql, [versionedSectionId.toString()]);
    return Array.isArray(results) ? results : [];
    const tagsMap: Record<number, string> = {};

    if (results) {
      results.forEach((row: any) => {
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
 * Add a PlanGuidanceAffiliation record for a plan, affiliation, and user.
 */
export async function addPlanGuidanceAffiliation(
  context: MyContext,
  planId: number,
  affiliationId: number | string,
  userId: number
): Promise<boolean> {
  try {
    const planGuidanceAffiliation = new PlanGuidance({
      planId,
      affiliationId,
      userId
    });
    const created = await planGuidanceAffiliation.create(context);
    return !!created && !created.hasErrors?.();
  } catch (err) {
    context.logger.error(prepareObjectForLogs(err), 'Failed to add PlanGuidanceAffiliation');
    return false;
  }
}

import { generalConfig } from "../config/generalConfig";
import { MyContext } from "../context";
import { createDMP, deleteDMP, DMPExists, getDMP, tombstoneDMP, updateDMP } from "../datasources/dynamo";
import { prepareObjectForLogs } from "../logger";
import { planToDMPCommonStandard } from "../services/commonStandardService";
import { DMPCommonStandard } from "../types/DMP";
import { Plan } from "./Plan";
import {isNullOrUndefined} from "../utils/helpers";

/*
 * Plan versioning management:
 *
 * A Plan always has a "latest" version that is the most recent snapshot of the DMP.
 *
 * When a plan is first created, an initial version snapshot is created. this becomes the "latest" version.
 * This initial version has the following properties:
 *  - created: current timestamp
 *  - modified: current timestamp
 *  - dmpId: unique identifier for the DMP
 *
 * When a plan (or any aspect of the parent project) is updated, a check is performed to see if the
 * "latest" version of the DMP has been modified within the last x hour(s) (x is defined in
 * generalConfig.versionPlanAfter). If it has been modified within that time frame, the "latest" version
 * is updated directly. If it has not been modified within that time frame, a version snapshot is created.
 *
 * A version snapshot is the state of the "latest" version at the time the change is being made. The
 * version snapshot is created and then the changes are made to the "latest" version.
 *
 * Each time a change is made, the "latest" version's modified timestamp is updated to the current timestamp.
 */

export const generateVersionSnapshot = async (
  context: MyContext,
  latestVersion: DMPCommonStandard,
  reference = 'PlanVersion.generateVersionSnapshot'
): Promise<string | null> => {
  const dmpId = latestVersion.dmp_id?.identifier;
  const modified = latestVersion.modified;

  if (isNullOrUndefined(dmpId) || isNullOrUndefined(modified)) {
    context.logger.error(prepareObjectForLogs({ dmpId: latestVersion?.dmp_id?.identifier }), `${reference} - invalid DMP JSON`);
    return "Invalid DMP Id or Modified Timestamp";
  }

  const errMsg = "Unable to create a new version snapshot";
  try {
    const snapshot = await createDMP(context, dmpId, latestVersion, modified);
    if (isNullOrUndefined(snapshot)) {
      return errMsg;
    }
  } catch {
    return errMsg
  }
  return null;
}

// Create a new PlanVersion
export const addVersion = async (
  context: MyContext,
  plan: Plan,
  reference = 'PlanVersion.addVersion'
): Promise<Plan> => {
  const commonStandard = await planToDMPCommonStandard(context, reference, plan);
  if (!commonStandard) {
    plan.addError('general', 'Unable to convert the plan to the DMP Common Standard');
  }

  // First see if this is the first version of the plan
  const currentVersion = await latestVersion(context, plan, reference);
  if (currentVersion) {
    // There is already a latest version, so we are creating a snapshot before making changes
    context.logger.debug(prepareObjectForLogs({ plan }), `${reference} - creating a version snapshot`);
    await generateVersionSnapshot(context, currentVersion, reference);
  } else {
    // This is the first version of the plan
    context.logger.debug(prepareObjectForLogs({ plan }), `${reference} - creating an initial version`);
    const newPlanVersion = await createDMP(context, plan.dmpId, commonStandard);
    if (!newPlanVersion) {
      context.logger.error(prepareObjectForLogs({ plan }), `${reference} - Unable to create an initial version snapshot`);
      plan.addError('general', 'Unable to create a new version snapshot');
    }
  }
  return new Plan(plan);
}

// Update the latest version of the Plan
export const updateVersion = async (
  context: MyContext,
  plan: Plan,
  reference = 'PlanVersion.updateVersion'
): Promise<Plan> => {
  const commonStandard = await planToDMPCommonStandard(context, reference, plan);
  if (!commonStandard) {
    plan.addError('general', 'Unable to convert the plan to the DMP Common Standard');
  }

  // If the lastModified date is not within the last hour, create a new version snapshot
  const mostRecentVersion = await latestVersion(context, plan, reference);
  if (mostRecentVersion) {
    const lastModified = new Date(mostRecentVersion?.modified);
    const now = new Date();
    // Calculate the difference in hours between the lastModified and now
    const diff = Math.abs(now.getTime() - lastModified.getTime()) / 36e5;

    // If the change happened more than one hour since the lastSync date then generate a version snapshot
    if (diff >= generalConfig.versionPlanAfter) {
      const msg = `Plan last changed over ${generalConfig.versionPlanAfter} hour(s) ago, so creating a new version`;
      context.logger.debug(prepareObjectForLogs({ planId: plan.id }), msg);
      await addVersion(context, plan, reference);
    }

    // Now update the latest version
    context.logger.debug(prepareObjectForLogs({ plan }), `${reference} - updating Plan Version`);
    const updatedVersion = await updateDMP(context, commonStandard);
    if (!updatedVersion) {
      const msg = 'Unable to update the version snapshot';
      context.logger.error(prepareObjectForLogs({ plan }), `${reference} - ${msg}`);
      plan.addError('general', msg);
    }
  } else {
    plan.addError('general', 'Unable to find the latest version of the DMP');
  }
  return new Plan(plan);
}

// Delete/Tombstone the specified Plan Version (registered/published DMPs can only be Tombstoned!)
export const removeVersions = async (
  context: MyContext,
  plan: Plan,
  reference = 'PlanVersion.removeVersion'
): Promise<Plan> => {
  // Get the latest version and see if it is registered
  const mostRecentVersion = await latestVersion(context, plan, reference);
  // If the plan is registered then tombstone the DMP otherwise delete it
  if (mostRecentVersion?.registered) {
    context.logger.debug(prepareObjectForLogs({ dmpId: plan.dmpId }), `${reference} - tombstoning the DMP`);
    const tombstoned = await tombstoneDMP(context, plan.dmpId);
    if (!tombstoned) {
      plan.addError('general', 'Unable to tombstone the DMP');
    }
  } else {
    context.logger.debug(prepareObjectForLogs({ dmpId: plan.dmpId }), `${reference} - deleting all versions of the DMP`);
    await deleteDMP(context, plan.dmpId);
  }
  return new Plan(plan);
}

// Helper method to verify a Plan has a latest version
export const hasLatestVersion = async (
  context: MyContext,
  plan: Plan,
): Promise<boolean> => {
  return await DMPExists(context, plan.dmpId);
}

// Find all of the versions for a specific plan
export const findVersionsByDMPId = async (
  context: MyContext,
  dmpId: string,
  reference = 'PlanVersion.findVersionsByDMPId'
): Promise<DMPCommonStandard[] | []> => {
  context.logger.debug(prepareObjectForLogs({ dmpId }), `${reference} - retrieving the versions of the DMP`);
  const dmps = await getDMP(context, dmpId, null);
  return Array.isArray(dmps) && dmps.length > 0 ? dmps : [];
}

// Find a specific version of the plan
export const findVersionByTimestamp = async (
  context: MyContext,
  plan: Plan,
  versionTimestamp: string,
  reference = 'PlanVersion.findVersionByTimestamp'
): Promise<DMPCommonStandard | null> => {
  context.logger.error(prepareObjectForLogs({ dmpId: plan.dmpId }), `${reference} - retrieving the versions of the DMP`);
  const dmps = await getDMP(context, plan.dmpId, versionTimestamp);
  return Array.isArray(dmps) && dmps.length > 0 ? dmps[0] : null;
}

// Retrieve the latest version of the plan
export const latestVersion = async (
  context: MyContext,
  plan: Plan,
  reference = 'PlanVersion.latestVersion'
): Promise<DMPCommonStandard | null> => {
  context.logger.error(prepareObjectForLogs({ dmpId: plan.dmpId }), `${reference} - retrieving the latest version of the DMP`);
  const dmps = await getDMP(context, plan.dmpId, null);
  return Array.isArray(dmps) && dmps.length > 0 ? dmps[0] : null;
}

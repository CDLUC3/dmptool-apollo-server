
import { MyContext } from "../context";
import {
  maDMPExists,
  getMaDMPVersionTimestamps, getMaDMP,
} from "../datasources/dynamo";
import {DMP_LATEST_VERSION, DMPVersionType} from "@dmptool/utils";
import { Plan } from "./Plan";
import { DMPToolDMPType } from "@dmptool/types";

/*
 * Plan versioning management:
 *
 * Plan versions are also known as maDMP snapshots in this system.
 *
 * Versions are stored in the DynamoDB table in the maDMP format which is made
 * up of a combination of:
 * - The RDA Common Standard https://github.com/RDA-DMP-Common/RDA-DMP-Common-Standard
 * - DMP Tool specific extensions to that standard
 * See the @dmptool/types for details on the structure of these formats.
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


/**
 * Detect whether the Plan has a maDMP record
 *
 * @param context The Apollo context object
 * @param plan The Plan we want to check
 * @returns True if the Plan has a maDMP record, false otherwise.
 */
export const hasMaDMP = async (
  context: MyContext,
  plan: Plan,
): Promise<boolean> => {
  return await maDMPExists(context, plan.dmpId);
}

/**
 * Fetch all maDMP versions of the Plan
 *
 * @param context The Apollo context object
 * @param plan The Plan we want to check
 * @returns An array of timestamps for each version of the DMP. If the DMP has
 * no recorded versions, an empty array is returned.
 */
export const getMaDMPVersions = async (
  context: MyContext,
  plan: Plan,
): Promise<string[] | []> => {
  const versions: DMPVersionType[] = await getMaDMPVersionTimestamps(context, plan.dmpId);
  return versions.map((ver) => ver.modified);
}

/**
 * Fetch a specific maDMP version of the Plan
 *
 * @param context The Apollo context object
 * @param plan The Plan we want to check
 * @param timestamp The timestamp of the version we want to fetch
 * @returns The maDMP record for the specified version of the DMP or undefined
 * if the version does not exist.
 */
export const getMaDMPVersion = async (
  context: MyContext,
  plan: Plan,
  timestamp: string,
): Promise<DMPToolDMPType | undefined> => {
  const versions = await getMaDMP(
    context,
    plan.dmpId,
    timestamp,
    true
  );
  return Array.isArray(versions) && versions.length > 0 ? versions[0] : undefined;
}

/**
 * Fetch the latest maDMP version of the Plan
 *
 * @param context The Apollo context object
 * @param plan The Plan we want to check
 * @returns The maDMP record for the latest version of the DMP or undefined if
 * the Plan has no recorded versions.
 */
export const getLatestMaDMPVersion = async (
  context: MyContext,
  plan: Plan
): Promise<DMPToolDMPType | null> => {
  const versions = await getMaDMP(
    context,
    plan.dmpId,
    DMP_LATEST_VERSION,
    true
  );
  return Array.isArray(versions) && versions.length > 0 ? versions[0] : undefined;
}

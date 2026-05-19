import { MyContext } from "../context";
import { MemberRole } from "../models/MemberRole";
import { isNullOrUndefined } from "../utils/helpers";
import { PlanMember, ProjectMember } from "../models/Member";
import { Plan } from "../models/Plan";
import { Project } from "../models/Project";
import {
  createDMP, deleteDMP,
  DMPExists,
  DynamoConnectionParams,
  EnvironmentEnum,
  planToDMPCommonStandard, tombstoneDMP,
  updateDMP
} from "@dmptool/utils";
import { getDynamoConnectionParams } from "../config/awsConfig";
import { generalConfig } from "../config/generalConfig";
import { DMPToolDMPType } from "@dmptool/types";
import { getRDSConnectionParams } from "../config/mysqlConfig";

/**
 * Function to help update Plan member roles. It compares the current roles for
 * the member with the new roles.
 *
 * Note that this function makes changes to the database!
 *
 * @param reference The value to help identify the caller to help with logging.
 * @param context The apollo context object.
 * @param memberId The id of the member to update the roles for.
 * @param currentRoleIds The current role ids for the member.
 * @param newRoleIds The new role ids for the member.
 */
export async function updateMemberRoles(
  reference: string,
  context: MyContext,
  memberId: number,
  currentRoleIds: number[],
  newRoleIds: number[]
): Promise<{ updatedRoleIds: number[], errors: string[] }> {

  const associationErrors = [];
  const { idsToBeRemoved, idsToBeSaved } = MemberRole.reconcileAssociationIds(currentRoleIds, newRoleIds);

  // Remove roles
  const removeErrors = [];
  for (const id of idsToBeRemoved) {
    const role = await MemberRole.findById(reference, context, id);
    if (role) {
      const wasRemoved = await role.removeFromPlanMember(context, memberId);
      if (!wasRemoved) {
        removeErrors.push(role.label);
      }
    }
  }
  if (removeErrors.length > 0) {
    associationErrors.push(`unable to remove roles: ${removeErrors.join(', ')}`);
  }

  // Add roles
  const addErrors = [];
  for (const id of idsToBeSaved) {
    const role = await MemberRole.findById(reference, context, id);
    if (role) {
      const wasAdded = await role.addToPlanMember(context, memberId);
      if (!wasAdded) {
        addErrors.push(role.label);
        // Remove the role from idsToBeSaved if it couldn't be added
        idsToBeSaved.splice(idsToBeSaved.indexOf(id), 1);
      }
    }
  }
  if (addErrors.length > 0) {
    associationErrors.push(`unable to assign roles: ${addErrors.join(', ')}`);
  }

  const updatedRoles = [...currentRoleIds.filter(id => !idsToBeRemoved.includes(id)), ...idsToBeSaved];
  return {
    updatedRoleIds: updatedRoles.length > 0 ? updatedRoles : currentRoleIds,
    errors: associationErrors,
  };
}

/**
 * Makes sure the plan has a primary contact defined. If not, we default to the
 * project's owner.
 *
 * Note this function makes changes to the database!
 *
 * @param context The apollo context object
 * @param plan The plan to check for a primary contact
 * @param project The project that the plan belongs to
 * @returns true if a primary contact was found or created, false otherwise
 */
export const ensureDefaultPlanContact = async (
  context: MyContext,
  plan: Plan,
  project: Project
): Promise<boolean> => {
  const reference = 'planService.ensurePlanHasPrimaryContact';

  if (!isNullOrUndefined(plan) && !isNullOrUndefined(project)) {
    const dfltMember = await ProjectMember.findPrimaryContact(reference, context, project.id);
    if (isNullOrUndefined(dfltMember)) {
      return false;
    }
    const dfltMemberRoles = await MemberRole.findByProjectMemberId(
      reference,
      context,
      dfltMember.id,
    );

    const current = await PlanMember.findPrimaryContact(reference, context, plan.id);
    if (isNullOrUndefined(current)) {
      // Create a new member record from the user and set as the primary contact
      const member = new PlanMember({
        planId: plan.id,
        projectMemberId: dfltMember.id,
        isPrimaryContact: true,
        memberRoleIds: dfltMemberRoles.map(role => role.id),
      });

      const created = await member.create(context);
      if (!isNullOrUndefined(created) && !created.hasErrors()) {
        // Add the roles to the default plan member
        for (const role of dfltMemberRoles) {
          await role.addToPlanMember(context, created.id);
        }
        return true;
      }
      return false;
    } else {
      // PrimaryContact was already set
      return true;
    }
  }
  return false
}

/**
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
 *
 * Registered/published plans cannot have version snapshots deleted! In that scenario,
 * the "latest" version is tomb-stoned. This is to ensure that the registered DMP ID (aka DOI)
 * is not orphaned and does not become a dead link.
 *
 * @param reference A value to help identify the caller to help with logging
 * @param context The apollo context object
 * @param planId The id of the plan to create a version snapshot for
 * @param shouldDelete If true, delete the version snapshots
 * @returns true if the version snapshot was created successfully, false otherwise
 */
export async function saveMaDMPVersion(
  reference: string,
  context: MyContext,
  planId: number,
  shouldDelete = false,
): Promise<boolean> {
  if (isNullOrUndefined(planId)) return false;

  // Generate the current maDMP JSON record based on the current RDS data
  context.logger.debug({ planId }, 'Generating maDMP JSON for the Plan.')
  const maDMP: DMPToolDMPType = await planToDMPCommonStandard(
    getRDSConnectionParams(context.logger),
    generalConfig.applicationName,
    generalConfig.domain,
    EnvironmentEnum[generalConfig.env.toUpperCase()] as EnvironmentEnum,
    planId,
    true
  );
  if (isNullOrUndefined(maDMP)) {
    context.logger.error({ planId, reference }, 'Unable to generate maDMP JSON for the Plan.')
    return false;
  }

  const dmpId: string = maDMP.dmp?.dmp_id?.identifier;
  if (isNullOrUndefined(dmpId)) {
    context.logger.error({ planId, reference }, 'DMP id was missing from generated maDMP JSON.')
    return false;
  }

  // See if the latest version of the maDMP record is in the DynamoDB table
  const dynamoConfig: DynamoConnectionParams = getDynamoConnectionParams(context.logger);
  const hasLatestMaDMP: boolean = await DMPExists(dynamoConfig, dmpId)

  if (!hasLatestMaDMP) {
    // The Plan is new, so create the first maDMP record
    if (!(await createDMP(dynamoConfig, generalConfig.domain, dmpId, maDMP))) {
      context.logger.error({planId, dmpId, reference}, 'Unable to create initial maDMP JSON.');
      return false;
    }
    context.logger.debug({ planId, dmpId, reference }, 'Successfully created initial maDMP JSON.');

  } else {
    // If we are supposed to delete the version snapshots
    if (shouldDelete) {
      if (maDMP.dmp.registered) {
        // If it was already registered/published, tombstone the latest version instead
        if (!(await tombstoneDMP(dynamoConfig, generalConfig.domain, dmpId))) {
          context.logger.error({ planId, dmpId, reference }, 'Unable to tombstone maDMP JSON.')
          return false;
        }
        context.logger.debug({ planId, dmpId, reference }, 'Successfully tomb-stoned maDMP JSON.');

      } else {
        // Otherwise delete the maDMP versions
        if (!(await deleteDMP(dynamoConfig, generalConfig.domain, dmpId))) {
          context.logger.error({ planId, dmpId, reference }, 'Unable to tombstone maDMP JSON.')
          return false;
        }
        context.logger.debug({ planId, dmpId, reference }, 'Successfully tomb-stoned maDMP JSON.');
      }
    }

    // Otherwise we need to update the maDMP information in the DynamoDB table
    const gracePeriod: number = generalConfig.versionPlanAfter * 3_600_000 // Convert hours to milliseconds;
    if (!(await updateDMP(dynamoConfig, generalConfig.domain, dmpId, maDMP, gracePeriod))) {
      context.logger.error({ planId, dmpId, reference }, 'Unable to save maDMP JSON.');
      return false;
    }
    context.logger.debug({ planId, dmpId, reference }, 'Successfully updated maDMP JSON.');
  }

  return true;
}

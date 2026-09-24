import { MyContext } from "../context.js";
import { MemberRole } from "../models/MemberRole.js";
import { isNullOrUndefined } from "../utils/helpers.js";
import { PlanMember, ProjectMember } from "../models/Member.js";
import { Plan, PlanSectionProgress, PlanVisibility } from "../models/Plan.js";
import { Project } from "../models/Project.js";
import { PlanFunding, ProjectFunding } from "../models/Funding.js";
import { AlternateIdentifier } from "../models/AlternateIdentifier.js";
import { AcceptedWork } from "../models/RelatedWork.js";
import {
  createDMP,
  deleteDMP,
  DMPExists,
  DynamoConnectionParams,
  EnvironmentEnum,
  planToDMPCommonStandard,
  tombstoneDMP,
  updateDMP,
  getDMPVersions,
  getDMPs,
  DMPVersionType,
} from "@dmptool/utils";
import { getDynamoConnectionParams } from "../config/awsConfig.js";
import { generalConfig } from "../config/generalConfig.js";
import { DMPToolDMPType } from "@dmptool/types";
import { getRDSConnectionParams } from "../config/mysqlConfig.js";
import {
  buildDataCiteXML,
  DataCiteSourceMember,
  DataCiteSourceAffiliation,
  DataCiteSourceFundingAffiliation,
  planToDataCiteMetadata,
  DataCiteSourceFunding,
  DataCiteSourceAlternateIdentifier,
  DataCiteMetadataInput
} from "./dataciteXMLService.js";
import { removeIndexItem, updateIndexItem } from "./indexDMPService.js";
import {
  CustomizableObjectOwnership,
  PlanQuestion,
  PlanSection,
  PlanVersionSnapshot,
  PlanVersionSnapshotRelatedWork,
} from "../types.js";
import { ProjectFundingStatus } from "../models/Funding.js";
import { NotFoundError } from "../utils/graphQLErrors.js";
import { getProjectAndCheckAuthorization } from "./projectService.js";
import {
  maDMPAffiliationType,
  maDMPContributorType,
  maDMPFunderOpportunityNumberType,
  maDMPFunderProjectNumberType,
  maDMPFundingType,
  maDMPIdentifierType,
  maDMPNarrativeQuestionType,
  maDMPNarrativeSectionType,
  maDMPProjectType,
  maDMPRelatedIdentifierType,
  maDMPType,
  maDMPVersionsType
} from "../types/maDMP.js";
import { ProjectCollaborator } from "../models/Collaborator.js";
import { User } from "../models/User.js";
import { Affiliation } from "../models/Affiliation.js";
import { VersionedQuestion } from "../models/VersionedQuestion.js";
import { VersionedCustomQuestion } from "../models/VersionedCustomQuestion.js";
import { Answer } from "../models/Answer.js";
import { VersionedSection } from "../models/VersionedSection.js";
import { VersionedCustomSection } from "../models/VersionedCustomSection.js";
import { VersionedTemplate } from "../models/VersionedTemplate.js";
import {
  getRelevantGuidanceForPlan,
  getRelevantGuidanceForVersionedQuestion,
  GuidanceSource
} from "./guidanceService.js";
import { RelevantTag, Tag } from "../models/Tag.js";
import { VersionedQuestionCustomization } from "../models/VersionedQuestionCustomization.js";
import { findConditionalLogicForPlan } from "./conditionalLogicService.js";
import {
  VersionedSectionCustomization
} from "../models/VersionedSectionCustomization.js";

export interface PublishedQuestionResult {
  id: number;
  questionText: string;
  requirementText?: string;
  guidanceText?: string;
  sampleText?: string;
  required: boolean;
  hasAnswer: boolean;
  questionType: CustomizableObjectOwnership;
  // Type-specific IDs — one will always be present depending on questionType
  versionedQuestionId?: number;  // present when questionType === 'BASE'
  customQuestionId?: number;     // present when questionType === 'CUSTOM'
  json?: string; // present when questionType === 'CUSTOM' and the question has a json field
}

export interface HistoricalPlanVersion {
  dmpId: string;
  modified: string;
  timestamp: string;
  url: string;
}

export interface FlattenedMaDMPAnswer {
  id: number,
  questionText: string,
  json: string
}

export interface ConsolidatedMaDMPMember {
  name?: string;
  orcid?: string;
  affiliationName?: string;
  isPrimaryContact: boolean;
  memberRoles: {
    id: number;
    label: string;
    uri: string;
  }[];
}

export interface FlattenedMaDMPFunding {
  funderName: string;
  funderUri?: string;
  status: string;
  grantId: string | null;
  funderProjectNumber: string | null;
  funderOpportunityNumber: string | null;
}

/**
 * Fetches the affiliation of the owner of the plan. The owner is determined by
 * first checking for a project collaborator with OWN access level, and if not
 * found, falling back to the plan creator's affiliation.
 *
 * @param reference A value to help identify the caller to help with logging
 * @param context The apollo context object
 * @param plan The plan for which to fetch the owner's affiliation
 * @returns The Affiliation of the plan owner, or null if not found
 */
export async function getPlanOwnerAffiliation(reference: string, context: MyContext, plan: Plan): Promise<Affiliation | null> {
  // First, try to get the project owner (collaborator with OWN access level)
  const projectOwner = await ProjectCollaborator.findOwnerByProjectId(
    reference,
    context,
    plan.projectId
  );

  if (projectOwner?.userId) {
    const user = await User.findById(reference, context, projectOwner.userId);
    if (user?.affiliationId) {
      const affiliation = await Affiliation.findByURI(reference, context, user.affiliationId);
      if (affiliation) return affiliation;
    }
  }

  // Fall back to the plan creator's affiliation
  if (plan?.createdById) {
    const user = await User.findById(reference, context, plan.createdById);
    if (user?.affiliationId) {
      return await Affiliation.findByURI(reference, context, user.affiliationId);
    }
  }

  return null;
}

/**
 * Fetch the specified Plan by its id and verify that the current user is authorized to access it.
 *
 * @param reference A value to help identify the caller to help with logging
 * @param context The apollo context object
 * @param planId The id of the plan to fetch
 * @returns The Plan if found and authorized
 * @throws NotFoundError if the Plan or its parent Project cannot be found
 * @throws ForbiddenError if the current user is not authorized to access it
 */
export async function getPlanAndCheckAuthorization(
  reference: string,
  context: MyContext,
  planId: number
): Promise<{ plan: Plan, project: Project }> {
  const plan: Plan | null = await Plan.findById(reference, context, planId);
  if (isNullOrUndefined(plan)) {
    throw NotFoundError(`Plan with ID, ${planId}, not found`);
  }

  const project: Project = await getProjectAndCheckAuthorization(reference, context, plan.projectId);
  return { plan, project };
}

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

  const associationErrors: string[] = [];
  const { idsToBeRemoved, idsToBeSaved } = MemberRole.reconcileAssociationIds(currentRoleIds, newRoleIds);

  // Remove roles
  const removeErrors: string[] = [];
  for (const id of idsToBeRemoved) {
    const role: MemberRole | null = await MemberRole.findById(reference, context, id as number);
    if (role) {
      const wasRemoved: boolean = await role.removeFromPlanMember(context, memberId);
      if (!wasRemoved) {
        removeErrors.push(role.label);
      }
    }
  }
  if (removeErrors.length > 0) {
    associationErrors.push(`unable to remove roles: ${removeErrors.join(', ')}`);
  }

  // Add roles
  const addErrors: string[] = [];
  for (const id of idsToBeSaved) {
    const role: MemberRole | null = await MemberRole.findById(reference, context, id as number);
    if (role) {
      const wasAdded: boolean = await role.addToPlanMember(context, memberId);
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

  const updatedRoles: (string | number)[] = [...currentRoleIds.filter(id => !idsToBeRemoved.includes(id)), ...idsToBeSaved];
  return {
    updatedRoleIds: updatedRoles.length > 0 ? updatedRoles as number[] : currentRoleIds as number[],
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
    const dfltMember: ProjectMember | null = await ProjectMember.findPrimaryContact(reference, context, project.id);
    if (isNullOrUndefined(dfltMember)) {
      return false;
    }
    const dfltMemberRoles: MemberRole[] = await MemberRole.findByProjectMemberId(
      reference,
      context,
      dfltMember.id
    );

    const current: PlanMember | null = await PlanMember.findPrimaryContact(reference, context, plan.id);
    if (isNullOrUndefined(current)) {
      // Create a new member record from the user and set as the primary contact
      const member = new PlanMember({
        planId: plan.id,
        projectMemberId: dfltMember.id,
        isPrimaryContact: true,
        memberRoleIds: dfltMemberRoles.map(role => role.id),
      });

      const created: PlanMember = await member.create(context);
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
 * Gathers project members, fundings, and alternate identifiers and builds
 * the DataCite XML document to submit to EZID at publish time.
 *
 * @param context The apollo context object
 * @param plan The plan to build DataCite metadata for
 * @param project The project that the plan belongs to
 * @returns The DataCite XML document as a string
 * @throws if the plan has no member marked as primary contact
 */
export async function buildDataCiteXMLForPlan(context: MyContext, plan: Plan, project?: Project): Promise<string> {
  const reference = 'planService.buildDataCiteXMLForPlan';

  const resolvedProject: Project | null = project ?? await Project.findById(reference, context, plan.projectId);

  // --- Members ---
  // Project members
  const projectMembers: ProjectMember[] = await ProjectMember.findByProjectId(reference, context, plan.projectId);

  const members: DataCiteSourceMember[] = await Promise.all(projectMembers.map(async (pm: ProjectMember): Promise<DataCiteSourceMember> => {
    const memberRoles: MemberRole[] = await MemberRole.findByProjectMemberId(reference, context, pm.id);

    let affiliation: DataCiteSourceAffiliation | undefined;
    if (pm.affiliationId) {
      const aff: Affiliation | null = await Affiliation.findByURI(reference, context, pm.affiliationId);
      if (aff) {
        affiliation = { name: aff.name || aff.displayName, uri: aff.uri, provenance: aff.provenance };
      }
    }

    return {
      isPrimaryContact: pm.isPrimaryContact,
      memberRoles: memberRoles.map((mr: MemberRole): { uri: string } => ({ uri: mr.uri })),
      projectMember: {
        givenName: pm.givenName,
        surName: pm.surName,
        orcid: pm.orcid,
        affiliation,
      },
    };
  }));

  // --- Plan Fundings ---
  const planFundings: PlanFunding[] = await PlanFunding.findByPlanId(reference, context, plan.id);

  const fundings: DataCiteSourceFunding[] = await Promise.all(planFundings.map(async (pf: PlanFunding): Promise<DataCiteSourceFunding> => {
    const projectFunding: ProjectFunding | null = await ProjectFunding.findById(reference, context, pf.projectFundingId);
    if (!projectFunding) return { projectFunding: undefined };

    let affiliation: DataCiteSourceFundingAffiliation | undefined;
    if (projectFunding.affiliationId) {
      const aff: Affiliation | null = await Affiliation.findByURI(reference, context, projectFunding.affiliationId);
      if (aff) {
        affiliation = {
          name: aff.name || aff.displayName,
          uri: aff.uri,
          provenance: aff.provenance,
          fundrefId: aff.fundrefId,
        };
      }
    }

    return { projectFunding: { affiliation, grantId: projectFunding.grantId } };
  }));

  // --- Alternate identifiers ---
  const alternateIdentifierRecords: AlternateIdentifier[] = await AlternateIdentifier.findByPlanId(reference, context, plan.id);
  const alternateIdentifiers: DataCiteSourceAlternateIdentifier[] = alternateIdentifierRecords.map((a: AlternateIdentifier): DataCiteSourceAlternateIdentifier => ({
    alternateIdentifier: a.alternateIdentifier,
  }));

  const dataciteInput: DataCiteMetadataInput = planToDataCiteMetadata({
    title: plan.title,
    abstractText: resolvedProject?.abstractText,
    language: plan.languageId,
    members,
    fundings,
    alternateIdentifiers,
    publisher: generalConfig.applicationName,
    publicationYear: new Date().getFullYear().toString(),
  });

  return buildDataCiteXML(dataciteInput);
}

/**
 * Handle truly asynchronous activity that should occur after a Plan is created/updated
 * so we don't block the Apollo thread
 *
 * @param reference the string reference for logging
 * @param context the Apollo server context
 * @param plan the Plan
 * @param project optional Project if already preloaded
 */
export const handleAsyncUpdates = async (
  reference: string,
  context: MyContext,
  plan: Plan,
  project?: Project,
): Promise<void> => {
  // Update the OpenSearch index
  updateIndexItem(reference, context, plan, project)
    .catch((err: unknown) => {
      context.logger.fatal({ planId: plan.id, err }, 'Index item in OpenSearch failed!');
    });

  // Update the maDMP record in Dynamo
  saveMaDMPVersion(reference, context, plan.id, plan.dmpId)
    .catch((err: unknown) => {
      context.logger.fatal({ planId: plan.id, err }, 'save maDMP JSON failed!');
    });
}

/**
 * Handle truly asynchronous activity that should occur after a Plan is deleted/archived
 * so we don't block the Apollo thread
 *
 * @param reference the string reference for logging
 * @param context the Apollo server context
 * @param plan the Plan
 */
export const handleAsyncDeletes = async (
  reference: string,
  context: MyContext,
  plan: Plan
): Promise<void> => {
  // Remove the OpenSearch index
  removeIndexItem(reference, context, plan)
    .catch((err: unknown) => {
      context.logger.fatal({ planId: plan.id, err }, 'Remove OpenSearch index item failed!');
    });

  // Remove the maDMP records from Dynamo
  saveMaDMPVersion(reference, context, plan.id, plan.dmpId, true)
    .catch((err: unknown) => {
      context.logger.fatal({ planId: plan.id, err }, 'Remove/Tomb-stone maDMP json failed!');
    });
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
 * @param dmpId The DMP id of the plan
 * @param shouldDelete If true, delete the version snapshots
 * @returns true if the version snapshot was created successfully, false otherwise
 */
export async function saveMaDMPVersion(
  reference: string,
  context: MyContext,
  planId: number,
  dmpId: string,
  shouldDelete = false
): Promise<boolean> {
  if (isNullOrUndefined(planId)) return false;

  // Convert the App name into a URI safe string
  const appName: string = generalConfig.applicationName
    .toLowerCase()
    .replace(/[ ()]/g, (match: string) => (match === ' ' ? '-' : ''));

  // Generate the current maDMP JSON record based on the current RDS data
  context.logger.debug({ planId }, 'Generating maDMP JSON for the Plan.')
  const maDMP: DMPToolDMPType = await planToDMPCommonStandard(
    getRDSConnectionParams(context.logger),
    appName,
    generalConfig.domain,
    EnvironmentEnum[generalConfig.env.toUpperCase()] as EnvironmentEnum,
    planId,
    true
  );
  if (isNullOrUndefined(maDMP)) {
    context.logger.error({ planId, reference }, 'Unable to generate maDMP JSON for the Plan.')
    return false;
  }

  // See if the latest version of the maDMP record is in the DynamoDB table
  const dynamoConfig: DynamoConnectionParams = getDynamoConnectionParams(context.logger);
  const hasLatestMaDMP: boolean = await DMPExists(dynamoConfig, dmpId)

  if (!hasLatestMaDMP) {
    // The Plan is new, so create the first maDMP record
    if (!(await createDMP(dynamoConfig, generalConfig.domain, dmpId, maDMP))) {
      context.logger.error({ planId, dmpId, reference }, 'Unable to create initial maDMP JSON.');
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

/**
 * Fetches the version timestamps from DynamoDB for the specified DMP ID, and
 * builds the public-facing URL for each version.
 *
 * @param reference A value to help identify the caller to help with logging
 * @param context The apollo context object
 * @param dmpId The DMP id of the plan to fetch versions for
 * @returns an array of { modified, dmpId } for each past version
 */
export async function getPlanVersions(
  reference: string,
  context: MyContext,
  dmpId: string
): Promise<HistoricalPlanVersion[]> {
  if (isNullOrUndefined(dmpId)) return [];

  const dynamoConfig: DynamoConnectionParams = getDynamoConnectionParams(context.logger);
  try {
    const versions: DMPVersionType[] = await getDMPVersions(dynamoConfig, dmpId);

    // Fetch the current latest snapshot's modified timestamp so it can be
    // excluded below. "VERSION#latest" isn't a queryable timestamped snapshot —
    // including it would produce a version-picker link that 404s when clicked.
    const latest: DMPToolDMPType[] = await getDMPs(dynamoConfig, generalConfig.domain, dmpId, 'latest');
    const latestModified: string | undefined = latest[0]?.dmp?.modified;

    // Only return genuinely historical, timestamp-queryable versions.
    const historicalVersions: DMPVersionType[] = versions.filter((v: DMPVersionType): boolean => v.modified !== latestModified);

    return historicalVersions.map((v: DMPVersionType): HistoricalPlanVersion => ({
      dmpId: v.dmpId,
      modified: v.modified,
      timestamp: v.modified,
      url: `https://${generalConfig.domain}/dmps/${v.dmpId.replace(/^https?:\/\//, '')}?version=${encodeURIComponent(v.modified)}`
    }));

  } catch (err) {
    context.logger.error({ dmpId, reference, err }, 'Unable to fetch DMP versions.');
    return [];
  }
}

/**
 * Fetches the complete maDMP snapshot for a specific version of a DMP and maps
 * it into the client-facing PlanVersionSnapshot shape.
 *
 * @param reference A value to help identify the caller to help with logging
 * @param context The apollo context object
 * @param dmpId The DMP id of the plan to fetch
 * @param version The specific version timestamp to fetch
 * @returns The mapped PlanVersionSnapshot, or null if the version could not be found
 */
export async function getPlanVersionSnapshot(
  reference: string,
  context: MyContext,
  dmpId: string,
  version: string,
): Promise<PlanVersionSnapshot | null> {
  if (isNullOrUndefined(dmpId) || isNullOrUndefined(version)) return null;

  const dynamoConfig: DynamoConnectionParams = getDynamoConnectionParams(context.logger);

  try {
    const results: DMPToolDMPType[] = await getDMPs(dynamoConfig, generalConfig.domain, dmpId, version);

    if (!results || results.length === 0) {
      return null;
    }

    // Fetch the planId from the database by dmpId
    const plan: Plan | null = await Plan.findByDMPId(reference, context, dmpId);
    const planId: number | undefined = plan?.id;
    const projectId: number | undefined = plan?.projectId;

    return await mapDMPToolDMPToSnapshot(results[0], version, context, planId, projectId);
  } catch (err) {
    context.logger.error({ dmpId, version, reference, err }, 'Unable to fetch DMP version snapshot.');
    return null;
  }
}

/**
 * Maps a funding status string from the maDMP snapshot into the ProjectFundingStatus enum.
 *
 * @param status The funding status string from the maDMP snapshot (e.g., "granted", "denied", "planned").
 * @returns The corresponding ProjectFundingStatus enum value. Defaults to ProjectFundingStatus.PLANNED if the input is null, undefined, or unrecognized.
 */
function mapFundingStatus(status?: string | null): ProjectFundingStatus {
  switch (status?.toLowerCase()) {
    case 'granted':
      return ProjectFundingStatus.GRANTED;
    case 'denied':
      return ProjectFundingStatus.DENIED;
    case 'planned':
    default:
      return ProjectFundingStatus.PLANNED;
  }
}

/**
 * Maps a DMPToolDMPType object (from the maDMP snapshot) into a PlanVersionSnapshot object.
 *
 * @param result The DMPToolDMPType object representing the maDMP snapshot.
 * @param version The version string (timestamp) of the snapshot.
 * @param context The Apollo server context.
 * @param planId The ID of the plan associated with the snapshot.
 * @param projectId (optional) The ID of the project associated with the plan, if available.
 * @returns A Promise that resolves to a PlanVersionSnapshot object.
 */
export async function mapDMPToolDMPToSnapshot(
  result: DMPToolDMPType,
  version: string,
  context: MyContext,
  planId: number,
  projectId?: number
): Promise<PlanVersionSnapshot> {

  const dmp: maDMPType = result.dmp;
  const project: maDMPProjectType | undefined = dmp.project?.[0];
  const dmpId: maDMPIdentifierType | undefined = dmp.dmp_id?.identifier; // already a full https://doi.org/... URL

  // Flatten narrative answers into the same {id, json} shape as live `answers`
  const answers: FlattenedMaDMPAnswer[] = (dmp.narrative?.template?.section ?? []).flatMap((section: maDMPNarrativeSectionType) =>
    (section.question ?? [])
      .filter((q: maDMPNarrativeQuestionType) => q.answer)
      .map((q: maDMPNarrativeQuestionType): FlattenedMaDMPAnswer => ({
        id: q.answer?.id,
        questionText: q.text,
        json: JSON.stringify(q.answer?.json),
      }))
  );

  // Fetch every known role once, then match against contributor role URIs in memory.
  const allMemberRoles: MemberRole[] = await MemberRole.all('mapDMPToolDMPToSnapshot.memberRoles', context);
  const roleByUri = new Map(allMemberRoles.map((r: MemberRole): [string, MemberRole] => [r.uri, r]));

  // Get the organization from the plan owner (affiliation) — this is computed
  // synchronously so we can kick off the affiliation lookup in parallel below.
  const ownerAffiliation: maDMPAffiliationType | undefined = dmp.contributor?.find((c: maDMPContributorType): boolean => {
    return c.name === dmp.contact?.name;
  })?.affiliation?.[0];
  const affiliationURI: string | undefined = ownerAffiliation?.affiliation_id?.identifier;

  // Run the independent async lookups concurrently instead of sequentially:
  // - members: maps contributors and looks up isPrimaryContact per-contributor
  // - affiliation: resolves the owner's affiliation record
  // - acceptedWorks: fetches related works for this plan
  const [members, affiliation, acceptedWorks] = await Promise.all([
    Promise.all(
      (dmp.contributor ?? []).map(async (c: maDMPContributorType): Promise<ConsolidatedMaDMPMember> => {
        let isPrimaryContact = false;

        // If we have a projectId, query the database for the actual isPrimaryContact value
        if (projectId && c.contributor_id) {
          // Try to find by email first (most reliable)
          if (c.contact_mbox || c.mbox) {
            const email: string = c.contact_mbox || c.mbox;
            const dbMember: ProjectMember | null = await ProjectMember.findByProjectAndEmail(
              'mapDMPToolDMPToSnapshot.isPrimaryContact',
              context,
              projectId,
              email
            );

            if (dbMember) {
              isPrimaryContact = dbMember.isPrimaryContact;
            }
          } else if (c.name) {
            // Fallback to name if no email (extract given/sur name)
            const nameParts: string[] = c.name.split(' ');
            const givenName: string = nameParts[0];
            const surName: string = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

            const dbMember: ProjectMember | null = await ProjectMember.findByProjectAndName(
              'mapDMPToolDMPToSnapshot.isPrimaryContact',
              context,
              projectId,
              givenName,
              surName
            );
            if (dbMember) {
              isPrimaryContact = dbMember.isPrimaryContact;
            }
          }
        }

        return {
          name: c.name,
          orcid: c.contributor_id?.find((id: maDMPIdentifierType): boolean => id.type === 'orcid')?.identifier,
          affiliationName: c.affiliation?.[0]?.name,
          isPrimaryContact,
          memberRoles: (c.role ?? []).map((uri: string): { id: number, label: string, uri: string } => {
            const matched: MemberRole | undefined = roleByUri.get(uri);
            return matched
              ? { id: matched.id, label: matched.label, uri: matched.uri }
              : { id: undefined, label: uri, uri };
          }),
        };
      })
    ),
    affiliationURI
      ? Affiliation.findByURI('mapDMPToolDMPToSnapshot.ownerAffiliation', context, affiliationURI)
      : Promise.resolve(undefined),
    planId
      ? AcceptedWork.findByPlanId('mapDMPToolDMPToSnapshot.relatedWorks', context, planId)
      : Promise.resolve([]),
  ]);

  // Map the accepted works into the snapshot's relatedWorks shape
  const relatedWorks: PlanVersionSnapshotRelatedWork[] = acceptedWorks.map((work: AcceptedWork): PlanVersionSnapshotRelatedWork => ({
    id: work.id,
    workVersion: {
      title: work.title,
      publicationDate: work.publicationDate,
      workType: work.workType,
      publicationVenue: work.publicationVenue,
      sourceName: work.sourceName,
      sourceUrl: work.sourceUrl,
      authors: work.authors,
      work: {
        doi: work.doi,
      }
    }
  }));

  // Determine the actual current "latest" snapshot's modified timestamp,
  // so we can exclude it from the historical versions list — VERSION#latest
  // is not queryable by its own timestamp, only by the literal string 'latest'.
  let latestModified: string | undefined;
  if (version === 'latest') {
    latestModified = dmp.modified;
  } else {
    const dynamoConfig: DynamoConnectionParams = getDynamoConnectionParams(context.logger);
    const latest: DMPToolDMPType[] = await getDMPs(dynamoConfig, generalConfig.domain, dmpId, 'latest');
    latestModified = latest[0]?.dmp?.modified;
  }

  const historicalVersions: maDMPVersionsType = (dmp.version ?? []).filter(
    (v: maDMPVersionsType): boolean => v.version !== latestModified
  );

  return {
    isHistoricalVersion: true,
    versionTimestamp: version,
    latestVersionTimestamp: latestModified,

    title: dmp.title,
    dmpId,
    created: dmp.created,
    modified: dmp.modified,
    registered: dmp.registered,
    visibility: dmp.privacy === 'public' ? PlanVisibility.PUBLIC : PlanVisibility.PRIVATE,

    owner: ownerAffiliation ? {
      id: affiliation?.id,
      name: affiliation?.name || affiliation?.displayName || ownerAffiliation.name,
      displayName: affiliation?.displayName || ownerAffiliation.name,
      uri: affiliation?.uri || ownerAffiliation?.affiliation_id?.identifier,
      homepage: affiliation?.homepage
    } : undefined,

    versionedTemplate: dmp.narrative?.template
      ? {
        id: dmp.narrative.template.id,
        title: dmp.narrative.template.title,
        version: dmp.narrative.template.version,
      }
      : undefined,

    project: project
      ? {
        title: project.title,
        abstractText: project.description,
        startDate: project.start,
        endDate: project.end,
        researchDomain: dmp.research_domain
          ? { name: dmp.research_domain.name }
          : undefined,
      }
      : undefined,
    members: members,
    fundings: (project?.funding ?? []).map((f: maDMPFundingType): FlattenedMaDMPFunding => {
      const funderIdentifier: string | undefined = f.funder_id?.identifier;
      const opportunity: maDMPFunderOpportunityNumberType = dmp.funding_opportunity?.find(
        (fo: maDMPFunderOpportunityNumberType): boolean => fo.funder_id?.identifier === funderIdentifier
      );
      const fundingProject: maDMPFunderProjectNumberType = dmp.funding_project?.find(
        (fp: maDMPFunderProjectNumberType): boolean => fp.funder_id?.identifier === funderIdentifier
      );

      return {
        funderName: f.name,
        funderUri: funderIdentifier,
        status: mapFundingStatus(f.funding_status),  // normalize here
        grantId: f.grant_id?.identifier,
        funderOpportunityNumber: opportunity?.opportunity_identifier?.identifier,
        funderProjectNumber: fundingProject?.project_identifier?.identifier,
      };
    }),

    answers,

    versions: historicalVersions.map((v: maDMPVersionsType): { timestamp: string, url: string } => ({
      timestamp: v.version,
      url: v.access_url,
    })),
    relatedWorks,
    relatedWorkIdentifiers: (dmp.related_identifier ?? []).map((r: maDMPRelatedIdentifierType): string => r.identifier),
  };
}

/**
 * Fetches all sections and their associated questions and answers for a given plan,
 * including both base and custom questions, along with their answer status.
 *
 * @param reference A value to help identify the caller to help with logging
 * @param context The apollo context object
 * @param plan The plan for which to fetch sections and questions
 * @returns A promise that resolves to an array of PlanSection objects, each
 * containing its question and answer
 */
export async function getPlanSectionsAndQuestions (
  reference: string,
  context: MyContext,
  plan: Plan,
): Promise<PlanSection[]> {
  const sections: PlanSection[] = [];

  if (plan.id) {
    // Get the current user's affiliation (needed to load the appropriate guidance for the plan)
    const affiliation: Affiliation = await Affiliation.findByURI(reference, context, context.token.affiliationId);
    // Get the plan owner and their affiliation (needed to load the appropriate customizations for the plan)
    const planOwner: ProjectCollaborator | null = await ProjectCollaborator.findOwnerByProjectId(reference, context, plan.projectId);
    const owner: User | null = planOwner ? await User.findById(reference, context, planOwner.userId) : null;
    const ownerAffiliation: Affiliation = owner
      ? await Affiliation.findByURI(reference, context, owner.affiliationId) || affiliation
      : affiliation;
    const vTemplate: VersionedTemplate = await VersionedTemplate.findById(reference, context, plan.versionedTemplateId);
    if (!affiliation || !vTemplate) return [];

    const relevantTags: Set<RelevantTag> = await Tag.findTagIdsForVersionedTemplateId(reference, context, vTemplate.id);

    // First, fetch the high level info and progress for every section
    const sectionProgress: PlanSectionProgress[] = await PlanSectionProgress.findByPlanId(
      reference,
      context,
      plan.id,
      plan?.versionedTemplateId
    );
    if (!Array.isArray(sectionProgress) || sectionProgress.length === 0) return [];

    const baseProgress: PlanSectionProgress[] = sectionProgress.filter((p: PlanSectionProgress): boolean => p.sectionType === 'BASE');
    const customProgress: PlanSectionProgress[] = sectionProgress.filter((p: PlanSectionProgress): boolean => p.sectionType !== 'BASE');
    const baseSectionIds: number[] = baseProgress.map((p: PlanSectionProgress): number => p.versionedSectionId);
    const customSectionIds: number[] = customProgress.map((p: PlanSectionProgress): number => p.customSectionId);

    // Second, fetch everything for the whole plan at once
    const [baseSections, customSections, allBaseQuestions, allBaseCustomQuestions, allCustomQuestions, filledAnswers, conditionalLogic, sectionCustomizations, questionCustomizations, guidanceSources] =
      await Promise.all([
        VersionedSection.findByIds(reference, context, baseSectionIds),
        VersionedCustomSection.findByIds(reference, context, customSectionIds),
        // Base sections can contain both base and custom questions, so we need to fetch both
        VersionedQuestion.findByVersionedSectionIds(reference, context, baseSectionIds),
        VersionedCustomQuestion.findByVersionedSectionIdsAndType(reference, context, baseSectionIds, 'BASE'),
        // CustomSections only contain CustomQuestions, so we don't need to fetch base questions for them
        VersionedCustomQuestion.findByVersionedSectionIdsAndType(reference, context, customSectionIds, 'CUSTOM'),
        Answer.findFilledAnswersByPlanId(reference, context, plan.id),
        // Get all conditional logic for the plan's questions
        findConditionalLogicForPlan(reference, context, baseSectionIds),
        // get any custom guidance set on Base sections (using the plan owner's affiliation!)
        VersionedSectionCustomization.findForActiveForAffiliationAndVersionSectionIds(reference, context, ownerAffiliation.uri, baseSectionIds),
        // Get any custom guidance set on Base questions (using the plan owner's affiliation!)
        VersionedQuestionCustomization.findForActiveForAffiliationAndVersionSectionIds(reference, context, ownerAffiliation.uri, baseSectionIds),
        // Guidance sources for the plan
        getRelevantGuidanceForPlan(reference, context, plan.id, vTemplate, relevantTags),
      ]);

    const baseSectionById = new Map<number, VersionedSection>(baseSections.map((s: VersionedSection) => [s.id, s]));
    const customSectionById: Map<number, VersionedCustomSection> = customSections.length > 0
      ? new Map<number, VersionedCustomSection>(customSections.map((s: VersionedCustomSection) => [s.id, s]))
      : new Map<number, VersionedCustomSection>();

    // Group the questions into their respective sections for easier lookup later
    const groupBy = <T>(items: T[], key: (item: T) => number): Map<number, T[]> => {
      const grouped = new Map<number, T[]>();
      for (const item of items) {
        const k: number = key(item);
        const list: T[] | undefined = grouped.get(k);
        if (list) list.push(item); else grouped.set(k, [item]);
      }
      return grouped;
    };
    const baseQuestionsBySection: Map<number, VersionedQuestion[]> = groupBy(allBaseQuestions, (q: VersionedQuestion): number => q.versionedSectionId);
    const baseCustomBySection: Map<number, VersionedCustomQuestion[]> = groupBy(allBaseCustomQuestions, (q: VersionedCustomQuestion): number => q.versionedSectionId);
    const customBySection: Map<number, VersionedCustomQuestion[]> = groupBy(allCustomQuestions, (q: VersionedCustomQuestion): number => q.versionedSectionId);

    const baseAnswersMap: Map<number, Answer> = new Map<number, Answer>(filledAnswers.map((a: Answer): [number, Answer] => [a.versionedQuestionId, a]).filter(([id]): boolean => Boolean(id)));
    const customAnswersMap: Map<number, Answer> = new Map<number, Answer>(filledAnswers.map((a: Answer): [number, Answer] => [a.versionedCustomQuestionId, a]).filter(([id]): boolean => Boolean(id)));

    // Third, iterate through each section progress record and build the PlanSection
    // object from the pre-fetched data
    for (const progress of sectionProgress) {
      const isBase: boolean = progress.sectionType === 'BASE';
      const sectionId: number = isBase ? progress.versionedSectionId : progress.customSectionId;
      const sec: VersionedSection | VersionedCustomSection | undefined = isBase
        ? baseSectionById.get(sectionId)
        : customSectionById.get(sectionId);

      const baseQuestions: VersionedQuestion[] = isBase ? (baseQuestionsBySection.get(sectionId) ?? []) : [];
      const customQuestions: VersionedCustomQuestion[] = (isBase ? baseCustomBySection : customBySection).get(sectionId) ?? [];

      // Build an ordered list starting with base questions
      const ordered: PlanQuestion[] = baseQuestions.map((q: VersionedQuestion, idx: number) => {
        // Retrieve the relevant guidance sources for this question, based on the
        // plan's affiliation, any customizations, and the relevant tags
        const gSources: GuidanceSource[] = getRelevantGuidanceForVersionedQuestion(
          affiliation,
          sectionCustomizations.find((s: VersionedSectionCustomization): boolean => s.versionedSectionId === q.versionedSectionId),
          questionCustomizations,
          relevantTags,
          guidanceSources,
          vTemplate,
          q
        );

        return {
          questionType: 'BASE' as CustomizableObjectOwnership,
          versionedQuestionId: q.id,
          customQuestionId: undefined,
          questionText: q.questionText,
          requirementText: q.requirementText,
          guidanceText: q.guidanceText,
          sampleText: q.sampleText,
          required: q.required,
          displayOrder: idx + 1,
          hasAnswer: baseAnswersMap.has(q.id),
          answer: baseAnswersMap.get(q.id) || undefined,
          json: q.json,
          guidanceSources: gSources,
          conditionalLogic: conditionalLogic.get(q.id) || []
        };
      });

      // Sort custom questions by id (same as injectCustomQuestions)
      const sortedCustom: VersionedCustomQuestion[] = [...customQuestions].sort((a, b) => a.id - b.id);

      // Splice each custom question in after its pinned question
      for (const q of sortedCustom) {
        const result: PlanQuestion = {
          questionType: 'CUSTOM' as CustomizableObjectOwnership,
          versionedQuestionId: undefined,
          customQuestionId: q.id,
          questionText: q.questionText,
          requirementText: q.requirementText,
          guidanceText: q.guidanceText,
          sampleText: q.sampleText,
          required: q.required,
          hasAnswer: customAnswersMap.has(q.id),
          answer: customAnswersMap.get(q.id) || undefined,
          json: q.json
        };

        if (q.pinnedVersionedQuestionId === null) {
          // No pin — goes first
          ordered.unshift(result);
        } else {
          const pinIdx = ordered.findIndex(o =>
            o.questionType === q.pinnedVersionedQuestionType && o.versionedQuestionId === q.pinnedVersionedQuestionId
          );
          if (pinIdx !== -1) {
            ordered.splice(pinIdx + 1, 0, result);
          } else {
            // Pinned question not found — append to end
            ordered.push(result);
          }
        }
      }

      sections.push({
        sectionType: progress.sectionType,
        versionedSectionId: progress.versionedSectionId,
        customSectionId: progress.customSectionId,
        title: progress.title,
        displayOrder: progress.displayOrder,
        answeredQuestions: progress.answeredQuestions,
        totalQuestions: progress.totalQuestions,

        introduction: sec.introduction,
        requirements: sec.requirements,

        questions: ordered
      });
    }
  }
  return sections;
}

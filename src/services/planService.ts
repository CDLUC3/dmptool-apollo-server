import { MyContext } from "../context";
import { MemberRole } from "../models/MemberRole";
import { isNullOrUndefined } from "../utils/helpers";
import { PlanMember, ProjectMember } from "../models/Member";
import { Plan, PlanVisibility } from "../models/Plan";
import { Project } from "../models/Project";
import { PlanFunding, ProjectFunding } from "../models/Funding";
import { Affiliation } from "../models/Affiliation";
import { AlternateIdentifier } from "../models/AlternateIdentifier";
import { AcceptedWork } from "../models/RelatedWork";
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
import { getDynamoConnectionParams } from "../config/awsConfig";
import { generalConfig } from "../config/generalConfig";
import { DMPToolDMPType } from "@dmptool/types";
import { getRDSConnectionParams } from "../config/mysqlConfig";
import {
  buildDataCiteXML,
  DataCiteSourceAffiliation,
  DataCiteSourceFundingAffiliation,
  planToDataCiteMetadata
} from "./dataciteXMLService";
import { removeIndexItem, updateIndexItem } from "./indexDMPService";
import { PlanVersionSnapshot } from "../types";
import { ProjectFundingStatus } from "../models/Funding";


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
    const role = await MemberRole.findById(reference, context, id as number);
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
    const role = await MemberRole.findById(reference, context, id as number);
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
    const dfltMember = await ProjectMember.findPrimaryContact(reference, context, project.id);
    if (isNullOrUndefined(dfltMember)) {
      return false;
    }
    const dfltMemberRoles = await MemberRole.findByProjectMemberId(
      reference,
      context,
      dfltMember.id
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

  const resolvedProject = project ?? await Project.findById(reference, context, plan.projectId);

  // --- Members ---
  // Project members
  const projectMembers = await ProjectMember.findByProjectId(reference, context, plan.projectId);

  const members = await Promise.all(projectMembers.map(async (pm) => {
    const memberRoles = await MemberRole.findByProjectMemberId(reference, context, pm.id);

    let affiliation: DataCiteSourceAffiliation | undefined;
    if (pm.affiliationId) {
      const aff = await Affiliation.findByURI(reference, context, pm.affiliationId);
      if (aff) {
        affiliation = { name: aff.name || aff.displayName, uri: aff.uri, provenance: aff.provenance };
      }
    }

    return {
      isPrimaryContact: pm.isPrimaryContact,
      memberRoles: memberRoles.map((mr) => ({ uri: mr.uri })),
      projectMember: {
        givenName: pm.givenName,
        surName: pm.surName,
        orcid: pm.orcid,
        affiliation,
      },
    };
  }));

  // --- Plan Fundings ---
  const planFundings = await PlanFunding.findByPlanId(reference, context, plan.id);

  const fundings = await Promise.all(planFundings.map(async (pf) => {
    const projectFunding = await ProjectFunding.findById(reference, context, pf.projectFundingId);
    if (!projectFunding) return { projectFunding: undefined };

    let affiliation: DataCiteSourceFundingAffiliation | undefined;
    if (projectFunding.affiliationId) {
      const aff = await Affiliation.findByURI(reference, context, projectFunding.affiliationId);
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
  const alternateIdentifierRecords = await AlternateIdentifier.findByPlanId(reference, context, plan.id);
  const alternateIdentifiers = alternateIdentifierRecords.map((a) => ({
    alternateIdentifier: a.alternateIdentifier,
  }));

  const dataciteInput = planToDataCiteMetadata({
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
    .catch(err => {
      context.logger.fatal({ planId: plan.id, err }, 'Index item in OpenSearch failed!');
    });

  // Update the maDMP record in Dynamo
  saveMaDMPVersion(reference, context, plan.id, plan.dmpId)
    .catch(err => {
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
    .catch(err => {
      context.logger.fatal({ planId: plan.id, err }, 'Remove OpenSearch index item failed!');
    });

  // Remove the maDMP records from Dynamo
  saveMaDMPVersion(reference, context, plan.id, plan.dmpId, true)
    .catch(err => {
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
): Promise<{ modified: string, dmpId: string, timestamp: string, url: string }[]> {
  if (isNullOrUndefined(dmpId)) return [];

  const dynamoConfig: DynamoConnectionParams = getDynamoConnectionParams(context.logger);
  try {
    const versions: DMPVersionType[] = await getDMPVersions(dynamoConfig, dmpId);

    // Fetch the current latest snapshot's modified timestamp so it can be
    // excluded below. "VERSION#latest" isn't a queryable timestamped snapshot —
    // including it would produce a version-picker link that 404s when clicked.
    const latest = await getDMPs(dynamoConfig, generalConfig.domain, dmpId, 'latest');
    const latestModified = latest[0]?.dmp?.modified;

    // Only return genuinely historical, timestamp-queryable versions.
    const historicalVersions = versions.filter(v => v.modified !== latestModified);

    return historicalVersions.map((v) => ({
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
    const results = await getDMPs(dynamoConfig, generalConfig.domain, dmpId, version);

    if (!results || results.length === 0) {
      return null;
    }

    // Fetch the planId from the database by dmpId
    const plan = await Plan.findByDMPId(reference, context, dmpId);
    const planId = plan?.id;
    const projectId = plan?.projectId;

    return await mapDMPToolDMPToSnapshot(results[0], version, context, planId, projectId);
  } catch (err) {
    context.logger.error({ dmpId, version, reference, err }, 'Unable to fetch DMP version snapshot.');
    return null;
  }
}

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

export async function mapDMPToolDMPToSnapshot(
  result: DMPToolDMPType,
  version: string,
  context: MyContext,
  planId: number,
  projectId?: number
): Promise<PlanVersionSnapshot> {

  const dmp = result.dmp;
  const project = dmp.project?.[0];
  const dmpId = dmp.dmp_id?.identifier; // already a full https://doi.org/... URL

  // Flatten narrative answers into the same {id, json} shape as live `answers`
  const answers = (dmp.narrative?.template?.section ?? []).flatMap((section) =>
    (section.question ?? [])
      .filter((q) => q.answer)
      .map((q) => ({
        id: q.answer?.id,
        questionText: q.text,
        json: JSON.stringify(q.answer?.json),
      }))
  );

  // Fetch every known role once, then match against contributor role URIs in memory.
  const allMemberRoles = await MemberRole.all('mapDMPToolDMPToSnapshot.memberRoles', context);
  const roleByUri = new Map(allMemberRoles.map((r) => [r.uri, r]));

  // Get the organization from the plan owner (affiliation) — this is computed
  // synchronously so we can kick off the affiliation lookup in parallel below.
  const ownerAffiliation = dmp.contributor?.find(c => c.name === dmp.contact?.name)?.affiliation?.[0];
  const affiliationURI = ownerAffiliation?.affiliation_id?.identifier;

  // Run the independent async lookups concurrently instead of sequentially:
  // - members: maps contributors and looks up isPrimaryContact per-contributor
  // - affiliation: resolves the owner's affiliation record
  // - acceptedWorks: fetches related works for this plan
  const [members, affiliation, acceptedWorks] = await Promise.all([
    Promise.all(
      (dmp.contributor ?? []).map(async (c) => {
        let isPrimaryContact = false;

        // If we have a projectId, query the database for the actual isPrimaryContact value
        if (projectId && c.contributor_id) {
          // Try to find by email first (most reliable)
          if (c.contact_mbox || c.mbox) {
            const email = c.contact_mbox || c.mbox;
            const dbMember = await ProjectMember.findByProjectAndEmail(
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
            const nameParts = c.name.split(' ');
            const givenName = nameParts[0];
            const surName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

            const dbMember = await ProjectMember.findByProjectAndName(
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
          orcid: c.contributor_id?.find((id) => id.type === 'orcid')?.identifier,
          affiliationName: c.affiliation?.[0]?.name,
          isPrimaryContact,
          memberRoles: (c.role ?? []).map((uri) => {
            const matched = roleByUri.get(uri);
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
  const relatedWorks: PlanVersionSnapshot['relatedWorks'] = acceptedWorks.map((work) => ({
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
    const dynamoConfig = getDynamoConnectionParams(context.logger);
    const latest = await getDMPs(dynamoConfig, generalConfig.domain, dmpId, 'latest');
    latestModified = latest[0]?.dmp?.modified;
  }

  const historicalVersions = (dmp.version ?? []).filter(
    (v) => v.version !== latestModified
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
    fundings: (project?.funding ?? []).map((f) => {
      const funderIdentifier = f.funder_id?.identifier;
      const opportunity = dmp.funding_opportunity?.find(
        (fo) => fo.funder_id?.identifier === funderIdentifier
      );
      const fundingProject = dmp.funding_project?.find(
        (fp) => fp.funder_id?.identifier === funderIdentifier
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

    versions: historicalVersions.map((v) => ({
      timestamp: v.version,
      url: v.access_url,
    })),
    relatedWorks,
    relatedWorkIdentifiers: (dmp.related_identifier ?? []).map((r) => r.identifier),
  };
}


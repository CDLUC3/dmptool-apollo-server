import { MyContext } from "../context";
import { MemberRole } from "../models/MemberRole";
import { isNullOrUndefined } from "../utils/helpers";
import { PlanMember, ProjectMember } from "../models/Member";
import { Plan, PlanStatus, PlanVisibility } from "../models/Plan";
import { Project } from "../models/Project";
import { PlanFunding, ProjectFunding } from "../models/Funding";
import { Affiliation } from "../models/Affiliation";
import { AlternateIdentifier } from "../models/AlternateIdentifier";
import {
  createDMP,
  deleteDMP,
  DMPExists,
  DynamoConnectionParams,
  EnvironmentEnum,
  planToDMPCommonStandard,
  toErrorMessage,
  tombstoneDMP,
  updateDMP
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
import {
  DatabaseTransactionClient,
  TransactionClient
} from "../datasources/mysql";
import {
  BAD_REQUEST_ERROR_CODE,
  BadRequestError,
  InternalServerError
} from "../utils/graphQLErrors";
import { GraphQLError } from "graphql/index";
import { prepareObjectForLogs } from "../logger";
import { VersionedTemplate } from "../models/VersionedTemplate";
import { defaultLanguageId } from "../models/Language";
import { ResearchDomain } from "../models/ResearchDomain";
import {
  AddEntirePlanInput,
  AddProjectInput, UpdateEntirePlanInput,
  UpdateProjectInput
} from "../types";
import {
  ensureDefaultProjectContact,
  setCurrentUserAsProjectOwner
} from "./projectService";

// The default object that will be included in all log messages for AddEntirePlan,
// UpdateEntirePlan and removeEntirePlanByDmpId functions
interface LogBase {
  ref: string;
  title: string;
  projectId?: number;
  planId?: number;
  dmpId?: string;
  versionedTemplateId?: number;
}

/**
 * Initialize a new MySQL connection object and start a new transaction
 *
 * @param context the Apollo server context
 */
const initializeTransaction = async (
  context: MyContext
): Promise<TransactionClient> => {
  // Fetch a transaction client for the database and start a new transaction
  const transactionClient: DatabaseTransactionClient = new TransactionClient(
    await context.dataSources.sqlDataSource.getConnection()
  );
  if (transactionClient) {
    context.logger.debug('Starting transaction.');
    await transactionClient.begin();
  } else {
    throw InternalServerError();
  }
  return transactionClient;
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
 * @param transactionClient the MySQL transaction to use
 * @returns true if a primary contact was found or created, false otherwise
 */
export const ensureDefaultPlanContact = async (
  context: MyContext,
  plan: Plan,
  project: Project,
  transactionClient: TransactionClient
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

      const created = await member.create(context, transactionClient);
      if (!isNullOrUndefined(created) && !created.hasErrors()) {
        // Add the roles to the default plan member
        for (const role of dfltMemberRoles) {
          await role.addToPlanMember(context, created.id, transactionClient);
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
  shouldDelete = false,
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
 * Handle an error that occurred in one of the `entirePlan` functions
 *
 * @param reference the string reference for logging
 * @param context the Apollo server context
 * @param transactionClient the MySQL transaction to roll back
 * @param logBase the base info for the log
 * @param plan the Plan that encountered the error
 * @param error the error that occurred
 * @returns the Plan as-is if all we're dealing with is a bad request error
 * @throws the original error if it's not a bad request error
 * @throws an internal server error if the error was not a GraphQL error
 */
const handleEntirePlanError = async (
  reference: string,
  context: MyContext,
  transactionClient: TransactionClient,
  logBase: LogBase,
  plan: Plan,
  error: GraphQLError | Error | unknown,
): Promise<Plan> => {
  // Always rollback if we get here.
  context.logger.error(
    prepareObjectForLogs({ logBase, error: toErrorMessage(error) }),
    'Rolling back transaction due to error.'
  );
  await transactionClient.rollback();

  // If it was an error we controlled
  if (error instanceof GraphQLError) {
    // If it was a bad request error then we should return the plan with all of its error messages
    if (error.extensions.code === BAD_REQUEST_ERROR_CODE) {
      if (!plan.errors.general) {
        plan.addError('general', 'Unable to create the plan from the maDMP JSON.');
      }
      return plan;
    }

    // Otherwise allow it to bubble up
    throw error;

  } else {
    // Otherwise it is a completely unexpected error, so log it and throw a 500
    context.logger.error(
      prepareObjectForLogs({ error: toErrorMessage(error) }),
      `Failure in ${reference}`
    );
    throw InternalServerError();
  }
}

/**
 * Find the project by the specified id or by the caller and project title.
 * If none is found, initialize a new project
 *
 * @param ref the string reference for logging
 * @param context the Apollo server context
 * @param input the project input
 * @returns a Project or undefined
 */
const findOrInitializeProject = async (
  ref: string,
  context: MyContext,
  input: AddProjectInput | UpdateProjectInput,
): Promise<Project | undefined> => {
  let project: Project | undefined;

  // We must have title
  if (!input || !input.title) return undefined;

  // Attempt to find it by the specified id or title
  project = input.id
    ? await Project.findById(ref, context, input.id)
    : await Project.findByOwnerAndTitle(ref, context, input.title, context.token.id);

  // Attempt to find the specified ResearchDomain
  const researchDomain: ResearchDomain | undefined = input.researchDomainId
    ? await ResearchDomain.findById(ref, context, input.researchDomainId)
    : undefined;

  // If no project was found, initialize one
  if (!project) {
    project = new Project({});
  }

  project.title = input.title.trim();
  project.abstractText = input.abstractText.trim();
  project.startDate = input.startDate;
  project.endDate = input.endDate;
  project.researchDomainId = researchDomain?.id;
  project.isTestProject = input.isTestProject || false;
  return project;
}

/**
 * Find the latest active version for the specified template or get the default template
 *
 * @param reference the string reference for logging
 * @param context the Apollo server context
 * @param templateId the id of the template to use
 */
const findVersionedTemplateForEntirePlan = async (
  reference: string,
  context: MyContext,
  templateId?: number,
): Promise<VersionedTemplate | undefined> => {
  let versionedTemplate: VersionedTemplate | undefined;

  if (templateId) {
    versionedTemplate = await VersionedTemplate.findActiveByTemplateId(reference, context, templateId);
    if (!versionedTemplate) {
      context.logger.error({ ref: reference, templateId }, 'Unable to find the specified versioned template!');
      throw BadRequestError('Unable to find the specified versioned template!');
    }
  } else {
    // If no versioned template was specified, use the default one
    versionedTemplate = await VersionedTemplate.defaultTemplate(reference, context);
    if (!versionedTemplate) {
      context.logger.error({ ref: reference }, 'Unable to find a default versioned template!');
      throw InternalServerError();
    }
  }

  return versionedTemplate;
}

/**
 * Add any new Alternate Identifiers and Remove any that are no longer present
 *
 * @param ref the string reference for logging
 * @param context the Apollo server context
 * @param transactionClient the MySQL transaction to use
 * @param plan the Plan
 * @param alternateIdentifiers the array of alternate identifiers
 * @returns a string of errors if there were any or undefined
 */
const processAlternateIdentifiers = async (
  ref: string,
  context: MyContext,
  transactionClient: TransactionClient,
  plan: Plan,
  alternateIdentifiers: string[]
): Promise<string | undefined> => {
  const errs: string[] = [];
  const currentEntries: AlternateIdentifier[] = await AlternateIdentifier.findByPlanId(
    ref,
    context,
    plan.id
  );

  const currentIds: string[] = currentEntries.map((entry: AlternateIdentifier) => {
    return entry.alternateIdentifier
  }).filter(Boolean);

  const { idsToBeRemoved, idsToBeSaved } = Plan.reconcileAssociationIds(currentIds, alternateIdentifiers);

  // Add any new ones
  for (const id of idsToBeSaved) {
    const newId = new AlternateIdentifier({ alternateIdentifier: id, planId: plan.id });
    await newId.create(context, transactionClient);
    if (newId.hasErrors()) {
      errs.push(`Unable to add alternate identifier ${id}`);
    }
  }

  // Delete any that are no longer there
  for (const id of idsToBeRemoved) {
    const idToRemove: AlternateIdentifier = currentEntries.find((entry: AlternateIdentifier) => {
      return entry.alternateIdentifier === id;
    });
    if (idToRemove) {
      await idToRemove.delete(context, transactionClient);
      if (idToRemove.hasErrors()) {
        errs.push(`Unable to delete alternate identifier ${id}`);
      }
    }
  }
  return errs.join(', ');
}

/**
 * Process all objects associated with the Entire Plan functions
 *
 * @param reference the string reference for logging
 * @param context the Apollo server context
 * @param transactionClient the MySQL transaction to use
 * @param plan the Plan
 * @param input the entire plan input
 * @returns the Plan (with errors if appropriate)
 */
const processAssociatedObjectForEntirePlan = async (
  reference: string,
  context: MyContext,
  transactionClient: TransactionClient,
  plan: Plan,
  input: AddEntirePlanInput | UpdateEntirePlanInput,
) => {
  // 4th: Save associated objects
  const altIdErrors: string = await processAlternateIdentifiers(
    reference,
    context,
    transactionClient,
    plan,
    input.alternateIdentifiers || []
  );
  if (altIdErrors) {
    plan.addError('alternateIdentifiers', altIdErrors);
  }

  // 5th: Save associated members

  // 6th: Save associated funding

  // 7th: Save any related works

  // 8th: Save the narrative answers
}

/**
 * Add the entire plan (and project if applicable) along with all of its associated
 * dependencies.
 *
 * @param reference the string reference for logging
 * @param context the Apollo server context
 * @param input the Plan input
 * @returns the newly created Plan or a Plan with errors for context into what went wrong
 */
export const addEntirePlan = async (
  reference: string,
  context: MyContext,
  input: AddEntirePlanInput,
): Promise<Plan> => {
  let plan: Plan = new Plan({});

  const logBase: LogBase = { ref: reference, title: input.title };
  const transactionClient: TransactionClient = await initializeTransaction(context);

  // 1st: find or initialize the project
  try {
    const project: Project | undefined = await findOrInitializeProject(reference, context, input.project);
    if (!project) {
      context.logger.error(logBase, 'Unable to find or initialize a Project!');
      throw InternalServerError();
    }

    // 2nd: Save the project
    if (project.id) {
      await project.update(context, false, transactionClient);
    } else {
      await project.create(context, transactionClient);
    }
    if (project.hasErrors()) {
      plan.addError('projectId', project.errorsToString());
      throw BadRequestError();
    }
    logBase.projectId = project.id;
    context.logger.debug(prepareObjectForLogs(logBase), 'Updated or created project.');
    // Make sure the current user is added as the owner of the project and is also
    // the primary contact
    await setCurrentUserAsProjectOwner(context, project.id, transactionClient);
    await ensureDefaultProjectContact(context, project, transactionClient);

    // 3rd: Determine what versioned template we should use
    const versionedTemplate: VersionedTemplate | undefined = await findVersionedTemplateForEntirePlan(
      reference,
      context,
      input.templateId
    );
    if (!versionedTemplate.id) {
      context.logger.fatal('Unable to find a suitable versioned template!');
      throw InternalServerError();
    }
    logBase.versionedTemplateId = versionedTemplate.id;
    context.logger.debug(prepareObjectForLogs(logBase), 'Found versioned template.');

    // 4th: Create the plan
    plan = new Plan({
      projectId: project.id,
      versionedTemplateId: versionedTemplate.id,
      title: input.title,
      status: input.status || PlanStatus.DRAFT,
      visibility: input.visibility || PlanVisibility.PRIVATE,
      languageId: input.languageId || defaultLanguageId
    });
    await plan.create(context, transactionClient);
    if (plan.hasErrors() || !plan.id) {
      context.logger.fatal(logBase, 'Unable to create the plan!')
      throw BadRequestError();
    }
    logBase.planId = plan.id;
    logBase.dmpId = plan.dmpId;
    context.logger.debug(prepareObjectForLogs(logBase), 'Created plan.');
    // Make sure the plan has a primary contact
    await ensureDefaultPlanContact(context, plan, project, transactionClient);

    // 5th: process all the associated objects
    await processAssociatedObjectForEntirePlan(
      reference,
      context,
      transactionClient,
      plan,
      input
    );
    // If we had any errors with the associated objects, throw a Bad Request
    if (plan.hasErrors()) {
      throw BadRequestError();
    }

    // Otherwise commit all the SQL transactions and return the plan
    await transactionClient.commit();
    return plan;

  } catch (error) {
    // Pass the error off to our helper function. If it's a Bad Request error it will
    // make sure the Plan errors object has a `general` error. If its another type
    // of GraphQL error or was a fatal exception, it will re-throw the error so that
    // we can let it bubble up to the caller
    return await handleEntirePlanError(reference, context, transactionClient, logBase, plan, error);
  }
}

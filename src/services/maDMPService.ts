import { MyContext } from "../context";
import { DMPToolDMPType } from "@dmptool/types";
import { ResearchDomain } from "../models/ResearchDomain";
import { VersionedTemplate } from "../models/VersionedTemplate";
import { Project } from "../models/Project";
import { Plan, PlanStatus, PlanVisibility } from "../models/Plan";
import {
  DatabaseTransactionClient,
  TransactionClient
} from "../datasources/mysql";
import { prepareObjectForLogs } from "../logger";
import { BadRequestError, ForbiddenError, InternalServerError } from "../utils/graphQLErrors";
import { hasPermissionOnProject } from "./projectService";
import { ProjectCollaboratorAccessLevel } from "../models/Collaborator";
import { defaultLanguageId } from "../models/Language";
import { AlternateIdentifier } from "../models/AlternateIdentifier";
import {PlanFunding, ProjectFunding, ProjectFundingStatus} from "../models/Funding";
import {Affiliation} from "../models/Affiliation";
import {id} from "date-fns/locale";

type DMPToolDMP = DMPToolDMPType['dmp'];
type DMPToolProject = DMPToolDMP['project'][0];
type DMPToolNarrative = DMPToolDMP['narrative'];
type DMPToolAlternateIdentifier = DMPToolDMP['alternate_identifier'][0];
type DMPToolFunding = DMPToolProject['funding'][0];

// The default object that will be included in all log messages
interface LogBase {
  ref: string;
  title: string;
  projectId?: number;
  planId?: number;
  dmpId?: string;
  versionedTemplateId?: number;
}

/**
 * Determine if we're working with a maDMP record that has the DMP Tool extensions
 *
 * @param maDMP the maDMP JSON (drilled into the top level `dmp` property)
 * @returns true if one of the core DMP extension properties is present
 */
const isUsingDMPToolExtensions = (
  maDMP: DMPToolDMPType['dmp']
) => {
  return !!maDMP['provenance']
    || !!maDMP['narrative']
    || !!maDMP['status']
    || !!maDMP['privacy'];
};

/**
 * Convert the RDA Common Standard funding status to the GraphQL enum.
 *
 * @param status the status code
 * @returns the status code as a GraphQL enum value
 */
const toFundingStatus = (
  status?: string
): ProjectFundingStatus | undefined => {
  const val = status?.trim().toUpperCase();

  if (val === 'PLANNED' || val === 'DENIED' || val === 'GRANTED') {
    return ProjectFundingStatus[val as keyof ProjectFundingStatus];
  }

  return undefined;
};

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
 * Fetch the Research Domain by the specified research_domain_identifier
 *
 * @param ref the string reference for logging
 * @param context the Apollo server context
 * @param maDMP the maDMP JSON (drilled into the top level `dmp` property)
 * @returns a ResearchDomain or undefined
 */
const findResearchDomainFromMaDMP = async (
  ref: string,
  context: MyContext,
  maDMP: DMPToolDMP
): Promise<ResearchDomain | undefined> => {
  if (maDMP['research_domain'] && maDMP['research_domain']['research_domain_identifier']) {
    return await ResearchDomain.findByURI(ref, context, maDMP['research_domain']['research_domain_identifier']);
  }
  return undefined;
}

/**
 * Find the latest version of the specified template, or the default template if
 * none was specified or the specified template has no active version.
 *
 * @param ref the string reference for logging
 * @param context the Apollo server context
 * @param narrativeTemplate the narrative template object from the maDMP JSON
 * @returns a VersionedTemplate or undefined
 */
const findTemplateFromMaDMP = async (
  ref: string,
  context: MyContext,
  narrativeTemplate?: DMPToolNarrative
): Promise<VersionedTemplate | undefined> => {
  let versionedTemplate: VersionedTemplate | undefined;

  // If a template id was specified, we need to grab the latest version
  if (narrativeTemplate?.templateId && Number.isInteger(narrativeTemplate.templateId)) {
    versionedTemplate = await VersionedTemplate.findActiveByTemplateId(
      ref,
      context,
      narrativeTemplate.templateId
    );
  }

  // Otherwise we are going to use the default template
  if (!versionedTemplate) {
    versionedTemplate = await VersionedTemplate.defaultTemplate(ref, context);
    if (narrativeTemplate?.templateId) {
      context.logger.warn(
        { templateId: narrativeTemplate.templateId },
        'Unable to find specified template (or none was specified) using the default template instead.'
      );
    }
  }
  return versionedTemplate;
}

/**
 * Find the project by the specified project_id or by the caller and project title.
 * If none is found, initialize a new project
 *
 * @param ref the string reference for logging
 * @param context the Apollo server context
 * @param maDMP the maDMP JSON (drilled into the top level `dmp` property)
 * @returns a Project or undefined
 */
const findOrInitializeProjectFromMaDMP = async (
  ref: string,
  context: MyContext,
  maDMP: DMPToolDMP
): Promise<Project | undefined> => {
  let project: Project | undefined;

  if (maDMP) {
    const maDMPProject: DMPToolProject = maDMP['project'][0];
    if (maDMPProject['project_id'] && maDMPProject['project_id']['identifier']) {
      const identifierParts: string[] = maDMPProject['project_id']['identifier'].split('/');
      if (Number.isInteger(identifierParts[identifierParts.length - 1])) {
        project = await Project.findById(
          ref,
          context,
          parseInt(identifierParts[identifierParts.length - 1], 10)
        );
        if (project) context.logger.debug({ projectId: project.id }, 'Found project by project_id');
      }
    }
    if (!project) {
      project = await Project.findByOwnerAndTitle(
        ref,
        context,
        maDMPProject.title || maDMP.title,
        context.token.id
      );
      if (project) context.logger.debug({ projectId: project.id }, 'Found project by owner and title');
    }
    if (!project) {
      const researchDomain: ResearchDomain = await findResearchDomainFromMaDMP(ref, context, maDMP);

      project = new Project({
        title: maDMPProject.title || maDMP.title,
        abstractText: maDMPProject.description || maDMP.description,
        startDate: maDMPProject.start,
        endDate: maDMPProject.end,
        researchDomainId: researchDomain?.id,
        isTestProject: maDMP['is_test_project'] ?? false
      });
    }
  }

  return project;
}

/**
 * Add any new Alternate Identifiers and Remove any that are no longer present
 *
 * @param ref the string reference for logging
 * @param context the Apollo server context
 * @param transactionClient the MySQL transaction to use
 * @param plan the Plan
 * @param maDMP the maDMP record (drilled in to the top level `dmp` property)
 * @returns a string of errors if there were any or undefined
 */
const processAlternateIdentifiers = async (
  ref: string,
  context: MyContext,
  transactionClient: TransactionClient,
  plan: Plan,
  maDMP: DMPToolDMP
): Promise<string | undefined> => {
  const errs: string[] = [];
  const newEntries: DMPToolAlternateIdentifier[] = maDMP['alternate_identifier'] || [];
  const currentEntries: AlternateIdentifier[] = await AlternateIdentifier.findByPlanId(ref, context, plan.id);

  const newIds: string[] = newEntries.map((entry: { identifier: string }) => entry.identifier).filter(Boolean);
  const currentIds: string[] = currentEntries.map((entry: AlternateIdentifier) => entry.alternateIdentifier).filter(Boolean);

  // Figure out which ones to delete
  const idsToDelete: string[] = currentIds.filter((id: string) => !newIds.includes(id));
  // Figure out which ones to add
  const idsToAdd: string[] = newIds.filter((id: string) => !currentIds.includes(id));

  // Add any new ones
  for (const id of idsToAdd) {
    const newId = new AlternateIdentifier({ alternateIdentifier: id, planId: plan.id });
    await newId.create(context, transactionClient);
    if (newId.hasErrors()) {
      errs.push(`Unable to add alternate identifier ${id}`);
    }
  }

  // Delete any that are no longer there
  for (const id of idsToDelete) {
    const idToRemove: AlternateIdentifier = currentEntries.find((entry: AlternateIdentifier) => entry.alternateIdentifier === id);
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
 * Fetch the affiliation name from the DB based on its URI
 *
 * @param ref the string reference for logging
 * @param context the Apollo server context
 * @param uri the URI to search for
 * @returns the affiliation's name
 */
const getAffiliationNameByURI = async (
  ref: string,
  context: MyContext,
  uri: string
): Promise<string | undefined> => {
  const affiliation = await Affiliation.findByURI(ref, context, uri);
  return affiliation?.name;
}

/**
 * Convert a funding object into a hash using its unique properties so we can do
 * comparisons and matching.
 *
 * @param ref the string reference for logging
 * @param context the Apollo server context
 * @param fundingA the Funding portion of a maDMP record or a ProjectFunding object
 * @param fundingB the Funding portion of a maDMP record or a ProjectFunding object
 * @returns a unique hash string for the funding entry
 */
const fundingEquals = async (
  ref: string,
  context: MyContext,
  fundingA: DMPToolFunding | ProjectFunding,
  fundingB: DMPToolFunding | ProjectFunding
): Promise<boolean> => {
  if (!fundingA && !fundingB) return true;

  const aIsModel: boolean = ('created' in fundingA);
  const bIsModel: boolean = ('created' in fundingB);
  const idA: string | undefined = aIsModel ? fundingA.affiliationId : fundingA.funder_id?.identifier;
  const idB: string | undefined = bIsModel ? fundingB.affiliationId : fundingB.funder_id?.identifier;

  // If both ids are present, compare them. Otherwise, compare the names.
  if (idA && idB) {
    return idA.toLowerCase().trim() === idB.toLowerCase().trim();
  } else {
    const nameA: string | undefined = aIsModel ? await getAffiliationNameByURI(ref, context, idA) : fundingA.name;
    const nameB: string | undefined = bIsModel ? await getAffiliationNameByURI(ref, context, idA) : fundingB.name;
    return nameA.toLowerCase().trim() === nameB.toLowerCase().trim();
  }
}

/**
 * Add any new Funding, Update any existing funding and Remove any that are no longer present
 *
 * @param ref the string reference for logging
 * @param context the Apollo server context
 * @param transactionClient the MySQL transaction to use
 * @param plan the Plan
 * @param maDMP the maDMP record (drilled in to the top level `dmp` property)
 * @returns a string of errors if there were any or undefined
 */
const processFunding = async (
  ref: string,
  context: MyContext,
  transactionClient: TransactionClient,
  project: Project,
  plan: Plan,
  maDMP: DMPToolDMPType
): Promise<string | undefined> => {
  const errs: string[] = [];
  const maDMPProject = maDMP['project'][0];
  const newEntries: DMPToolFunding[] = maDMPProject.funding || [];
  const currentProjFs: ProjectFunding[] = await ProjectFunding.findByProjectId(ref, context, project.id);
  const currentPlanFs: PlanFunding[] = await PlanFunding.findByPlanId(ref, context, plan.id);

  // Figure out which ones to delete
  const toDelete: ProjectFunding[] = currentProjFs.filter((funding: ProjectFunding) => {
    return !newEntries.some(async (newFunding: DMPToolFunding) => {
      return await fundingEquals(ref, context, funding, newFunding);
    });
  });
  // Figure out which ones to add
  const toAdd: DMPToolFunding[] = newEntries.filter((funding: DMPToolFunding) => {
    return !currentProjFs.some(async (newFunding: ProjectFunding) => {
      return await fundingEquals(ref, context, funding, newFunding);
    })
  });

  // Delete any that should no longer be there
  for (const deleteMe of toDelete) {
    // First find all uses of the project funding we want to delete
    const planFundings: PlanFunding[] = await PlanFunding.findByProjectFundingId(
      ref,
      context,
      deleteMe.id
    );

    if (planFundings.length > 1) {
      // If it is attached to other plans then we can delete the planFunding but
      // not the parent projectFunding because it is shared
      context.logger.debug(`Skipping deletion of projectFunding for "${deleteMe.affiliationId}". It is used on other plans.`);
      const oneToDelete: PlanFunding = planFundings.find((f) => {
        return f.projectFundingId !== deleteMe.id;
      });
      if (oneToDelete) {
        await oneToDelete.delete(context, transactionClient);
        if (oneToDelete.hasErrors()) {
          errs.push(`Unable to delete plan funding for ${deleteMe.affiliationId}`);
        }
      } else {
        context.logger.warn({ projectFundingId: deleteMe.id }, 'Could not find planFunding to delete.');
      }

    } else if (planFundings.length === 1) {
      // Otherwise delete the PlanFunding and then the ProjectFunding
      context.logger.debug(prepareObjectForLogs({ planId: plan.id, planFundingId: planFundings[0].id }), "deleting planFunding");

      await planFundings[0].delete(context, transactionClient);
      if (planFundings[0].hasErrors()) {
        errs.push(`Unable to delete plan funding for ${deleteMe.affiliationId}`);
      } else {
        context.logger.debug(prepareObjectForLogs({ projectId: project.id, projectFundingId: deleteMe.id }), "deleting projectFunding");
        await deleteMe.delete(context, transactionClient);
        if (deleteMe.hasErrors()) {
          errs.push(`Unable to delete project funding for ${deleteMe.affiliationId}`);
        }
      }
    }
  }

  // Loop through the ones in the maDMP record
  for (const funding of newEntries) {
    const areAdding: boolean = toAdd.some((newOne: DMPToolFunding) => newOne === funding);
    if (areAdding) {
      // Add the new ProjectFunding

      // Add the PlanFunding
    } else {
      // Otherwise update the ProjectFunding

      // Check if the plan already has this ProjectFunding, if not add it
    }

  }

  return errs.join(', ');
}

/**
 * Create a Plan and all of its associated objects from the maDMP JSON
 *
 * @param context the Apollo server context
 * @param maDMP the maDMP JSON
 * @returns a newly created Plan or undefined if something went wrong. If there were
 * any non-fatal errors, they will be added to the Plan's errors property
 */
export const batchCreateEntirePlanFromMaDMP = async (
  maDMP: DMPToolDMP,
  context: MyContext
): Promise<Plan | undefined> => {
  const ref = 'batchCreateEntirePlanFromMaDMP';
  const logBase: LogBase = { ref, title: maDMP.title };
  const transactionClient: TransactionClient = await initializeTransaction(context);

  let plan: Plan | undefined;

  // Extract core fragments of the larger maDMP JSON to make it more readable below
  const maDMPProject: DMPToolProject | undefined = maDMP.project[0];

  try {
    // 1st: Find or initialize the Project
    const project: Project = await findOrInitializeProjectFromMaDMP(ref, context, maDMP);
    if (!project) {
      //Something went wrong, we could not find OR initialize a new project
      context.logger.fatal(prepareObjectForLogs(logBase), 'Unable to find or initialize the Project!');
      throw InternalServerError();
    }
    // If the project returned had no id then it is new so we need to create it
    if (!project.id) {
      await project.create(context, transactionClient);
      if (project.hasErrors()) {
        // The creation failed, so record the errors and throw
        context.logger.error(prepareObjectForLogs(
            { ...logBase, errors: project.errors }),
          'Unable to create the Project!');
        throw BadRequestError();
      }
    } else {
      // Make sure the caller has permission
      if (!( await hasPermissionOnProject(context, project, ProjectCollaboratorAccessLevel.EDIT))) {
        context.logger.error(prepareObjectForLogs(logBase), 'Caller does not have permission to edit the Project!');
        throw ForbiddenError();
      }
    }
    logBase.projectId = project.id;
    context.logger.debug(prepareObjectForLogs(logBase), 'Found or created project.');

    // 2nd: Determine which Template we are using
    const versionedTemplate: VersionedTemplate | undefined = await findTemplateFromMaDMP(
      ref,
      context,
      maDMP.narrative?.template
    );
    if (!versionedTemplate.id) {
      context.logger.fatal('Unable to find a suitable versioned template!');
      throw InternalServerError();
    }
    logBase.versionedTemplateId = versionedTemplate.id;
    context.logger.debug(prepareObjectForLogs(logBase), 'Found versioned template.');

    // 3rd: Create the plan
    plan = new Plan({
      projectId: project.id,
      versionedTemplateId: versionedTemplate.id,
      title: maDMP.title,
      status: maDMP.status || PlanStatus.DRAFT,
      visibility: maDMP.visibility || PlanVisibility.PRIVATE,
      languageId: maDMP.languageId || defaultLanguageId
    });
    await plan.create(context, transactionClient);

    if (plan.hasErrors() || !plan.id) {
      context.logger.fatal(logBase, 'Unable to create the plan!')
      throw BadRequestError();
    }
    logBase.planId = plan.id;
    logBase.dmpId = plan.dmpId;
    context.logger.debug(prepareObjectForLogs(logBase), 'Created plan.');

    // 4th: Save associated objects
    const altIdErrors: string = await processAlternateIdentifiers(ref, context, plan, maDMP);
    if (altIdErrors) {
      plan.addError('alternateIdentifiers', altIdErrors);
    }

    // 4th: Save the Project and Plan Funding
    context.logger.debug(
      { ...logBase, alternateIdentifier: idIn, projectId: project.id, dmpId: plan.dmpId },
      'Saving project and plan funding'
    );
    const fundedPlan: Plan = await saveFundingWorkflow(context, project, plan, dmp);

    // 5th: Save the Project and Plan Members
    context.logger.debug(
      { ...logBase, alternateIdentifier: idIn, projectId: project.id, dmpId: fundedPlan.dmpId },
      'Saving project and plan members'
    );
    const finalPlan: Plan = await saveMembersWorkflow(context, project, fundedPlan, dmp);

    // 6th: All o
    context.logger.debug(
      { ...logBase, alternateIdentifier: idIn, projectId: project.id, dmpId: finalPlan.dmpId },
      'Saving non-critical information'
    );
    await saveNonFatalPlanArtifacts(context, dmp, finalPlan);

  } catch (err) {
    // Always rollback if we get here.
    context.logger.error(
      prepareObjectForLogs({ logBase, error: toErrorMessage(err) }),
      'Rolling back transaction due to error.'
    );
    await transactionClient.rollback();

    // If it was an error we controlled
    if (err instanceof GraphQLError) {
      // If it was a bad request error then we should return the plan with all of its error messages
      if (err.extensions.code === BAD_REQUEST_ERROR_CODE) {
        if (!plan.errors.general) {
          plan.addError('general', 'Unable to create the plan from the maDMP JSON.');
        }
        return plan;
      }

      // Otherwise allow it to bubble up
      throw err;

    } else {
      // Otherwise it is a completely unexpected error, so log it and throw a 500
      context.logger.error(prepareObjectForLogs(err), `Failure in ${ref}`);
      throw InternalServerError();
    }
  }

  // Finalize the SQL transactions and return the plan
  context.logger.warn(prepareObjectForLogs({ logBase }), 'Commiting transaction.');
  await transactionClient.commit();
  return plan;
}

/**
 * Update a Plan and all of its associated content from a maDMP JSON record
 *
 * @param context the Apollo server context
 * @param project the Project
 * @param plan the Plan
 * @param maDMP the maDMP JSON record (drilled in to the top level `dmp` property)
 */
export const batchUpdateEntirePlanFromMaDMP = async (
  context: MyContext,
  project: Project,
  plan: Plan,
  maDMP: DMPToolDMP,
): Promise<Plan | undefined> => {
  const ref = 'batchUpdateEntirePlanFromMaDMP';
  const usingDMPToolExtensions: boolean = isUsingDMPToolExtensions(maDMP);
  const transactionClient: TransactionClient = await initializeTransaction(context);
  const logBase: LogBase = {
    ref,
    title: maDMP.title,
    projectId: project.id,
    planId: plan.id,
    dmpId: plan.dmpId,
    versionedTemplateId: plan.versionedTemplateId
  };

  // Extract core fragments of the larger maDMP JSON to make it more readable below
  const maDMPProject: DMPToolProject | undefined = maDMP.project[0];

  try {
    // 1st: Update the project
    const projectTitle = maDMPProject.title ?? maDMP.title;
    const projectAbstract = maDMPProject.description ?? maDMPProject.description;

    // Add some verbose logging to help with debugging
    context.logger.debug(
      {
        ...logBase,
        oldTitle: project.title,
        newTitle: projectTitle,
        oldAbstract: project.abstractText,
        newAbstract: projectAbstract,
        oldStartDate: project.startDate,
        newStartDate: maDMPProject.start,
        oldEndDate: project.endDate,
        newEndDate: maDMPProject.end,
        oldIsTest: project.isTestProject,
        newIsTest: usingDMPToolExtensions ? maDMP.is_test : project.isTestProject,
        oldResearchDomain: project.researchDomainId,
        newResearchDomain: usingDMPToolExtensions ? maDMP['research_domain'] : project.researchDomainId,
      },
      'Updating project information.'
    );

    // Process the standard project level information
    project.title = maDMPProject.title || maDMP.title;
    project.abstractText = maDMPProject.description || maDMP.description;
    project.startDate = maDMPProject.start;
    project.endDate = maDMPProject.end;

    // Only process the following fields if the incoming content type was for the
    // DMP Tool extended schema format (otherwise we are inadvertently blanking out data)
    if (usingDMPToolExtensions) {
      project.isTestProject = maDMP.isTestProject || false;
      project.researchDomainId = (await findResearchDomainFromMaDMP(ref, context, maDMP))?.id;
    }

    // 2nd: Update the plan
    const languageId = maDMP.language
      ? maDMP.language === 'ptb' ? 'pt-BR' : 'en-US'
      : defaultLanguageId;
    // Add some verbose logging to help with debugging
    context.logger.debug(
      {
        ...logBase,
        oldTitle: plan.title,
        newTitle: maDMP.title,
        oldLanguage: plan.languageId,
        newLanguage: languageId,
        oldStatus: project.isTestProject,
        newStatus: usingDMPToolExtensions ? maDMP.is_test : project.isTestProject,
        oldVisibility: project.researchDomainId,
        newVisibility: usingDMPToolExtensions ? maDMP['research_domain'] : project.researchDomainId,
      },
      'Updating plan information.'
    );
    plan.title = maDMP.title ?? plan.title;
    plan.languageId = languageId ?? plan.languageId;

    // Only process the following fields if the incoming content type was fpr the
    // DMP Tool extended schema format (otherwise we are inadvertently blanking out data)
    if (usingDMPToolExtensions) {
      plan.status = maDMP.status ?? plan.status;
      plan.visibility = maDMP.visibility ?? plan.visibility;
    }

    // 3rd: Save associated objects
    const altErrors: string = await processAlternateIdentifiers(ref, context, plan, maDMP);
    if (altErrors) {
      plan.addError('alternateIdentifiers', altErrors);
    }

    // 4th: Save the Project and Plan Funding
    context.logger.debug(
      { ...logBase, alternateIdentifier: idIn, projectId: project.id, dmpId: plan.dmpId },
      'Saving project and plan funding'
    );
    const fundedPlan: Plan = await saveFundingWorkflow(context, project, plan, dmp);

    // 5th: Save the Project and Plan Members
    context.logger.debug(
      { ...logBase, alternateIdentifier: idIn, projectId: project.id, dmpId: fundedPlan.dmpId },
      'Saving project and plan members'
    );
    const finalPlan: Plan = await saveMembersWorkflow(context, project, fundedPlan, dmp);

    // 6th: Save non-critical information
    context.logger.debug(
      { ...logBase, alternateIdentifier: idIn, projectId: project.id, dmpId: finalPlan.dmpId },
      'Saving non-critical information'
    );
    await saveNonFatalPlanArtifacts(context, dmp, finalPlan);

  } catch (err) {
    // Always rollback if we get here.
    context.logger.error(
      prepareObjectForLogs({ logBase, error: toErrorMessage(err) }),
      'Rolling back transaction due to error.'
    );
    await transactionClient.rollback();

    // If it was an error we controlled
    if (err instanceof GraphQLError) {
      // If it was a bad request error then we should return the plan with all of its error messages
      if (err.extensions.code === BAD_REQUEST_ERROR_CODE) {
        if (!plan.errors.general) {
          plan.addError('general', 'Unable to create the plan from the maDMP JSON.');
        }
        return plan;
      }

      // Otherwise allow it to bubble up
      throw err;

    } else {
      // Otherwise it is a completely unexpected error, so log it and throw a 500
      context.logger.error(prepareObjectForLogs(err), `Failure in ${ref}`);
      throw InternalServerError();
    }
  }

  // Finalize the SQL transactions and return the plan
  context.logger.warn(prepareObjectForLogs({ logBase }), 'Commiting transaction.');
  await transactionClient.commit();
  return plan;
}

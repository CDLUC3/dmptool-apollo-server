import {GraphQLError} from "graphql";
import {toErrorMessage} from "@dmptool/utils";
import {MyContext} from "../context";
import {prepareObjectForLogs} from "../logger";
import {ensureDefaultPlanContact} from "./planService";
import {AlternateIdentifier} from "../models/AlternateIdentifier";
import {defaultLanguageId} from "../models/Language";
import {Project} from "../models/Project";
import {Affiliation} from "../models/Affiliation";
import {MemberRole} from "../models/MemberRole";
import {ResearchDomain} from "../models/ResearchDomain";
import {VersionedTemplate} from "../models/VersionedTemplate";
import {PlanMember, ProjectMember} from "../models/Member";
import {Plan, PlanStatus, PlanVisibility} from "../models/Plan";
import {
  PlanFunding,
  ProjectFunding,
  ProjectFundingStatus
} from "../models/Funding";
import {
  AddEntirePlanInput,
  AddProjectFundingInput,
  AddProjectInput,
  AddProjectMemberInput,
  UpdateEntirePlanInput,
  UpdateProjectFundingInput,
  UpdateProjectInput,
  UpdateProjectMemberInput
} from "../types";
import {BadRequestError, InternalServerError} from "../utils/graphQLErrors";
import {
  ensureDefaultProjectContact,
  setCurrentUserAsProjectOwner
} from "./projectService";

interface LogBase {
  ref: string;
  title: string;
  projectId?: number;
  planId?: number;
  dmpId?: string;
  versionedTemplateId?: number;
}

// The action types that can be used when resolving an associated object
type AssociationAction = 'add' | 'update' | 'remove';

type ProjectAssociationType = ProjectMember | ProjectFunding;
type PlanAssociationType = PlanMember | PlanFunding;

// The type of the associated object
type AssociationInputType = AddProjectMemberInput
  | UpdateProjectMemberInput
  | AddProjectFundingInput
  | UpdateProjectFundingInput;

// A reconciled associated object
interface ReconciledAssociation<AssociationInputType, ProjectAssociationType> {
  action: AssociationAction;
  input?: AssociationInputType;
  id?: number;
  existingProjectObj?: ProjectAssociationType;
}

// Represents the input used when resolving associated objects within the "EntirePlan"
// functions
interface AssociationResolutionContext {
  reference: string;
  context: MyContext;
  project: Project;
  plan: Plan;
}

// The context ultimately passed into the add, update and remove handlers
interface ReconciliationHandlerContext {
  context: MyContext;
  project: Project;
  plan: Plan;
  input: AssociationInputType;
  affiliation: Affiliation;
  currentProjectObj: ProjectAssociationType;
  currentPlanObj: PlanAssociationType;
  isShared: boolean;
  logName: string;
  errors: string[];
}

interface AssociationReconcilerConfig {
  // Function to fetch all the associated objects for the Plan (e.g. PlanMember[])
  fetchPlanObjs: (planId: number) => Promise<PlanAssociationType[]>;
  // Function to fetch all the associated objects for the Project (e.g. ProjectMember[])
  fetchProjectObjs: (projectId: number) => Promise<ProjectAssociationType[]>;
  // Function to initialize a new associated object for the Project (e.g. new ProjectMember)
  findOrCreateProjectObj: (input: AssociationInputType) => Promise<ProjectAssociationType>;
  // Function to get the Project's associated object id for a given Plan associated object
  // (e.g. get the projectMemberId for a PlanMember)
  getPlanObjProjectObjId: (planObj: PlanAssociationType) => number;
  // Function to determine if the Project associated object is used by other Plans
  isUsedByOtherPlans: (projectObjId: number) => Promise<boolean>;
  // Function to set a contextual string value for the logs
  getLogIdentifier: (input: AssociationInputType, affiliationUri?: string) => string;

  // Functions to handle mutating the associated objects for the Project and Plan
  handleAdd: (ctx: ReconciliationHandlerContext) => Promise<void>;
  handleUpdate: (ctx: ReconciliationHandlerContext) => Promise<void>;
  handleRemove: (ctx: ReconciliationHandlerContext) => Promise<void>;
}

/**
 *
 * @param currentProjectObjs
 * @param incomingObjs
 * @param inputsMapByProjectObj
 */
const reconcileAssociations = (
  currentProjectObjs: ProjectAssociationType[],
  incomingObjs: ProjectAssociationType[],
  inputsMapByProjectObj: Map<ProjectAssociationType, AssociationInputType>
): ReconciledAssociation<AssociationInputType, ProjectAssociationType>[] => {
  // First figure out which associated objects should be removed and which ones saved
  const { idsToBeRemoved, idsToBeSaved } = Plan.reconcileAssociationIds(
    currentProjectObjs.map((m: ProjectAssociationType): number => m.id),
    incomingObjs.map((m: ProjectAssociationType): number => m.id)
  );

  const reconciled: ReconciledAssociation<AssociationInputType, ProjectAssociationType>[] = incomingObjs.map((obj: ProjectAssociationType) => {
    const shouldBeSaved = obj.id ? idsToBeSaved.includes(obj.id) : false;
    return {
      action: shouldBeSaved ? 'update' : 'add',
      input: inputsMapByProjectObj.get(obj),
      existingProjectObj: obj,
      id: obj.id,
    };
  });

  for (const id of idsToBeRemoved) {
    reconciled.push({
      action: 'remove',
      input: undefined,
      existingProjectObj: currentProjectObjs.find((m: ProjectAssociationType): boolean => m.id === id),
      id: Number(id),
    });
  }

  return reconciled;
}

/**
 * Process the associated objects for a Project and Plan
 *
 * @param processingContext the context in which to process inserts, updates and deletes
 * @param inputs the associated objects
 * @param config the configuration to use while processing the objects
 */
const processAssociations  = async (
  processingContext: AssociationResolutionContext,
  inputs: AssociationInputType[],
  config: AssociationReconcilerConfig
): Promise<string | undefined> => {
  const { reference, context, project, plan } = processingContext;
  const errors: string[] = [];

  const [currentPlanObjs, currentProjectObjs] = await Promise.all([
    config.fetchPlanObjs(plan.id),
    config.fetchProjectObjs(project.id)
  ]);

  // Map inputs to project objects
  const inputsMap = new Map<ProjectAssociationType, AssociationInputType>();
  const incomingProjectObjs: ProjectAssociationType[] = await Promise.all(
    inputs.map(async (input: AssociationInputType): Promise<ProjectAssociationType> => {
      const obj: ProjectAssociationType = await config.findOrCreateProjectObj(input);
      if (obj) inputsMap.set(obj, input);
      return obj;
    })
  ).then((list: ProjectAssociationType[]): ProjectAssociationType[] => list.filter(Boolean));

  const items: ReconciledAssociation<AssociationInputType, ProjectAssociationType>[] = reconcileAssociations(
    currentProjectObjs,
    incomingProjectObjs,
    inputsMap
  );

  for (const item of items) {
    const input: AssociationInputType = item.input;
    const currentProjectObj: ProjectAssociationType = item.existingProjectObj || (item.existingProjectObj as ProjectAssociationType);
    const currentPlanObj: PlanAssociationType = currentPlanObjs.find(
      (m: PlanAssociationType): boolean => config.getPlanObjProjectObjId(m) === item.id
    );

    const affiliation: Affiliation = input && 'affiliationId' in input
      ? await Affiliation.findByURI(reference, context, input.affiliationId)
      : undefined;

    const logName = input
      ? config.getLogIdentifier(input, affiliation?.uri)
      : `${item.id}`;
    const isShared = currentProjectObj?.id
      ? await config.isUsedByOtherPlans(currentProjectObj.id)
      : false;

    const handlerCtx: ReconciliationHandlerContext = {
      ...processingContext,
      input,
      affiliation,
      currentProjectObj,
      currentPlanObj,
      isShared,
      logName,
      errors,
    };

    if (item.action === 'add') {
      await config.handleAdd(handlerCtx);
    } else if (item.action === 'remove') {
      await config.handleRemove(handlerCtx);
    } else {
      await config.handleUpdate(handlerCtx);
    }
  }

  return errors.length ? errors.join(', ') : undefined;
}

/**
 * Process all the incoming Project/Plan members
 *
 * @param reference the string reference for logging
 * @param context the Apollo server context
 * @param project the research project
 * @param plan the plan
 * @param members the incoming members
 * @returns a string of errors or undefined if everything was successful
 */
export const processMemberAssociations = async(
  reference: string,
  context: MyContext,
  project: Project,
  plan: Plan,
  members: AddProjectMemberInput[] | UpdateProjectMemberInput[]
): Promise<string | undefined> => {
  return processAssociations(
    // Define the context needed to process the associations
    {
      reference,
      context,
      project,
      plan
    } as AssociationResolutionContext,
    members,
    {
      // Define all the fetch functions that will give us the information we need
      // to determine whether an association should be added, updated or removed
      fetchPlanObjs: (id: number): Promise<PlanMember[]> => {
        return PlanMember.findByPlanId(reference, context, id);
      },
      fetchProjectObjs: (id: number): Promise<ProjectMember[]> => {
        return ProjectMember.findByProjectId(reference, context, id);
      },
      findOrCreateProjectObj: async (m: ProjectMember): Promise<ProjectMember> => {
        const member: ProjectMember = await ProjectMember.findByProjectAndNameOrORCIDOrEmail(
          reference,
          context,
          project.id,
          m.givenName,
          m.surName,
          m.orcid,
          m.email
        );
        return member || new ProjectMember(m);
      },
      getPlanObjProjectObjId: (pm: PlanMember): number => pm.projectMemberId,
      isUsedByOtherPlans: async (id: number): Promise<boolean> => {
        return (await PlanMember.findByProjectMemberId(reference, context, id)).length > 0;
      },
      getLogIdentifier: (a: AssociationInputType): string => {
        return 'surname' in a && 'givenName' in a
          ? [a?.surName, a?.givenName].filter(Boolean).join(' ').trim()
          : 'affiliationId' in a ? a.affiliationId : '';
      },

      // Define all the functions to handle the association
      handleAdd: async ({
        context,
        project,
        plan,
        input,
        affiliation,
        logName,
        errors
      }: ReconciliationHandlerContext): Promise<void> => {
        const pMemberIn = input as AddProjectMemberInput | UpdateProjectMemberInput;

        // Add the project member first
        const newProjMember: ProjectMember = await new ProjectMember({
          projectId: project.id,
          affiliationId: affiliation?.uri,
          givenName: pMemberIn.givenName,
          surName: pMemberIn.surName,
          orcid: pMemberIn.orcid,
          email: pMemberIn.email,
        }).create(context, project.id);
        if (!newProjMember || newProjMember.hasErrors()) {
          errors.push(`Unable to add new project member: ${logName}`);
          return;

        } else {
          const roles: MemberRole[] = await Promise.all(pMemberIn.memberRoleIds.map(async (id: number): Promise<MemberRole> => {
            return await MemberRole.findById(reference, context, id);
          }).filter(Boolean));

          // Add the roles to the new project member
          for (const role of roles) {
            const addedRole: boolean = await role.addToProjectMember(context, newProjMember.id);
            if (!addedRole) {
              errors.push(`Unable to add new role ${role.label} to project member: ${logName}`);
            }
          }

          // Add the plan member
          const newPlanMember = new PlanMember({
            projectMemberId: newProjMember.id,
            planId: plan.id,
            isPrimaryContact: newProjMember.isPrimaryContact,
          });
          await newPlanMember.create(context);
          if (newPlanMember.hasErrors()) {
            errors.push(`Unable to add new plan member: ${logName}`);

          } else {
            // Add the roles to the new plan member
            for (const role of roles) {
              const addedRole: boolean = await role.addToPlanMember(context, newPlanMember.id);
              if (!addedRole) {
                errors.push(`Unable to add new role ${role.label} to plan member: ${logName}`);
              }
            }
          }
        }
      },

      handleRemove: async ({
        context,
        currentPlanObj,
        currentProjectObj,
        isShared,
        logName,
        errors
      }: ReconciliationHandlerContext) => {
        // Remove the plan member
        const cPlanObj = currentPlanObj as PlanMember;
        const removedPlan: PlanMember = await cPlanObj.delete(context);
        if (removedPlan.hasErrors()) {
          errors.push(`Unable to delete plan member ${logName}`);

        } else {
          // Remove the project member if it is NOT shared with other plans
          if (!isShared) {
            const cProjObj = currentProjectObj as ProjectMember;
            const removedProj: ProjectMember = await cProjObj.delete(context);
            if (removedProj.hasErrors()) errors.push(`Unable to delete project member ${logName}`);
          }
        }
      },

      handleUpdate: async ({
        context,
        currentPlanObj,
        currentProjectObj,
        input,
        affiliation,
        isShared,
        logName,
        errors
      }: ReconciliationHandlerContext) => {
        const inObj = input as AddProjectMemberInput | UpdateProjectMemberInput;

        const cPlanObj = currentPlanObj as PlanMember;
        const cProjObj = currentProjectObj as ProjectMember;

        // The only thing to update for a plan member are roles
        cPlanObj.memberRoleIds = inObj.memberRoleIds;
        const projRoleIds: number[] = cProjObj.memberRoles.map((role: MemberRole) => role.id);
        for (const id in cPlanObj.memberRoleIds) {
          const role: MemberRole = await MemberRole.findById(reference, context, Number(id));
          if (role) {
            // If the project member doesn't have this role then add it there first
            if (!projRoleIds.includes(role.id)) {
              const addedToProj: boolean = await role.addToProjectMember(context, cProjObj.id);
              if (!addedToProj) {
                errors.push(`Unable to add role ${role.label} to project member ${logName}`);
              }
            }

            // Add the role to the plan member
            const wasAdded = await role.addToPlanMember(context, cPlanObj.id);
            if (!wasAdded) {
              errors.push(`Unable to add role ${role.label} to plan member ${logName}`);
            }
          }
        }

        // Update the project member
        cProjObj.affiliationId = affiliation?.uri;
        cProjObj.givenName = inObj.givenName;
        cProjObj.surName = inObj.surName;
        cProjObj.orcid = inObj.orcid;
        cProjObj.email = inObj.email;
        const updProj: ProjectMember = await cProjObj.update(context, true);
        if (updProj.hasErrors()) errors.push(`Unable to update project member ${logName}`);

        // If the project member is NOT shared with other plans, remove any roles
        // that are no longer there
        if (!isShared) {
          for (const role of cProjObj.memberRoles) {
            if (!cPlanObj.memberRoleIds.includes(role.id)) {
              const wasRemoved: boolean = await role.removeFromProjectMember(context, cProjObj.id);
              if (!wasRemoved) {
                errors.push(`Unable to remove role ${role.label} from project member ${logName}`);
              }
            }
          }
        }
      }
    }
  );
}

/**
 * Process all the incoming Project/Plan funding
 *
 * @param reference the string reference for logging
 * @param context the Apollo server context
 * @param project the research project
 * @param plan the plan
 * @param funding the incoming funding
 * @returns a string of errors or undefined if everything was successful
 */
export const processFundingAssociations = async(
  reference: string,
  context: MyContext,
  project: Project,
  plan: Plan,
  funding: AddProjectFundingInput[] | UpdateProjectFundingInput[]
): Promise<string | undefined> => {
  return processAssociations(
    // Define the context needed to process the associations
    {
      reference,
      context,
      project,
      plan
    } as AssociationResolutionContext,
    funding,
    {
      // Define all the fetch functions that will give us the information we need
      // to determine whether an association should be added, updated or removed
      fetchPlanObjs: (id: number): Promise<PlanFunding[]> => {
        return PlanFunding.findByPlanId(reference, context, id);
      },
      fetchProjectObjs: (id: number): Promise<ProjectFunding[]> => {
        return ProjectFunding.findByProjectId(reference, context, id);
      },
      findOrCreateProjectObj: async (m: ProjectFunding): Promise<ProjectFunding> => {
        const funding: ProjectFunding = await ProjectFunding.findByProjectAndAffiliation(
          reference,
          context,
          project.id,
          m.affiliationId
        );
        return funding || new ProjectFunding(m);
      },
      getPlanObjProjectObjId: (pm: PlanFunding): number => pm.projectFundingId,
      isUsedByOtherPlans: async (id: number): Promise<boolean> => {
        return (await PlanFunding.findByProjectFundingId(reference, context, id)).length > 0;
      },
      getLogIdentifier: (a: AssociationInputType): string => {
        return 'affiliationId' in a
          ? a.affiliationId
          : ('projectFundingId' in a ? a.projectFundingId.toString() : '?');
      },

      // Define all the functions to handle the association
      handleAdd: async ({
        context,
        project,
        plan,
        input,
        affiliation,
        logName,
        errors
      }: ReconciliationHandlerContext): Promise<void> => {
        const pFundingIn = input as AddProjectFundingInput | UpdateProjectFundingInput;

        // Add the project funding
        const newProjFunding: ProjectFunding = await new ProjectFunding({
          projectId: project.id,
          affiliationId: affiliation?.uri,
          status: ProjectFundingStatus[pFundingIn.status as keyof ProjectFundingStatus],
          funderOpportunityNumber: pFundingIn?.funderOpportunityNumber,
          funderProjectNumber: pFundingIn?.funderProjectNumber,
          grantId: pFundingIn?.grantId,
        }).create(context, project.id);
        if (!newProjFunding || newProjFunding.hasErrors()) {
          errors.push(`Unable to add new project funding: ${logName}`);
          return;
        }

        // Add the plan funding
        const newPlanFunding = new PlanFunding({
          projectFundingId: newProjFunding.id,
          planId: plan.id,
        });
        await newPlanFunding.create(context);
        if (newPlanFunding.hasErrors()) errors.push(`Unable to add new plan funding for: ${logName}`);
      },

      handleRemove: async ({
        context,
        currentPlanObj,
        currentProjectObj,
        isShared,
        logName,
        errors
      }: ReconciliationHandlerContext) => {
        // Remove the plan funding
        const cPlanObj = currentPlanObj as PlanFunding;
        const removedPlan: PlanFunding = await cPlanObj.delete(context);
        if (removedPlan.hasErrors()) errors.push(`Unable to delete plan funding for: ${logName}`);

        // Only remove the project funding if it isn't being used by another plan
        if (!isShared) {
          const cProjObj = currentProjectObj as ProjectFunding;
          const removedProj: ProjectFunding = await cProjObj.delete(context);
          if (removedProj.hasErrors()) errors.push(`Unable to delete project funding for: ${logName}`);
        }
      },

      handleUpdate: async ({
        context,
        currentProjectObj,
        input,
        affiliation,
        logName,
        errors
      }: ReconciliationHandlerContext) => {
        const inObj = input as AddProjectFundingInput | UpdateProjectFundingInput;

        // There is nothing to update on a PlanFunding, it is just a join table

        // Update the project funding
        const cProjObj = currentProjectObj as ProjectFunding;
        cProjObj.affiliationId = affiliation?.uri;
        cProjObj.status = ProjectFundingStatus[inObj.status as keyof ProjectFundingStatus];
        cProjObj.funderOpportunityNumber = inObj.funderOpportunityNumber;
        cProjObj.funderProjectNumber = inObj.funderProjectNumber;
        cProjObj.grantId = inObj.grantId;
        const updProj: ProjectFunding = await cProjObj.update(context, true);
        if (updProj.hasErrors()) errors.push(`Unable to update project funding for: ${logName}`);
      }
    }
  );
}

/**
 * Add any new Alternate Identifiers and Remove any that are no longer present
 *
 * @param ref the string reference for logging
 * @param context the Apollo server context
 * @param plan the Plan
 * @param alternateIdentifiers the array of alternate identifiers
 * @returns a string of errors if there were any or undefined
 */
const processAlternateIdentifiers = async (
  ref: string,
  context: MyContext,
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
    await newId.create(context);
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
      await idToRemove.delete(context);
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
 * @param project the Project
 * @param plan the Plan
 * @param input the entire plan input
 * @returns the Plan (with errors if appropriate)
 */
const processAssociatedObjectForEntirePlan = async (
  reference: string,
  context: MyContext,
  project: Project,
  plan: Plan,
  input: AddEntirePlanInput | UpdateEntirePlanInput,
): Promise<void> => {
  // 1st: Save associated alternate identifiers (used by external services)
  const altIdErrors: string = await processAlternateIdentifiers(
    reference,
    context,
    plan,
    input.alternateIdentifiers || []
  );
  if (altIdErrors) {
    plan.addError('alternateIdentifiers', altIdErrors);
  }

  // 2nd: Save associated members (The project/plan owner and primary contact
  //      are set prior to this function being called)
  const memberErrors: string = await processMemberAssociations(
    reference,
    context,
    project,
    plan,
    input.members || []
  );
  if (memberErrors) {
    plan.addError('members', memberErrors);
  }

  // 3rd: Save associated funding
  const fundingErrors: string = await processFundingAssociations(
    reference,
    context,
    project,
    plan,
    input.funding || [],
  );
  if (fundingErrors) {
    plan.addError('funding', fundingErrors);
  }

  // 7th: Save any related works


  // 8th: Save the narrative answers
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
 * Handle an error that occurred in one of the `entirePlan` functions
 *
 * @param reference the string reference for logging
 * @param context the Apollo server context
 * @param logBase the base info for the log
 * @param plan the Plan with all of its errors
 * @param error the error that occurred
 * @returns the Plan as-is if all we're dealing with is a bad request error
 * @throws the original error if it's not a bad request error
 * @throws an internal server error if the error was not a GraphQL error
 */
const handleEntirePlanError = async (
  reference: string,
  context: MyContext,
  logBase: LogBase,
  plan: Plan,
  error: GraphQLError | Error | unknown,
): Promise<Plan> => {
  // If it was an error we controlled just rethrow it.
  if (error instanceof GraphQLError) {
    if (plan.hasErrors() && !plan.errors['general']) {
      plan.addError('general', 'Unable to process your request.');
    }
    throw error;

  } else {
    // Otherwise it is a completely unexpected error, so log it and throw a 500
    context.logger.error(
      prepareObjectForLogs({ ...logBase, error: toErrorMessage(error) }),
      `Failure in ${reference}`
    );
    throw InternalServerError();
  }
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

  try {
    // 1st: Determine what versioned template we should use
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

    // 2nd: find or initialize the project
    const project: Project | undefined = await findOrInitializeProject(reference, context, input.project);
    if (!project) {
      context.logger.fatal(logBase, 'Unable to find or initialize a Project!');
      throw InternalServerError();
    }

    // 3rd: Save the project
    if (project.id) {
      await project.update(context, false);
    } else {
      await project.create(context);
    }
    if (project.hasErrors()) {
      plan.addError('projectId', project.errorsToString());
      throw BadRequestError();
    }
    logBase.projectId = project.id;
    context.logger.debug(prepareObjectForLogs(logBase), 'Updated or created project.');
    // Make sure the current user is added as the owner of the project and is also
    // the primary contact
    await setCurrentUserAsProjectOwner(context, project.id);
    await ensureDefaultProjectContact(context, project);

    // 4th: Create the plan
    plan = new Plan({
      projectId: project.id,
      versionedTemplateId: versionedTemplate.id,
      title: input.title,
      status: input.status || PlanStatus.DRAFT,
      visibility: input.visibility || PlanVisibility.PRIVATE,
      languageId: input.languageId || defaultLanguageId
    });
    await plan.create(context);
    if (plan.hasErrors() || !plan.id) {
      context.logger.fatal(logBase, 'Unable to create the plan!')
      throw BadRequestError();
    }
    logBase.planId = plan.id;
    logBase.dmpId = plan.dmpId;
    context.logger.debug(prepareObjectForLogs(logBase), 'Created plan.');
    // Make sure the plan has a primary contact
    await ensureDefaultPlanContact(context, plan, project);

    // 5th: process all the associated objects
    await processAssociatedObjectForEntirePlan(
      reference,
      context,
      project,
      plan,
      input
    );
    // If we had any errors with the associated objects, throw a Bad Request
    if (plan.hasErrors()) {
      throw BadRequestError();
    }

    return plan;

  } catch (error) {
    // Pass the error off to our helper function. If it's a Bad Request error it will
    // make sure the Plan errors object has a `general` error. If its another type
    // of GraphQL error or was a fatal exception, it will re-throw the error so that
    // we can let it bubble up to the caller
    return await handleEntirePlanError(reference, context, logBase, plan, error);
  }
}

/**
 * Replace the entire plan (and project if applicable) along with all of its associated
 * dependencies.
 *
 * @param reference the string reference for logging
 * @param context the Apollo server context
 * @param project the research Project associated with the Plan
 * @param plan the Plan
 * @param input the Plan input
 * @returns the newly created Plan or a Plan with errors for context into what went wrong
 */
export const replaceEntirePlan = async (
  reference: string,
  context: MyContext,
  project: Project,
  plan: Plan,
  input: UpdateEntirePlanInput,
): Promise<Plan> => {
  const logBase: LogBase = {
    ref: reference,
    title: input.title,
    projectId: project.id,
    planId: plan.id,
    versionedTemplateId: plan.versionedTemplateId,
  };

  try {
    // 1st: Save the project information
    context.logger.debug(logBase, 'Replacing project information');
    const researchDomain: ResearchDomain | null = input.project?.researchDomainId
      ? await ResearchDomain.findById(reference, context, input.project.researchDomainId)
      : null;

    // Process the standard project level information
    project.title = input.project?.title || input.title;
    project.abstractText = input.project?.abstractText;
    project.startDate = input.project?.startDate;
    project.endDate = input.project?.endDate;
    project.isTestProject = input.project?.isTestProject || false;
    project.researchDomainId = researchDomain?.id || null;

    if (!(await project.update(context))) {
      context.logger.error(
        prepareObjectForLogs({ ...logBase, errors: project.errors }),
        'Unable to replace project information'
      );
      throw BadRequestError();
    }

    // 2nd: Replace the Plan information
    context.logger.debug(logBase, 'Replacing plan information');

    plan.title = input.title;
    plan.languageId = input.languageId || defaultLanguageId;
    plan.status = PlanStatus[input.status as keyof PlanStatus];
    plan.visibility = PlanVisibility[input.visibility as keyof PlanVisibility];
    if (!(await plan.update(context))) {
      context.logger.error(
        prepareObjectForLogs({ ...logBase, errors: plan.errors }),
        'Unable to replace plan information'
      );
      throw BadRequestError();
    }

    // 5th: process all the associated objects
    await processAssociatedObjectForEntirePlan(
      reference,
      context,
      project,
      plan,
      input
    );
    // If we had any errors with the associated objects, throw a Bad Request
    if (plan.hasErrors()) {
      throw BadRequestError();
    }

    return plan;

  } catch (error) {
    // Pass the error off to our helper function. If it's a Bad Request error it will
    // make sure the Plan errors object has a `general` error. If its another type
    // of GraphQL error or was a fatal exception, it will re-throw the error so that
    // we can let it bubble up to the caller
    return await handleEntirePlanError(reference, context, logBase, plan, error);
  }
}

/**
 * Remove the entire plan (and project if applicable) along with all of its associated
 * dependencies.
 *
 * @param reference the string reference for logging
 * @param context the Apollo server context
 * @param project the research Project associated with the Plan
 * @param plan the Plan
 * @returns the newly created Plan or a Plan with errors for context into what went wrong
 */
export const removeEntirePlan = async (
  reference: string,
  context: MyContext,
  project: Project,
  plan: Plan
): Promise<Plan> => {
  const logBase: LogBase = {
    ref: reference,
    title: plan.title,
    projectId: project.id,
    planId: plan.id,
    versionedTemplateId: plan.versionedTemplateId,
  };

  try {
    if (plan.isPublished()) {
      // We cannot delete a published/registered Plan, so tombstone it instead
      context.logger.debug(logBase, 'Archiving plan');

      // Add an "OBSOLETE:" prefix to the Plan title, make it privately visible,
      // and set its status to archived
      plan.title = `OBSOLETE: ${plan.title}`;
      plan.visibility = PlanVisibility.PRIVATE;
      plan.status = PlanStatus.ARCHIVED;

      if (!(await plan.update(context))) {
        context.logger.error(
          prepareObjectForLogs({...logBase, errors: plan.errors}),
          'Unable to archive published plan.'
        );
        throw BadRequestError();
      }

      // TODO: Need to work through what else needs to be done. For example:
      //         - Do we remove collaborators?
      //         - Do we send emails?

    } else {
      // 1st: Remove the Plan (related dependency deletion should happen automatically)
      context.logger.debug(logBase, 'Removing plan');

      if (!(await plan.delete(context))) {
        context.logger.error(
          prepareObjectForLogs({...logBase, errors: plan.errors}),
          'Unable to delete plan'
        );
        throw BadRequestError();
      }

      // 2nd: Remove the Project if it is not associated with other Plans
      const plans: Plan[] = await Plan.findByProjectId(reference, context, project.id);
      if (plans.length <= 0) {
        if (!(await project.delete(context))) {
          context.logger.error(
            prepareObjectForLogs({...logBase, errors: project.errors}),
            'Unable to delete project'
          );
          throw BadRequestError();
        }
      }
    }

    return plan;

  } catch (error) {
    // Pass the error off to our helper function. If it's a Bad Request error it will
    // make sure the Plan errors object has a `general` error. If its another type
    // of GraphQL error or was a fatal exception, it will re-throw the error so that
    // we can let it bubble up to the caller
    return await handleEntirePlanError(reference, context, logBase, plan, error);
  }
}

import { prepareObjectForLogs } from '../logger';
import { Resolvers } from "../types";
import { Affiliation } from '../models/Affiliation';
import { Project } from '../models/Project';
import { PlanFunding, ProjectFunding } from "../models/Funding";
import { MyContext } from '../context';
import { isAuthorized } from '../services/authService';
import { AuthenticationError, ForbiddenError, InternalServerError, NotFoundError } from '../utils/graphQLErrors';
import { hasPermissionOnProject } from '../services/projectService';
import { GraphQLError } from 'graphql';
import { Plan } from '../models/Plan';
import { ProjectCollaboratorAccessLevel } from "../models/Collaborator";
import { isNullOrUndefined, normaliseDateTime } from "../utils/helpers";
import { saveMaDMPVersion } from "../services/planService";

export const resolvers: Resolvers = {
  Query: {
    // return all of the fundings for the project
    projectFundings: async (_, { projectId }, context: MyContext): Promise<ProjectFunding[]> => {
      const reference = 'projectFundings resolver';
      try {
        if (isAuthorized(context.token)) {
          const project = await Project.findById(reference, context, projectId);

          if (project && await hasPermissionOnProject(context, project, ProjectCollaboratorAccessLevel.COMMENT)) {
            return await ProjectFunding.findByProjectId(reference, context, projectId);
          }
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // return a single project funding
    projectFunding: async (_, { projectFundingId }, context: MyContext): Promise<ProjectFunding> => {
      const reference = 'projectFunding resolver';
      try {
        if (isAuthorized(context.token)) {
          const projectFunding = await ProjectFunding.findById(reference, context, projectFundingId);
          if (isNullOrUndefined(projectFunding)) {
            throw NotFoundError();
          }

          const project = await Project.findById(reference, context, projectFunding.projectId);
          if (project && await hasPermissionOnProject(context, project, ProjectCollaboratorAccessLevel.COMMENT)) {
            return projectFunding;
          }
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    planFundings: async (_, { planId }, context: MyContext): Promise<PlanFunding[]> => {
      const reference = 'planFundings resolver';
      try {
        if (isAuthorized(context.token)) {
          const plan = await Plan.findById(reference, context, planId);
          if (isNullOrUndefined(plan)) {
            throw NotFoundError();
          }

          const project = await Project.findById(reference, context, plan.projectId);
          if (plan && await hasPermissionOnProject(context, project, ProjectCollaboratorAccessLevel.COMMENT)) {
            return await PlanFunding.findByPlanId(reference, context, plan.id);
          }
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },
  },

  Mutation: {
    // add a new project funding
    addProjectFunding: async (_, { input }, context: MyContext) => {
      const reference = 'addProjectFunding resolver';
      try {
        if (isAuthorized(context.token)) {
          const project = await Project.findById(reference, context, input.projectId);
          if (isNullOrUndefined(project)) {
            throw NotFoundError();
          }

          if (await hasPermissionOnProject(context, project, ProjectCollaboratorAccessLevel.EDIT)) {
            const newFunding = new ProjectFunding(input);
            const created = await newFunding.create(context, project.id);

            if (created?.id) {
              return created;
            }

            // A null was returned so add a generic error and return it
            if (!newFunding.errors['general']) {
              newFunding.addError('general', 'Unable to create funding');
            }
            return newFunding;
          }
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // update an existing project funding
    updateProjectFunding: async (_, { input }, context) => {
      const reference = 'updateProjectFunding resolver';
      try {
        if (isAuthorized(context.token)) {
          const funding = await ProjectFunding.findById(reference, context, input.projectFundingId);
          if (isNullOrUndefined(funding)) {
            throw NotFoundError();
          }

          // Only allow the owner of the project to edit it
          const project = await Project.findById(reference, context, funding.projectId);
          if (await hasPermissionOnProject(context, project, ProjectCollaboratorAccessLevel.EDIT)) {
            const toUpdate = new ProjectFunding(input);
            toUpdate.projectId = funding?.projectId;
            toUpdate.id = funding?.id;
            toUpdate.affiliationId = funding.affiliationId;

            const updated = await toUpdate.update(context);
            if (updated && !updated.hasErrors()) {
              const plans = await Plan.findByProjectId(reference, context, funding.projectId);
              for (const plan of plans) {
                // Update the maDMP version of the Plan
                await saveMaDMPVersion(reference, context, plan.id, plan.registered);
              }
            }
            return updated;
          }
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // delete an existing project funding
    removeProjectFunding: async (_, { projectFundingId }, context) => {
      const reference = 'removeProjectFunding resolver';
      try {
        if (isAuthorized(context.token)) {
          const funding = await ProjectFunding.findById(reference, context, projectFundingId);
          if (isNullOrUndefined(funding)) {
            throw NotFoundError();
          }

          // Only allow the owner of the project to delete it
          const project = await Project.findById(reference, context, funding.projectId);
          if (await hasPermissionOnProject(context, project, ProjectCollaboratorAccessLevel.EDIT)) {
            const removed = await funding.delete(context);
            if (removed && !removed.hasErrors()) {
              const plans = await Plan.findByProjectId(reference, context, funding.projectId);
              for (const plan of plans) {
                // Update the maDMP version of the Plan
                await saveMaDMPVersion(reference, context, plan.id, plan.registered);
              }
            }
            return removed;
          }
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // add new plan fundings
    addPlanFunding: async (_, { planId, projectFundingIds }, context: MyContext): Promise<Plan> => {
      const reference = 'addPlanFunding mutator';

      try {
        if (isAuthorized(context.token)) {
          const plan = await Plan.findById(reference, context, planId);
          if (isNullOrUndefined(plan)) {
            throw NotFoundError();
          }

          const project = await Project.findById(reference, context, plan.projectId);
          if (await hasPermissionOnProject(context, project)) {

            // Fetch all of the current Funders associated with this Plan
            const fundings = await PlanFunding.findByPlanId(reference, context, plan.id);
            const currentPlanFundingids = fundings ? fundings.map((d) => d.projectFundingId) : [];
            // Use the helper function to determine which funders to add
            const {
              idsToBeSaved
            } = PlanFunding.reconcileAssociationIds(
              currentPlanFundingids,
              projectFundingIds
            );

            const failedFundings = [];

            // Add new records for projectFundingIds that are not already in planFundings table
            for (const id of idsToBeSaved) {
              const funding = new PlanFunding({ planId, projectFundingId: id });
              const wasAdded = await funding.create(context);
              if (!wasAdded) {
                // Get errors from the failed object creation
                failedFundings.push(`Unable to add projectFundingId: ${id}`);
                context.logger.error(
                  prepareObjectForLogs({ planId, projectFundingId: id }),
                  `Failed to add PlanFunding in ${reference}`
                );
              }
            }

            // Get plan with new fundings
            const returnedPlan = await Plan.findById(reference, context, plan.id);

            // Merge in the failed ids so the client can see their errors
            for (const failed of failedFundings) {
              returnedPlan.addError('general', failed);
            }

            // Update the maDMP version of the Plan
            await saveMaDMPVersion(reference, context, returnedPlan.id, returnedPlan.registered);

            // We want to return the Plan and attach one set of errors for any failed fundings
            return returnedPlan;
          }
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;
        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Update any number of planFundings by passing in an array of the new projectFundingIds. New ones will be added and existing ones
    // that are not included in the projectFundingIds array will be removed
    updatePlanFunding: async (_, { planId, projectFundingIds }, context: MyContext): Promise<PlanFunding[]> => {
      const reference = 'updatePlanFunding resolver';
      try {

        if (!isAuthorized(context.token)) {
          throw context.token ? ForbiddenError() : AuthenticationError();
        }

        const plan = await Plan.findById(reference, context, planId);
        if (isNullOrUndefined(plan)) {
          throw NotFoundError();
        }

        const project = await Project.findById(reference, context, plan.projectId);
        if (await hasPermissionOnProject(context, project)) {

          const associationErrors = [];
          // Fetch all of the current Funders associated with this Plan
          const fundings = await PlanFunding.findByPlanId(reference, context, plan.id);
          const currentPlanFundingids = fundings ? fundings.map((d) => d.projectFundingId) : [];
          // Use the helper function to determine which funders to keep and which to remove
          const {
            idsToBeRemoved,
            idsToBeSaved
          } = PlanFunding.reconcileAssociationIds(
            currentPlanFundingids,
            projectFundingIds
          );

          const removeErrors = [];
          // Remove records that are not in the newly supplied projectFundingIds array
          for (const id of idsToBeRemoved) {
            const funding = await PlanFunding.findByProjectFundingId(reference, context, planId, id);
            if (funding) {
              const wasRemoved = funding.delete(context);
              if (!wasRemoved) {
                removeErrors.push(funding.projectFundingId);
              }
            }
          }
          // If any failed to be removed, then add an error
          if (removeErrors.length > 0) {
            associationErrors.push(`unable to remove funding: ${removeErrors.join(', ')}`);
          }

          const addErrors = [];
          // Add new records for projectFundingIds that are not already in planFundings table
          for (const id of idsToBeSaved) {
            const funding = new PlanFunding({ planId, projectFundingId: id });

            const wasAdded = funding.create(context);
            if (!wasAdded) {
              addErrors.push(funding.projectFundingId);
            }

          }
          // If any failed to be added, then add an error to the ProjectMember
          if (addErrors.length > 0) {
            associationErrors.push(`unable to add funding: ${addErrors.join(', ')}`);
          }
          if (associationErrors.length > 0) {
            context.logger.warn(`Plan funding update had issues: ${associationErrors.join(', ')}`);
          }

          // Update the maDMP version of the Plan
          await saveMaDMPVersion(reference, context, plan.id, plan.registered);

          return await PlanFunding.findByPlanId(reference, context, plan.id);
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // remove one plan funding
    removePlanFunding: async (_, { planFundingId }, context: MyContext): Promise<PlanFunding> => {
      const reference = 'removePlanFunding resolver';
      try {
        if (isAuthorized(context.token)) {
          const funding = await PlanFunding.findById(reference, context, planFundingId);
          if (isNullOrUndefined(funding)) {
            throw NotFoundError();
          }

          const plan = await Plan.findById(reference, context, funding.planId);
          const project = await Project.findById(reference, context, plan.projectId);
          if (await hasPermissionOnProject(context, project)) {
            const deletedFunding = await funding.delete(context);

            if (deletedFunding && !deletedFunding.hasErrors()) {
              // Update the maDMP version of the Plan
              await saveMaDMPVersion(reference, context, plan.id, plan.registered);
            }

            return deletedFunding;
          }
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

  },

  ProjectFunding: {
    project: async (parent: ProjectFunding, _, context: MyContext): Promise<Project> => {
      if (parent?.projectId) {
        return await Project.findById('Chained ProjectFunding.project', context, parent.projectId);
      }
      return null;
    },
    affiliation: async (parent: ProjectFunding, _, context: MyContext): Promise<Affiliation> => {
      if (parent?.affiliationId) {
        return await Affiliation.findByURI('Chained ProjectFunding.affiliation', context, parent.affiliationId);
      }
      return null;
    },
    created: (parent: ProjectFunding) => {
      return normaliseDateTime(parent.created);
    },
    modified: (parent: ProjectFunding) => {
      return normaliseDateTime(parent.modified);
    }
  },

  PlanFunding: {
    plan: async (parent: PlanFunding, _, context: MyContext): Promise<Plan> => {
      if (parent?.planId) {
        return await Plan.findById('Chained PlanFunding.plan', context, parent.planId);
      }
    },
    projectFunding: async (parent: PlanFunding, _, context: MyContext): Promise<ProjectFunding> => {
      if (parent?.projectFundingId) {
        return await ProjectFunding.findById('Chained PlanFunding.projectFunding', context, parent.projectFundingId);
      }
      return null;
    },
    created: (parent: PlanFunding) => {
      return normaliseDateTime(parent.created);
    },
    modified: (parent: PlanFunding) => {
      return normaliseDateTime(parent.modified);
    }
  }
};

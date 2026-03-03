import { GraphQLError } from "graphql";
import { MyContext } from "../context";
import { Plan, PlanSearchResult, PlanSectionProgress, PlanProgress, PlanStatus, PlanVisibility } from "../models/Plan";
import { prepareObjectForLogs } from "../logger";
import { AuthenticationError, ForbiddenError, InternalServerError, NotFoundError } from "../utils/graphQLErrors";
import { Project } from "../models/Project";
import { isAuthorized } from "../services/authService";
import { hasPermissionOnProject } from "../services/projectService";
import { PlanMember } from "../models/Member";
import { PlanFunding } from "../models/Funding";
import { PlanFeedback } from "../models/PlanFeedback";
import { Resolvers } from "../types";
import { VersionedTemplate } from "../models/VersionedTemplate";
import { Answer } from "../models/Answer";
import { ProjectCollaboratorAccessLevel } from "../models/Collaborator";
import { isNullOrUndefined, normaliseDateTime } from "../utils/helpers";
import {
  ensureDefaultPlanContact,
  saveMaDMPVersion
} from "../services/planService";

export const resolvers: Resolvers = {
  Query: {
    // return all of the projects that the current user owns or is a collaborator on
    plans: async (_, { projectId }, context: MyContext): Promise<PlanSearchResult[]> => {
      const reference = 'plans resolver';
      try {
        if (isAuthorized(context.token)) {
          const project = await Project.findById(reference, context, projectId);

          if (!project) {
            throw NotFoundError(`Project with ID ${projectId} not found`);
          }
          if (await hasPermissionOnProject(context, project, ProjectCollaboratorAccessLevel.COMMENT)) {
            return await PlanSearchResult.findByProjectId(reference, context, projectId);
          }
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Find the plan by its id
    plan: async (_, { planId }, context: MyContext): Promise<Plan> => {
      const reference = 'plan resolver';
      try {
        const plan = await Plan.findById(reference, context, planId);
        if (!plan) {
          throw NotFoundError(`Plan with ID ${planId} not found`);
        }

        const project = await Project.findById(reference, context, plan.projectId);
        if (await hasPermissionOnProject(context, project, ProjectCollaboratorAccessLevel.COMMENT)) {
          return plan;
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
    // Create a new plan
    addPlan: async (_, { projectId, versionedTemplateId }, context: MyContext): Promise<Plan> => {
      const reference = 'add plan resolver';
      try {
        if (isAuthorized(context.token)) {
          const project = await Project.findById(reference, context, projectId);
          const versionedTemplate = await VersionedTemplate.findById(reference, context, versionedTemplateId);

          if (!project) {
            throw NotFoundError(`Project with ID ${projectId} not found`);
          }
          if (!versionedTemplate) {
            throw NotFoundError(`Template with ID ${versionedTemplateId} not found`);
          }

          if (await hasPermissionOnProject(context, project, ProjectCollaboratorAccessLevel.EDIT)) {
            const plan = new Plan({ projectId, versionedTemplateId });
            const created = await plan.create(context);

            if (!isNullOrUndefined(created.id) && !created.hasErrors()) {
              // Add the project's primary contact as the primary contact for the new plan
              const contactWasSet = await ensureDefaultPlanContact(context, created, project);
              if (!contactWasSet) {
                created.addError('general', 'Unable to set the default contact');
              }

              // Generate the initial maDMP version of the record
              await saveMaDMPVersion(reference, context, created.id, created.registered);
            }

            return created;
          }
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Delete a plan
    archivePlan: async (_, { planId }, context: MyContext): Promise<Plan> => {
      const reference = 'archive plan resolver';
      try {
        if (isAuthorized(context.token)) {
          const plan = await Plan.findById(reference, context, planId);
          if (!plan) {
            throw NotFoundError(`Plan with id ${planId} not found`);
          }

          if (plan.isPublished()) {
            plan.addError('general', 'Plan is already published and cannot be archived');
          }

          const project = await Project.findById(reference, context, plan.projectId);
          if (await hasPermissionOnProject(context, project, ProjectCollaboratorAccessLevel.OWN)) {
            if (!plan.hasErrors()) {
              const deleted = await plan.delete(context);

              if (deleted) {
                // Delete the maDMP versions of the record
                await saveMaDMPVersion(reference, context, deleted.id, deleted.registered, true);
              }
            } else {
              return plan;
            }
          }
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Upload a PDF version of a plan
    uploadPlan: async (_, { projectId, fileName, fileContent }, context: MyContext): Promise<Plan> => {
      const reference = 'upload plan resolver';
      try {
        if (isAuthorized(context.token)) {
          const project = await Project.findById(reference, context, projectId);
          if (!project) {
            throw NotFoundError(`Project with ID ${projectId} not found`);
          }
          if (await hasPermissionOnProject(context, project, ProjectCollaboratorAccessLevel.EDIT)) {
            const plan = new Plan({ projectId, fileName, fileContent });

            // TODO: Figure out what would be passed in from the client and how we'd get the actual
            //       file content and push it into an S3 bucket
            plan.addError('general', 'Uploads have not yet been implemented');
            return plan;
          }
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Publish/register the plan with the DOI registrar (e.g. EZID/DataCite)
    publishPlan: async (_, { planId, visibility = PlanVisibility.PRIVATE }, context: MyContext): Promise<Plan> => {
      const reference = 'publish plan resolver';
      try {
        if (isAuthorized(context.token)) {
          const plan = await Plan.findById(reference, context, planId);
          if (!plan) {
            throw NotFoundError(`Plan with id ${planId} not found`);
          }
          if (plan.isPublished()) {
            plan.addError('general', 'Plan is already published');
          }

          const project = await Project.findById(reference, context, plan.projectId);
          if (await hasPermissionOnProject(context, project, ProjectCollaboratorAccessLevel.OWN)) {
            if (!plan.hasErrors()) {
              if (project.isTestProject) {
                plan.addError('general', 'Test projects cannot be published');
              } else if (plan.isPublished()) {
                plan.addError('general', 'Plan is already published');
              }

              if (!plan.hasErrors()) {
                // Add the project's primary contact as the primary contact for the new plan
                const contactWasSet = await ensureDefaultPlanContact(context, plan, project);
                if (!contactWasSet) {
                  plan.addError('general', 'Plan must have a primary contact');
                } else {
                  // All criteria was satisfied, so publish the plan
                  const published = await plan.publish(context, visibility as PlanVisibility);

                  if (published && !published.hasErrors()) {
                    // Update the maDMP version of the record
                    await saveMaDMPVersion(reference, context, plan.id, plan.registered);
                  }
                  return published;
                }
              }
            }
            return plan;
          }
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    updatePlanStatus: async (_, { planId, status }, context: MyContext): Promise<Plan> => {
      const reference = 'update plan status resolver';
      try {
        if (isAuthorized(context.token)) {
          const plan = await Plan.findById(reference, context, planId);
          if (!plan) {
            throw NotFoundError(`Plan with id ${planId} not found`);
          }
          const project = await Project.findById(reference, context, plan.projectId);
          if (await hasPermissionOnProject(context, project, ProjectCollaboratorAccessLevel.OWN)) {
            plan.status = status as PlanStatus;
            const updated = await plan.update(context);

            if (updated && !updated.hasErrors()) {
              // Update the maDMP version of the record
              await saveMaDMPVersion(reference, context, updated.id, updated.registered);
            }
          }
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    updatePlanTitle: async (_, { planId, title }, context: MyContext): Promise<Plan> => {
      const reference = 'update plan title resolver';
      try {
        if (isAuthorized(context.token)) {
          const plan = await Plan.findById(reference, context, planId);
          if (!plan) {
            throw NotFoundError(`Plan with id ${planId} not found`);
          }
          const project = await Project.findById(reference, context, plan.projectId);
          if (await hasPermissionOnProject(context, project, ProjectCollaboratorAccessLevel.OWN)) {
            plan.title = title;
            const updated = await plan.update(context);

            if (updated && !updated.hasErrors()) {
              // Update the maDMP version of the record
              await saveMaDMPVersion(reference, context, updated.id, updated.registered);
            }
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

  Plan: {
    // The project the plan is associated with
    project: async (parent: Plan, _, context: MyContext): Promise<Project> => {
      if (parent?.projectId) {
        return await Project.findById('project resolver', context, parent.projectId);
      }
      return null;
    },
    // The template the plan is based on
    versionedTemplate: async (parent: Plan, _, context: MyContext): Promise<VersionedTemplate> => {
      if (parent?.versionedTemplateId) {
        return await VersionedTemplate.findById('versioned template resolver', context, parent.versionedTemplateId);
      }
      return null;
    },
    // The members to the plan
    members: async (parent: Plan, _, context: MyContext): Promise<PlanMember[]> => {
      if (parent?.id) {
        return await PlanMember.findByPlanId('plan members resolver', context, parent.id);
      }
      return [];
    },
    // The funding sources for the plan
    fundings: async (parent: Plan, _, context: MyContext): Promise<PlanFunding[]> => {
      if (parent?.id) {
        return await PlanFunding.findByPlanId('plan fundings resolver', context, parent.id);
      }
      return [];
    },
    // The feedback associated with the plan
    feedback: async (parent: Plan, _, context: MyContext): Promise<PlanFeedback[]> => {
      if (parent?.id) {
        return await PlanFeedback.findByPlanId('plan feedback resolver', context, parent.id);
      }
      return [];
    },
    answers: async (parent: Plan, _, context: MyContext): Promise<Answer[]> => {
      if (parent?.id) {
        return await Answer.findByPlanId('plan answers resolver', context, parent.id);
      }
      return [];
    },
    versionedSections: async (parent: Plan, _, context: MyContext): Promise<PlanSectionProgress[]> => {
      if (parent?.id) {
        return await PlanSectionProgress.findByPlanId('plan versionedSections resolver', context, parent.id);
      }
      return [];
    },
    progress: async (parent: Plan, _, context: MyContext): Promise<PlanProgress> => {
      if (parent?.id) {
        return await PlanProgress.findByPlanId('plan progress resolver', context, parent.id);
      }
      return null;
    },
    registered: (parent: Plan) => {
      return normaliseDateTime(parent.registered);
    },
    created: (parent: Plan) => {
      return normaliseDateTime(parent.created);
    },
    modified: (parent: Plan) => {
      return normaliseDateTime(parent.modified);
    }
  },

  PlanSearchResult: {
    versionedSections: async (parent: PlanSearchResult, _, context: MyContext): Promise<PlanSectionProgress[]> => {
      if (parent?.id) {
        return await PlanSectionProgress.findByPlanId('planSearchresult versionedSections resolver', context, parent.id);
      }
      return [];
    }
  },
}

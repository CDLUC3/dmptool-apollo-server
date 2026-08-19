import { GraphQLError } from "graphql";
import { MyContext } from "../context";
import {
  Plan,
  PlanProgress,
  PlanSearchResult,
  PlanSectionProgress,
  PlanStatus,
  PlanVisibility
} from "../models/Plan";
import { Project } from "../models/Project";
import { User, UserRole } from "../models/User";
import { PlanMember, ProjectMember } from "../models/Member";
import { PlanFunding } from "../models/Funding";
import { PlanFeedback } from "../models/PlanFeedback";
import { Affiliation } from "../models/Affiliation";
import { VersionedTemplate } from "../models/VersionedTemplate";
import { Answer } from "../models/Answer";
import { ProjectCollaboratorAccessLevel } from "../models/Collaborator";
import { AlternateIdentifier } from "../models/AlternateIdentifier";
import { isNullOrUndefined, normaliseDateTime } from "../utils/helpers";
import {
  AuthenticationError,
  BadUserInputError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
} from "../utils/graphQLErrors";
import {
  PaginationOptions,
  PaginationOptionsForCursors,
  PaginationOptionsForOffsets,
  PaginationType
} from "../types/general";
import {
  AddEntirePlanInput,
  PaginatedPlanResults,
  PlanFeedbackStatus,
  Resolvers,
  UpdateEntirePlanInput
} from "../types";
import { prepareObjectForLogs } from "../logger";
// Services
import {
  buildDataCiteXMLForPlan,
  ensureDefaultPlanContact,
  getPlanVersions,
  saveMaDMPVersion
} from "../services/planService";
import {
  hasPermissionOnProject,
  isProjectReadOnlyForCurrentUser
} from "../services/projectService";
import {
  authenticatedResolver,
  isAdmin,
  isAuthorized,
  isSuperAdmin
} from "../services/authService";
import {
  addEntirePlan,
  removeEntirePlan,
  replaceEntirePlan
} from "../services/entirePlanService";
import { toErrorMessage } from "@dmptool/utils";
import { MemberRole } from "../models/MemberRole";

export const resolvers: Resolvers = {
  Query: {
    // Find all of the plans for a specified userId, with pagination and optional search term filtering
    plans: authenticatedResolver(
      'plansWithPagination resolver',
      UserRole.ADMIN,
      async (
        _: Record<PropertyKey, never>,
        { userId, term, paginationOptions }: { userId: number; term?: string; paginationOptions?: PaginationOptions },
        context: MyContext
      ): Promise<PaginatedPlanResults> => {
        const reference = 'plansWithPagination resolver';
        try {

          const superAdmin: boolean = isSuperAdmin(context.token);

          if (!superAdmin) {
            // Admin must belong to the same affiliation as the target user
            const targetUser = await User.findById(reference, context, userId);
            if (!targetUser) throw NotFoundError(`User with ID ${userId} not found`);

            if (!(isAdmin(context.token) && context.token.affiliationId === targetUser.affiliationId)) {
              throw ForbiddenError();
            }
          }

          const opts = !isNullOrUndefined(paginationOptions) && paginationOptions.type === PaginationType.OFFSET
            ? paginationOptions as PaginationOptionsForOffsets
            : { ...paginationOptions, type: PaginationType.CURSOR } as PaginationOptionsForCursors;

          return await PlanSearchResult.findByUserIdWithPagination(reference, context, userId, opts, term);
        } catch (err) {
          if (err instanceof GraphQLError) throw err;
          context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
          throw InternalServerError();
        }
      },
    ),
    // Find all the plans for a specified project
    plansByProjectId: authenticatedResolver(
      '`plansByProjectId` resolver',
      UserRole.RESEARCHER,
      async (
        _: Record<PropertyKey, never>,
        { projectId }: { projectId: number; },
        context: MyContext
      ): Promise<Plan[]> => {
        const reference = 'plansByProjectId resolver';
        try {
          const project: Project = await Project.findById(reference, context, projectId);
          if (!project) throw NotFoundError(`Project with ID ${projectId} not found`);

          if (hasPermissionOnProject(context, project, ProjectCollaboratorAccessLevel.COMMENT)) {
            return await Plan.findByProjectId(reference, context, projectId);
          }

          throw context?.token ? ForbiddenError() : AuthenticationError();
        } catch (err) {
          if (err instanceof GraphQLError) throw err;
          context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
          throw InternalServerError();
        }
      },
    ),
    // Find the plan by its id
    plan: async (_, { planId }, context: MyContext): Promise<Plan> => {
      const reference = 'plan resolver';
      try {
        const plan = await Plan.findById(reference, context, planId);

        if (!plan) {
          throw NotFoundError(`Plan with ID ${planId} not found`);
        }

        const project = await Project.findById(reference, context, plan.projectId);
        if (!project) {
          throw NotFoundError(`Project with ID ${plan.projectId} not found`);
        }

        if (await hasPermissionOnProject(context, project, ProjectCollaboratorAccessLevel.COMMENT)) {
          const readOnly = await isProjectReadOnlyForCurrentUser(reference, context, project);
          return Object.assign(plan, { readOnly }) as Plan & { readOnly: boolean };
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Find a Plan by its DMP id
    planByDMPId: async (_, { dmpId }, context: MyContext): Promise<Plan> => {
      const reference = 'planByDMPId resolver';
      try {
        const plan = await Plan.findByDMPId(reference, context, dmpId);
        if (isNullOrUndefined(plan)) {
          throw NotFoundError(`Plan with DMP id, ${dmpId}, not found`);
        }

        const project = await Project.findById(reference, context, plan.projectId);
        if (isNullOrUndefined(project)) {
          throw NotFoundError(`Project with ID, ${plan.projectId}, not found`);
        }

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

    // Find a published plan by its DMP id (publicly accessible so not checking permissions)
    publicPlanByDMPId: async (_, { dmpId }, context: MyContext): Promise<Plan> => {
      const reference = 'publicPlanByDMPId resolver';
      try {
        const plan = await Plan.findByDMPId(reference, context, dmpId);

        // Treat "not found" and "not registered" identically - don't leak existence of private plans
        if (isNullOrUndefined(plan) || plan.registered === null) {
          throw NotFoundError(`Plan with DMP id, ${dmpId}, not found`);
        }

        return plan;
      } catch (err) {
        if (err instanceof GraphQLError) throw err;
        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },
    // Lookup a Plan by its alternate identifier
    planByAlternateIdentifier: async (_, { alternateIdentifier }, context: MyContext): Promise<Plan> => {
      const reference = 'planByAlternateIdentifier resolver';
      try {
        const identifier: AlternateIdentifier = await AlternateIdentifier.findByAlternateIdentifier(
          reference,
          context,
          alternateIdentifier
        );
        if (isNullOrUndefined(identifier)) {
          throw NotFoundError('Alternate identifier not found');
        }

        const plan = await Plan.findById(reference, context, identifier.planId);
        if (isNullOrUndefined(plan)) {
          throw NotFoundError(`Plan with ID, ${identifier.planId}, not found`);
        }

        const project = await Project.findById(reference, context, plan.projectId);
        if (isNullOrUndefined(project)) {
          throw NotFoundError(`Project with ID, ${plan.projectId}, not found`);
        }

        if (await hasPermissionOnProject(context, project, ProjectCollaboratorAccessLevel.COMMENT)) {
          return plan;
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    }
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
              await saveMaDMPVersion(reference, context, created.id, created.dmpId);
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
                await saveMaDMPVersion(reference, context, deleted.id, deleted.dmpId, true);
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
                  // Build the DataCite XML metadata document before publishing
                  let dataciteXML: string;
                  try {
                    dataciteXML = await buildDataCiteXMLForPlan(context, plan);
                  } catch (err) {
                    context.logger.error(
                      prepareObjectForLogs(err),
                      `${reference} failed to build DataCite metadata`
                    );
                    plan.addError('general', 'Unable to build metadata required to publish this plan');
                    return plan;
                  }

                  // All criteria was satisfied, so publish the plan
                  const published = await plan.publish(context, visibility as PlanVisibility, dataciteXML);

                  if (published && !published.hasErrors()) {
                    // Update the maDMP version of the record
                    await saveMaDMPVersion(reference, context, plan.id, plan.dmpId);
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

    updatePlan: async (_, { input }, context: MyContext): Promise<Plan> => {
      const reference = 'update plan resolver';
      try {
        if (isAuthorized(context.token)) {
          const plan = await Plan.findById(reference, context, input.id);
          if (!plan) {
            throw NotFoundError(`Plan with id ${input.id} not found`);
          }
          const project = await Project.findById(reference, context, plan.projectId);

          if (await hasPermissionOnProject(context, project, ProjectCollaboratorAccessLevel.OWN)) {
            plan.title = input.title ?? plan.title;
            plan.status = input.status as PlanStatus ?? plan.status;
            plan.visibility = input.visibility as PlanVisibility ?? plan.visibility;
            plan.featured = input.featured ?? plan.featured;
            plan.languageId = input.languageId ?? plan.languageId;

            const updated = await plan.update(context);

            if (updated && !updated.hasErrors()) {
              // Update the maDMP version of the record
              await saveMaDMPVersion(reference, context, updated.id, updated.dmpId);
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
              await saveMaDMPVersion(reference, context, updated.id, updated.dmpId);
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
              await saveMaDMPVersion(reference, context, updated.id, updated.dmpId);
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

    // Assign an alternate identifier to the plan
    addAlternateIdentifierToPlan: async (_, { planId, alternateIdentifier }, context: MyContext): Promise<Plan> => {
      const reference = 'add alternate identifier to plan resolver';
      try {
        if (isAuthorized(context.token)) {
          const plan = await Plan.findById(reference, context, planId);
          if (!plan) {
            throw NotFoundError(`Plan with id ${planId} not found`);
          }
          const project = await Project.findById(reference, context, plan.projectId);

          if (await hasPermissionOnProject(context, project, ProjectCollaboratorAccessLevel.OWN)) {
            const identifier: AlternateIdentifier = new AlternateIdentifier({ planId, alternateIdentifier });

            const created: AlternateIdentifier = await identifier.create(context);
            if (created && !created.hasErrors()) {
              // Update the maDMP version of the record
              await saveMaDMPVersion(reference, context, planId, plan.dmpId);
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

    // Assign an alternate identifier to the plan
    removeAlternateIdentifierFromPlan: async (_, { planId, alternateIdentifier }, context: MyContext): Promise<Plan> => {
      const reference = 'remove alternate identifier from plan resolver';
      try {
        if (isAuthorized(context.token)) {
          const plan = await Plan.findById(reference, context, planId);
          if (!plan) {
            throw NotFoundError(`Plan with id ${planId} not found`);
          }
          const project = await Project.findById(reference, context, plan.projectId);
          if (await hasPermissionOnProject(context, project, ProjectCollaboratorAccessLevel.OWN)) {
            const identifier: AlternateIdentifier = await AlternateIdentifier.findByAlternateIdentifier(
              reference,
              context,
              alternateIdentifier
            );
            if (isNullOrUndefined(identifier)) {
              throw NotFoundError('Alternate identifier not found');
            }
            if (identifier.planId !== planId) {
              throw ForbiddenError('Alternate identifier belongs to a different plan');
            }

            const deleted = await identifier.delete(context);
            if (deleted && !deleted.hasErrors()) {
              // Update the maDMP version of the record
              await saveMaDMPVersion(reference, context, planId, plan.dmpId);
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

    /**
     * AUTHENTICATED USERS ONLY: Create an entire plan (and project if applicable)
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args the entire plan input (including project, members, funding and answers)
     * @param context The Apollo context
     * @returns The QuestionCustomization (with errors if applicable)
     * @throws NotFoundError when the QuestionCustomization or TemplateCustomization
     * are not found
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws InternalServerError when a fatal error has occurred
     */
    addEntirePlan: authenticatedResolver(
      'addEntirePlan resolver',
      UserRole.RESEARCHER,
      async (
        _: Record<PropertyKey, never>,
        { input }: { input: AddEntirePlanInput },
        context: MyContext
      ): Promise<Plan> => {
        const ref = 'createEntirePlan';
        const plan: Plan = new Plan({});

        try {
          // 1st: Check any alternate identifiers to make sure the Plan doesn't already exist
          if (input.alternateIdentifiers) {
            const altId: AlternateIdentifier | undefined = await AlternateIdentifier.findByAlternateIdentifiers(
              ref,
              context,
              input.alternateIdentifiers
            );
            if (altId) {
              throw BadUserInputError('A plan with the specified alternate identifier(s) already exists.');
            }
          }

          // Add the Plan within a database transaction
          const newPlan: Plan | undefined = await context.dataSources.sqlDataSource.withTransaction(context, async (): Promise<Plan> => {
            return await addEntirePlan(ref, context, input, plan);
          });

          if (newPlan) {
            // Push the maDMP info into Dynamo
            await saveMaDMPVersion(ref, context, newPlan.id, newPlan.dmpId);
          }

          return newPlan;
        } catch (error) {
          if (error instanceof GraphQLError) {
            if (error.extensions?.code === 'BAD_REQUEST') {
              if (plan.hasErrors() && !plan.errors['general']) {
                plan.addError('general', 'Unable to process your request.');
              }
              // Return the plan with its populated validation errors
              return plan;
            } else {
              throw error;
            }
          }

          // Log unexpected errors and throw 500
          context.logger.error(
            prepareObjectForLogs({ ref, error: toErrorMessage(error) }),
            `Failure in ${ref}`
          );
          throw InternalServerError();
        }
      }
    ),

    /**
     * AUTHENTICATED USERS ONLY: Replace an entire plan (and project if applicable)
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args the entire plan input (including project, members, funding and answers)
     * @param context The Apollo context
     * @returns The QuestionCustomization (with errors if applicable)
     * @throws NotFoundError when the QuestionCustomization or TemplateCustomization
     * are not found
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws InternalServerError when a fatal error has occurred
     */
    updateEntirePlan: authenticatedResolver(
      'updateEntirePlan resolver',
      UserRole.RESEARCHER,
      async (
        _: Record<PropertyKey, never>,
        { input }: { input: UpdateEntirePlanInput },
        context: MyContext
      ): Promise<Plan> => {
        const ref = 'updateEntirePlan';

        // 1st: Find the Plan and Project
        const plan: Plan = await Plan.findById(ref, context, input.id);
        if (!plan) {
          throw NotFoundError();
        }
        const project: Project = await Project.findById(ref, context, plan.projectId);
        if (!project) {
          throw NotFoundError();
        }

        if (await hasPermissionOnProject(context, project, ProjectCollaboratorAccessLevel.EDIT)) {
          try {
            // Add the Plan within a database transaction
            return await context.dataSources.sqlDataSource.withTransaction(context, async (): Promise<Plan> => {
              return await replaceEntirePlan(ref, context, project, plan, input);
            });
          } catch (error) {
            if (error instanceof GraphQLError) {
              if (error.extensions?.code === 'BAD_REQUEST') {
                if (plan.hasErrors() && !plan.errors['general']) {
                  plan.addError('general', 'Unable to process your request.');
                }
                // Return the plan with its populated validation errors
                return plan;
              } else {
                throw error;
              }
            }

            // Log unexpected errors and throw 500
            context.logger.error(
              prepareObjectForLogs({ ref, error: toErrorMessage(error) }),
              `Failure in ${ref}`
            );
            throw InternalServerError();
          }
        } else {
          throw context.token ? ForbiddenError() : AuthenticationError();
        }
      }
    ),

    /**
     * AUTHENTICATED USERS ONLY: Delete/tomb-stone an entire plan (and project if applicable)
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args the DMP id of the plan
     * @param context The Apollo context
     * @returns The QuestionCustomization (with errors if applicable)
     * @throws NotFoundError when the QuestionCustomization or TemplateCustomization
     * are not found
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws InternalServerError when a fatal error has occurred
     */
    removeEntirePlanByDMPId: authenticatedResolver(
      'removeEntirePlanByDMPId resolver',
      UserRole.RESEARCHER,
      async (
        _: Record<PropertyKey, never>,
        { dmpId }: { dmpId: string },
        context: MyContext
      ): Promise<boolean> => {
        const ref = 'updateEntirePlan';

        // 1st: Find the Plan and Project
        const plan: Plan = await Plan.findByDMPId(ref, context, dmpId);
        if (!plan) {
          throw NotFoundError();
        }
        const project: Project = await Project.findById(ref, context, plan.projectId);
        if (!project) {
          throw NotFoundError();
        }

        if (await hasPermissionOnProject(context, project, ProjectCollaboratorAccessLevel.EDIT)) {
          try {
            // Add the Plan within a database transaction
            const removed: Plan | undefined = await context.dataSources.sqlDataSource.withTransaction(context, async (): Promise<Plan> => {
              return await removeEntirePlan(ref, context, project, plan);
            });
            return removed && !removed.hasErrors();
          } catch (err) {
            if (err instanceof GraphQLError) throw err;

            context.logger.error(prepareObjectForLogs(err), `Failure in ${ref}`);
            throw InternalServerError();
          }
        } else {
          throw context.token ? ForbiddenError() : AuthenticationError();
        }
      }
    ),
  },

  Plan: {
    // The user who owns/created the plan
    planCreator: async (parent: Plan, _, context: MyContext): Promise<User> => {
      if (parent?.createdById) {
        return await User.findById('plan.createdBy resolver', context, parent.createdById);
      }
      return null;
    },
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
    feedbackStatus: async (parent: Plan, _, context: MyContext): Promise<PlanFeedbackStatus> => {
      if (parent?.id) {
        // Use the same logic as in planFeedbackStatus query
        return await PlanFeedback.statusForPlan('plan.feedbackStatus resolver', context, parent.id);
      }
      return null;
    },
    answers: async (parent: Plan, _, context: MyContext): Promise<Answer[]> => {
      if (parent?.id) {
        return await Answer.findByPlanId('plan answers resolver', context, parent.id);
      }
      return [];
    },
    versionedSections: async (parent: Plan, _, context: MyContext): Promise<PlanSectionProgress[]> => {
      if (parent?.id) {
        return await PlanSectionProgress.findByPlanId('plan versionedSections resolver', context, parent.id, parent?.versionedTemplateId);
      }
      return [];
    },
    progress: async (parent: Plan, _, context: MyContext): Promise<PlanProgress> => {
      if (parent?.id) {
        return await PlanProgress.findByPlanId('plan progress resolver', context, parent.id, parent?.versionedTemplateId);
      }
      return null;
    },
    alternateIdentifiers: async (parent: Plan, _, context: MyContext): Promise<AlternateIdentifier[]> => {
      if (parent?.id) {
        return await AlternateIdentifier.findByPlanId('plan alternateIdentifiers chained resolver', context, parent.id);
      }
      return [];
    },
    registered: (parent: Plan) => {
      return normaliseDateTime(parent.registered);
    },
    versions: async (parent: Plan, _, context: MyContext) => {
      if (!parent?.dmpId) return [];
      return await getPlanVersions('Chained Plan.versions', context, parent.dmpId);
    },
    created: (parent: Plan) => {
      return normaliseDateTime(parent.created);
    },
    modified: (parent: Plan) => {
      return normaliseDateTime(parent.modified);
    }
  },

  PlanSearchResult: {
    versionedSections: async (parent, _, context: MyContext): Promise<PlanSectionProgress[]> => {
      if (parent?.id) {
        return await PlanSectionProgress.findByPlanId(
          'planSearchresult versionedSections resolver',
          context,
          parent.id,
          parent?.versionedTemplateId
        );
      }
      return [];
    },
    templateOwnerAffiliationName: async (parent: PlanSearchResult, _, context: MyContext): Promise<string | null> => {
      if (!parent?.versionedTemplateId) return null;

      const versionedTemplate = await VersionedTemplate.findById(
        'planSearchResult.templateOwnerAffiliationName resolver',
        context,
        parent.versionedTemplateId
      );
      if (!versionedTemplate?.ownerId) return null;

      const affiliation = await Affiliation.findByURI(
        'planSearchResult.templateOwnerAffiliationName resolver',
        context,
        versionedTemplate.ownerId
      );
      return affiliation?.displayName || null;
    },
    planCreator: async (parent: PlanSearchResult, _, context: MyContext): Promise<User> => {
      if (parent?.createdById) {
        return await User.findById('planSearchResult.planCreator resolver', context, parent.createdById);
      }
      return null;
    }
  },
  PlanMember: {
    projectMember: async (parent: PlanMember, _, context: MyContext): Promise<ProjectMember> => {
      if (parent?.projectMemberId) {
        return await ProjectMember.findById('planMember.projectMember resolver', context, parent.projectMemberId);
      }
      return null;
    },
    memberRoles: async (parent: PlanMember, _, context: MyContext): Promise<MemberRole[]> => {
      if (parent?.id) {
        return await MemberRole.findByPlanMemberId('planMember.memberRoles resolver', context, parent.id);
      }
      return [];
    },
  },

}

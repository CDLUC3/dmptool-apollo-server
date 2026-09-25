import { GraphQLError } from "graphql";
import { MyContext } from "../context.js";
import {
  Plan,
  PlanProgress,
  PlanSearchResult,
  PlanSectionProgress,
  PlanStatus,
  PlanVisibility
} from "../models/Plan.js";
import { Project } from "../models/Project.js";
import { User, UserRole } from "../models/User.js";
import { PlanMember, ProjectMember } from "../models/Member.js";
import { PlanFunding } from "../models/Funding.js";
import { PlanFeedback } from "../models/PlanFeedback.js";
import { Affiliation } from "../models/Affiliation.js";
import { VersionedTemplate } from "../models/VersionedTemplate.js";
import { Answer } from "../models/Answer.js";
import { ProjectCollaboratorAccessLevel } from "../models/Collaborator.js";
import { AlternateIdentifier } from "../models/AlternateIdentifier.js";
import { normaliseDateTime } from "../utils/helpers.js";
import {
  AuthenticationError,
  BadUserInputError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
} from "../utils/graphQLErrors.js";
import {
  PaginationOptions,
  PaginationOptionsForCursors,
  PaginationOptionsForOffsets,
  PaginationType
} from "../types/general.js";
import {
  AddEntirePlanInput,
  InputMaybe,
  PaginatedPlanResults,
  PlanFeedbackStatus,
  Resolvers,
  UpdateEntirePlanInput,
  PlanStatus as PlanStatusType,
  PlanVersionSnapshot,
  UpdatePlanInput,
  GuidanceSource,
  PlanSection
} from "../types.js";
import { prepareObjectForLogs } from "../logger.js";
import { toErrorMessage } from "@dmptool/utils";
import { MemberRole } from "../models/MemberRole.js";
import { AcceptedWork } from "../models/RelatedWork.js";
// Services
import {
  buildDataCiteXMLForPlan,
  ensureDefaultPlanContact,
  handleAsyncDeletes,
  handleAsyncUpdates,
  getPlanVersions,
  getPlanVersionSnapshot,
  getPlanAndCheckAuthorization, getPlanOwnerAffiliation,
  getPlanSectionsAndQuestions,
} from "../services/planService.js";
import {
  getProjectAndCheckAuthorization,
  hasPermissionOnProject,
  isProjectReadOnlyForCurrentUser
} from "../services/projectService.js";
import {
  authenticatedResolver,
  isAdmin,
  isSuperAdmin
} from "../services/authService.js";
import {
  addEntirePlan,
  removeEntirePlan,
  replaceEntirePlan
} from "../services/entirePlanService.js";
import { getGuidanceSourcesForPlan } from "../services/guidanceService.js";

export const resolvers: Resolvers = {
  Query: {
    /**
     * ADMINS ONLY: Find all the plans for a specified userId, with pagination
     * and optional search term filtering
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args the user id, search term and pagination options
     * @param context The Apollo context
     * @returns The Plans
     * @throws NotFoundError when the Plan is not found
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws InternalServerError when a fatal error has occurred
     */
    plans: authenticatedResolver(
      'plansWithPagination resolver',
      UserRole.ADMIN,
      async (
        _: Record<PropertyKey, never>,
        { userId, term, paginationOptions }: { userId: number; term: InputMaybe<string>; paginationOptions?: PaginationOptions },
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

          // Figure out what type of pagination we're working with
          const opts: PaginationOptions = paginationOptions
            ? paginationOptions.type === PaginationType.OFFSET
              ? paginationOptions as PaginationOptionsForOffsets
              : { ...paginationOptions, type: PaginationType.CURSOR } as PaginationOptionsForCursors
            : { type: PaginationType.CURSOR } as PaginationOptionsForCursors;

          return await PlanSearchResult.findByUserIdWithPagination(reference, context, userId, opts, term || '');
        } catch (err) {
          if (err instanceof GraphQLError) throw err;
          context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
          throw InternalServerError();
        }
      },
    ),

    /**
     * AUTHENTICATED USERS ONLY: Get all the plans for the specified project
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args the project id
     * @param context The Apollo context
     * @returns The Plans
     * @throws NotFoundError when the Plan is not found
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws InternalServerError when a fatal error has occurred
     */
    plansByProjectId: authenticatedResolver(
      '`plansByProjectId` resolver',
      UserRole.RESEARCHER,
      async (
        _: Record<PropertyKey, never>,
        { projectId }: { projectId: number; },
        context: MyContext
      ): Promise<Plan[]> => {
        const reference = 'plansByProjectId resolver';

        // Fetch the project and check that the user is authorized to access it
        await getProjectAndCheckAuthorization(reference, context, projectId);

        return await Plan.findByProjectId(reference, context, projectId);
      },
    ),

    /**
     * AUTHENTICATED USERS ONLY: Get a plan by its id
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args the plan id
     * @param context The Apollo context
     * @returns The Plan
     * @throws NotFoundError when the Plan is not found
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws InternalServerError when a fatal error has occurred
     */
    plan: authenticatedResolver(
      '`plan` resolver',
      UserRole.RESEARCHER,
      async (
        _: Record<PropertyKey, never>,
        { planId }: { planId: number; },
        context: MyContext
      ): Promise<Plan> => {
        const reference = 'plan resolver';

        // Fetch the plan and project and make sure the user is authorized to access it
        const { plan, project } = await getPlanAndCheckAuthorization(reference, context, planId);

        const readOnly: boolean = await isProjectReadOnlyForCurrentUser(reference, context, project);
        return Object.assign(plan, { readOnly }) as Plan & { readOnly: boolean };
      }
    ),

    /**
     * AUTHENTICATED USERS ONLY: Get a plan by its DMP id
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args the DMP id
     * @param context The Apollo context
     * @returns The Plan
     * @throws NotFoundError when the Plan is not found
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws InternalServerError when a fatal error has occurred
     */
    planByDMPId: authenticatedResolver(
      '`planByDMPId` resolver',
      UserRole.RESEARCHER,
      async (
        _: Record<PropertyKey, never>,
        { dmpId }: { dmpId: string; },
        context: MyContext
      ): Promise<Plan> => {
        const reference = 'planByDMPId resolver';

        const plan: Plan | null = await Plan.findByDMPId(reference, context, dmpId);
        if (!plan) {
          throw NotFoundError(`Plan with DMP id, ${dmpId}, not found`);
        }

        // Fetch the project and check that the user is authorized to access it
        await getProjectAndCheckAuthorization(reference, context, plan.projectId);
        return plan;
      }
    ),

    /**
     * Get the publicly visible plan by its DMP id and version timestamp.
     * Used by the landing page
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args the DMP id and version timestamp
     * @param context The Apollo context
     * @returns The Plan
     * @throws NotFoundError when the Plan is not found
     * @throws InternalServerError when a fatal error has occurred
     */
    publicPlanVersionByDMPId: async (_, { dmpId, version }, context: MyContext): Promise<PlanVersionSnapshot> => {
      const reference = 'publicPlanVersionByDMPId resolver';
      try {
        const snapshot = await getPlanVersionSnapshot(reference, context, dmpId, version);

        if (!snapshot) {
          throw NotFoundError(`Version ${version} of DMP ${dmpId} not found`);
        }

        return snapshot;
      } catch (err) {
        if (err instanceof GraphQLError) throw err;
        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    /**
     * AUTHENTICATED USERS ONLY: Get a plan by the alternate identifier (e.g. external system id)
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args the alternate identifier
     * @param context The Apollo context
     * @returns The Plan (with errors if applicable)
     * @throws NotFoundError when the Plan is not found
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws InternalServerError when a fatal error has occurred
     */
    planByAlternateIdentifier: authenticatedResolver(
      '`planByAlternateIdentifier` resolver',
      UserRole.RESEARCHER,
      async (
        _: Record<PropertyKey, never>,
        { alternateIdentifier }: { alternateIdentifier: string; },
        context: MyContext
      ): Promise<Plan> => {
        const reference = 'planByAlternateIdentifier resolver';

        const identifier: AlternateIdentifier | null = await AlternateIdentifier.findByAlternateIdentifier(
          reference,
          context,
          alternateIdentifier
        );
        if (!identifier) {
          throw NotFoundError('Alternate identifier not found');
        }

        const plan = await Plan.findById(reference, context, identifier.planId);
        if (!plan) {
          throw NotFoundError(`Plan with ID, ${identifier.planId}, not found`);
        }

        // Fetch the project and check that the user is authorized to access it
        await getProjectAndCheckAuthorization(reference, context, plan.projectId);

        return plan;
      }
    ),
  },

  Mutation: {
    /**
     * AUTHENTICATED USERS ONLY: Add a new plan
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args the project id and versioned template id
     * @param context The Apollo context
     * @returns The Plan (with errors if applicable)
     * @throws NotFoundError when the Plan is not found
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws InternalServerError when a fatal error has occurred
     */
    addPlan: authenticatedResolver(
      '`addPlan` resolver',
      UserRole.RESEARCHER,
      async (
        _: Record<PropertyKey, never>,
        { projectId, versionedTemplateId }: { projectId: number; versionedTemplateId: number; },
        context: MyContext
      ): Promise<Plan> => {
        const reference = 'add plan resolver';

        // Get the project and check that the user is authorized to access it
        const project: Project = await getProjectAndCheckAuthorization(reference, context, projectId);

        const versionedTemplate: VersionedTemplate | null = await VersionedTemplate.findById(reference, context, versionedTemplateId);
        if (!versionedTemplate) {
          throw NotFoundError(`Template with ID ${versionedTemplateId} not found`);
        }

        const plan = new Plan({ projectId, versionedTemplateId });
        const created = await plan.create(context);

        if (created.id && !created.hasErrors()) {
          // Add the project's primary contact as the primary contact for the new plan
          const contactWasSet = await ensureDefaultPlanContact(context, created, project);
          if (!contactWasSet) {
            created.addError('general', 'Unable to set the default contact');
          }

          // Handle OpenSearch index update and maDMP JSON versioning in Dynamo
          await handleAsyncUpdates(reference, context, created);
        }

        return created;
      }
    ),

    /**
     * AUTHENTICATED USERS ONLY: Archive a plan
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args the plan id and title
     * @param context The Apollo context
     * @returns The Plan (with errors if applicable)
     * @throws NotFoundError when the Plan is not found
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws InternalServerError when a fatal error has occurred
     */
    archivePlan: authenticatedResolver(
      '`archivePlan` resolver',
      UserRole.RESEARCHER,
      async (
        _: Record<PropertyKey, never>,
        { planId }: { planId: number; },
        context: MyContext
      ): Promise<Plan> => {
        const reference = 'archive plan resolver';

        // Get the plan and check that the user is authorized to access it
        const { plan } = await getPlanAndCheckAuthorization(reference, context, planId);

        if (plan.isPublished()) {
          plan.addError('general', 'Plan is already published and cannot be archived');
        }

        const deleted: Plan | null = await plan.delete(context);
        if (deleted && !deleted.hasErrors()) {
          // Handle OpenSearch index removal and removal of maDMP JSON versions
          await handleAsyncDeletes(reference, context, deleted);
        }

        return plan;
      }
    ),

    /**
     * AUTHENTICATED USERS ONLY: Not yet implemented!
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args the project id, file name and file content
     * @param context The Apollo context
     * @returns The Plan (with errors if applicable)
     * @throws NotFoundError when the Plan is not found
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws InternalServerError when a fatal error has occurred
     */
    uploadPlan: authenticatedResolver(
      '`uploadPlan` resolver',
      UserRole.RESEARCHER,
      async (
        _: Record<PropertyKey, never>,
        { projectId, fileName, fileContent }: { projectId: number; fileName: InputMaybe<string>; fileContent: InputMaybe<string> },
        context: MyContext
      ): Promise<Plan> => {
        const reference = 'upload plan resolver';

        // get the project and check that the user is authorized to access it
        await getProjectAndCheckAuthorization(reference, context, projectId);

        const plan = new Plan({ projectId, fileName, fileContent });

        // TODO: Figure out what would be passed in from the client and how we'd get the actual
        //       file content and push it into an S3 bucket
        plan.addError('general', 'Uploads have not yet been implemented');
        return plan;
      }
    ),

    /**
     * AUTHENTICATED USERS ONLY: Publish a plan (aka register)
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args the plan id and visibility
     * @param context The Apollo context
     * @returns The Plan (with errors if applicable)
     * @throws NotFoundError when the Plan is not found
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws InternalServerError when a fatal error has occurred
     */
    publishPlan: authenticatedResolver(
      '`publishPlan` resolver',
      UserRole.RESEARCHER,
      async (
        _: Record<PropertyKey, never>,
        { planId, visibility = PlanVisibility.PRIVATE }: { planId: number; visibility: InputMaybe<PlanVisibility> },
        context: MyContext
      ): Promise<Plan> => {
        const reference = 'publish plan resolver';

        const {
          plan,
          project
        } = await getPlanAndCheckAuthorization(reference, context, planId);

        if (plan.isPublished()) {
          plan.addError('general', 'Plan is already published');
        }
        if (project.isTestProject) {
          plan.addError('general', 'Test projects cannot be published');
        }

        if (!plan.hasErrors()) {
          // Add the project's primary contact as the primary contact for the new plan
          const contactWasSet: boolean = await ensureDefaultPlanContact(context, plan, project);
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

            // All criteria are satisfied, so publish the plan
            const published: Plan | null = await plan.publish(context, visibility as PlanVisibility, dataciteXML);

            if (published && !published.hasErrors()) {
              // Handle OpenSearch index update and maDMP JSON versioning in Dynamo
              await handleAsyncUpdates(reference, context, published);
            }
            return published;
          }

          return plan;
        }
      }
    ),

    /**
     * AUTHENTICATED USERS ONLY: Update a plan
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args the plan input
     * @param context The Apollo context
     * @returns The Plan (with errors if applicable)
     * @throws NotFoundError when the Plan is not found
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws InternalServerError when a fatal error has occurred
     */
    updatePlan: authenticatedResolver(
      '`updatePlan` resolver',
      UserRole.RESEARCHER,
      async (
        _: Record<PropertyKey, never>,
        { input }: { input: UpdatePlanInput; },
        context: MyContext
      ): Promise<Plan> => {
        const reference = 'update plan resolver';

        if (!input.id) throw NotFoundError('Plan id is required');

        // Get the plan and check that the user is authorized to access it
        const { plan } = await getPlanAndCheckAuthorization(reference, context, input.id);

        plan.title = input.title ?? plan.title;
        plan.status = input.status as PlanStatus ?? plan.status;
        plan.visibility = input.visibility as PlanVisibility ?? plan.visibility;
        plan.featured = input.featured ?? plan.featured;
        plan.languageId = input.languageId ?? plan.languageId;

        const updated = await plan.update(context);

        if (updated && !updated.hasErrors()) {
          // Handle OpenSearch index update and maDMP JSON versioning in Dynamo
          await handleAsyncUpdates(reference, context, updated);
        }
        return updated;
      }
    ),

    /**
     * AUTHENTICATED USERS ONLY: Update a plan's status
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args the plan id and status
     * @param context The Apollo context
     * @returns The QuestionCustomization (with errors if applicable)
     * @throws NotFoundError when the QuestionCustomization or TemplateCustomization
     * are not found
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws InternalServerError when a fatal error has occurred
     */
    updatePlanStatus: authenticatedResolver(
      '`updatePlanStatus` resolver',
      UserRole.RESEARCHER,
      async (
        _: Record<PropertyKey, never>,
        { planId, status }: { planId: number; status: PlanStatusType },
        context: MyContext
      ): Promise<Plan> => {
        const reference = 'update plan status resolver';

        // Get the plan and check that the user is authorized to access it
        const { plan } = await getPlanAndCheckAuthorization(reference, context, planId);

        plan.status = status as PlanStatus;
        const updated = await plan.update(context);

        if (updated && !updated.hasErrors()) {
          // Handle OpenSearch index update and maDMP JSON versioning in Dynamo
          await handleAsyncUpdates(reference, context, updated);
        }
        return updated;
      }
    ),

    /**
     * AUTHENTICATED USERS ONLY: Update a plan's title
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args the plan id and title
     * @param context The Apollo context
     * @returns The Plan (with errors if applicable)
     * @throws NotFoundError when the Plan is not found
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws InternalServerError when a fatal error has occurred
     */
    updatePlanTitle: authenticatedResolver(
      '`updatePlanTitle` resolver',
      UserRole.RESEARCHER,
      async (
        _: Record<PropertyKey, never>,
        { planId, title }: { planId: number; title: string },
        context: MyContext
      ): Promise<Plan> => {
        const reference = 'update plan title resolver';

        // Get the plan and check that the user is authorized to access it
        const { plan } = await getPlanAndCheckAuthorization(reference, context, planId);

        plan.title = title;
        const updated = await plan.update(context);

        if (updated && !updated.hasErrors()) {
          // Handle OpenSearch index update and maDMP JSON versioning in Dynamo
          await handleAsyncUpdates(reference, context, updated);
        }
        return updated;
      }
    ),

    /**
     * AUTHENTICATED USERS ONLY: Add an alternate identifier to a plan (e.g. external system id)
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args the plan id and alternate identifier
     * @param context The Apollo context
     * @returns The Plan (with errors if applicable)
     * @throws NotFoundError when the Plan is not found
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws InternalServerError when a fatal error has occurred
     */
    addAlternateIdentifierToPlan: authenticatedResolver(
      '`addAlternateIdentifierToPlan` resolver',
      UserRole.RESEARCHER,
      async (
        _: Record<PropertyKey, never>,
        { planId, alternateIdentifier }: { planId: number; alternateIdentifier: string },
        context: MyContext
      ): Promise<Plan> => {
        const reference = 'add alternate identifier to plan resolver';

        // Get the plan and check that the user is authorized to access it
        const { plan } = await getPlanAndCheckAuthorization(reference, context, planId);

        const identifier: AlternateIdentifier = new AlternateIdentifier({ planId, alternateIdentifier });

        const created: AlternateIdentifier = await identifier.create(context);
        if (created && !created.hasErrors()) {
          // Handle OpenSearch index update and maDMP JSON versioning in Dynamo
          await handleAsyncUpdates(reference, context, plan);
        }
        return plan;
      }
    ),

    /**
     * AUTHENTICATED USERS ONLY: Remove an alternate identifier from a plan
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args the plan id and alternate identifier
     * @param context The Apollo context
     * @returns The Plan (with errors if applicable)
     * @throws NotFoundError when the Plan is not found
     * @throws ForbiddenError when the caller does not have permission
     * @throws UnauthorizedError when the JWT token is not present
     * @throws InternalServerError when a fatal error has occurred
     */
    removeAlternateIdentifierFromPlan: authenticatedResolver(
      '`removeAlternateIdentifierFromPlan` resolver',
      UserRole.RESEARCHER,
      async (
        _: Record<PropertyKey, never>,
        { planId, alternateIdentifier }: { planId: number; alternateIdentifier: string },
        context: MyContext
      ): Promise<Plan> => {
        const reference = 'remove alternate identifier from plan resolver';

        // Get the plan and check that the user is authorized to access it
        const { plan } = await getPlanAndCheckAuthorization(reference, context, planId);

        const identifier: AlternateIdentifier = await AlternateIdentifier.findByAlternateIdentifier(
          reference,
          context,
          alternateIdentifier
        );
        if (!identifier) {
          throw NotFoundError('Alternate identifier not found');
        }
        if (identifier.planId !== planId) {
          throw ForbiddenError('Alternate identifier belongs to a different plan');
        }

        const deleted = await identifier.delete(context);
        if (deleted && !deleted.hasErrors()) {
          // Handle OpenSearch index update and maDMP JSON versioning in Dynamo
          await handleAsyncUpdates(reference, context, plan);
        }
        return plan;
      }
    ),

    /**
     * AUTHENTICATED USERS ONLY: Create an entire plan (and project if applicable)
     *
     * @param _ Ignored, this is the entrypoint for the Apollo resolver
     * @param args the entire plan input (including project, members, funding and answers)
     * @param context The Apollo context
     * @returns The Plan (with errors if applicable)
     * @throws NotFoundError when a Template could not be identified for the plan
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
        const ref = 'addEntirePlan';
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
          return await context.dataSources.sqlDataSource.withTransaction(context, async (): Promise<Plan> => {
            const created: Plan = await addEntirePlan(ref, context, input, plan);
            if (created && !created.hasErrors()) {
              // If successful, add the OpenSearch index in the background
              await handleAsyncUpdates(ref, context, created);
            }
            return created;
          });
        } catch (error) {
          if (error instanceof GraphQLError) {
            if (error.extensions?.code === 'BAD_REQUEST') {
              plan.addError(
                'general',
                `Unable to process your request. ${error.message}`
              );
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
              const replaced: Plan = await replaceEntirePlan(ref, context, project, plan, input);
              if (replaced && !replaced.hasErrors()) {
                // If successful, update the OpenSearch index in the background
                await handleAsyncUpdates(ref, context, replaced);
              }
              return replaced;
            });
          } catch (error) {
            if (error instanceof GraphQLError) {
              if (error.extensions?.code === 'BAD_REQUEST') {
                plan.addError(
                  'general',
                  `Unable to process your request. ${error.message}`
                );
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
              const oldPlan: Plan = await removeEntirePlan(ref, context, project, plan);
              if (oldPlan && !oldPlan.hasErrors()) {
                // If successful, remove the OpenSearch index
                await handleAsyncDeletes(ref, context, oldPlan);
              }
              return oldPlan
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
    owner: async (parent: Plan, _, context: MyContext): Promise<Affiliation> => {
      if (!parent?.id) return null;
      const reference = 'Chained Plan.owner';

      return await getPlanOwnerAffiliation(reference, context, parent);
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
      // The progress of each section within the plan
      if (parent?.id) {
        return await PlanSectionProgress.findByPlanId('plan versionedSections resolver', context, parent.id, parent?.versionedTemplateId);
      }
      return [];
    },
    sections: async (parent: Plan, _, context: MyContext): Promise<PlanSection[]> => {
      const ref = 'plan.sections resolver';
      const sections: PlanSection[] = await getPlanSectionsAndQuestions(ref, context, parent);
      return Array.isArray(sections) ? sections : [];
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
    acceptedWorks: async (parent: Plan, _, context: MyContext): Promise<AcceptedWork[]> => {
      if (parent?.id) {
        return await AcceptedWork.findByPlanId('plan acceptedWorks chained resolver', context, parent.id);
      }
      return [];
    },
    availableGuidanceSources: async (parent: Plan, _, context: MyContext): Promise<GuidanceSource[]> => {
      if (parent?.id) {
        return await getGuidanceSourcesForPlan(context, parent.id);
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
    planCreator: async (parent: PlanSearchResult, _, context: MyContext): Promise<User | null> => {
      if (parent?.createdById) {
        return await User.findById('planSearchResult.planCreator resolver', context, parent.createdById);
      }
      return null;
    }
  },

  PlanMember: {
    projectMember: async (parent: PlanMember, _, context: MyContext): Promise<ProjectMember | null> => {
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

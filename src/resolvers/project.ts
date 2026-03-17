import { prepareObjectForLogs } from '../logger';
import { ExternalProject, ProjectSearchResults, Resolvers } from "../types";
import { Project, ProjectSearchResult } from "../models/Project";
import {
  ProjectCollaborator,
  ProjectCollaboratorAccessLevel
} from '../models/Collaborator';
import { MyContext } from '../context';
import { isAdmin, isAuthorized, isSuperAdmin } from '../services/authService';
import {
  AuthenticationError,
  ForbiddenError,
  InternalServerError,
  NotFoundError
} from '../utils/graphQLErrors';
import { ProjectFunding } from '../models/Funding';
import { ProjectMember } from '../models/Member';
import {
  ensureDefaultProjectContact,
  hasPermissionOnProject,
  setCurrentUserAsProjectOwner
} from '../services/projectService';
import { Affiliation } from '../models/Affiliation';
import { ResearchDomain } from '../models/ResearchDomain';
import { MemberRole } from '../models/MemberRole';
import { GraphQLError } from 'graphql';
import { Plan, PlanSearchResult } from '../models/Plan';
//import { addVersion } from '../models/PlanVersion';
import {
  isNullOrUndefined,
  normaliseDate,
  normaliseDateTime
} from '../utils/helpers';
//import { parseMember } from '../services/commonStandardService';
import {
  PaginationOptionsForCursors,
  PaginationOptionsForOffsets,
  PaginationType
} from '../types/general';
import {saveMaDMPVersion} from "../services/planService";

export const resolvers: Resolvers = {
  Query: {
    // return all projects that the current user owns or is a collaborator on
    myProjects: async (
      _,
      { term, paginationOptions, filterOptions },
      context: MyContext
    ): Promise<ProjectSearchResults> => {
      const reference = 'myProjects resolver';
      try {
        if (isAuthorized(context.token)) {
          const pagOpts = !isNullOrUndefined(paginationOptions) && paginationOptions.type === PaginationType.OFFSET
                      ? paginationOptions as PaginationOptionsForOffsets
                      : { ...paginationOptions, type: PaginationType.CURSOR } as PaginationOptionsForCursors;

          return await ProjectSearchResult.search(
            reference,
            context,
            term,
            context.token?.id,
            context.token?.affiliationId,
            filterOptions,
            pagOpts
          );
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Return all projects based on the user's role (Admin only!)
    allProjects: async (
      _,
      { term, paginationOptions, filterOptions },
      context: MyContext
    ): Promise<ProjectSearchResults> => {
      const reference = 'allProjects resolver';
      try {
        if (isAdmin(context.token)) {
          const pagOpts = !isNullOrUndefined(paginationOptions) && paginationOptions.type === PaginationType.OFFSET
            ? paginationOptions as PaginationOptionsForOffsets
            : { ...paginationOptions, type: PaginationType.CURSOR } as PaginationOptionsForCursors;

          const userId = isAdmin(context.token) ? null : context.token?.id;
          const affiliationId = isSuperAdmin(context.token) ? null : context.token?.affiliationId;

          return await ProjectSearchResult.search(
            reference,
            context,
            term,
            userId,
            affiliationId,
            filterOptions,
            pagOpts
          );
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Fetch a single project
    project: async (_, { projectId }, context: MyContext): Promise<Project> => {
      const reference = 'project resolver';
      try {
        if (isAuthorized(context.token)) {
          const project = await Project.findById(reference, context, projectId);
          if (isNullOrUndefined(project)) {
            throw NotFoundError();
          }
          if (await hasPermissionOnProject(context, project, ProjectCollaboratorAccessLevel.COMMENT)) {
            return project;
          }
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    searchExternalProjects: async (_, { input }, context: MyContext): Promise<ExternalProject[]> => {
      const reference = 'external project search resolver';
      const { affiliationId , awardId, awardName, awardYear, piNames } = input;

      try {
        if (isAuthorized(context.token)) {
          const dmphubAPI = context.dataSources.dmphubAPIDataSource;
          const affiliation = await Affiliation.findByURI(reference, context, affiliationId);
          const dmps = await dmphubAPI.getAwards(
            context,
            affiliation.apiTarget,
            awardId,
            awardName,
            awardYear,
            piNames,
          );
          return dmps.map((dmpHubAward) => {
            const members = [];

            return {
              title: dmpHubAward.project.title,
              abstractText: dmpHubAward.project.description,
              startDate: normaliseDate(dmpHubAward.project.start),
              endDate: normaliseDate(dmpHubAward.project.end),
              fundings: dmpHubAward.project.funding.map((fund) => ({
                funderProjectNumber: fund.dmproadmap_project_number,
                grantId: fund.grant_id.identifier,
                funderOpportunityNumber: fund.dmproadmap_opportunity_number,
              })),
              members: members,
            };
          });
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
    // add a new project
    addProject: async (_, { title, isTestProject }, context: MyContext) => {
      const reference = 'addProject resolver';
      try {
        if (isAuthorized(context.token)) {
          const newProject = new Project({title, isTestProject});
          const created = await newProject.create(context);

          if (!isNullOrUndefined(created)) {
            if (!created.hasErrors()) {
              // Set the current user as an owner on the project
              const ownerWasSet = await setCurrentUserAsProjectOwner(context, created.id);
              // Set the current user as the default primary contact
              const contactWasSet = await ensureDefaultProjectContact(context, created);

              if (!ownerWasSet) {
                created.addError('general', 'Unable to set the default owner of the project');
              }
              if (!contactWasSet) {
                created.addError('general', 'Unable to set the default primary contact');
              }
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

    // update a project
    updateProject: async (_, { input }, context) => {
      const reference = 'updateProject resolver';
      try {
        if (isAuthorized(context.token)) {
          const project = await Project.findById(reference, context, input.id);
          if (isNullOrUndefined(project)) {
            throw NotFoundError();
          }

          if (!(await hasPermissionOnProject(context, project))) {
            throw ForbiddenError();
          }

          const toUpdate = new Project(input);
          const updated = await toUpdate.update(context);
          if (updated && !updated.hasErrors()) {
            // Update each plan's version snapshot if the project was updated
            const plans = await Plan.findByProjectId(reference, context, project.id);
            for (const plan of plans) {
              // Update the maDMP version of the Plan
              await saveMaDMPVersion(reference, context, plan.id, plan.registered);
            }
          }

          return updated;
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // archive a project
    archiveProject: async (_, { projectId }, context) => {
      const reference = 'archiveProject resolver';
      try {
        if (isAuthorized(context.token)) {
          const project = await Project.findById(reference, context, projectId);
          if (!project) {
            throw NotFoundError();
          }

          // Only allow the owner of the project to delete it
          if (!(await hasPermissionOnProject(context, project))) {
            throw ForbiddenError();
          }

          // Delete/Tombstone each plan associated with the project
          const plans = await Plan.findByProjectId(reference, context, project.id);
          for (const plan of plans) {
            const deleted = await plan.delete(context);

            if (deleted && !deleted.hasErrors()) {
              // Delete the maDMP versions of the Plan
              await saveMaDMPVersion(reference, context, deleted.id, deleted.registered, true);
            }
          }

          return await project.delete(context);
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Import project from an external data source
    projectImport: async (_, {input}, context) => {
      const reference = 'updateProject resolver';
      try {
        if (isAuthorized(context.token)) {
          try {
            const projectId = input.project.id;
            const existingProject = await Project.findById(reference, context, projectId);
            if (!existingProject) {
              throw NotFoundError();
            }

            if (!hasPermissionOnProject(context, existingProject)) {
              throw ForbiddenError();
            }

            // Update project
            const toUpdateProject = new Project(input.project);
            const updatedProject = await toUpdateProject.update(context);

            // Add project funding and project members
            if (updatedProject && !updatedProject.hasErrors()) {
              // Update project funding
              const addFundingErrors = [];
              for (const fund of input.funding) {
                const newFunding = new ProjectFunding(fund);
                const fundingAdded = await newFunding.create(context, projectId);
                if(!fundingAdded){
                  addFundingErrors.push(`Funding(affiliationId=${newFunding.affiliationId})`);
                }
              }
              if(addFundingErrors.length > 0){
                const msg = `Unable to add fundings to project: ${addFundingErrors.join(', ')}`;
                context.logger.error(prepareObjectForLogs({ projectId }), msg);
                updatedProject.addError('fundings', msg)
              }

              // Update project members
              const addMemberErrors = [];
              const addMemberRoleErrors = [];
              for (const contrib of input.members) {
                // Add project member
                const newMember = new ProjectMember(contrib);
                context.logger.debug(`${reference}: add project member`);
                const memberAdded = await newMember.create(context, projectId);
                if(!memberAdded){
                  addMemberErrors.push(`Member(affiliationId=${newMember.affiliationId}, givenName=${newMember.givenName}, surName=${newMember.surName}, orcid=${newMember.orcid}, email=${newMember.email})`);
                } else {
                  // Add member role
                  context.logger.debug(`${reference}: add member role`);
                  const role = await MemberRole.defaultRole(context, reference);
                  if(!role){
                    context.logger.error(`${reference}: could not find default role`);
                  } else {
                    context.logger.debug(`${reference}: add ${role.label} to member ${memberAdded.id}`);
                    const wasAdded = await role.addToProjectMember(context, memberAdded.id);
                    if (!wasAdded) {
                      addMemberRoleErrors.push(`MemberRole(memberId=${memberAdded.id}, role=${role.label})`);
                    }
                  }
                }
              }

              if(addMemberErrors.length > 0){
                const msg = `Unable to add members to project: ${addMemberErrors.join(', ')}`;
                context.logger.error(prepareObjectForLogs({ projectId }), msg);
                updatedProject.addError('members', msg)
              }
              if(addMemberRoleErrors.length > 0){
                const msg = `Unable to add default member roles: ${addMemberRoleErrors.join(', ')}`
                context.logger.error(prepareObjectForLogs({ projectId }), msg);
                updatedProject.addError('memberRoles', msg)
              }
            }

            return updatedProject;
          } catch (err) {
            context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
            throw InternalServerError();
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

  Project: {
    researchDomain: async (parent: Project, _, context: MyContext): Promise<ResearchDomain | null> => {
      if (parent.researchDomainId) {
        return await ResearchDomain.findById(
          'Chained Project.researchDomain',
          context,
          parent.researchDomainId
        );
      }
      return null;
    },
    collaborators: async (parent: Project, _, context: MyContext): Promise<ProjectCollaborator[]> => {
      return await ProjectCollaborator.findByProjectId(
        'Chained Project.collaborators',
        context,
        parent.id
      );
    },
    members: async (parent: Project, _, context: MyContext): Promise<ProjectMember[]> => {
      return await ProjectMember.findByProjectId(
        'Chained Project.members',
        context,
        parent.id
      );
    },
    fundings: async (parent: Project, _, context: MyContext): Promise<ProjectFunding[]> => {
      return await ProjectFunding.findByProjectId(
        'Chained Project.fundings',
        context,
        parent.id
      );
    },
    plans: async (parent: Project, _, context: MyContext): Promise<PlanSearchResult[]> => {
      return await PlanSearchResult.findByProjectId(
        'Chained Project.plans',
        context,
        parent.id
      );
    },
    created: (parent: Project) => {
      return normaliseDateTime(parent.created);
    },
    modified: (parent: Project) => {
      return normaliseDateTime(parent.modified);
    }
  },
};

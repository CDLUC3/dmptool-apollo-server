import { prepareObjectForLogs } from '../logger';
import { Resolvers } from "../types";
import { Affiliation } from '../models/Affiliation';
import { MemberRole } from '../models/MemberRole';
import { Project } from '../models/Project';
import { PlanMember, ProjectMember } from "../models/Member";
import { MyContext } from '../context';
import { isAuthorized } from '../services/authService';
import { AuthenticationError, ForbiddenError, InternalServerError, NotFoundError } from '../utils/graphQLErrors';
import { hasPermissionOnProject } from '../services/projectService';
import {saveMaDMPVersion, updateMemberRoles} from '../services/planService';
import { GraphQLError } from 'graphql';
import { Plan } from '../models/Plan';
// import { updateVersion } from '../models/PlanVersion';
import { isNullOrUndefined, normaliseDateTime } from "../utils/helpers";
import { ProjectCollaboratorAccessLevel } from "../models/Collaborator";
import { processOtherAffiliationName } from '../services/affiliationService';


export const resolvers: Resolvers = {
  Query: {
    // return all of the members for the specified project
    projectMembers: async (_, { projectId }, context: MyContext): Promise<ProjectMember[]> => {
      const reference = 'projectMembers resolver';
      try {
        if (isAuthorized(context.token)) {
          const project = await Project.findById(reference, context, projectId);
          if (isNullOrUndefined(project)) {
            throw NotFoundError();
          }

          if (await hasPermissionOnProject(context, project, ProjectCollaboratorAccessLevel.COMMENT)) {
            return await ProjectMember.findByProjectId(reference, context, projectId);
          }
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;
        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // return a specific member
    projectMember: async (_, { projectMemberId }, context: MyContext): Promise<ProjectMember> => {
      const reference = 'projectMember resolver';
      try {
        if (isAuthorized(context.token)) {
          const member = await ProjectMember.findById(reference, context, projectMemberId);
          if (isNullOrUndefined(member)) {
            throw NotFoundError();
          }

          const project = await Project.findById(reference, context, member.projectId);

          if (project && await hasPermissionOnProject(context, project, ProjectCollaboratorAccessLevel.COMMENT)) {
            return member;
          }
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    planMembers: async (_, { planId }, context: MyContext): Promise<PlanMember[]> => {
      const reference = 'planMembers resolver';
      try {
        if (isAuthorized(context.token)) {
          const plan = await Plan.findById(reference, context, planId);
          if (isNullOrUndefined(plan)) {
            throw NotFoundError();
          }

          const project = await Project.findById(reference, context, plan.projectId);
          if (await hasPermissionOnProject(context, project, ProjectCollaboratorAccessLevel.COMMENT)) {
            return await PlanMember.findByPlanId(reference, context, plan.id);
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
    // add a new ProjectMember
    addProjectMember: async (_, { input }, context: MyContext) => {
      const reference = 'addProjectMember resolver';
      try {
        if (isAuthorized(context.token)) {
          const project = await Project.findById(reference, context, input.projectId);
          if (isNullOrUndefined(project)) {
            throw NotFoundError();
          }

          // If an affiliationId was provided, check if it exists and create it if it doesn't
          if (input.affiliationId && input.affiliationId.length > 0) {
            const existingAffiliation = await Affiliation.findByURI(reference, context, input.affiliationId);
            if (!existingAffiliation && input.affiliationName) {
              // Create the affiliation with the provided URI and name
              const newAffiliation = new Affiliation({
                uri: input.affiliationId,
                name: input.affiliationName
              });

              const createdAffiliation = await newAffiliation.create(context);

              if (!createdAffiliation || createdAffiliation.hasErrors()) {
                const errorMember = new ProjectMember(input);
                errorMember.addError('affiliation', 'Unable to create required affiliation');
                return errorMember;
              }

              // Update the input to use the URI from the created affiliation
              input.affiliationId = createdAffiliation.uri;
            }
          } else if (input.affiliationName) {
            // If only an affiliationName was provided, then process it to generate a URI
            const affiliation = await processOtherAffiliationName(context, input.affiliationName, context.token.id);
            if (affiliation) {
              input.affiliationId = String(affiliation.uri);
            }
          }

          if (await hasPermissionOnProject(context, project)) {
            const newMember = new ProjectMember(input);
            const created = await newMember.create(context, project.id);

            if (isNullOrUndefined(created?.id)) {
              // A null was returned so add a generic error and return it
              if (isNullOrUndefined(newMember.errors['general'])) {
                newMember.addError('general', 'Unable to create Member');
              }
              return newMember;
            }

            // If any MemberRole were specified and there were no errors creating the record
            if (Array.isArray(input.memberRoleIds)) {
              if (created && !created.hasErrors()) {
                const addErrors = [];
                // Add any memberRole associations
                for (const id of input.memberRoleIds) {
                  const role = await MemberRole.findById(reference, context, id);
                  if (role) {
                    const wasAdded = await role.addToProjectMember(context, created.id);
                    if (!wasAdded) {
                      addErrors.push(role.label);
                    }
                  }
                }
                // If any failed to be added, then add an error to the ProjectMember
                if (addErrors.length > 0) {
                  created.addError('memberRoles', `Created but unable to assign roles: ${addErrors.join(', ')}`);
                }
              }
            } else {
              // Since no roles were provided, we will default to one
              const role = await MemberRole.defaultRole(context, reference);
              await role.addToProjectMember(context, created.id);
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

    // update an existing ProjectMember
    updateProjectMember: async (_, { input }, context) => {
      const reference = 'updateProjectMember resolver';
      try {
        if (isAuthorized(context.token)) {
          const member = await ProjectMember.findById(reference, context, input.projectMemberId);
          if (isNullOrUndefined(member)) {
            throw NotFoundError();
          }

          // Fetch the project and run a permission check
          const project = await Project.findById(reference, context, member.projectId);
          if (isNullOrUndefined(project)) {
            throw NotFoundError();
          }

          if (await hasPermissionOnProject(context, project)) {
            const toUpdate = new ProjectMember(input);
            toUpdate.projectId = member?.projectId;
            toUpdate.id = member?.id;
            const updated = await toUpdate.update(context);

            if (updated && !updated.hasErrors()) {
              const associationErrors = [];
              // Fetch all of the current Roles associated with this Contirbutor
              const roles = await MemberRole.findByProjectMemberId(reference, context, member.id);
              const currentRoleids = roles ? roles.map((d) => d.id) : [];

              // Use the helper function to determine which Roles to keep
              const {
                idsToBeRemoved,
                idsToBeSaved
              } = MemberRole.reconcileAssociationIds(
                currentRoleids,
                input.memberRoleIds
              );

              const removeErrors = [];
              // Delete any Role associations that were removed
              for (const id of idsToBeRemoved) {
                const role = await MemberRole.findById(reference, context, id);
                if (role) {
                  const wasRemoved = role.removeFromProjectMember(context, updated.id);
                  if (!wasRemoved) {
                    removeErrors.push(role.label);
                  }
                }
              }
              // If any failed to be removed, then add an error to the ProjectMember
              if (removeErrors.length > 0) {
                associationErrors.push(`unable to remove roles: ${removeErrors.join(', ')}`);
              }

              const addErrors = [];
              // Add any new Role associations
              for (const id of idsToBeSaved) {
                const role = await MemberRole.findById(reference, context, id);
                if (role) {
                  const wasAdded = role.addToProjectMember(context, updated.id);
                  if (!wasAdded) {
                    addErrors.push(role.label);
                  }
                }
              }
              // If any failed to be added, then add an error to the ProjectMember
              if (addErrors.length > 0) {
                associationErrors.push(`unable to assign roles: ${addErrors.join(', ')}`);
              }

              if (associationErrors.length > 0) {
                updated.addError('memberRoles', `Updated but ${associationErrors.join(', ')}`);
              }

              if (!updated.hasErrors()) {
                const plans = await Plan.findByProjectId(reference, context, member.projectId);
                for (const plan of plans) {
                  // Update the maDMP version of the Plan
                  await saveMaDMPVersion(reference, context, plan.id, plan.registered);
                }
              }

              // Reload since the roles may have changed
              return updated.hasErrors() ? updated : await ProjectMember.findById(reference, context, member.id);
            }
            // Otherwise there were errors so return the object with errors
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

    // delete an existing ProjectMember
    removeProjectMember: async (_, { projectMemberId }, context) => {
      const reference = 'removeProjectMember resolver';
      try {
        if (isAuthorized(context.token)) {
          const member = await ProjectMember.findById(reference, context, projectMemberId);
          if (isNullOrUndefined(member)) {
            throw NotFoundError();
          }

          // Fetch the project and run a permission check
          const project = await Project.findById(reference, context, member.projectId);
          if (isNullOrUndefined(project)) {
            throw NotFoundError();
          }

          if (await hasPermissionOnProject(context, project)) {
            // Any related memberRoles will be automatically deleted within the DB
            const removed = await member.delete(context);
            if (removed && !removed.hasErrors()) {
              const plans = await Plan.findByProjectId(reference, context, member.projectId);
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

    //Add a Member to a Plan
    addPlanMember: async (_, { planId, projectMemberId, roleIds }, context: MyContext): Promise<PlanMember> => {
      const reference = 'addPlanMember resolver';
      try {
        if (isAuthorized(context.token)) {
          const plan = await Plan.findById(reference, context, planId);
          if (isNullOrUndefined(plan)) {
            throw NotFoundError();
          }

          const projectMember = await ProjectMember.findById(reference, context, projectMemberId);
          if (isNullOrUndefined(projectMember)) {
            throw NotFoundError();
          }

          let roles = roleIds ?? [];
          // If no roles were passed in then use whatever is currently set on the ProjectMember
          if (roles.length === 0) {
            // For now, planMember roles will match the projectMember roles
            const currentProjectRoles = await MemberRole.findByProjectMemberId(reference, context, projectMemberId);
            roles = currentProjectRoles ? currentProjectRoles.map((d) => d.id) : [];
          }

          const project = await Project.findById(reference, context, plan.projectId);
          if (await hasPermissionOnProject(context, project)) {
            const newPlanMember = new PlanMember({ planId, projectMemberId, memberRoleIds: roles });
            const created = await newPlanMember.create(context);

            if (isNullOrUndefined(created?.id)) {
              // A null was returned so add a generic error and return it
              if (isNullOrUndefined(newPlanMember.errors['general'])) {
                newPlanMember.addError('general', 'Unable to create PlanMember');
              }
              return newPlanMember;
            }

            // If any memberRole were specified and there were no errors creating the record
            if (Array.isArray(roles)) {
              if (created && !created.hasErrors()) {
                const addErrors = [];
                // Add any MemberRole associations
                for (const id of roles) {
                  const role = await MemberRole.findById(reference, context, id);
                  if (role) {
                    const wasAdded = await role.addToPlanMember(context, created.id);
                    if (!wasAdded) {
                      addErrors.push(role.label);
                    }
                  }
                }
                // If any failed to be added, then add an error to the PlanMember
                if (addErrors.length > 0) {
                  created.addError('memberRoles', `Created but unable to assign roles: ${addErrors.join(', ')}`);
                }
              }
            }

            // Update the maDMP version of the Plan
            await saveMaDMPVersion(reference, context, plan.id, plan.registered);

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

    // update an existing PlanMember
    updatePlanMember: async (_, { planId, planMemberId, memberRoleIds, isPrimaryContact }, context) => {
      const reference = 'updatePlanMember resolver';
      try {
        if (isAuthorized(context.token)) {
          const member = await PlanMember.findById(reference, context, planMemberId);
          if (isNullOrUndefined(member)) {
            throw NotFoundError();
          }

          const plan = await Plan.findById(reference, context, member?.planId);
          if (isNullOrUndefined(plan)) {
            throw NotFoundError();
          }
          const project = await Project.findById(reference, context, plan.projectId);
          const hasPermission = await hasPermissionOnProject(context, project);

          if (hasPermission) {
            // Fetch current roles
            const roles = await MemberRole.findByPlanMemberId(reference, context, planMemberId);
            const currentRoleIds = roles ? roles.map((d) => d.id) : [];

            // Update roles using the helper function
            const { updatedRoleIds, errors } = await updateMemberRoles(
              reference,
              context,
              member.id,
              currentRoleIds,
              memberRoleIds
            );

            if (errors.length > 0) {
              member.addError('memberRoles', `Updated but ${errors.join(', ')}`);
            }

            // Create a new instance of PlanMember and set the updated values
            const toUpdate = new PlanMember({
              id: planMemberId,
              planId: planId,
              projectMemberId: member.projectMemberId,
              isPrimaryContact,
              memberRoleIds: updatedRoleIds ?? currentRoleIds,
            });

            //update the PlanMember with new instance
            const updatedPlan = await toUpdate.update(context);

            // Make updates for isPrimaryContact
            if (updatedPlan && !updatedPlan.hasErrors()) {
              if (isPrimaryContact === true) {
                // Get all members for the plan
                const allMembers = await PlanMember.findByPlanId(reference, context, planId);

                // Set isPrimaryContact to false for all other members
                for (const member of allMembers) {
                  if (member.id !== planMemberId) {
                    member.isPrimaryContact = false;
                    // Fetch current roles
                    const roles = await MemberRole.findByPlanMemberId(reference, context, member.id);
                    const roleIds = roles ? roles.map((d) => d.id) : [];
                    member.memberRoleIds = roleIds;
                    await member.update(context);
                  }
                }
              }

              const plan = await Plan.findById(reference, context, planId);
              if (plan) {
                /*
                // Version all of the plans (if any) and sync with the DMPHub
                const planVersion = await updateVersion(context, plan, reference);
                if (!planVersion || planVersion.hasErrors()) {
                  member.addError("general", "Unable to version the plan");
                }
                 */
              }
            }

            return member.hasErrors() ? member : await PlanMember.findById(reference, context, member.id);
          }
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // delete an existing PlanMember
    removePlanMember: async (_, { planMemberId }, context) => {
      const reference = 'removePlanMember resolver';
      try {
        if (isAuthorized(context.token)) {
          const member = await PlanMember.findById(reference, context, planMemberId);
          if (isNullOrUndefined(member)) {
            throw NotFoundError();
          }

          // Fetch the plan and run a permission check
          const plan = await Plan.findById(reference, context, member.planId);

          const project = await Project.findById(reference, context, plan.projectId);
          if (await hasPermissionOnProject(context, project)) {
            // Any related MemberRoles will be automatically deleted within the DB
            const removed = await member.delete(context);

            if (removed && !removed.hasErrors()) {
              const plan = await Plan.findById(reference, context, member.planId);
              if (plan) {
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
  },

  ProjectMember: {
    project: async (parent: ProjectMember, _, context: MyContext): Promise<Project> => {
      if (parent?.projectId) {
        return await Project.findById('Chained ProjectMember.project', context, parent.projectId);
      }
      return null;
    },
    affiliation: async (parent: ProjectMember, _, context: MyContext): Promise<Affiliation> => {
      if (parent?.affiliationId) {
        return await Affiliation.findByURI('Chained ProjectMember.affiliation', context, parent.affiliationId);
      }
      return null;
    },
    memberRoles: async (parent: ProjectMember, _, context: MyContext): Promise<MemberRole[]> => {
      if (parent?.id) {
        return await MemberRole.findByProjectMemberId(
          'Chained ProjectMember.memberRoles',
          context,
          parent.id
        );
      }
      return null;
    },
    created: (parent: ProjectMember) => {
      return normaliseDateTime(parent.created);
    },
    modified: (parent: ProjectMember) => {
      return normaliseDateTime(parent.modified);
    }
  },

  PlanMember: {
    plan: async (parent: PlanMember, _, context: MyContext): Promise<Plan> => {
      if (parent?.planId) {
        return await Plan.findById('Chained PlanMember.plan', context, parent.planId);
      }
      return null;
    },
    projectMember: async (parent: PlanMember, _, context: MyContext): Promise<ProjectMember> => {
      if (parent?.projectMemberId) {
        return await ProjectMember.findById(
          'Chained PlanMember.projectMember',
          context, parent.projectMemberId
        );
      }
      return null;
    },
    memberRoles: async (parent: ProjectMember, _, context: MyContext): Promise<MemberRole[]> => {
      if (parent?.id) {
        return await MemberRole.findByPlanMemberId(
          'Chained ProjectMember.memberRoles',
          context,
          parent.id
        );
      }
      return null;
    },
    created: (parent: PlanMember) => {
      return normaliseDateTime(parent.created);
    },
    modified: (parent: PlanMember) => {
      return normaliseDateTime(parent.modified);
    }
  },
};

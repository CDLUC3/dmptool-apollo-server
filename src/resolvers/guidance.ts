import { Resolvers } from "../types";
import { MyContext } from "../context";
import { Guidance } from "../models/Guidance";
import { GuidanceGroup } from "../models/GuidanceGroup";
import { PlanGuidance } from "../models/Guidance";
import { Affiliation } from "../models/Affiliation";
import { User } from "../models/User";
import { Tag } from "../models/Tag";
import { hasPermissionOnGuidanceGroup, markGuidanceGroupAsDirty } from "../services/guidanceService";
import { ForbiddenError, NotFoundError, AuthenticationError, InternalServerError } from "../utils/graphQLErrors";
import { isAdmin, isAuthorized } from "../services/authService";
import { prepareObjectForLogs } from "../logger";
import { GraphQLError } from "graphql";
import { isNullOrUndefined, normaliseDateTime } from "../utils/helpers";
import { hasPublishedFlag } from "./guidanceGroup";
import { Plan } from "../models/Plan";

export const resolvers: Resolvers = {
  Query: {
    // Return all Guidance items for a specific GuidanceGroup
    guidanceByGroup: async (_, { guidanceGroupId }, context: MyContext): Promise<Guidance[]> => {
      const reference = 'guidanceByGroup resolver';
      try {
        const requester = context?.token;
        if (!requester) {
          throw AuthenticationError();
        }

        // Admins with permission: full access
        if (isAdmin(requester) && await hasPermissionOnGuidanceGroup(context, guidanceGroupId)) {
          return await Guidance.findByGuidanceGroupId(reference, context, guidanceGroupId);
        }

        // For other users: check if guidanceGroup is published
        const guidanceGroup = await GuidanceGroup.findById(reference, context, guidanceGroupId);
        const isPublished = Boolean(guidanceGroup?.latestPublishedDate || hasPublishedFlag(guidanceGroup));
        if (isPublished) {
          return await Guidance.findByGuidanceGroupId(reference, context, guidanceGroupId);
        }

        throw ForbiddenError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;
        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Return a specific Guidance item
    guidance: async (_, { guidanceId }, context: MyContext): Promise<Guidance> => {
      const reference = 'guidance resolver';
      const guidance = await Guidance.findById(reference, context, guidanceId);
      const guidanceGroupId = guidance?.guidanceGroupId;
      try {
        const requester = context?.token;
        if (!requester) {
          throw AuthenticationError();
        }

        // Admins with permission: full access
        if (isAdmin(requester) && await hasPermissionOnGuidanceGroup(context, guidanceGroupId)) {
          if (!guidance) {
            throw NotFoundError('Guidance not found');
          }
          return guidance;
        }

        // For other users: check if guidanceGroup is published
        const guidanceGroup = await GuidanceGroup.findById(reference, context, guidanceGroupId);
        const isPublished = Boolean(guidanceGroup?.latestPublishedDate || hasPublishedFlag(guidanceGroup));
        if (isPublished) {
          if (!guidance) {
            throw NotFoundError('Guidance not found');
          }
          return guidance;
        }

        throw ForbiddenError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;
        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // ============================================================================
    // Plan Guidance Affiliations Query (User permissions)
    // ============================================================================

    // Return user's selected guidance affiliations for a plan
    planGuidance: async (_, { planId }, context: MyContext): Promise<PlanGuidance[]> => {
      const reference = 'planGuidanceAffiliations resolver';
      try {
        if (isAuthorized(context.token)) {
          const plan = await Plan.findById(reference, context, planId);

          if (isNullOrUndefined(plan)) {
            throw NotFoundError(`Plan with id ${planId} not found`);
          }
          const userId = context.token?.userId;
          if (!userId) {
            throw AuthenticationError();
          }

          return await PlanGuidance.findByPlanIdAndUserId(
            reference,
            context,
            planId,
            userId
          );
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
    // Add a new Guidance item
    addGuidance: async (
      _,
      { input: { guidanceGroupId, guidanceText, tagId } },
      context: MyContext
    ): Promise<Guidance> => {
      const reference = 'addGuidance resolver';
      try {
        if (isAdmin(context?.token) && await hasPermissionOnGuidanceGroup(context, guidanceGroupId)) {
          const guidance = new Guidance({
            guidanceGroupId,
            guidanceText,
            tagId,
            createdById: context.token.id,
            modifiedById: context.token.id,
          });

          // Create the new guidance
          const newGuidance = await guidance.create(context);

          // If the guidance was not created, return the errors
          if (!newGuidance?.id) {
            if (!guidance.errors['general']) {
              guidance.addError('general', 'Unable to create the guidance');
            }
            return guidance;
          }

          // Mark the guidance group as dirty
          await markGuidanceGroupAsDirty(context, guidanceGroupId);

          return await Guidance.findById(reference, context, newGuidance.id);
        }

        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Update an existing Guidance item
    updateGuidance: async (
      _,
      { input: { guidanceId, guidanceText, tagId } },
      context: MyContext
    ): Promise<Guidance> => {
      const reference = 'updateGuidance resolver';
      const guidance = await Guidance.findById(reference, context, guidanceId);
      const guidanceGroupId = guidance?.guidanceGroupId;
      try {
        if (isAdmin(context?.token) && await hasPermissionOnGuidanceGroup(context, guidanceGroupId)) {
          if (!guidance) {
            throw NotFoundError('Guidance not found');
          }

          // Update the fields
          if (guidanceText !== undefined) guidance.guidanceText = guidanceText;
          guidance.tagId = tagId; // the schema requires tagId to be provided so it will never be undefined
          guidance.modifiedById = context.token.id;

          // Save the updates
          const updated = await guidance.update(context);

          if (!updated?.id) {
            if (!guidance.errors['general']) {
              guidance.addError('general', 'Unable to update the guidance');
            }
            return guidance;
          }

          // Mark the guidance group as dirty
          await markGuidanceGroupAsDirty(context, guidance.guidanceGroupId);

          return await Guidance.findById(reference, context, guidanceId);
        }

        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Delete a Guidance item
    removeGuidance: async (
      _,
      { guidanceId },
      context: MyContext
    ): Promise<Guidance> => {
      const reference = 'removeGuidance resolver';
      const guidance = await Guidance.findById(reference, context, guidanceId);
      const guidanceGroupId = guidance?.guidanceGroupId;
      try {
        if (isAdmin(context?.token) && await hasPermissionOnGuidanceGroup(context, guidanceGroupId)) {
          if (!guidance) {
            throw NotFoundError('Guidance not found');
          }

          const guidanceGroupId = guidance.guidanceGroupId;
          const deleted = await guidance.delete(context);

          if (!deleted) {
            guidance.addError('general', 'Unable to delete the guidance');
            return guidance;
          }

          // Mark the guidance group as dirty
          await markGuidanceGroupAsDirty(context, guidanceGroupId);

          return deleted;
        }

        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },
    // Add a user-selected affiliation for plan guidance
    addPlanGuidance: async (
      _,
      { planId, affiliationId },
      context: MyContext
    ): Promise<PlanGuidance> => {
      const reference = 'add plan guidance affiliation resolver';
      try {
        if (isAuthorized(context.token)) {
          const plan = await Plan.findById(reference, context, planId);
          if (!plan) {
            throw NotFoundError(`Plan with id ${planId} not found`);
          }

          const affiliation = await Affiliation.findByURI(reference, context, affiliationId.toString());
          if (!affiliation) {
            throw NotFoundError(`Affiliation with URI ${affiliationId} not found`);
          }

          const userId = context.token?.userId;
          if (!userId) {
            throw AuthenticationError();
          }

          const planGuidanceAffiliation = new PlanGuidance({
            planId,
            affiliationId,
            userId
          });

          const created = await planGuidanceAffiliation.create(context);
          if (created && !created.hasErrors()) {
            created.addError("general", "Unable to add plan guidance affiliation");
          } else {
            return await created.delete(context);
          }
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Remove a user-selected affiliation from plan guidance
    removePlanGuidance: async (
      _,
      { planId, affiliationId },
      context: MyContext
    ): Promise<PlanGuidance> => {
      const reference = 'remove plan guidance affiliation resolver';
      try {
        if (isAuthorized(context.token)) {
          const plan = await Plan.findById(reference, context, planId);
          if (!plan) {
            throw NotFoundError(`Plan with id ${planId} not found`);
          }

          const userId = context.token?.userId;
          if (!userId) {
            throw AuthenticationError();
          }

          const removed = await PlanGuidance.findByPlanUserAndAffiliation(
            reference,
            context,
            planId,
            userId,
            affiliationId.toString()
          );

          if (removed && !removed.hasErrors()) {
            removed.addError("general", "Unable to remove");
          } else {
            return await removed.delete(context);
          }
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    }

  },

  Guidance: {
    // Chained resolver to fetch the GuidanceGroup for this Guidance
    guidanceGroup: async (parent: Guidance, _, context: MyContext): Promise<GuidanceGroup> => {
      return await GuidanceGroup.findById('Chained Guidance.guidanceGroup', context, parent.guidanceGroupId);
    },
    // Chained resolver to fetch the Tag info for guidance's tagId
    tag: async (parent: Guidance, _, context: MyContext): Promise<Tag> => {
      return await Tag.findById('Chained Guidance.tags', context, parent.tagId);
    },
    created: (parent: Guidance) => {
      return normaliseDateTime(parent.created);
    },
    modified: (parent: Guidance) => {
      return normaliseDateTime(parent.modified);
    },
    // Resolver to get the user who last modified this guidance
    modifiedBy: async (parent: Guidance, _, context: MyContext): Promise<User | null> => {
      if (parent?.modifiedById) {
        return await User.findById('Guidance user resolver', context, parent.modifiedById);
      }
      return null;
    },
  },
  PlanGuidance: {
    plan: async (parent: PlanGuidance, _, context: MyContext): Promise<Plan> => {
      if (parent?.planId) {
        return await Plan.findById('Chained PlanGuidanceAffiliation.plan', context, parent.planId);
      }
      return null;
    },
    affiliation: async (parent: PlanGuidance, _, context: MyContext): Promise<Affiliation> => {
      if (parent?.affiliationId) {
        return await Affiliation.findByURI('Chained PlanGuidanceAffiliation.affiliation', context, parent.affiliationId);
      }
      return null;
    },
    created: (parent: PlanGuidance) => {
      return normaliseDateTime(parent.created);
    },
    modified: (parent: PlanGuidance) => {
      return normaliseDateTime(parent.modified);
    }
  }
};

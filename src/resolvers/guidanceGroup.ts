import { Resolvers } from "../types.js";
import { MyContext } from "../context.js";
import { GuidanceGroup } from "../models/GuidanceGroup.js";
import { Guidance } from "../models/Guidance.js";
import { VersionedGuidanceGroup } from "../models/VersionedGuidanceGroup.js";
import { User } from "../models/User.js";
import { hasPermissionOnGuidanceGroup, publishGuidanceGroup, unpublishGuidanceGroup, markGuidanceGroupAsDirty } from "../services/guidanceService.js";
import { ForbiddenError, NotFoundError, AuthenticationError, InternalServerError } from "../utils/graphQLErrors.js";
import { isAdmin, isSuperAdmin } from "../services/authService.js";
import { prepareObjectForLogs } from "../logger.js";
import { GraphQLError } from "graphql";
import { normaliseDateTime } from "../utils/helpers.js";

// Add a small helper to avoid `any` casts when checking published state
export const hasPublishedFlag = (obj: unknown): boolean => {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as { latestPublishedDate?: unknown; published?: unknown };
  return Boolean(o.latestPublishedDate || o.published);
};

export const resolvers: Resolvers = {
  Query: {
    // Return all GuidanceGroups for the user's organization
    guidanceGroups: async (_, { affiliationId }, context: MyContext): Promise<GuidanceGroup[]> => {
      const reference = 'guidanceGroups resolver';
      try {
        // Require authentication
        const requester = context?.token;
        if (!requester) {
          throw AuthenticationError();
        }

        // Fetch all guidance groups for the affiliation
        const groups = await GuidanceGroup.findByAffiliationId(reference, context, affiliationId);

        // Determine once whether the requester can see ALL groups for this affiliation:
        // - Super-admin can see everything
        // - Admin for the target affiliation can see everything for that affiliation
        const canSeeAll = isSuperAdmin(requester) || (isAdmin(requester) && requester.affiliationId === affiliationId);

        if (canSeeAll) {
          return groups;
        }

        // Non-admin users or non-admins for group's affiliation: filter to published only
        const publishedOnly = groups.filter(g => {
          const isPublished = hasPublishedFlag(g);
          return isPublished;
        }) as GuidanceGroup[];

        return publishedOnly;
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Return a specific GuidanceGroup
    guidanceGroup: async (_, { guidanceGroupId }, context: MyContext): Promise<GuidanceGroup> => {
      const reference = 'guidanceGroup resolver';
      try {
        // Require authentication
        const requester = context?.token;
        if (!requester) {
          throw AuthenticationError();
        }

        const guidanceGroup = await GuidanceGroup.findById(reference, context, guidanceGroupId);

        if (!guidanceGroup) {
          throw NotFoundError('GuidanceGroup not found');
        }

        const isPublished = hasPublishedFlag(guidanceGroup);

        if (!isPublished) {
          // Unpublished: only admin-types with permission can view
          if (isAdmin(requester) && await hasPermissionOnGuidanceGroup(context, guidanceGroupId)) {
            return guidanceGroup;
          }
          throw ForbiddenError();
        }

        // Published: any authenticated user can view
        return guidanceGroup;
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    }
  },

  Mutation: {
    // Add a new GuidanceGroup
    addGuidanceGroup: async (
      _,
      { input: { affiliationId: tempAffiliationId, name, description, bestPractice, optionalSubset } },
      context: MyContext
    ): Promise<GuidanceGroup> => {
      const reference = 'addGuidanceGroup resolver';
      try {
        const requester = context.token;

        // Choose affiliationId:
        // - if requester is super-admin and provided affiliationId in input, use it
        // - otherwise use the requester's affiliationId (regular admins)
        const affiliationId = isSuperAdmin(requester) && tempAffiliationId
          ? tempAffiliationId
          : requester.affiliationId;

        if (!affiliationId) {
          throw new Error("affiliationId is required");
        }

        const guidanceGroup = new GuidanceGroup({
          affiliationId,
          name,
          description,
          bestPractice: bestPractice ?? false,
          optionalSubset: optionalSubset ?? false,
          createdById: requester.id,
          modifiedById: requester.id,
        });

        // Create the new guidance group
        const newGuidanceGroup = await guidanceGroup.create(context);

        // If the guidance group was not created, return the errors
        if (!newGuidanceGroup?.id) {
          if (!guidanceGroup.errors['general']) {
            guidanceGroup.addError('general', 'Unable to create the guidance group');
          }
          return guidanceGroup;
        }

        return newGuidanceGroup;
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Update an existing GuidanceGroup
    updateGuidanceGroup: async (
      _,
      { input: { guidanceGroupId, name, description, bestPractice, optionalSubset } },
      context: MyContext
    ): Promise<GuidanceGroup> => {
      const reference = 'updateGuidanceGroup resolver';
      try {
        if (isAdmin(context?.token) && await hasPermissionOnGuidanceGroup(context, guidanceGroupId)) {
          const guidanceGroup = await GuidanceGroup.findById(reference, context, guidanceGroupId);

          if (!guidanceGroup) {
            throw NotFoundError('GuidanceGroup not found');
          }

          // Update the fields
          if (name !== undefined) guidanceGroup.name = name;
          if (description !== undefined) guidanceGroup.description = description;
          if (bestPractice !== undefined) guidanceGroup.bestPractice = bestPractice;
          if (optionalSubset !== undefined) guidanceGroup.optionalSubset = optionalSubset;

          guidanceGroup.modifiedById = context.token.id;

          // Save the updates
          const updated = await guidanceGroup.update(context);

          if (!updated?.id) {
            if (!guidanceGroup.errors['general']) {
              guidanceGroup.addError('general', 'Unable to update the guidance group');
            }
            return guidanceGroup;
          }

          // Mark the guidance group as dirty if it has an active version
          await markGuidanceGroupAsDirty(context, guidanceGroupId);

          return updated;
        }

        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Delete a GuidanceGroup
    removeGuidanceGroup: async (
      _,
      { guidanceGroupId },
      context: MyContext
    ): Promise<GuidanceGroup> => {
      const reference = 'removeGuidanceGroup resolver';
      try {
        if (isAdmin(context?.token) && await hasPermissionOnGuidanceGroup(context, guidanceGroupId)) {
          const guidanceGroup = await GuidanceGroup.findById(reference, context, guidanceGroupId);

          if (!guidanceGroup) {
            throw NotFoundError('GuidanceGroup not found');
          }

          const deleted = await guidanceGroup.delete(context);

          if (!deleted) {
            guidanceGroup.addError('general', 'Unable to delete the guidance group');
            return guidanceGroup;
          }

          return deleted;
        }

        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Publish a GuidanceGroup
    publishGuidanceGroup: async (
      _,
      { guidanceGroupId },
      context: MyContext
    ): Promise<GuidanceGroup> => {
      const reference = 'publishGuidanceGroup resolver';
      try {
        if (isAdmin(context?.token) && await hasPermissionOnGuidanceGroup(context, guidanceGroupId)) {
          const guidanceGroup = await GuidanceGroup.findById(reference, context, guidanceGroupId);

          if (!guidanceGroup) {
            throw NotFoundError('GuidanceGroup not found');
          }

          const published = await publishGuidanceGroup(context, guidanceGroup);

          if (!published) {
            guidanceGroup.addError('general', 'Unable to publish the guidance group');
            return guidanceGroup;
          }

          // Return the updated guidance group
          return await GuidanceGroup.findById(reference, context, guidanceGroupId);
        }

        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // Unpublish a GuidanceGroup
    unpublishGuidanceGroup: async (
      _,
      { guidanceGroupId },
      context: MyContext
    ): Promise<GuidanceGroup> => {
      const reference = 'unpublishGuidanceGroup resolver';
      try {
        if (isAdmin(context?.token) && await hasPermissionOnGuidanceGroup(context, guidanceGroupId)) {
          const guidanceGroup = await GuidanceGroup.findById(reference, context, guidanceGroupId);

          if (!guidanceGroup) {
            throw NotFoundError('GuidanceGroup not found');
          }

          const unpublished = await unpublishGuidanceGroup(context, guidanceGroup);

          if (!unpublished) {
            guidanceGroup.addError('general', 'Unable to unpublish the guidance group');
            return guidanceGroup;
          }

          return guidanceGroup;
        }

        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },
  },

  GuidanceGroup: {
    // Chained resolver to fetch the Guidance items for this GuidanceGroup
    guidance: async (parent: GuidanceGroup, _, context: MyContext): Promise<Guidance[]> => {
      return await Guidance.findByGuidanceGroupId('Chained GuidanceGroup.guidance', context, parent.id);
    },
    created: (parent: GuidanceGroup) => {
      return normaliseDateTime(parent.created);
    },
    modified: (parent: GuidanceGroup) => {
      return normaliseDateTime(parent.modified);
    },
    latestPublishedDate: (parent: GuidanceGroup) => {
      return normaliseDateTime(parent.latestPublishedDate);
    },
    // Resolver to get the user who last modified this guidance
    modifiedBy: async (parent: GuidanceGroup, _, context: MyContext): Promise<User | null> => {
      if (parent?.modifiedById) {
        return await User.findById('GuidanceGroup user resolver', context, parent.modifiedById);
      }
      return null;
    },
    // Get the VersionedGuidanceGroups for this GuidanceGroup
    versionedGuidanceGroup: async (parent: GuidanceGroup, _, context: MyContext): Promise<VersionedGuidanceGroup[] | null> => {
      return await VersionedGuidanceGroup.findByGuidanceGroupId('Chained GuidanceGroupversionedGuidanceGroup', context, parent.id);
    },
  }
};

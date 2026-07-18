import { Resolvers } from "../types";
import { MyContext } from "../context";
import { VersionedQuestionCondition } from "../models/VersionedQuestionCondition";
import { VersionedQuestionConditionGroup } from "../models/VersionedQuestionConditionGroups";
import { AuthenticationError, ForbiddenError, InternalServerError } from "../utils/graphQLErrors";
import { prepareObjectForLogs } from "../logger";
import { isAuthorized } from "../services/authService";
import { GraphQLError } from "graphql";
import { normaliseDateTime } from "../utils/helpers";

export const resolvers: Resolvers = {
  Query: {
    // return all forcibly published condition groups (and their nested
    // conditions) for the specified versioned question
    publishedConditionGroupsForQuestion: async (_, { versionedQuestionId }, context: MyContext): Promise<VersionedQuestionConditionGroup[]> => {
      const reference = 'publishedConditionGroupsForQuestion resolver';
      try {
        if (isAuthorized(context.token)) {
          return await VersionedQuestionConditionGroup.findByVersionedQuestionId(reference, context, versionedQuestionId);
        }
        // Unauthorized!
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },
  },

  VersionedQuestionConditionGroup: {
    conditions: async (parent: VersionedQuestionConditionGroup, _, context: MyContext) => {
      return await VersionedQuestionCondition.findByVersionedQuestionConditionGroupId(
        'VersionedQuestionConditionGroup.conditions resolver',
        context,
        parent.id
      );
    },
    created: (parent: VersionedQuestionConditionGroup) => {
      return normaliseDateTime(parent.created);
    },
    modified: (parent: VersionedQuestionConditionGroup) => {
      return normaliseDateTime(parent.modified);
    }
  },

  VersionedQuestionCondition: {
    created: (parent: VersionedQuestionCondition) => {
      return normaliseDateTime(parent.created);
    },
    modified: (parent: VersionedQuestionCondition) => {
      return normaliseDateTime(parent.modified);
    }
  },
};
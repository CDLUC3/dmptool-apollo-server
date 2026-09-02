
import { prepareObjectForLogs } from '../logger.js';
import { Resolvers } from "../types.js";
import { ResearchOutputType } from "../models/ResearchOutputType.js";
import { MyContext } from '../context.js';
import { isSuperAdmin } from '../services/authService.js';
import {
  AuthenticationError,
  ForbiddenError,
  InternalServerError,
  NotFoundError
} from '../utils/graphQLErrors.js';
import { GraphQLError } from 'graphql';
import { isNullOrUndefined, normaliseDateTime } from "../utils/helpers.js";

export const resolvers: Resolvers = {
  Query: {
    // returns an array of all research output types
    defaultResearchOutputTypes: async (_, __, context: MyContext): Promise<ResearchOutputType[]> => {
      const reference = 'ResearchOutputTypes resolver';
      try {
        return await ResearchOutputType.all(reference, context);
      } catch (err) {
        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // returns a research output type that matches the specified ID
    researchOutputType: async (_, { id }, context: MyContext): Promise<ResearchOutputType> => {
      const reference = 'ResearchOutputTypeById resolver';
      try {
        return await ResearchOutputType.findById(reference, context, id);
      } catch (err) {
        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // returns the research output type that matches the specified name
    researchOutputTypeByName: async (_, { name }, context: MyContext): Promise<ResearchOutputType> => {
      const reference = 'ResearchOutputTypeByURL resolver';
      try {
        const value = ResearchOutputType.nameToValue(name);
        return await ResearchOutputType.findByValue(reference, context, value);
      } catch (err) {
        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },
  },

  Mutation: {
    // add a new ResearchOutputType
    addResearchOutputType: async (_, { name, description }, context) => {
      const reference = 'addResearchOutputType resolver';
      try {
        // If the current user is a superAdmin or an Admin and this is their Affiliation
        if (isSuperAdmin(context.token)) {
          const outputType = new ResearchOutputType({ name, description });
          return await outputType.create(context);
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // update an existing ResearchOutputType
    updateResearchOutputType: async (_, { id, name, description }, context) => {
      const reference = 'updateResearchOutputType resolver';
      try {
        // If the current user is a superAdmin or an Admin and this is their Affiliation
        if (isSuperAdmin(context.token)) {
          const outputType = await ResearchOutputType.findById(reference, context, id);

          if (isNullOrUndefined(outputType)) {
            throw NotFoundError();
          }

          outputType.name = name;
          outputType.description = description;
          return outputType.update(context);
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // remove a ResearchOutputType
    removeResearchOutputType: async (_, { id }, context) => {
      const reference = 'removeResearchOutputType resolver';
      const original = await ResearchOutputType.findById(reference, context, id);
      try {
        // If the current user is a superAdmin or an Admin and this is their Affiliation
        if (isSuperAdmin(context.token)) {
          await original.delete(context);
          return original;
        }
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },
  },

  ResearchOutputType: {
    created: (parent: ResearchOutputType) => {
      return normaliseDateTime(parent.created);
    },
    modified: (parent: ResearchOutputType) => {
      return normaliseDateTime(parent.modified);
    }
  }
};

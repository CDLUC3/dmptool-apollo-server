import { Resolvers } from "../types";
import { ResearchDomain } from "../models/ResearchDomain";
import { MyContext } from '../context';
import { AuthenticationError, ForbiddenError, InternalServerError } from "../utils/graphQLErrors";
import { prepareObjectForLogs } from "../logger";
import { isAuthorized } from "../services/authService";
import { GraphQLError } from "graphql";
import { normaliseDateTime } from "../utils/helpers";

export const resolvers: Resolvers = {
  Query: {
    // return all of the top level research domains
    topLevelResearchDomains: async (_, __, context: MyContext): Promise<ResearchDomain[]> => {
      const reference = 'topLevelResearchDomains resolver';
      try {
        if (isAuthorized(context.token)) {
          return await ResearchDomain.topLevelDomains(reference, context);
        }
        // Unauthorized access
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // return all of the child research domains for the specified parent domain
    childResearchDomains: async (_, { parentResearchDomainId }, context: MyContext): Promise<ResearchDomain[]> => {
      const reference = 'childResearchDomains resolver';
      try {
        if (isAuthorized(context.token)) {
          return await ResearchDomain.findByParentId(reference, context, parentResearchDomainId);
        }
        // Unauthorized access
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    },

    // search for research domains by the specified URI
    researchDomainByURI: async (_, { uri }, context: MyContext): Promise<ResearchDomain> => {
      const reference = 'researchDomains resolver';
      try {
        if (isAuthorized(context.token)) {
          return await ResearchDomain.findByURI(reference, context, uri);
        }
        // Unauthorized access
        throw context?.token ? ForbiddenError() : AuthenticationError();
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(prepareObjectForLogs(err), `Failure in ${reference}`);
        throw InternalServerError();
      }
    }
  },
  ResearchDomain: {
    parentResearchDomain: async (parent: ResearchDomain, _, context: MyContext): Promise<ResearchDomain | null> => {
      if (parent.parentResearchDomainId) {
        return await ResearchDomain.findById('ResearchDomain.parentResearchDomain', context, parent.parentResearchDomainId);
      }
      return null;
    },
    created: (parent: ResearchDomain) => {
      return normaliseDateTime(parent.created);
    },
    modified: (parent: ResearchDomain) => {
      return normaliseDateTime(parent.modified);
    }
  },
};

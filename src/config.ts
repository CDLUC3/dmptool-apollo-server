import * as dotenv from 'dotenv';
import { addMocksToSchema } from '@graphql-tools/mock';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { ApolloServerPluginLandingPageDisabled } from '@apollo/server/plugin/disabled';

import { typeDefs } from './schema';
import { resolvers } from './resolver';
import { mocks } from './mocks';
import { loggerPlugin } from './plugins/logger';
import {Logger} from "pino";

dotenv.config();

// Base Apollo server configuration
function baseConfig() {
  // TODO: Could never really get the GraphQL MockStore working the way we wanted
  //       so we aren't using this, but leaving here in case we come back to it someday
  if (['true', '1'].includes(process.env?.USE_MOCK_DATA?.toString()?.toLowerCase())) {
    return {
      schema: addMocksToSchema({
        schema: makeExecutableSchema({ typeDefs, resolvers }),
        mocks,
        preserveResolvers: true
      }),
    };
  }
  // Otherwise use the normal resolvers connected to our data sources
  return { typeDefs, resolvers };
}

// Standard Apollo server configuration regardless of whether we are using mock data or not
export function serverConfig(logger: Logger, httpServer) {
  return  {
    ...baseConfig(),
    ...{
      plugins: [
        // The LoggerPlugin is used by Apollo server to record events in the request/response
        // lifecycle as well as handling any GraphQL errors
        loggerPlugin(logger),
        ApolloServerPluginDrainHttpServer({ httpServer }),
        // If we are in production disable the default Explorer landing page
        process.env.NODE_ENV === 'production'
          ? ApolloServerPluginLandingPageDisabled()
          : ApolloServerPluginLandingPageLocalDefault()
      ],
    }
  };
}

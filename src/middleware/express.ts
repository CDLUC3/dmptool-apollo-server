import { expressMiddleware } from '@as-integrations/express5';
import { JWTAccessToken } from '../services/tokenService.js';
import { buildContext } from '../context.js';
import { ApolloServer } from '@apollo/server';
import { Request } from 'express-jwt';
import { Logger } from "pino";
import { MySQLConnection } from "../datasources/mysql.js";
import { DMPHubAPI } from "../datasources/dmphubAPI.js";
import { EZIDAPI } from "../datasources/EZIDAPI.js";
import { OpenSearch } from "../datasources/openSearch.js";

/**
 * Attaches the Apollo Server middleware to the Express application.
 *
 * @param apolloServer The Apollo Server instance to attach to the Express app
 * @param cache The cache instance to be used in the context
 * @param logger The logger instance to be used in the context
 * @param sqlDataSource The MySQL data source instance to be used in the context
 * @param dmphubAPIDataSource The DMPHub API data source instance to be used in the context
 * @param ezidAPIDataSource The EZID API data source instance to be used in the context
 * @param openSearchServerlessDataSource The OpenSearch data source instance to be used in the context
 * @returns The Express middleware function for the Apollo Server
 */
export async function attachApolloServer(
  apolloServer: ApolloServer,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cache: any,
  logger: Logger,
  sqlDataSource: MySQLConnection,
  dmphubAPIDataSource: DMPHubAPI,
  ezidAPIDataSource: EZIDAPI,
  openSearchServerlessDataSource: OpenSearch
) {
  const context = buildContext(
    logger,
    cache,
    null,
    sqlDataSource,
    dmphubAPIDataSource,
    ezidAPIDataSource,
    openSearchServerlessDataSource,
  );
  context.logger.info({}, 'Attaching Apollo server');

  // Make sure we're able to establish a connection to the MySQL DB before continuing
  await sqlDataSource.validateConnection()

  // expressMiddleware accepts the same arguments:
  //   an Apollo Server instance and optional configuration options
  return expressMiddleware(apolloServer, {
    context: async ({ req }: { req: Request }) => {
      // Extract the token from the incoming request so we can pass it on to the resolvers
      return buildContext(
        logger,
        cache,
        req.auth as JWTAccessToken,
        sqlDataSource,
        dmphubAPIDataSource,
        ezidAPIDataSource,
        openSearchServerlessDataSource
      );
    },
  });
}

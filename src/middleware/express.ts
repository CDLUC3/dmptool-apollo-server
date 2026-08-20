import { expressMiddleware } from '@as-integrations/express5';
import { JWTAccessToken } from '../services/tokenService';
import { buildContext } from '../context';
import { ApolloServer } from '@apollo/server';
import { Request } from 'express-jwt';
import { Logger } from "pino";
import { MySQLConnection } from "../datasources/mysql";
import { DMPHubAPI } from "../datasources/dmphubAPI";
import { EZIDAPI } from "../datasources/EZIDAPI";
import { OpenSearch } from "../datasources/openSearch";

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

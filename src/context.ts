import { Logger } from 'pino';
import { DMPHubAPI } from './datasources/dmphubAPI.js';
import { EZIDAPI } from './datasources/EZIDAPI.js';
import { OpenSearch } from "./datasources/openSearch.js";
import { MySQLConnection, TransactionClient } from './datasources/mysql.js';
import { JWTAccessToken } from './services/tokenService.js';
import { randomHex } from './utils/helpers.js';
import { BaseContext } from "@apollo/server";
import { KeyvAdapter } from "@apollo/utils.keyvadapter";
import { initLogger, prepareObjectForLogs } from "./logger.js";
import { generalConfig } from "./config/generalConfig.js";
import {toErrorMessage} from "@dmptool/utils";

// The Apollo Server Context object passed in to the Resolver on each request
export interface MyContext extends BaseContext {
  // The cache
  cache: KeyvAdapter;
  // The caller's JSON Web Token
  token: JWTAccessToken | null;
  // An instance of the Logger
  logger: Logger;
  // A unique id that can be used to track all the log output for a single request
  requestId: string;
  // The active database transaction, if one is in progress
  activeTransaction?: TransactionClient;
  // Instances of the data sources the system uses to access information
  dataSources: {
    dmphubAPIDataSource: DMPHubAPI | null;
    ezidAPIDataSource: EZIDAPI | null;
    sqlDataSource: MySQLConnection | null;
    openSearchServerlessDataSource: OpenSearch | null;
  };
}

// This function should only be used when the caller is running a query from outside the
// Apollo Server GraphQL context. e.g. when calling signup or register
export function buildContext(
  logger: Logger,
  cache: KeyvAdapter,
  token: JWTAccessToken | null = null,
  sqlDataSource: MySQLConnection | null = null,
  dmphubAPIDataSource: DMPHubAPI | null = null,
  ezidAPIDataSource: EZIDAPI | null = null,
  openSearchServerlessDataSource: OpenSearch | null = null
): MyContext {

  try {
    const requestId: string = randomHex(32);
    const requestLogger: Logger = initLogger(
      logger,                                 // Base logger
      {
        app: generalConfig.applicationName || 'dmp',  // Help identify entries for this application
        env: generalConfig.env || 'dev',      // The current environment (not necessarily the Node env)
        requestId,                            // Unique id for the incoming GraphQL request
        jti: token?.jti,                      // The id of the JWT
        userId: token?.id,                    // The current user's id
      }
    );

    return {
      cache,
      token,
      logger: requestLogger,
      requestId,
      dataSources: {
        dmphubAPIDataSource: dmphubAPIDataSource,
        ezidAPIDataSource: ezidAPIDataSource,
        sqlDataSource: sqlDataSource,
        openSearchServerlessDataSource: openSearchServerlessDataSource,
      }
    }
  } catch (err) {
    const msg = `Unable to buildContext - ${toErrorMessage(err)}`;
    if (logger) {
      logger.error(prepareObjectForLogs({
        err,
        sqlDataSource,
        dmphubAPIDataSource,
        logger,
        cache,
        token
      }),
        msg);
    } else {
      console.log(msg);
    }
    throw err;
  }
}

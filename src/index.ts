import { Logger } from "pino";
import http, { Server } from 'http';
import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { ApolloServer } from '@apollo/server';
import { KeyvAdapter } from "@apollo/utils.keyvadapter";
import { logger } from './logger.js';
import { serverConfig } from './config.js';
import { healthcheck } from './controllers/healthcheck.js';
import { attachApolloServer } from './middleware/express.js';
import { setupRouter } from './router.js';
import { MySQLConnection } from './datasources/mysql.js';
import { Cache } from './datasources/cache.js';
import { verifyCriticalEnvVariable } from './utils/helpers.js';
import corsConfig from './config/corsConfig.js';
import { DMPHubAPI } from "./datasources/dmphubAPI.js";
import { EZIDAPI } from "./datasources/EZIDAPI.js";
import { OpenSearch } from "./datasources/openSearch.js";
import { awsConfig } from "./config/awsConfig.js";
import { requireAuth, validateClaims } from "./middleware/auth.js";

verifyCriticalEnvVariable('NODE_ENV');
console.log(`DMPTool Apollo server backend starting in ${process.env.NODE_ENV} mode.`)

const PORT: number = process.env.PORT ? parseInt(process.env.PORT) : 4000;

// Establish the MySQL connection pool
const cache: KeyvAdapter = Cache.getInstance().adapter;
const sqlDataSource = new MySQLConnection();
const dmphubAPIDataSource = new DMPHubAPI({ cache });
const ezidAPIDataSource = new EZIDAPI({ cache });
const openSearchServerlessDataSource = new OpenSearch(awsConfig.opensearchServerless);

// Required logic for integrating with Express
const app: Express = express();
// Our httpServer handles incoming requests to our Express app.
const httpServer: Server = http.createServer(app);
const baseLogger: Logger = logger;

const apolloServer = new ApolloServer({
  cache,
  ...serverConfig(baseLogger, httpServer)
});

/**
 * Starts the Apollo server and Express application.
 * This function ensures that the MySQL connection pool is ready before starting the server.
 */
const startServer = async (): Promise<void> => {
  // Ensure the connection pool is ready
  await sqlDataSource.validateConnection();
  await apolloServer.start();

  // Health check endpoint (declare this BEFORE CORS definition due to AWS ALB limitations)
  app.get('/up', (_request: Request, response: Response): void => {
    healthcheck(apolloServer, response, logger)
  });

  // Express middleware for all requests (besides the healthcheck above)
  app.use(
    cookieParser(),
    cors(corsConfig()),
    express.urlencoded({ extended: false }),
    express.json({ limit: '50mb' }),
  )

  // GraphQL operations
  // Apollo server has its own built-in way of dealing with CSRF.
  //     See: https://www.apollographql.com/docs/router/configuration/csrf/
  // Use the authMiddleware to extract the token from the cookies and then Attach Apollo server
  app.use('/graphql', requireAuth, validateClaims, await attachApolloServer(
    apolloServer,
    cache,
    baseLogger,
    sqlDataSource,
    dmphubAPIDataSource,
    ezidAPIDataSource,
    openSearchServerlessDataSource,
  ));

  // Pass off to the Router for non-GraphQL requests
  app.use('/', setupRouter(baseLogger, cache, sqlDataSource, null));

  // Start the HTTP server
  httpServer.listen({ port: PORT }, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`GraphQL endpoint: http://localhost:${PORT}/graphql`)
  })
}

/**
 * Gracefully shuts down the server and closes the MySQL connection pool.
 * This function is called when the process receives a SIGINT or SIGTERM signal.
 */
const shutdown = async (): Promise<never> => {
  try {
    await sqlDataSource.close();
    process.exit(0);
  } catch (error) {
    console.log('Error shutting down server:', error);
    process.exit(1);
  }
};

// Attach the shutdown function to SIGINT and SIGTERM signals
if (!process.listeners('SIGINT').includes(shutdown)) {
  process.on('SIGINT', shutdown);
}
if (!process.listeners('SIGTERM').includes(shutdown)) {
  process.on('SIGTERM', shutdown);
}

// Start the server and handle any errors that occur during startup
startServer().catch((error: Error): never => {
  console.log('Error starting server:', error)
  process.exit(1);
});

export default app;

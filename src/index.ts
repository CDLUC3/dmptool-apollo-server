import { ApolloServer } from '@apollo/server';
import express from 'express';
import http from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { logger } from './logger';
import { serverConfig } from './config';
import { healthcheck } from './controllers/healthcheck';
import { attachApolloServer } from './middleware/express';
import { setupRouter } from './router';
import { MySQLConnection } from './datasources/mysql';
import { Cache } from './datasources/cache';
import { verifyCriticalEnvVariable } from './utils/helpers';
import corsConfig from './config/corsConfig';
import { authMiddleware } from './middleware/auth';
import { DMPHubAPI } from "./datasources/dmphubAPI";
import { validateShibKey } from "./middleware/sso";

verifyCriticalEnvVariable('NODE_ENV');
console.log(`DMPTool Apollo server backend starting in ${process.env.NODE_ENV} mode.`)

// Validate that the SHIB_PUBLIC_KEY is present and is a valid public key. Will
// terminate the process if it is not.
validateShibKey();

// TODO: Make this configurable and pass in as ENV variable
const PORT = 4000;

// Establish the MySQL connection pool
const cache = Cache.getInstance().adapter;
const sqlDataSource = new MySQLConnection();
const dmphubAPIDataSource = new DMPHubAPI({ cache, token: null })

// Required logic for integrating with Express
const app = express();
// Our httpServer handles incoming requests to our Express app.
const httpServer = http.createServer(app);
const baseLogger = logger;

const apolloServer = new ApolloServer({
  cache,
  ...serverConfig(baseLogger, httpServer)
});

const startServer = async () => {
  // Ensure the connection pool is ready
  await sqlDataSource.initPromise;
  await apolloServer.start();

  // Healthcheck endpoint (declare this BEFORE CORS definition due to AWS ALB limitations)
  app.get('/up', (_request, response) => healthcheck(apolloServer, response, logger));

  // Express middleware for all requests (besides the healthcheck above)
  app.use(
    cookieParser(),
    cors(corsConfig()),
    express.urlencoded({ extended: false }),
    express.json({ limit: '50mb' }),
  )

  // GraphQL operations
  // Apollo server has it's own built-in way of dealing with CSRF.
  //     See: https://www.apollographql.com/docs/router/configuration/csrf/
  // Use the authMiddleware to extract the token from the cookies and then Attach Apollo server
  app.use('/graphql', authMiddleware, await attachApolloServer(
    apolloServer,
    cache,
    baseLogger,
    sqlDataSource,
    dmphubAPIDataSource
  ));

  // Pass off to the Router for non-GraphQL requests
  app.use('/', setupRouter(baseLogger, cache, sqlDataSource, null));

  httpServer.listen({ port: 4000 }, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`GraphQL endpoint: http://localhost:${PORT}/graphql`)
  })
}

// Graceful shutdown
const shutdown = async () => {
  try {
    await sqlDataSource.close();
    process.exit(0);
  } catch (error) {
    console.log('Error shutting down server:', error);
    process.exit(1);
  }
};

if (!process.listeners('SIGINT').includes(shutdown)) {
  process.on('SIGINT', shutdown);
}
if (!process.listeners('SIGTERM').includes(shutdown)) {
  process.on('SIGTERM', shutdown);
}

startServer().catch((error) => {
  console.log('Error starting server:', error)
  process.exit(1);
});

export default app;

import express, { Response, Router, Request } from 'express';
import { authMiddleware } from './middleware/auth';
import { signinController } from './controllers/signinController';
import { signupController } from './controllers/signupController';
import { signoutController } from './controllers/signoutController';
import { ssoPassthruController } from "./controllers/ssoPassthruController";
import { ssoCallbackController } from "./controllers/ssoCallbackController";
import { csrfMiddleware } from './middleware/csrf';
import { refreshTokenController } from './controllers/refreshTokenController';
import { Logger } from "pino";
import { MySQLConnection } from "./datasources/mysql";
import { DMPHubAPI } from "./datasources/dmphubAPI";
import { KeyvAdapter } from "@apollo/utils.keyvadapter";

// Modify the express Request to allow it to include our context resources:
declare module 'express-serve-static-core' {
  interface Request {
    logger: Logger | null;
    cache: KeyvAdapter | null;
    sqlDataSource: MySQLConnection | null;
    dmphubAPIDataSource: DMPHubAPI | null;
  }
}

// Allow cache, logger and dataSources to be passed through
export function setupRouter(
  logger: Logger | null,
  cache: KeyvAdapter | null,
  sqlDataSource: MySQLConnection | null,
  dmphubAPIDataSource: DMPHubAPI | null,
): Router {
  const router = express.Router();

  router.use((req: Request, res: Response, next) => {
    if (logger) {
      logger.debug(`Router Layer Trace: ${req.method} ${req.path}`);
    }

    req.logger = logger;
    req.cache = cache;
    req.sqlDataSource = sqlDataSource;
    req.dmphubAPIDataSource = dmphubAPIDataSource;

    next();
  });

  // Support for acquiring an initial CSRF token
  router.get('/apollo-csrf',
    csrfMiddleware,
    (_req: Request, res: Response) => { res.status(200).send('ok'); }
  );

  // Support for user sign in/up - requires a valid CSRF token
  router.post('/apollo-signin',
    csrfMiddleware,
    async (req: Request, res: Response): Promise<void> => await signinController(req, res)
  );

  router.post('/apollo-signup',
    csrfMiddleware,
    async (req: Request, res: Response): Promise<void> => await signupController(req, res)
  );

  // Support for refreshing access tokens - requires a valid CSRF and Refresh token
  router.post('/apollo-refresh',
    csrfMiddleware,
    authMiddleware,
    async (req: Request, res: Response): Promise<void> => await refreshTokenController(req, res)
  );

  // Support for user sign out
  router.post('/apollo-signout',
    csrfMiddleware,
    authMiddleware,
    async (req: Request, res: Response): Promise<void> => await signoutController(req, res)
  );

  // SSO Passthrough to Shibboleth SP
  router.get('/sso',
    // TODO: Determine what middleware hooks we want

    // csrfMiddleware,
    // authMiddleware,
    async (req: Request, res: Response): Promise<void> => await ssoPassthruController(req, res)
  );

  // SSO Callback from Shibboleth SP
  router.get('/sso/callback/1234567890',
    // TODO: remove this because its just to verify our specific test SSO callback

    // authMiddleware
    async (req: Request, res: Response): Promise<void> => await ssoCallbackController(req, res)
  );

  // SSO Callback from Shibboleth SP
  router.get('/sso/callback/:id',
    // TODO: Determine what middleware hooks we want

    // authMiddleware
    async (req: Request, res: Response): Promise<void> => await ssoCallbackController(req, res)
  );

  return router;
}

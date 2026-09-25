import express, { Response as ExpressResponse, Router, Request, NextFunction } from 'express';
import { ssoPassthruController } from "./controllers/ssoPassthruController.js";
import { ssoCallbackController } from "./controllers/ssoCallbackController.js";
import { csrfMiddleware } from './middleware/csrf.js';
import { Logger } from "pino";
import { MySQLConnection } from "./datasources/mysql.js";
import { DMPHubAPI } from "./datasources/dmphubAPI.js";
import { KeyvAdapter } from "@apollo/utils.keyvadapter";
import { requireAuth, validateClaims } from "./middleware/auth.js";
import { generalConfig } from "./config/generalConfig.js";

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
  const router: Router = express.Router();

  router.use((req: Request, _res: ExpressResponse, next: NextFunction) => {
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
    // (_req: Request, res: Response): void => { res.status(200).send('ok'); }
    async (_req: Request, res: ExpressResponse): Promise<void> => {
      // Temporary proxy to the issuer until we update the other services to acquire
      // CSRF tokens directly from the auth service.
      const url = `${generalConfig.tokenIssuer}/csrf`;
      const response: Response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

console.log('CSRF TOKEN RESPONSE FROM AUTH SERVICE:', response?.headers);

      if (response.ok && response.headers?.get('X-CSRF-Token')) {
        const csrf: string | null = response.headers.get('X-CSRF-Token');
        if (csrf) {
          res.setHeader('Access-Control-Expose-Headers', 'X-CSRF-Token');
          res.setHeader('X-CSRF-Token', csrf);
          res.send(response);
        }
      } else {
        logger.error(
          { status: response.status, message: await response.text() },
          'ERROR FROM AUTH SERVICE - csrf:'
        );
        res.status(500).json({ error: 'Unable to acquire CSRF token from auth service' });
      }
    }
  );

  // Support for user sign in/up - requires a valid CSRF token
  router.post('/apollo-signin',
    csrfMiddleware,
    //async (req: Request, res: ExpressResponse): Promise<void> => await signinController(req, res)
    async (req: Request, res: ExpressResponse, next: NextFunction): Promise<void> => {
      // Temporary proxy to the issuer until we update the UI to call the auth
      // service directly for sign in/up.
      const url = `${generalConfig.tokenIssuer}/signin`;

console.log('SIGNING IN', url);
console.log('CSRF:', req.headers['x-csrf-token']);
console.log(req.body);

      const response: Response = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-CSRF-Token': req.headers['x-csrf-token'] as string
        },
        credentials: 'include', // 👈 Required to receive Set-Cookie headers
        body: JSON.stringify(req.body)
      });

console.log('SIGN IN RESPONSE FROM AUTH SERVICE:', response.headers);

      const json: { success: boolean, message: string } = await response.json();

      if (response.ok) {
        // Assign the new cookies from the issuer to the response if they exist
        const cookies: string[] = response.headers.getSetCookie
          ? response.headers.getSetCookie()
          : [response.headers.get('set-cookie')].filter(Boolean) as string[];

        if (cookies.length > 0) {
          res.setHeader('Set-Cookie', cookies);
        }
      } else {
        logger.error(
          { status: response.status, message: json.message },
          'ERROR FROM AUTH SERVICE - signin:'
        );
      }
      res.status(response.status).json(json);
      next();
    }
  );

  router.post('/apollo-signup',
    csrfMiddleware,
    // async (req: Request, res: ExpressResponse): Promise<void> => await signupController(req, res)
    async (req: Request, res: ExpressResponse, next: NextFunction): Promise<void> => {
      // Temporary proxy to the issuer until we update the UI to call the auth
      // service directly for sign in/up.
      const url = `${generalConfig.tokenIssuer}/signup`;
      const response: Response = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-CSRF-Token': req.headers['x-csrf-token'] as string
        },
        credentials: 'include', // 👈 Required to receive Set-Cookie headers
        body: JSON.stringify(req.body)
      });

     const json: { success: boolean, message: string } = await response.json();

      if (response.ok) {
        // Assign the new cookies from the issuer to the response if they exist
        const setCookieHeader = response.headers.get('set-cookie');
        if (setCookieHeader) {
          res.setHeader('set-cookie', setCookieHeader);
        }
      } else {
        logger.error(
          { status: response.status, message: json.message },
          'ERROR FROM AUTH SERVICE - signup:'
        );
        res.send(response.status).json(json);
      }
      next();
    }
  );

  // Support for refreshing access tokens - requires a valid CSRF and Refresh token
  router.post('/apollo-refresh',
    csrfMiddleware,
    requireAuth,
    validateClaims,
    // async (req: Request, res: ExpressResponse): Promise<void> => await refreshTokenController(req, res)
    async (req: Request, res: ExpressResponse, next: NextFunction): Promise<void> => {
      // Temporary proxy to the issuer until we update the UI to call the auth
      // service directly for refreshing tokens.
      const url = `${generalConfig.tokenIssuer}/refresh-token`;
      const response: Response = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-CSRF-Token': req.headers['x-csrf-token'] as string,
          'Cookie': req.headers['cookie'] || ''
        },
        credentials: 'include', // 👈 Required to receive Set-Cookie headers
        body: JSON.stringify(req.body)
      });

console.log('REFRESH EXISTING COOKIES:', req.headers['cookie']);

      const json: { success: boolean, message: string } = await response.json();

      if (response.ok) {

console.log('REFRESH RESPONSE FROM AUTH SERVICE:', response.headers);

        // Clear the old cookies from the response
        res.clearCookie('dmspt');
        res.clearCookie('dmspr');

        // Attach the new cookies from the issuer to the response if they exist
        const setCookieHeader = response.headers.get('set-cookie');
        if (setCookieHeader) {
          res.setHeader('set-cookie', setCookieHeader);
        }
      } else {
        logger.error(
          { status: response.status, message: json.message },
          'ERROR FROM AUTH SERVICE - refresh:'
        );
        res.send(response.status).json(json);
      }
      next();
    }
  );

  // Support for user sign out
  router.post('/apollo-signout',
    csrfMiddleware,
    requireAuth,
    validateClaims,
    // async (req: Request, res: ExpressResponse): Promise<void> => await signoutController(req, res)
    async (req: Request, res: ExpressResponse, next: NextFunction): Promise<void> => {
      // Temporary proxy to the issuer until we update the UI to call the auth
      // service directly for signing out.
      const url = `${generalConfig.tokenIssuer}/signout`;
      const response: Response = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-CSRF-Token': req.headers['x-csrf-token'] as string,
          'Cookie': req.headers['cookie'] || ''
        },
        body: JSON.stringify(req.body)
      });

      const json: { success: boolean, message: string } = await response.json();

console.log('SIGN OUT RESPONSE FROM AUTH SERVICE:', json);

      if (response.ok) {
        // Clear the old cookies from the response
        res.clearCookie('dmspt');
        res.clearCookie('dmspr');
      } else {
        logger.error(
          { status: response.status, message: json.message },
          'ERROR FROM AUTH SERVICE - signout:'
        );
        res.send(response.status).json(json);
      }
      next();
    }
  );

  // SSO Passthrough to Shibboleth SP
  router.get('/sso',
    // TODO: Determine what middleware hooks we want

    // csrfMiddleware,
    // authMiddleware,
    async (req: Request, res: ExpressResponse): Promise<void> => await ssoPassthruController(req, res)
  );

  // SSO Callback from Shibboleth SP
  router.get('/sso/callback/1234567890',
    // TODO: remove this because its just to verify our specific test SSO callback

    // authMiddleware
    async (req: Request, res: ExpressResponse): Promise<void> => await ssoCallbackController(req, res)
  );

  // SSO Callback from Shibboleth SP
  router.get('/sso/callback/:id',
    // TODO: Determine what middleware hooks we want

    // authMiddleware
    async (req: Request, res: ExpressResponse): Promise<void> => await ssoCallbackController(req, res)
  );

  return router;
}

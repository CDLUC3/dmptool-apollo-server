import { Response as ExpressResponse, Request, NextFunction } from "express";
import { generalConfig } from "../config/generalConfig.js";

/**
 * Express middleware to validate the CSRF token for non-GET requests.
 * This middleware checks for the presence of a CSRF token in the request headers
 * and verifies it with the token issuer. If the token is missing or invalid, the
 * request is rejected with a 403 Forbidden response.
 *
 * @param req the Express request
 * @param res the Express response
 * @param next the next middleware function to call if the CSRF token is valid
 * @returns a promise that resolves when the middleware has completed its checks
 */
export async function csrfMiddleware(req: Request, res: ExpressResponse, next: NextFunction) {
  // Only worry about the CSRF token if the caller is performing a POST, PUT, PATCH, DELETE
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    const token = req.headers['x-csrf-token'] as string;
    if (!token) {
      return res.status(403).json({error: 'Missing CSRF token'});
    }

console.log('VALIDATING CSRF TOKEN:', token);

    // Contact the issuer to verify the CSRF token. The issuer will return a 200
    // status if the token is valid
    const response: Response = await fetch(`${generalConfig.tokenIssuer}/csrf/verify`, {
      method: 'POST',
      headers: {
        'X-CSRF-Token': token
      },
      body: JSON.stringify({token})
    });

console.log('VALIDATED CSRF', response);

    if (response.status !== 200) {
      return res.status(403).json({error: 'Invalid CSRF token'});
    } else {
      next(); // Token is valid, proceed to the next middleware or route handler
    }
  }
}

import { JwtPayload, Secret } from "jsonwebtoken";
import { NextFunction, Response as ExpressResponse } from 'express';
import { expressJwtSecret } from 'jwks-rsa';
import { expressjwt, IsRevoked, Request as JWTRequest } from "express-jwt";
import { generalConfig } from "../config/generalConfig.js";

/**
 * Callback function to check if a JWT token has been revoked.
 * This function checks the token's `jti` claim against a revocation list.
 * If the token is revoked, it returns true; otherwise, it returns false.
 *
 * @param _req the Express request object (not used in this function)
 * @param token the JWT payload to check for revocation
 * @returns a promise that resolves to true if the token is revoked, false otherwise
 */
const isRevokedCallback: IsRevoked = async (
  _req: JWTRequest,
  token: JwtPayload | undefined
): Promise<boolean> => {
  if (!token || !token.payload) {
    return true; // Revoke/reject if payload is missing
  }

  const payload: JwtPayload = typeof token.payload === 'string' ? JSON.parse(token.payload) : token.payload;
  const jti = payload.jti as string;
  if (!jti) {
    return true; // Revoke/reject if jti is missing
  }

  // Call the issuer's revocation check endpoint with the jti to see if it has been revoked
  const revocationCheckURL = `${generalConfig.tokenIssuer}//revocations/${jti}`;
  const response: Response = await fetch(revocationCheckURL);
  return response.status === 200 || response.status === 400;
}

/**
 * Express middleware to validate the custom claims in the JWT payload.
 * This middleware checks that the JWT payload contains the expected claims with
 * the correct types.
 *
 * If any claim is missing or has an invalid type, the request is rejected with
 * a 401 Unauthorized response.
 *
 * @param req the Express request object, which should have the JWT payload in `req.auth`
 * @param res the Express response object
 * @param next the next middleware function to call if the claims are valid
 */
export const validateClaims = (
  req: JWTRequest,
  res: ExpressResponse,
  next: NextFunction
) => {
  const payload: JwtPayload | undefined = req.auth;

  if (
    payload && (
      typeof payload.id !== 'string'
      || typeof payload.email !== 'string'
      || typeof payload.givenName !== 'string'
      || typeof payload.surName !== 'string'
      || typeof payload.affiliationId !== 'string'
      || typeof payload.languageId !== 'string'
      || typeof payload.role !== 'string'
      || typeof payload.jti !== 'string'
      || typeof payload.tokenVersion !== 'number')
  ) {

    return res.status(401).json({ error: 'Access token has invalid custom claims' });
  }

  next();
};

/**
 * Express middleware to require authentication using JWT tokens.
 * This middleware checks for a JWT token in the 'dmspt' cookie or the authorization header.
 *
 * If the token is valid, the request proceeds; otherwise, it is rejected with a
 * 401 Unauthorized response.
 */
export const requireAuth = expressjwt({
  secret: expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `${generalConfig.tokenIssuer}/jwks`,
  }) as unknown as Secret, // Type cast required for express-jwt secret compatibility
  audience: generalConfig.applicationName,
  issuer: generalConfig.tokenIssuer,
  algorithms: ['RS256'],
  credentialsRequired: false,
  isRevoked: isRevokedCallback
});

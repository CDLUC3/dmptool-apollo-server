import { v4 } from 'uuid';
import { createHash, timingSafeEqual } from 'crypto';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { Response } from "express";
import { logger, prepareObjectForLogs } from '../logger';
import { User } from '../models/User';
import { generalConfig } from '../config/generalConfig';
import { UserRole } from '../models/User';
import {
  AuthenticationError,
  DEFAULT_INTERNAL_SERVER_MESSAGE,
  DEFAULT_UNAUTHORIZED_MESSAGE,
  InternalServerError
} from '../utils/graphQLErrors';
import { Cache } from '../datasources/cache';
import { MyContext } from '../context';
import { defaultLanguageId } from '../models/Language';
import { KeyvAdapter } from "@apollo/utils.keyvadapter";

export interface JWTAccessToken extends JwtPayload {
  id: number,
  email: string,
  givenName: string,
  surName: string,
  role: string,
  affiliationId: string,
  languageId: string,
  jti: string,
 }

export interface JWTRefreshToken extends JwtPayload {
  jti: string,
  id: number,
}

// Hash a token before placing it in the cache
const hashToken = (token: string): string => {
  return createHash('sha256').update(`${token}${generalConfig.hashTokenSecret}`).digest('hex');
}

// Helper function to set a secure HTTP-only cookie
export const setTokenCookie = (res: Response, name: string, value: string, maxAge?: number): void => {
  res.cookie(name, value, {
    httpOnly: true,
    secure: !['test', 'development'].includes(process.env.NODE_ENV), // Use secure except in test and development
    maxAge: maxAge || generalConfig.jwtTTL,
    path: '/' // Ensure the cookie is accessible for the entire app
  });
};

// Generate a new CSRF token the session
export const generateCSRFToken = async (cache: KeyvAdapter): Promise<string> => {
  try {
    const csrfToken = v4().replace(/-/g, '').slice(0, generalConfig.csrfLength);
    const hashedToken = hashToken(csrfToken);

    // Add the refresh token to the Cache
    await cache.set(`{csrf}:${csrfToken}`, hashedToken, { ttl: generalConfig.csrfTTL });
    return csrfToken;
  } catch(err) {
    logger.error(err, 'generateCSRFToken error!');
    return null;
  }
}

// Generate an access token for the User
const generateAccessToken = async (context: MyContext, jti: string, user: User): Promise<string> => {
  const email = await user.getEmail(context);

  try {
    const payload: JWTAccessToken = {
      id: user.id,
      email,
      givenName: user.givenName,
      surName: user.surName,
      affiliationId: user.affiliationId,
      role: user.role.toString() || UserRole.RESEARCHER,
      languageId: user.languageId || defaultLanguageId,
      jti,
    };

    context.logger.debug(prepareObjectForLogs(payload), 'generateAccessToken payload');
    return jwt.sign(payload, generalConfig.jwtSecret as string, { expiresIn: generalConfig.jwtTTL });
  } catch(err) {
    if (context?.logger) {
      context.logger.error(prepareObjectForLogs(err), `generateAccessToken error`);
    }
    throw AuthenticationError(`${DEFAULT_UNAUTHORIZED_MESSAGE} - ${err.message}`);
  }
}

// Generate a refresh token for the User and add it to the Cache.
const generateRefreshToken = async (context: MyContext, jti: string, userId: number): Promise<string> => {
  try {
    const payload: JWTRefreshToken = {
      jti,
      id: userId,
    };

    const token = jwt.sign(payload, generalConfig.jwtRefreshSecret, { expiresIn: generalConfig.jwtRefreshTTL });
    const hashedToken = hashToken(token);

    // Add the refresh token to the Cache
    await context.cache.set(`{dmspr}:${jti}`, hashedToken, { ttl: generalConfig.jwtRefreshTTL })
    return token;
  } catch(err) {
    if (context?.logger) {
      context.logger.error(prepareObjectForLogs(err), 'generateRefreshToken error');
    }
    throw AuthenticationError(`${DEFAULT_UNAUTHORIZED_MESSAGE} - ${err.message}`);
  }
}

// Generate an Access Token and a Refresh Token
export const generateAuthTokens = async (context: MyContext, user: User): Promise<{ accessToken: string; refreshToken: string }> => {
  if (generalConfig.jwtSecret && generalConfig.jwtRefreshSecret && user && user.id && await user.getEmail(context)) {
    try {
      // Generate a unique id for the JWT
      const jti = `${user.id}-${new Date().getTime()}`;
      // Generate an Access Token
      const accessToken = await generateAccessToken(context, jti, user);

      // Generate a Refresh Token
      const refreshToken = await generateRefreshToken(context, jti, user.id);

      return { accessToken, refreshToken };
    } catch(err) {
      context.logger.error(prepareObjectForLogs(err), 'generateAuthTokens - unable to generate tokens');
    }
  }
  return { accessToken: null, refreshToken: null };
};

// Verify a CSRF Token
export const verifyCSRFToken = async (cache: KeyvAdapter, csrfToken: string): Promise<boolean> => {
  try {
    const storedHash = await cache.get(`{csrf}:${csrfToken}`);
    if (!storedHash) return false;

    const calculatedHash = hashToken(csrfToken);
    return timingSafeEqual(Buffer.from(storedHash), Buffer.from(calculatedHash));
  } catch(err) {
    logger.error(err, 'verifyCSRFToken failure');
    return false;
  }
}

// Verify the Incoming Access Token. The express-jwt middleware handles this in most circumstances
export const verifyAccessToken = (context: MyContext, accessToken: string): JwtPayload => {
  try {
    const now = new Date().getTime();
    const token = jwt.verify(accessToken, generalConfig.jwtSecret) as JwtPayload;

    // If the token could be verified and it has not expired
    if (token && (token.exp >= now / 1000)) {
      return token;
    }
  } catch(err) {
    context.logger.error(prepareObjectForLogs(err), 'verifyAccessToken error');
  }
  return null;
}

// Verify a Refresh Token
const verifyRefreshToken = async (context: MyContext, refreshToken: string): Promise<JWTRefreshToken> => {
  try {
    const token = jwt.verify(refreshToken, generalConfig.jwtRefreshSecret) as JWTRefreshToken;

    if (token) {
      // Make sure the token hasn't been tampered with
      const storedHash = await context.cache.get(`{dmspr}:${token.jti}`);
      const calculatedHash = hashToken(refreshToken);
      return timingSafeEqual(Buffer.from(storedHash), Buffer.from(calculatedHash)) ? token : null;
    }
    return null;
  } catch(err) {
    if (logger) {
      context.logger.error(prepareObjectForLogs(err), 'verifyRefreshToken error');
    }
    throw AuthenticationError(`${DEFAULT_UNAUTHORIZED_MESSAGE} - Invalid refresh token`);
  }
};

// See if the access token is in the black list of revoked tokens
export const isRevokedCallback = async (req: Express.Request, token?: jwt.Jwt): Promise<boolean> => {
  if (token && token.payload && typeof token.payload === 'object') {
    // Fetch the unique JTI from the token
    const jti = (token.payload as JwtPayload).jti;
    const cache = Cache.getInstance().adapter;

    if (jti) {
      try {
        // See if the JTI is in the black list
        if (await cache.get(`{dmspbl}:${jti}`)) {
          // We don't have access to the Apollo context here so log normally
          logger.warn(`Attempt to access revoked access token! jti: ${jti}`);
          return true;
        }
      } catch(err) {
        logger.error(err, 'isRevokedCallback - unable to fetch token from cache');
      }
    }
  }
  return false;
};

// Refresh the Access and Refresh Tokens
export const refreshAccessToken = async (
  context: MyContext,
  refreshToken: string,
): Promise<string> => {
  try {
    const verifiedRefreshToken = await verifyRefreshToken(context, refreshToken);
    if (verifiedRefreshToken) {
      // TODO: We can eventually add some checks here to see if the account if locked or deactivated
      const user = await User.findById('refreshAccessToken', context, verifiedRefreshToken.id);
      if (user) {
        return generateAccessToken(context, verifiedRefreshToken.jti, user);
      }
    }
    // Otherwise the refresh token was invalid or something else went wrong!
    throw AuthenticationError();
  } catch (err) {
    if (logger) {
      context.logger.error(prepareObjectForLogs(err), 'refreshAccessToken error');
    }
    throw AuthenticationError(err.message);
  }
};

// Invalidate the Refresh Token (e.g., on logout or token rotation)
export const revokeRefreshToken = async (context: MyContext, jti: string): Promise<boolean> => {
  try {
    await context.cache.delete(`{dmspr}:${jti}`);
    return true;
  } catch(err) {
    context.logger.error(prepareObjectForLogs(err), 'revokeRefreshToken - unable to delete token from cache');
    throw InternalServerError(`${DEFAULT_INTERNAL_SERVER_MESSAGE} - ${err.message}`);
  }
};

export const revokeAccessToken = async (context: MyContext, jti: string): Promise<boolean> => {
  try {
    await context.cache.set(`{dmspbl}:${jti}`, new Date().toISOString(), { ttl: generalConfig.jwtTTL });
    return true;
  } catch(err) {
    context.logger.error(prepareObjectForLogs(err), 'revokeAccessToken - unable to add token to black list');
    throw InternalServerError(`${DEFAULT_INTERNAL_SERVER_MESSAGE} - ${err.message}`);
  }
}

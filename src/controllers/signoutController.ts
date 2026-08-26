import { Request } from 'express-jwt';
import { Response } from 'express';
import { revokeAccessToken, revokeRefreshToken, verifyAccessToken } from '../services/tokenService.js';
import { prepareObjectForLogs } from '../logger.js';
import { buildContext } from '../context.js';

export const signoutController = async (req: Request, res: Response) => {
  const context = buildContext(
    req.logger,
    req.cache,
    null,
    req.sqlDataSource,
    req.dmphubAPIDataSource,
  );

  try {
    // For some reason req.auth is `undefined` here even though authMiddleware is called.
    // It's in req.cookies though :/
    const accessToken = req.cookies?.dmspt;

    if (accessToken) {
      const token = verifyAccessToken(context, accessToken);

      // Clear the old cookies from the response
      res.clearCookie('dmspt');
      res.clearCookie('dmspr');

      if (token && token.jti) {
        // Delete the refresh token from the cache
        if (await revokeRefreshToken(context, token.jti)) {
          // Add the access token to the black list so that token is immediately invalidated
          await revokeAccessToken(context, token.jti);
          res.status(200).json({});
        } else {
          res.status(500).json({ success: true, message: 'Unable to sign out at this time' });
        }
      } else {
        res.status(200).json({});
      }
    } else {
      res.status(200).json({});
    }
  } catch (err) {
    context.logger.error(prepareObjectForLogs(err), 'Sign out error');
    res.status(500).json({ error: 'An unexpected error occurred' });
  }
}

import { Response } from 'express';
import { Request } from 'express-jwt';
import { refreshAccessToken, setTokenCookie } from '../services/tokenService.js';
import { buildContext } from '../context.js';
import { prepareObjectForLogs } from '../logger.js';

export const refreshTokenController = async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.dmspr?.toString();

  if (refreshToken) {
    const context = buildContext(
      req.logger,
      req.cache,
      null,
      req.sqlDataSource,
      req.dmphubAPIDataSource,
    );

    try {
      const newAccessToken = await refreshAccessToken(context, refreshToken);

      if (newAccessToken) {
        // Set the new access token
        setTokenCookie(res, 'dmspt', newAccessToken);

        // Send the new access token to the client
        res.status(200).json({ success: true, message: 'ok' });
      } else {
        res.status(401).json({ success: false, message: 'Refresh token has expired' });
      }
    } catch (err) {
      context.logger.error(prepareObjectForLogs(err), 'refreshTokenController error');
      res.status(401).json({ success: false, message: 'Server error: unable to refresh tokens at this time' });
    }
  } else {
    res.status(401).json({ success: false, message: 'No refresh token available' });
  }
}

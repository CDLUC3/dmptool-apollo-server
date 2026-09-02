import { Request, Response } from 'express';
import { prepareObjectForLogs } from '../logger.js';
import { User } from '../models/User.js';
import { generateAuthTokens, setTokenCookie } from '../services/tokenService.js';
import { generalConfig } from '../config/generalConfig.js';
import { buildContext } from '../context.js';

export const signinController = async (req: Request, res: Response) => {
  const { email, ...userData } = req.body;
  const userIn = new User(userData);
  const context = buildContext(
    req.logger,
    req.cache,
    null,
    req.sqlDataSource,
    req.dmphubAPIDataSource,
  );

  try {
    const user = await userIn.login(context, email) || null;

    if (user) {
      const { accessToken, refreshToken } = await generateAuthTokens(context, user);

      // Record the login and generate the tokens
      if (accessToken && refreshToken) {
        // Set the tokens as HTTP only cookies
        setTokenCookie(res, 'dmspt', accessToken, generalConfig.jwtTTL);
        setTokenCookie(res, 'dmspr', refreshToken, generalConfig.jwtRefreshTTL);

        res.status(200).json({ success: true, message: 'ok' });
      } else {
        res.status(500).json({ success: false, message: 'Unable to sign in at this time' });
      }
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (err) {
    context.logger.error(prepareObjectForLogs(err), 'Sign in error');
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

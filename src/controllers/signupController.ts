import { Request, Response } from 'express';
import { prepareObjectForLogs } from '../logger.js';
import { User } from '../models/User.js';
import { generateAuthTokens, setTokenCookie } from '../services/tokenService.js';
import { generalConfig } from '../config/generalConfig.js';
import { buildContext } from '../context.js';
import { processOtherAffiliationName } from '../services/affiliationService.js';

export const signupController = async (req: Request, res: Response) => {
  const context = buildContext(
    req.logger,
    req.cache,
    null,
    req.sqlDataSource,
    req.dmphubAPIDataSource,
  );

  const props = req.body;

  let user: User = new User({
    password: props?.password,
    affiliationId: props?.affiliationId,
    givenName: props?.givenName,
    surName: props?.surName,
    acceptedTerms: props?.acceptedTerms,
  });

  try {
    user = await user.register(context, props?.email) || null;

    if (user) {
      if (user.hasErrors()) {
        res.status(400).json({ success: false, message: Object.values(user.errors).join(' | ') });
      } else {
        // If the affiliationId was not provided then create a new Affiliation using the otherAffiliationName
        if (!props?.affiliationId && props?.otherAffiliationName) {
          const affiliation = await processOtherAffiliationName(context, props.otherAffiliationName, user.id);

          if (!affiliation) {
            res.status(500).json({ success: false, message: 'Unable to create the new user affiliation at this time' });
          } else {
            // Need to reload here because the object returned by `register` does not have functions!
            const registeredUser = await User.findById('signupController', context, user.id);
            // Update the user's affiliationId with the new id
            registeredUser.affiliationId = affiliation.uri;
            await registeredUser.update(context);
          }
        }

        // Generate the tokens
        const { accessToken, refreshToken } = await generateAuthTokens(context, user);
        if (accessToken && refreshToken) {
          // Set the tokens as HTTP only cookies
          setTokenCookie(res, 'dmspt', accessToken, generalConfig.jwtTTL);
          setTokenCookie(res, 'dmspr', refreshToken, generalConfig.jwtRefreshTTL);

          res.status(201).json({ success: true, message: 'ok' });
        } else {
          res.status(500).json({ success: false, message: 'Unable to create the account at this time.' });
        }
      }
    } else {
      res.status(500).json({ success: false, message: 'Unable to register the account.' });
    }
  } catch (err) {
    context.logger.error(prepareObjectForLogs(err), 'Sign up error');
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

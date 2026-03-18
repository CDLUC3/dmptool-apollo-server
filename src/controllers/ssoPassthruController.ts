import { Request, Response } from "express";
import { buildContext } from "../context";
import { AffiliationEmailDomain } from "../models/AffiliationEmailDomain";
import { isNullOrUndefined } from "../utils/helpers";
import { prepareObjectForLogs } from "../logger";
import { Affiliation } from "../models/Affiliation";

// This is an endpoint that can be called to send a user to login to their
// institutional SSO via our Shibboleth SP
export const ssoPassthruController = async (req: Request, res: Response) => {
  // const { email, entityId } = req.body;
  const email = 'brian.riley@ucop.edu';
  const entityId = 'urn:mace:incommon:ucop.edu';

  const ref = 'ssoPassthruController';

  const context = buildContext(
    req.logger,
    req.cache,
    null,
    req.sqlDataSource,
    req.dmphubAPIDataSource,
  );

  try {
    const domain = email.split('@')[1];
    // If the domain could not be extracted from the email address
    // Return a Bad Request code
    if (isNullOrUndefined(domain)) {
      context.logger.error(prepareObjectForLogs({ email, entityId }), 'SSO Passthrough 400 error');
      res.status(400).json({ success: false, message: 'Invalid email address' });
    }

    const affilDomain = await AffiliationEmailDomain.findByDomain(ref, context, domain);
    const affiliation = await Affiliation.findByEntityId(ref, context, entityId);

    // If the email domain has no matching affiliation or the entityId specified does not match
    // Return a Forbidden code
    if (isNullOrUndefined(affilDomain)
      || isNullOrUndefined(affiliation)
      || affiliation.uri !== affilDomain.affiliationId ) {
      context.logger.error(prepareObjectForLogs({ email, entityId }), 'SSO Passthrough 403 error');
      res.status(403).json({ success: false, message: 'SSO is not available at this time.' });
    }

    // TODO: Add a function to the tokenService that generates a new SSO JWT
    //       It should be initialized with the incoming email, entityId, and affiliation.uri.
    //       The service should generate the sessionId.
    //       The service should stash the SSO JWT into the cache

    const sessionId = '1234567890';

    // TODO: Try the paths first, we may need to use the full URL though

    // This is the location of our Shibboleth SP's login endpoint
    // const shibURL = `https://${generalConfig.domain}/Shibboleth.sso/Login`;
    const shibURL = '/Shibboleth.sso/Login';

    // This is the location we want our Shibboleth SP to return to when its done
    // const targetURL = `https://${generalConfig.domain}/sso/callback/${sessionId}`;
    const targetURL = `/sso/callback/${sessionId}`;

    // Redirect the user to our Shibboleth SP
    res.status(301)
       .location(`${shibURL}?target=${encodeURIComponent(targetURL)}&entityId=${entityId}`)
       .send();

  } catch (err) {
    context.logger.error(prepareObjectForLogs({ email, entityId, err }), 'SSO Passthrough 500 error');
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

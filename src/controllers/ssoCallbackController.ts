import { Request, Response } from "express";
import { buildContext } from "../context";
import { prepareObjectForLogs } from "../logger";

// This is the entry point for SSO response information from our Shibboleth SP
export const ssoCallbackController = async (req: Request, res: Response) => {


console.log('ssoCallbackController PATH', req.path);
console.log('ssoCallbackController QUERY', req.query);
console.log('ssoCallbackController BODY', req.body);
console.log('ssoCallbackController HEADERS', req.headers);
console.log('ssoCallbackController COOKIES', req.cookies);
console.log('ssoCallbackController PARAMS', req.params);
console.log('ssoCallbackController SIGNED COOKIES', req.signedCookies);

const sessionId = req.cookies.find(cookie => cookie.name.startsWith('_shibsession_'))?.value;
console.log('ssoCallbackController PAYLOAD', {
  uid: req.headers['uid'] || req.headers['remote-user'],
  email: req.headers['mail'],
  displayName: req.headers['displayname'],
  sessionId
});

  const { email, entityId } = req.body;
  const ref = 'ssoCallbackController';

  const context = buildContext(
    req.logger,
    req.cache,
    null,
    req.sqlDataSource,
    req.dmphubAPIDataSource,
  );

  try {
    // TODO: Call the tokenService to fetch the SSO JWT associated with the sessionId
    //       We should be able to pass additional info from the req.headers (or req.body)
    //       We should ensure that the response came from the entityId we were expecting

    context.logger.error(
      prepareObjectForLogs({
        query: req.query,
        body: req.body,
        headers: req.headers
      }),
      `${ref} - Shibboleth SP callback response`
    );

    // TODO: Query the User table for the ssoId (eppn or uid in the Shib payload)
    //       If a user is found, call the tokenService to generate the access/refresh tokens
    //                           see the signinController for an example
    //       If not, add the SSO JWT to the cookies as `dmps`
    //               then redirect the user to the signup page

    res.status(301).location(`/`).send();

  } catch (err) {
    context.logger.error(prepareObjectForLogs({ email, entityId, err }), 'SSO Passthrough 500 error');
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

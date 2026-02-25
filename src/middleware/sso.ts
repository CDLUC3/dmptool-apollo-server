import { constants, createPublicKey, verify } from "crypto";
import { Response, Request, NextFunction } from "express";
import { logger } from "../logger";

// Use environment variables for the Public Key in ECS
const publicKey = process.env.SHIB_PUBLIC_KEY;

/**
 * Validates the Shibboleth public key. Should be called on app initialization.
 */
export const validateShibKey = (): void => {
  // Skip this if we are not in the AWS environment
  if (['development', 'test'].includes(process.env.NODE_ENV)) return;

  if (!publicKey) {
    logger.error("Critical Error: SHIB_PUBLIC_KEY environment variable is missing.");
    process.exit(1);
  }

  try {
    // This validates that the string is a valid PEM/SPKI/PKCS public key
    createPublicKey(publicKey);
    logger.info('Shibboleth Public Key successfully loaded and validated.');
  } catch (err) {
    logger.error({ err }, 'Crypto failed to validate the Shibboleth public key:');

    // Useful for debugging S3 newline issues
    if (!publicKey.includes('\n')) {
      logger.warn('HINT: The key contains no newlines. Check if S3 upload stripped them.');
    }

    process.exit(1);
  }
}

/**
 * Middleware to verify the Shibboleth headers.
 *
 * @param req The Express request object.
 * @param res The Express response object.
 * @param next The Express next function.
 */
export const verifyShibbolethHeaders = (req: Request, res: Response, next: NextFunction) => {
  if (!publicKey) {
    logger.error("Critical Error: SHIB_PUBLIC_KEY environment variable is missing.");
    return res.status(500).send("Server Configuration Error");
  }

  // Get the shibboleth headers
  const signature = req.get('x-shib-signature');
  const timestamp = req.get('x-shib-timestamp');
  const payloadHeaders = [
    req.get('remote-user'),
    req.get('shib-ep-principalname'),
    timestamp
  ];

  // Make sure we have all the required headers
  if (!signature || !timestamp || payloadHeaders.includes(undefined)) {
    logger.warn(`Incomplete Shibboleth data from IP: ${req.ip}`);
    return res.status(401).json({ error: 'Incomplete Shibboleth data' });
  }

  // Check the timestamp to prevent replay attacks
  const requestTime = parseInt(timestamp, 10);
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - requestTime) > 300) {
    logger.warn(`Stale Shibboleth signature attempt from IP: ${req.ip}`);
    return res.status(401).json({ error: 'Stale signature' });
  }

  // Reconstruct the Shibboleth payload
  const dataToVerify = payloadHeaders.join('|');

  try {
    // Verify the signature using the Shibboleth public key
    const isValid = verify(
      "sha256",
      Buffer.from(dataToVerify),
      {
        key: publicKey,
        padding: constants.RSA_PKCS1_PSS_PADDING, // Match your SP's padding
      },
      Buffer.from(signature, 'base64')
    );

    if (isValid) return next();

    logger.warn(`Invalid Shibboleth signature attempt from IP: ${req.ip}`);
    res.status(403).send('Signature verification failed');
  } catch (err) {
    logger.error(`Error verifying Shibboleth signature: ${err}`);
    res.status(500).send('Internal Security Error');
  }
};

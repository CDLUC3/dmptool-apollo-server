import { Logger } from "pino";
import { getPresignedURL } from '@dmptool/utils';
import { awsConfig } from "../config/awsConfig";

/**
 * Generate a presigned URL so that an Affiliation logo can be uploaded to our
 * CloudFront CDN S3 bucket.
 *
 * @param logger the Pino logger
 * @param affiliationURI the URI of the Affiliation
 * @param fileName the name of the file being uploaded (e.g. logo.png)
 * @returns the presigned URL
 */
export const getPresignedURLForAffiliationLogo = async(
  logger: Logger,
  affiliationURI: string,
  fileName: string,
): Promise<string> => {
  const bucket = awsConfig.s3.bucket;

  try {
    const uri = URL.parse(affiliationURI);
    const logoKey = `logos/${uri.pathname}/${Date.now()}-${fileName}`;

    const presignedURL: string = await getPresignedURL(
      logger,
      bucket,
      logoKey,
      true,
      awsConfig.region || 'us-west-2'
    );
    logger.debug({ affiliationURI, fileName, bucket, presignedURL }, 'Generated presigned URL');
    return presignedURL();
  } catch (err) {
    logger.error({ affiliationURI, fileName, bucket, err }, 'Unable to generate presigned URL for S3.');
  }
}

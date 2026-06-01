import { Logger } from "pino";
import { getPresignedURLForImageUpload } from '@dmptool/utils';
import { awsConfig } from "../config/awsConfig";

/**
 * Generate a presigned URL so that an Affiliation logo can be uploaded to our
 * CloudFront CDN S3 bucket.
 *
 * @param logger the Pino logger
 * @param affiliationURI the URI of the Affiliation
 * @param fileName the name of the file being uploaded (e.g. logo.png)
 * @param contentType the content type of the file being uploaded
 * @returns the presigned URL
 */
export const getPresignedURLForAffiliationLogo = async(
  logger: Logger,
  affiliationURI: string,
  fileName: string,
  contentType = 'image/png'
): Promise<string> => {
  const bucket = awsConfig.s3.bucket;

  try {
    const uri = URL.parse(affiliationURI);
    const logoKey = `logos/${uri.pathname}/${Date.now()}-${fileName}`;

    const { url, fields }: { url: string, fields: string } = await getPresignedURLForImageUpload(
      logger,
      bucket,
      logoKey,
      contentType,
      awsConfig.region || 'us-west-2'
    );
    logger.debug({ affiliationURI, fileName, bucket, url, fields }, 'Generated presigned URL');
    return url;
  } catch (err) {
    logger.error({ affiliationURI, fileName, bucket, err }, 'Unable to generate presigned URL for S3.');
  }
}

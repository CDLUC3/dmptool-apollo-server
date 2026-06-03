import { Logger } from "pino";
import { getPresignedURLForImageUpload } from '@dmptool/utils';
import { awsConfig } from "../config/awsConfig";
import { generalConfig } from "../config/generalConfig";
import { v4 as uuidv4 } from "uuid";

/**
 * Sanitize a user provided fileName
 *
 * @param fileName the name of the file provided by the user
 * @returns the sanitized filename
 */
const sanitizeFileName = (fileName: string): string => {
  // Using the normalization standards from:
  //     https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize
  //
  // Use the `normalize` function with "NFD" to destructure characters like é into 'e' and the accent mark.
  // Then remove the accent mark characters u0300 - u036f.
  // Then replace any remaining non-alphanumeric, dots, hyphens, or underscores with underscores.
  // Then at the end, remove duplicate underscores, hyphens and dots
  let sanitizedFileName: string = fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/([._-])\1+/g, '$1');

  // If the above resulted in an empty name or all that is left is a single dot, dash or underscore character
  if (!sanitizedFileName || sanitizedFileName === '.' || sanitizedFileName === ''
    || sanitizedFileName === '-' || sanitizedFileName === '_') {
    sanitizedFileName = `logo-${uuidv4()}`;
  }

  // S3 has a key limit of 1024-bytes, so limit the size of the filename
  const MAX_FILENAME_LENGTH = 50;
  if (sanitizedFileName.length > MAX_FILENAME_LENGTH) {
    // Figure out if there's a dot (probably an extension that should be preserved)
    const lastDot: number = sanitizedFileName.lastIndexOf('.');
    if (lastDot !== -1) {
      const ext: string = sanitizedFileName.slice(lastDot);
      sanitizedFileName = sanitizedFileName.slice(0, MAX_FILENAME_LENGTH - ext.length) + ext;
    } else {
      sanitizedFileName = sanitizedFileName.slice(0, MAX_FILENAME_LENGTH);
    }
  }
  return sanitizedFileName;
}

/**
 * This application uses S3 to store some assets like Affiliation logos. Uploading
 * one of these assets is a three-step process.
 *
 * Step 1: Involves generation of a presigned URL that can be used to upload the file.
 *         This returns information about how the caller can upload the file directly to S3.
 *
 * Step 2: The caller uses the returned presigned URL and fields JSON object to upload the
 *         file directly to S3.
 *
 *         For example,
 *           const formData = new FormData();
 *
 *           // Append all the presigned fields first
 *           Object.entries(fields).forEach(([key, value]) => {
 *             formData.append(key, value);
 *           });
 *
 *           // Append the file LAST
 *           formData.append("file", file);
 *
 *           // Send the POST request to the URL
 *           const response = await fetch(url, {
 *             method: "POST",
 *             body: formData, // Do NOT set Content-Type header manually; let the set the multipart boundary
 *           });
 *
 * Step 3: The caller sends a mutation request to finalize the upload. This allows
 *         the caller to handle any errors that have occurred before we store
 *         the location of the newly uploaded object in the database.
 */

/**
 * The URL to the application's CDN (AWS Cloudfront distribution)
 */
export const CDN_BASE_URL: string = process.env.NODE_ENV === 'development'
  ? `https://${awsConfig.s3.bucket}.s3.${awsConfig.region}.amazonaws.com`
  : `https://cdn.${generalConfig.domain}`

/**
 * Generate a presigned URL so that an Affiliation logo can be uploaded to our
 * CloudFront CDN S3 bucket.
 *
 * @param logger the Pino logger
 * @param affiliationURI the URI of the Affiliation
 * @param fileName the name of the file being uploaded (e.g. logo.png)
 * @param contentType the content type of the file being uploaded
 * @returns the presigned URL and the fields expected in the POST body when uploading the file
 */
export const getPresignedURLForAffiliationLogo = async(
  logger: Logger,
  affiliationURI: string,
  fileName: string,
  contentType = 'image/png'
): Promise<{ url: string, fields: string } | undefined> => {
  const bucket = awsConfig.s3.bucket;

  try {
    const uri = URL.parse(affiliationURI);
    if (!uri) return undefined;

    const path = uri.pathname.startsWith('/') ? uri.pathname.slice(1) : uri.pathname;
    const sanitizedFileName = sanitizeFileName(fileName);
    const logoKey = `logos/${uri.host}/${path}/${sanitizedFileName}`;

    const { url, fields }: { url: string, fields: string } = await getPresignedURLForImageUpload(
      logger,
      bucket,
      logoKey,
      contentType,
      awsConfig.region || 'us-west-2'
    );
    logger.debug({ affiliationURI, fileName, bucket, url, fields }, 'Generated presigned URL');

    return { url, fields };
  } catch (err) {
    logger.error({ affiliationURI, fileName, bucket, err }, 'Unable to generate presigned URL for S3.');
    return undefined;
  }
}

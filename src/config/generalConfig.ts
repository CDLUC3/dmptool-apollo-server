import { verifyCriticalEnvVariable } from "../utils/helpers";

// Verify these critical variables on startup!
verifyCriticalEnvVariable('DOMAIN');
verifyCriticalEnvVariable('APP_NAME');
verifyCriticalEnvVariable('DEFAULT_AFFILIATION_URI');
verifyCriticalEnvVariable('DMP_ID_SHOULDER');
verifyCriticalEnvVariable('TOKEN_HASH_SECRET');
verifyCriticalEnvVariable('JWT_SECRET');
verifyCriticalEnvVariable('JWT_REFRESH_SECRET');

// Get the application environment code. This can differ from the NODE_ENV which bears special
// meaning for Node applictions. For example when we deploy to the AWS development environment,
// the NODE_ENV is `staging` but the APP_ENV is `dev`.
const env = process.env.APP_ENV || 'dev';

export const generalConfig = {
  restDataSourceCacheTtl: Number.parseInt(process.env.REST_DATA_SOURCE_CACHE_TTL) || 180,

  env,
  domain: process.env.DOMAIN,
  applicationName: env === 'prd' ? process.env.APP_NAME : `${process.env.APP_NAME} (${env})`,
  defaultAffiliatioURI: process.env.DEFAULT_AFFILIATION_URI,
  defaultSearchLimit: Number.parseInt(process.env.DEFAULT_SEARCH_LIMIT) || 20,
  maximumSearchLimit: Number.parseInt(process.env.MAXIMUM_SEARCH_LIMIT) || 100,

  dmpIdBaseURL: process.env.DMP_ID_BASE_URL || 'https://doi.org/',
  dmpIdShoulder: process.env.DMP_ID_SHOULDER,

  orcidBaseURL: process.env.ORCID_BASE_URL || 'https://orcid.org/',
  rorBaseURL: process.env.ROR_BASE_URL || 'https://ror.org/',

  bcryptSaltRounds: Number.parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10,

  hashTokenSecret: process.env.TOKEN_HASH_SECRET,

  // Number of hours before we consider a change a new version
  versionPlanAfter: Number.parseInt(process.env.VERSION_PLAN_AFTER) || 1,

  jwtSecret: process.env.JWT_SECRET,
  jwtTTL: Number.parseInt(process.env.JWT_TTL) || 1800000, // Default is 30 minutes (in milliseconds)
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  jwtRefreshTTL: Number.parseInt(process.env.JWT_REFRESH_TTL) || 86400000, // Default is 24 hours (in milliseconds)

  csrfLength: Number.parseInt(process.env.CSRF_LENGTH) || 32,
  csrfTTL: Number.parseInt(process.env.CSRF_TTL) || 3600, // Default is 1 hour
}

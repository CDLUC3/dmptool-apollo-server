import { verifyCriticalEnvVariable } from "../utils/helpers.js";
import { EnvironmentEnum } from "@dmptool/utils";

// Verify these critical variables on startup!
verifyCriticalEnvVariable('DOMAIN');
verifyCriticalEnvVariable('APP_NAME');
verifyCriticalEnvVariable('DEFAULT_AFFILIATION_URI');
verifyCriticalEnvVariable('DMP_ID_SHOULDER');
verifyCriticalEnvVariable('TOKEN_ISSUER');
verifyCriticalEnvVariable('TOKEN_AUDIENCES');
verifyCriticalEnvVariable('ACCESS_TOKEN_NAME');

// Get the application environment code. This can differ from the NODE_ENV which bears special
// meaning for Node applictions. For example when we deploy to the AWS development environment,
// the NODE_ENV is `staging` but the APP_ENV is `dev`.
const env: string = process.env.APP_ENV || 'dev';

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

  tokenIssuer: process.env.TOKEN_ISSUER || 'http://localhost:3000',
  tokenAudiences: process.env.TOKEN_AUDIENCES || 'http://localhost:3000',
  accessTokenName: process.env.ACCESS_TOKEN_NAME || 'access_token',

  // Number of hours before we consider a change a new version
  versionPlanAfter: Number.parseInt(process.env.VERSION_PLAN_AFTER) || 1,
}

/**
 * Converts the environment code to an EnvironmentEnum value.
 */
export const envAsEnumValue = (): EnvironmentEnum => {
  switch (generalConfig.env) {
    case 'stg':
      return EnvironmentEnum.STG;
    case 'prd':
      return EnvironmentEnum.PRD;
    default:
      return EnvironmentEnum.DEV;
  }
}

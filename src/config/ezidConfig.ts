import { verifyCriticalEnvVariable } from "../utils/helpers.js";

// Verify these critical variables on startup!
verifyCriticalEnvVariable('EZID_USERNAME');
verifyCriticalEnvVariable('EZID_PASSWORD');

export const EZIDConfig = {
  baseApiUrl: process.env.EZID_API_URL ?? 'https://ezid-stg.cdlib.org/',
  username: process.env.EZID_USERNAME,
  password: process.env.EZID_PASSWORD,
}

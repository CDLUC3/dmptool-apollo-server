import { verifyCriticalEnvVariable } from "../utils/helpers.js";

// Verify these critical variables on startup!
verifyCriticalEnvVariable('DMPHUB_AUTH_URL');
verifyCriticalEnvVariable('DMPHUB_API_CLIENT_ID');
verifyCriticalEnvVariable('DMPHUB_API_CLIENT_SECRET');

export const DMPHubConfig = {
  dmpHubAuthURL: process.env.DMPHUB_AUTH_URL,
  dmpHubURL: process.env.DMPHUB_API_BASE_URL,

  dmpHubProvenance: process.env.DMPHUB_PROVENANCE_IDENTIFIER ?? 'my_application',
  dmpHubClientId: process.env.DMPHUB_API_CLIENT_ID,
  dmpHubClientSecret: process.env.DMPHUB_API_CLIENT_SECRET,

  dmpHubCacheTTL: Number.parseInt(process.env.DMP_CACHE_TTL) ?? 86400, // Default is 24 hours (in seconds)
}
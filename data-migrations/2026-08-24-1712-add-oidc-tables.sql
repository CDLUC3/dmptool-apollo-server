-- This migration adds the necessary tables for OpenId Connect (OIDC) authentication
-- and authorization.

-- Table that stores the JSON Web Key Sets (JWKS) for OIDC authentication.
-- This table is used to store the public keys that are used to verify the
-- signatures of JWTs issued by the OIDC provider.
--
-- The `name` column is a unique identifier for the key set.
-- The `jwks` column stores the actual key set in JSON format.
DROP TABLE IF EXISTS authKeys;
CREATE TABLE IF NOT EXISTS authKeys (
  name VARCHAR(64) PRIMARY KEY,
  jwks JSON NOT NULL,
  created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The `oauth_clients` table stores the registered OAuth clients that can interact
-- with the OIDC provider.
DROP TABLE IF EXISTS oauthClients;
CREATE TABLE IF NOT EXISTS oauthClients (
  clientId VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  clientSecret VARCHAR(512) CHARACTER SET ascii COLLATE ascii_bin NULL,
  clientName VARCHAR(255) NULL,
  applicationType VARCHAR(32) NOT NULL DEFAULT 'web',
  tokenEndpointAuthMethod VARCHAR(64) NOT NULL DEFAULT 'client_secret_basic',
  grantTypes JSON NOT NULL,
  responseTypes JSON NOT NULL,
  requirePkce BOOLEAN NOT NULL DEFAULT TRUE,
  clientMetadata JSON NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The `oauth_client_redirect_uris` table stores the redirect URIs associated with
-- each OAuth client.
DROP TABLE IF EXISTS oauthClientRedirectUris;
CREATE TABLE IF NOT EXISTS oauthClientRedirectUris (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clientId VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  redirectUri VARCHAR(2048) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY oauth_client_redirect_uri_unique (clientId, redirectUri),
  CONSTRAINT oauth_client_redirect_uri_client_fk
  FOREIGN KEY (clientId) REFERENCES oauthClients(clientId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Polymorphic Table that stores the OIDC records for the OIDC provider (e.g. Grant,
-- AuthorizationCode, AccessToken, etc.).
--
-- The `model` column is used to identify the type of OIDC record (e.g., "AccessToken", "Grant", etc.).
-- The `id` column is used to uniquely identify the OIDC record within its model type.
-- The `payload` column stores the actual OIDC record in JSON format.
-- The `grant_id` column is used to associate the OIDC record with a specific grant.
-- The `uid` column is used to associate the OIDC record with a specific user id.
-- The `user_code` column is used to associate the OIDC record with a specific user code.
-- The `expires_at` column is used to store the expiration time of the OIDC record.
DROP TABLE IF EXISTS oidcRecords;
CREATE TABLE IF NOT EXISTS oidcRecords (
  model VARCHAR(64) NOT NULL,
  id VARCHAR(512) NOT NULL,
  payload JSON NOT NULL,
  grantId VARCHAR(512) NULL,
  uid VARCHAR(512) NULL,
  userCode VARCHAR(512) NULL,
  expiresAt DATETIME NULL,
  created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (model, id),
  INDEX oidc_grant_idx (model, grantId),
  INDEX oidc_uid_idx (model, uid),
  INDEX oidc_user_code_idx (model, userCode),
  INDEX oidc_expiry_idx (expiresAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

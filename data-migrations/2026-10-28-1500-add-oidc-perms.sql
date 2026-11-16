-- Table that stores the permissions/grants associated with the Oauth client.
-- These are used when a client uses client_credentials grant type to obtain an
-- access token. It determines what the client can do with the access token.
--
-- The `clientId` column is a foreign key that references the `clientId` column in the `oauthClients` table.
-- The `subject` column is a unique identifier for the subject (plans, templates, etc.) that the permission is associated with.
-- The `permission` column stores the actual permission in JSON format.
DROP TABLE IF EXISTS oauthClientPermissions;
CREATE TABLE IF NOT EXISTS oauthClientPermissions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clientId VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  subject VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  permission JSON NOT NULL,
  created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY oauth_client_subject_unique (clientId, subject),
  FOREIGN KEY (clientId) REFERENCES oauthClients(clientId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rename some OIDC columns to match the new naming convention
ALTER TABLE oauthClients
  CHANGE COLUMN requirePkce pkce TINYINT(1) NOT NULL,
  CHANGE COLUMN clientMetadata extraClientMetadata JSON NULL;

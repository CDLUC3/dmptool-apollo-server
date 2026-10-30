-- Adds a `is_service_account` column to the users table to indicate whether a
-- user is a service account or a regular user.

ALTER TABLE users
  ADD COLUMN isServiceAccount BOOLEAN NOT NULL DEFAULT FALSE;

-- Adds a `userId` column to the oauthClients table to associate each OAuth
-- client with its service account user.
ALTER TABLE oauthClients
  ADD COLUMN userId Int UNSIGNED NOT NULL,
  ADD CONSTRAINT `oauthClients_users_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE;

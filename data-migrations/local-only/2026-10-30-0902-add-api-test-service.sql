-- Add the OAuth account for the dmptool-api-tester
SET @default_super_id := (SELECT id FROM userEmails WHERE email = 'super@example.com');
SET @affiliation_ror := 'https://dmptool.org/dmptool-api-tester';

-- Add a new affiliation for the dmptool-api-tester service account
INSERT INTO `affiliations`
  (`uri`, `provenance`, `name`, `displayName`, `searchName`, `funder`,
   `fundrefId`, `homepage`, `acronyms`, `aliases`, `types`, `logoName`,
   `contactName`, `contactEmail`, `ssoEntityId`, `feedbackEnabled`,
   `feedbackMessage`, `feedbackEmails`, `managed`, `createdById`, `created`,
   `modifiedById`, `modified`)
VALUES
  (@affiliation_ror,
   'DMPTOOL', 'DMP Tool API Testing',
   'DMP Tool API Testing (api-test.dmptool.org)', '',
   0, NULL, 'http://dmptool.org/', '["DMP API"]',
   '[]', '["Archive"]', NULL, 'UC3 Helpdesk',
   'uc3@cdlib.org', NULL, false,
   '<p>Dear %{user_name},</p><p>"%{plan_name}" has been sent to your %{application_name} account administrator for feedback.</p><p>Please email %{organisation_email} with any questions about this process.</p>',
   '["uc3@cdlib.org"]', true, @default_super_id,
   NOW(), @default_super_id, NOW());

-- Add the service account user
INSERT INTO `users`
  (`givenName`, `surName`, `role`, `affiliationId`, `password`)
VALUES
  ('DMP Tool', 'API Tester', 'ADMIN', @affiliation_ror, REPLACE(UUID(), '-', ''));

SET @service_account_user := (SELECT id FROM users WHERE surName = 'API Tester' AND affiliationId = @affiliation_ror);

-- Add the service account user email
INSERT INTO `userEmails`
  (`userId`, `email`, `isPrimary`, `isConfirmed`, `created`, `createdById`, `modified`, `modifiedById`)
VALUES
  (@service_account_user, 'uc3@cdlib.org', 1, 1, NOW(), @service_account_user, NOW(), @service_account_user);

-- Add the service account
INSERT INTO `oauthClients`
  (clientId, clientSecret, clientName, userId, applicationType, grantTypes,
   responseTypes, requirePkce, active, created, modified)
VALUES
  (UUID(), UUID(), 'dmptool-api-tester',
   @service_account_user, 'web', '["client_credentials"]', '[]',
   0, 1, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP());

-- Add the OAuth account for the dmptool-api-tester
SET @default_super_id := (SELECT id FROM userEmails WHERE email = 'super@example.com');
SET @test_password = '$2b$10$IUEu4c.5FkQ.xVayI1IrKunPoSk3B4Wq3Cs5fPwjpM44lDXFTpaw6';
SET @affiliation_ror := (SELECT CONCAT('https://dmptool.org/', LEFT(REPLACE(UUID(), '-', ''), 12)) FROM dual);
SET @test_email_domain = 'example.com';

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

-- Add an admin account
INSERT INTO `users`
  (`givenName`, `surName`, `role`, `affiliationId`, `password`)
VALUES
  ('Playwright', 'Admin', 'ADMIN', @affiliation_ror, @test_password);

SET @service_account_admin := (SELECT id FROM users WHERE givenName = 'Playwright' AND role = 'ADMIN' AND affiliationId = @affiliation_ror);

-- Add an email for the admin account
INSERT INTO `userEmails`
  (`userId`, `email`, `isPrimary`, `isConfirmed`, `created`, `createdById`, `modified`, `modifiedById`)
VALUES
  (@service_account_admin, CONCAT('testadmin@', @test_email_domain), 1, 1, NOW(), @service_account_admin, NOW(), @service_account_admin);

-- Add a researcher account
INSERT INTO `users`
  (`givenName`, `surName`, `role`, `affiliationId`, `password`)
VALUES ('Playwright', 'Researcher', 'RESEARCHER', @affiliation_ror, @test_password);

SET @service_account_researcher := (SELECT id FROM users WHERE givenName = 'Playwright' AND role = 'RESEARCHER' AND affiliationId = @affiliation_ror);

-- Add an email for the researcher account
INSERT INTO `userEmails`
  (`userId`, `email`, `isPrimary`, `isConfirmed`, `created`, `createdById`, `modified`, `modifiedById`)
VALUES
  (@service_account_researcher, CONCAT('testresearcher@', @test_email_domain), 1, 1, NOW(), @service_account_researcher, NOW(), @service_account_researcher);

-- Add the OAuth Client account
INSERT INTO `oauthClients`
  (clientId, clientSecret, clientName, userId, applicationType, grantTypes,
   responseTypes, requirePkce, active, created, modified)
VALUES
  (UUID(), UUID(), 'dmptool-api-tester',
   @service_account_admin, 'web', '["client_credentials"]', '[]',
   0, 1, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP());

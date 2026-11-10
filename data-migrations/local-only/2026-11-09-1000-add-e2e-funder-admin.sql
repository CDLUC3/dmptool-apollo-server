-- Add a funder organization and an ADMIN account for it, used by the E2E template customization tests.
-- The funder admin publishes a public template that the "DMP Tool API Testing" admin can then customize,
-- because a template can't be customized by the organization that owns it
SET @default_super_id := (SELECT userId FROM userEmails WHERE email = 'super@example.com');
SET @test_password = '$2b$10$IUEu4c.5FkQ.xVayI1IrKunPoSk3B4Wq3Cs5fPwjpM44lDXFTpaw6';
SET @funder_affiliation_ror := (SELECT CONCAT('https://dmptool.org/', LEFT(REPLACE(UUID(), '-', ''), 12)) FROM dual);
SET @test_email_domain = 'example.com';

-- Add the funder organization
INSERT INTO `affiliations`
  (`uri`, `provenance`, `name`, `displayName`, `searchName`, `funder`,
   `fundrefId`, `homepage`, `acronyms`, `aliases`, `types`, `logoName`,
   `contactName`, `contactEmail`, `ssoEntityId`, `feedbackEnabled`,
   `feedbackMessage`, `feedbackEmails`, `managed`, `createdById`, `created`,
   `modifiedById`, `modified`)
VALUES
  (@funder_affiliation_ror,
   'DMPTOOL', 'DMP Tool API Testing Funder',
   'DMP Tool API Testing Funder (api-test.dmptool.org)', '',
   1, NULL, 'http://dmptool.org/', '["DMP API Funder"]',
   '[]', '["Government"]', NULL, 'UC3 Helpdesk',
   'uc3@cdlib.org', NULL, false,
   '<p>Dear %{user_name},</p><p>"%{plan_name}" has been sent to your %{application_name} account administrator for feedback.</p><p>Please email %{organisation_email} with any questions about this process.</p>',
   '["uc3@cdlib.org"]', true, @default_super_id,
   NOW(), @default_super_id, NOW());

-- Add the funder admin account. createdById and modifiedById must be set: records copied from the user (like the
-- default project member Apollo creates for a new project) fail validation when they're NULL.
-- isServiceAccount matches the other E2E test accounts (see 2026-11-03-1036-update-e2e-test-accounts.sql)
INSERT INTO `users`
  (`givenName`, `surName`, `role`, `affiliationId`, `password`, `isServiceAccount`, `createdById`, `modifiedById`)
VALUES
  ('Playwright', 'FunderAdmin', 'ADMIN', @funder_affiliation_ror, @test_password, 1, @default_super_id, @default_super_id);

SET @funder_admin := (SELECT id FROM users WHERE givenName = 'Playwright' AND surName = 'FunderAdmin' AND role = 'ADMIN' AND affiliationId = @funder_affiliation_ror);

-- Add an email for the funder admin account
INSERT INTO `userEmails`
  (`userId`, `email`, `isPrimary`, `isConfirmed`, `created`, `createdById`, `modified`, `modifiedById`)
VALUES
  (@funder_admin, CONCAT('testfunderadmin@', @test_email_domain), 1, 1, NOW(), @funder_admin, NOW(), @funder_admin);

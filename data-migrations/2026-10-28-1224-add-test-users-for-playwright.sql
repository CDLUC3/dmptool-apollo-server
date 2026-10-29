-- Add a Test Organization affiliation along with an ADMIN and a RESEARCHER user that
-- belong to it. These records are used by the Playwright integration tests.

SET @test_password = '$2b$10$IUEu4c.5FkQ.xVayI1IrKunPoSk3B4Wq3Cs5fPwjpM44lDXFTpaw6';

SET @test_affiliation_uri = 'https://dmptool.org/affiliations/532910';
SET @test_email_domain = 'example.com';

-- Create the test affiliation. The createdById/modifiedById are set to the test admin below
-- once that user exists
INSERT INTO `affiliations` (`uri`, `provenance`, `name`, `displayName`, `searchName`, `funder`, `acronyms`, `aliases`, `types`, `managed`, `createdById`, `created`, `modifiedById`, `modified`)
  VALUES (@test_affiliation_uri, 'DMPTOOL', 'Test Organization', 'Test Organization', 'Test Organization', 0, '[]', '[]', '["Education"]', true, 0, NOW(), 0, NOW());

-- Create an admin and a researcher for the test affiliation
INSERT INTO `users` (`givenName`, `surName`, `role`, `affiliationId`, `password`)
  VALUES ('Playwright', 'Admin', 'ADMIN', @test_affiliation_uri, @test_password);
INSERT INTO `userEmails` (`userId`, `email`, `isPrimary`, `isConfirmed`, `created`, `createdById`, `modified`, `modifiedById`)
  (SELECT id, CONCAT('testadmin@', @test_email_domain), 1, 1, NOW(), id, NOW(), id FROM users WHERE givenName = 'Playwright' AND surname = 'Admin');

INSERT INTO `users` (`givenName`, `surName`, `role`, `affiliationId`, `password`)
  VALUES ('Playwright', 'Researcher', 'RESEARCHER', @test_affiliation_uri, @test_password);
INSERT INTO `userEmails` (`userId`, `email`, `isPrimary`, `isConfirmed`, `created`, `createdById`, `modified`, `modifiedById`)
  (SELECT id, CONCAT('testresearcher@', @test_email_domain), 1, 1, NOW(), id, NOW(), id FROM users WHERE givenName = 'Playwright' AND surname = 'Researcher');

-- Fetch the id of the test admin and set it as the creator of the test affiliation
SET @test_admin_id := (SELECT userId FROM userEmails WHERE email = CONCAT('testadmin@', @test_email_domain));

UPDATE `affiliations` SET `createdById` = @test_admin_id, `modifiedById` = @test_admin_id
  WHERE `uri` = @test_affiliation_uri;

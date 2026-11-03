-- Update the test e2e user accounts so that they are OAuth service accounts

UPDATE users set isServiceAccount = 1
WHERE id IN (SELECT userId FROM userEmails
             WHERE email IN ('testadmin@example.com', 'testresearcher@example.com'));

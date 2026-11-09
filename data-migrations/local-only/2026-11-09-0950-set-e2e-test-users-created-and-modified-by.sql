-- Set createdById and modifiedById on the E2E test accounts added by 2026-10-30-0902-add-e2e-test-users.sql.
-- Records copied from the user (like the default project member Apollo creates for a new project) fail
-- validation when they're NULL. Only fills in values that are missing
SET @default_super_id := (SELECT userId FROM userEmails WHERE email = 'super@example.com');

UPDATE users
SET createdById = COALESCE(createdById, @default_super_id),
    modifiedById = COALESCE(modifiedById, @default_super_id)
WHERE id IN (SELECT userId FROM userEmails
             WHERE email IN ('testadmin@example.com', 'testresearcher@example.com'));

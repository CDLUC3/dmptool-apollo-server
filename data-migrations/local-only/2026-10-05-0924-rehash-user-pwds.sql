
-- Password hashing was moved to the auth service. This rehashes the original
-- default passwords for the sample user accounts to the new hash
-- (assuming the default `change-me` pepper is in place in the auth service).
UPDATE users SET password = '$2b$10$AmKLLPirBsaHhYdZ5DS1ieeEQ4h01SKFBzIsqncDx35IUoVIz9J1m'
WHERE id IN (
  SELECT userId FROM userEmails WHERE email IN (
    'super@example.com',
    'admin@example.com',
    'researcher@example.com',
    'api-tester@example.com',
    'admin@nsf.gov',
    'admin@nih.gov'
  )
);

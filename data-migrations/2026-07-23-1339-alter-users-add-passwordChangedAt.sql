ALTER TABLE users
ADD COLUMN passwordChangedAt timestamp NULL AFTER isArchived;
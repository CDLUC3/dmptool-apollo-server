-- Remove the logoURI column from the affiliation table, as it is now constructed
-- from the CDN URL and logoName (s3 key) within the resolver.
ALTER TABLE `affiliations` DROP COLUMN `logoURI`;

-- Add an isDefault flag to the Template and VersionedTemplate tables
ALTER TABLE `templates`
  ADD COLUMN `isDefault` TINYINT DEFAULT 0 AFTER `bestPractice`;

ALTER TABLE `versionedTemplates`
  ADD COLUMN `isDefault` TINYINT DEFAULT 0 AFTER `bestPractice`;

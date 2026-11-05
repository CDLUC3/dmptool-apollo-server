-- Add the affiliationId column to the plans table and create a foreign key
-- constraint to the affiliations table. The affiliationId column will be used to
-- associate a plan with the creator's affiliation
ALTER TABLE `plans`
  ADD COLUMN `affiliationId` VARCHAR(255) NULL AFTER `versionedTemplateId`,
  ADD CONSTRAINT `fk_plans_affiliationId`
    FOREIGN KEY (`affiliationId`)
    REFERENCES `affiliations` (`uri`);

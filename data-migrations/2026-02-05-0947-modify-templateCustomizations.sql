-- Add new columns to the templateCustomizations table to help track versioning and drift
ALTER TABLE templateCustomizations
  ADD COLUMN currentVersionedTemplateId INT UNSIGNED NOT NULL AFTER templateId,
  ADD COLUMN latestPublishedVersionId INT UNSIGNED DEFAULT NULL AFTER migrationStatus,
  ADD COLUMN latestPublishedDate timestamp NULL DEFAULT NULL AFTER latestPublishedVersionId,
  ADD COLUMN isDirty TINYINT(1) NOT NULL DEFAULT '1' AFTER migrationStatus,

  -- Update the status column length because 8 was too short for "PUBLISHED"
  MODIFY status VARCHAR(12) NOT NULL DEFAULT 'DRAFT',

  ADD CONSTRAINT `fk_templateCust_vtemplateId` FOREIGN KEY (`currentVersionedTemplateId`)
    REFERENCES `versionedTemplates` (`id`),

  -- Although this points to the id of a record in the versionedTemplateCustomizations table,
  -- we do not create a foreign key because it would create a circular reference.
  ADD INDEX `idx_templateCust_vCustId` (`latestPublishedVersionId`);

-- Remove some unneeded columns from versionedTemplateCustomizations
ALTER TABLE versionedTemplateCustomizations
  DROP FOREIGN KEY fk_vTemplateCust_priorId,
  DROP COLUMN priorVersionedTemplateId,
  DROP COLUMN status,

  -- Recreate uniqueness constraint (must recreate the affiliationId foreign key too)
  DROP FOREIGN KEY `fk_vTemplateCust_affiliationId`,
  DROP INDEX `unique_vTemplateCusts`,
  ADD UNIQUE KEY `unique_vTemplateCusts` (`active`,`templateCustomizationId`),
  ADD CONSTRAINT `fk_vTemplateCust_affiliationId2`
    FOREIGN KEY (`affiliationId`) REFERENCES `affiliations` (`uri`);

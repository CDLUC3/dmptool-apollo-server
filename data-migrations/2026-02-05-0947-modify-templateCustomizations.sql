-- Add new columns to the templateCustomizations table to help track versioning and drift
ALTER TABLE templateCustomizations
  ADD COLUMN currentVersionedTemplateId INT UNSIGNED NOT NULL AFTER templateId,
  ADD COLUMN latestPublishedVersionId INT UNSIGNED DEFAULT NULL AFTER migrationStatus,
  ADD COLUMN latestPublishedDate timestamp NULL DEFAULT NULL AFTER latestPublishedVersionId,
  ADD COLUMN isDirty TINYINT(1) NOT NULL DEFAULT '1' AFTER migrationStatus,

  ADD CONSTRAINT `fk_templateCust_vtemplateId` FOREIGN KEY (`currentVersionedTemplateId`)
    REFERENCES `versionedTemplates` (`id`),

  ADD CONSTRAINT `fk_templateCust_vcustId` FOREIGN KEY (`latestPublishedVersionId`)
    REFERENCES `versionedTemplateCustomizations` (`id`);

-- Remove some unneeded columns from versionedTemplateCustomizations
ALTER TABLE versionedTemplateCustomizations
  DROP FOREIGN KEY fk_vTemplateCust_priorId,
  DROP COLUMN priorVersionedTemplateId,
  DROP COLUMN status;

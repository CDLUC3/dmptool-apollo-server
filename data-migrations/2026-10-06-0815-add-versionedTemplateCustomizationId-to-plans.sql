ALTER TABLE `plans`
  ADD COLUMN `versionedTemplateCustomizationId` INT UNSIGNED NULL AFTER `versionedTemplateId`,
  ADD CONSTRAINT `fk_plans_vTemplateCustId`
    FOREIGN KEY (`versionedTemplateCustomizationId`)
    REFERENCES `versionedTemplateCustomizations` (`id`);
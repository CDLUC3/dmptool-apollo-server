-- Add sourceVersionedTemplateId field to templates table
-- This field tracks when a template was copied from a specific versioned template

ALTER TABLE `templates`
ADD COLUMN `sourceVersionedTemplateId` int unsigned DEFAULT NULL AFTER `sourceTemplateId`,
ADD KEY `sourceVersionedTemplateId` (`sourceVersionedTemplateId`),
ADD CONSTRAINT `templates_ibfk_5` FOREIGN KEY (`sourceVersionedTemplateId`) REFERENCES `versionedTemplates` (`id`) ON DELETE CASCADE;

-- Recreate the customization tables for sections and questions
DROP TABLE IF EXISTS versionedQuestionCustomizations;
DROP TABLE IF EXISTS versionedCustomQuestions;
DROP TABLE IF EXISTS versionedSectionCustomizations;
DROP TABLE IF EXISTS versionedCustomSections;
DROP TABLE IF EXISTS questionCustomizations;
DROP TABLE IF EXISTS customQuestions;
DROP TABLE IF EXISTS sectionCustomizations;
DROP TABLE IF EXISTS customSections;

CREATE TABLE `sectionCustomizations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `templateCustomizationId` int unsigned NOT NULL,
  `sectionId` int unsigned NOT NULL,
  `migrationStatus` varchar(8) NOT NULL DEFAULT 'OK',
  `guidance` text,
  `createdById` int unsigned NOT NULL,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedById` int unsigned NOT NULL,
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_sectionCusts` (`templateCustomizationId`,`sectionId`),
  KEY `fk_sectionCust_sectionId` (`sectionId`),
  CONSTRAINT `fk_sectionCust_sectionId` FOREIGN KEY (`sectionId`) REFERENCES `sections` (`id`),
  CONSTRAINT `fk_sectionCust_templateCustId` FOREIGN KEY (`templateCustomizationId`) REFERENCES `templateCustomizations` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `versionedSectionCustomizations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `versionedTemplateCustomizationId` int unsigned NOT NULL,
  `sectionCustomizationId` int unsigned NOT NULL,
  `versionedSectionId` int unsigned NOT NULL,
  `guidance` text,
  `createdById` int unsigned NOT NULL,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedById` int unsigned NOT NULL,
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_vSectionCusts` (`versionedTemplateCustomizationId`,`sectionCustomizationId`),
  KEY `fk_vSectionCust_sectionId` (`sectionCustomizationId`),
  KEY `fk_vSectionCust_currentId` (`versionedSectionId`),
  CONSTRAINT `fk_vSectionCust_currentId` FOREIGN KEY (`versionedSectionId`) REFERENCES `versionedSections` (`id`),
  CONSTRAINT `fk_vSectionCust_sectionId` FOREIGN KEY (`sectionCustomizationId`) REFERENCES `sectionCustomizations` (`id`),
  CONSTRAINT `fk_vSectionCust_templateCustId` FOREIGN KEY (`versionedTemplateCustomizationId`) REFERENCES `versionedTemplateCustomizations` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `questionCustomizations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `templateCustomizationId` int unsigned NOT NULL,
  `questionId` int unsigned NOT NULL,
  `migrationStatus` varchar(8) NOT NULL DEFAULT 'OK',
  `guidanceText` text,
  `sampleText` text,
  `createdById` int unsigned NOT NULL,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedById` int unsigned NOT NULL,
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_questionCusts` (`templateCustomizationId`,`questionId`),
  KEY `fk_qCust_questionId` (`questionId`),
  CONSTRAINT `fk_qCust_questionId` FOREIGN KEY (`questionId`) REFERENCES `questions` (`id`),
  CONSTRAINT `fk_qCust_templateCustId` FOREIGN KEY (`templateCustomizationId`) REFERENCES `templateCustomizations` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `versionedQuestionCustomizations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `versionedTemplateCustomizationId` int unsigned NOT NULL,
  `questionCustomizationId` int unsigned NOT NULL,
  `versionedQuestionId` int unsigned NOT NULL,
  `guidanceText` text,
  `sampleText` text,
  `createdById` int unsigned NOT NULL,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedById` int unsigned NOT NULL,
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_vQuestionCusts` (`versionedTemplateCustomizationId`,`questionCustomizationId`),
  KEY `fk_vQCust_questionId` (`questionCustomizationId`),
  KEY `fk_vQCust_currentId` (`versionedQuestionId`),
  CONSTRAINT `fk_vQCust_currentId` FOREIGN KEY (`versionedQuestionId`) REFERENCES `versionedQuestions` (`id`),
  CONSTRAINT `fk_vQCust_questionId` FOREIGN KEY (`questionCustomizationId`) REFERENCES `questionCustomizations` (`id`),
  CONSTRAINT `fk_vQCust_templateCustId` FOREIGN KEY (`versionedTemplateCustomizationId`) REFERENCES `versionedTemplateCustomizations` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `customSections` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `templateCustomizationId` int unsigned NOT NULL,
  `pinnedSectionType` VARCHAR(16) NULL,
  `pinnedSectionId` int unsigned NULL,
  `migrationStatus` varchar(8) NOT NULL DEFAULT 'OK',
  `name` varchar(255) NOT NULL,
  `introduction` text,
  `requirements` text,
  `guidance` text,
  `createdById` int unsigned NOT NULL,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedById` int unsigned NOT NULL,
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_customSecs_templateCustId` (`templateCustomizationId`),
  UNIQUE KEY `fk_vCustomSecs_pinnedSecId` (`templateCustomizationId`, `pinnedSectionType`, `pinnedSectionId`),
  CONSTRAINT `fk_customSecs_templateCustId` FOREIGN KEY (`templateCustomizationId`) REFERENCES `templateCustomizations` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `versionedCustomSections` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `versionedTemplateCustomizationId` int unsigned NOT NULL,
  `customSectionId` int unsigned NOT NULL,
  `pinnedVersionedSectionType` VARCHAR(16) NULL,
  `pinnedVersionedSectionId` int unsigned NULL,
  `name` varchar(255) NOT NULL,
  `introduction` text,
  `requirements` text,
  `guidance` text,
  `createdById` int unsigned NOT NULL,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedById` int unsigned NOT NULL,
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_vCustomSecs_templateCustId` (`versionedTemplateCustomizationId`),
  KEY `fk_vCustomSecs_sectionId` (`customSectionId`),
  UNIQUE KEY `fk_vCustomSecs_pinnedVSecId` (`versionedTemplateCustomizationId`, `pinnedVersionedSectionType`, `pinnedVersionedSectionId`),
  CONSTRAINT `fk_vCustomSecs_sectionId` FOREIGN KEY (`customSectionId`) REFERENCES `customSections` (`id`),
  CONSTRAINT `fk_vCustomSecs_templateCustId` FOREIGN KEY (`versionedTemplateCustomizationId`) REFERENCES `versionedTemplateCustomizations` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `customQuestions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `templateCustomizationId` int unsigned NOT NULL,
  `sectionType` VARCHAR(16) NOT NULL DEFAULT 'BASE',
  `sectionId` INT UNSIGNED NOT NULL,
  `pinnedQuestionType` VARCHAR(16) NOT NULL DEFAULT 'BASE',
  `pinnedQuestionId` int unsigned DEFAULT NULL,
  `migrationStatus` varchar(8) NOT NULL DEFAULT 'OK',
  `questionText` text NOT NULL,
  `json` JSON NOT NULL,
  `requirementText` text,
  `guidanceText` text,
  `sampleText` text,
  `useSampleTextAsDefault` TINYINT(1) NOT NULL DEFAULT 0,
  `required` tinyint(1) NOT NULL DEFAULT '0',
  `createdById` int unsigned NOT NULL,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedById` int unsigned NOT NULL,
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_customQs_templateCustId` (`templateCustomizationId`),
  UNIQUE KEY `fk_customQs_sectionId` (`templateCustomizationId`, `sectionType`, `sectionId`,
    `pinnedQuestionType`, `pinnedQuestionId`),
  CONSTRAINT `fk_customQs_templateCustId` FOREIGN KEY (`templateCustomizationId`) REFERENCES `templateCustomizations` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `versionedCustomQuestions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `versionedTemplateCustomizationId` int unsigned NOT NULL,
  `customQuestionId` INT UNSIGNED NOT NULL,
  `versionedSectionType` VARCHAR(16) NOT NULL DEFAULT 'BASE',
  `versionedSectionId` INT UNSIGNED NOT NULL,
  `pinnedVersionedQuestionType` VARCHAR(16) NOT NULL DEFAULT 'BASE',
  `pinnedVersionedQuestionId` int unsigned DEFAULT NULL,
  `questionText` text NOT NULL,
  `json` JSON NOT NULL,
  `requirementText` text,
  `guidanceText` text,
  `sampleText` text,
  `useSampleTextAsDefault` TINYINT(1) NOT NULL DEFAULT 0,
  `required` tinyint(1) NOT NULL DEFAULT '0',
  `createdById` int unsigned NOT NULL,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedById` int unsigned NOT NULL,
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_vCustomQs_templateCustId` (`versionedTemplateCustomizationId`),
  KEY `fk_vCustomQs_questionId` (`customQuestionId`),
  UNIQUE KEY `fk_vcustomQs_vsectionId` (`versionedTemplateCustomizationId`, `versionedSectionType`,
    `versionedSectionId`, `pinnedVersionedQuestionType`, `pinnedVersionedQuestionId`),
  CONSTRAINT `fk_vCustomQs_questionId` FOREIGN KEY (`customQuestionId`) REFERENCES `customQuestions` (`id`),
  CONSTRAINT `fk_vCustomQs_templateCustId` FOREIGN KEY (`versionedTemplateCustomizationId`) REFERENCES `versionedTemplateCustomizations` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

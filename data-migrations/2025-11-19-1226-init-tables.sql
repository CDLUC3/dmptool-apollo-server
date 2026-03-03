START TRANSACTION;

SET FOREIGN_KEY_CHECKS = 0;

-- DROP ALL EXISTING TABLES because we need to rebuild them
DROP TABLE IF EXISTS affiliationEmailDomains;
DROP TABLE IF EXISTS affiliationDepartments;
DROP TABLE IF EXISTS affiliationLinks;
DROP TABLE IF EXISTS affiliations;
DROP TABLE IF EXISTS answerComments;
DROP TABLE IF EXISTS answers;
DROP TABLE IF EXISTS customQuestions;
DROP TABLE IF EXISTS customSections;
DROP TABLE IF EXISTS feedback;
DROP TABLE IF EXISTS feedbackComments;
DROP TABLE IF EXISTS guidance;
DROP TABLE IF EXISTS guidanceGroups;
DROP TABLE IF EXISTS guidanceTags;
DROP TABLE IF EXISTS licenses;
DROP TABLE IF EXISTS memberRoles;
DROP TABLE IF EXISTS metadataStandardResearchDomains;
DROP TABLE IF EXISTS metadataStandards;
DROP TABLE IF EXISTS planFundings;
DROP TABLE IF EXISTS planMemberRoles;
DROP TABLE IF EXISTS planMembers;
DROP TABLE IF EXISTS plans;
DROP TABLE IF EXISTS projectCollaborators;
DROP TABLE IF EXISTS projectFundings;
DROP TABLE IF EXISTS projectMemberRoles;
DROP TABLE IF EXISTS projectMembers;
DROP TABLE IF EXISTS projectOutputTypes;
DROP TABLE IF EXISTS projectOutputMetadataStandards;
DROP TABLE IF EXISTS projectOutputRepositories;
DROP TABLE IF EXISTS projectOutputs;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS questionConditions;
DROP TABLE IF EXISTS questionCustomizations;
DROP TABLE IF EXISTS questions;
DROP TABLE IF EXISTS relatedWorks;
DROP TABLE IF EXISTS repositories;
DROP TABLE IF EXISTS repositoryResearchDomains;
DROP TABLE IF EXISTS researchDomains;
DROP TABLE IF EXISTS sectionCustomizations;
DROP TABLE IF EXISTS sectionTags;
DROP TABLE IF EXISTS sections;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS templateCollaborators;
DROP TABLE IF EXISTS templateCustomizations;
DROP TABLE IF EXISTS templateLinks;
DROP TABLE IF EXISTS templates;
DROP TABLE IF EXISTS userDepartments;
DROP TABLE IF EXISTS userEmails;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS versionedCustomQuestions;
DROP TABLE IF EXISTS versionedCustomSections;
DROP TABLE IF EXISTS versionedGuidance;
DROP TABLE IF EXISTS versionedGuidanceGroups;
DROP TABLE IF EXISTS versionedGuidanceTags;
DROP TABLE IF EXISTS versionedQuestionConditions;
DROP TABLE IF EXISTS versionedQuestionCustomizations;
DROP TABLE IF EXISTS versionedQuestions;
DROP TABLE IF EXISTS versionedSectionCustomizations;
DROP TABLE IF EXISTS versionedSectionTags;
DROP TABLE IF EXISTS versionedSections;
DROP TABLE IF EXISTS versionedTemplateCustomizations;
DROP TABLE IF EXISTS versionedTemplateLinks;
DROP TABLE IF EXISTS versionedTemplates;
DROP TABLE IF EXISTS workVersions;
DROP TABLE IF EXISTS works;

-- Recreate the tables
CREATE TABLE `dataMigrations` (
  `migrationFile` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_migration_file` (`migrationFile`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `affiliationDepartments` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `affiliationId` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `abbreviation` varchar(255) DEFAULT NULL,
  `createdById` int unsigned NOT NULL,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedById` int unsigned NOT NULL,
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_affiliationDepts` (`affiliationId`,`name`),
  CONSTRAINT `fk_affiliationDepts_affiliationId` FOREIGN KEY (`affiliationId`) REFERENCES `affiliations` (`uri`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `affiliationEmailDomains` (
 `id` int unsigned NOT NULL AUTO_INCREMENT,
 `affiliationId` varchar(255) NOT NULL,
 `emailDomain` varchar(255) NOT NULL,
 `createdById` int unsigned NOT NULL,
 `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `modifiedById` int unsigned NOT NULL,
 `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`),
 UNIQUE KEY `unique_emailDomain` (`emailDomain`),
 KEY `affiliations_email_domains_idx` (`emailDomain`,`affiliationId`),
 KEY `createdById` (`createdById`),
 KEY `modifiedById` (`modifiedById`),
 KEY `affiliationId` (`affiliationId`),
 CONSTRAINT `affiliationemaildomains_ibfk_1` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`),
 CONSTRAINT `affiliationemaildomains_ibfk_2` FOREIGN KEY (`modifiedById`) REFERENCES `users` (`id`),
 CONSTRAINT `affiliationemaildomains_ibfk_3` FOREIGN KEY (`affiliationId`) REFERENCES `affiliations` (`uri`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `affiliationLinks` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `affiliationId` varchar(255) NOT NULL,
  `url` varchar(255) NOT NULL,
  `text` varchar(255) NOT NULL,
  `createdById` int unsigned NOT NULL,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedById` int unsigned NOT NULL,
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `createdById` (`createdById`),
  KEY `modifiedById` (`modifiedById`),
  KEY `affiliationId` (`affiliationId`),
  CONSTRAINT `affiliationlinks_ibfk_1` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`),
  CONSTRAINT `affiliationlinks_ibfk_2` FOREIGN KEY (`modifiedById`) REFERENCES `users` (`id`),
  CONSTRAINT `affiliationlinks_ibfk_3` FOREIGN KEY (`affiliationId`) REFERENCES `affiliations` (`uri`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `affiliations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `uri` varchar(255) NOT NULL,
  `provenance` varchar(255) NOT NULL DEFAULT 'DMPTOOL',
  `name` varchar(255) NOT NULL,
  `displayName` varchar(255) NOT NULL,
  `searchName` varchar(512) DEFAULT NULL,
  `funder` tinyint(1) NOT NULL DEFAULT '0',
  `fundrefId` varchar(255) DEFAULT NULL,
  `homepage` varchar(255) DEFAULT NULL,
  `acronyms` json DEFAULT NULL,
  `aliases` json DEFAULT NULL,
  `types` json DEFAULT NULL,
  `logoURI` varchar(255) DEFAULT NULL,
  `logoName` varchar(255) DEFAULT NULL,
  `contactName` varchar(255) DEFAULT NULL,
  `contactEmail` varchar(255) DEFAULT NULL,
  `ssoEntityId` varchar(255) DEFAULT NULL,
  `feedbackEnabled` tinyint(1) NOT NULL DEFAULT '0',
  `feedbackMessage` text,
  `feedbackEmails` json DEFAULT NULL,
  `managed` tinyint(1) NOT NULL DEFAULT '0',
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `apiTarget` varchar(255) DEFAULT NULL,
  `createdById` int unsigned NOT NULL,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedById` int unsigned NOT NULL,
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_affiliation_uri` (`uri`),
  UNIQUE KEY `unique_affiliation_displayName` (`displayName`),
  KEY `affiliations_uri_idx` (`uri`),
  KEY `affiliations_search_idx` (`searchName`),
  KEY `affiliations_sso_idx` (`ssoEntityId`),
  KEY `affiliations_funders_idx` (`funder`),
  KEY `affiliations_provenance_idx` (`provenance`,`uri`,`displayName`),
  KEY `createdById` (`createdById`),
  KEY `modifiedById` (`modifiedById`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `answerComments` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `answerId` int unsigned NOT NULL,
  `commentText` text NOT NULL,
  `createdById` int unsigned NOT NULL,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedById` int unsigned NOT NULL,
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `answer_comments_modified_idx` (`answerId`,`modified`),
  KEY `createdById` (`createdById`),
  KEY `modifiedById` (`modifiedById`),
  CONSTRAINT `answercomments_ibfk_1` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`),
  CONSTRAINT `answercomments_ibfk_2` FOREIGN KEY (`modifiedById`) REFERENCES `users` (`id`),
  CONSTRAINT `answercomments_ibfk_3` FOREIGN KEY (`answerId`) REFERENCES `answers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `answers` (
   `id` int unsigned NOT NULL AUTO_INCREMENT,
   `planId` int unsigned NOT NULL,
   `versionedSectionId` int unsigned NOT NULL,
   `versionedQuestionId` int unsigned NOT NULL,
   `json` json DEFAULT NULL,
   `createdById` int unsigned NOT NULL,
   `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
   `modifiedById` int unsigned NOT NULL,
   `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY (`id`),
   KEY `createdById` (`createdById`),
   KEY `modifiedById` (`modifiedById`),
   KEY `planId` (`planId`),
   KEY `versionedSectionId` (`versionedSectionId`),
   KEY `versionedQuestionId` (`versionedQuestionId`),
   CONSTRAINT `answers_ibfk_1` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`),
   CONSTRAINT `answers_ibfk_2` FOREIGN KEY (`modifiedById`) REFERENCES `users` (`id`),
   CONSTRAINT `answers_ibfk_3` FOREIGN KEY (`planId`) REFERENCES `plans` (`id`) ON DELETE CASCADE,
   CONSTRAINT `answers_ibfk_4` FOREIGN KEY (`versionedSectionId`) REFERENCES `versionedSections` (`id`),
   CONSTRAINT `answers_ibfk_5` FOREIGN KEY (`versionedQuestionId`) REFERENCES `versionedQuestions` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `customQuestions` (
   `id` int unsigned NOT NULL AUTO_INCREMENT,
   `templateCustomizationId` int unsigned NOT NULL,
   `migrationStatus` varchar(8) NOT NULL DEFAULT 'OK',
   `customSectionId` int unsigned DEFAULT NULL,
   `displayOrder` int DEFAULT NULL,
   `pinnedQuestionId` int unsigned DEFAULT NULL,
   `questionTypeId` int NOT NULL,
   `questionText` text NOT NULL,
   `requirementText` text,
   `guidanceText` text,
   `sampleText` text,
   `required` tinyint(1) NOT NULL DEFAULT '0',
   `createdById` int unsigned NOT NULL,
   `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
   `modifiedById` int unsigned NOT NULL,
   `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY (`id`),
   KEY `fk_customQs_templateCustId` (`templateCustomizationId`),
   KEY `fk_customQs_sectionId` (`customSectionId`),
   KEY `fk_customQs_currentId` (`pinnedQuestionId`),
   CONSTRAINT `fk_customQs_currentId` FOREIGN KEY (`pinnedQuestionId`) REFERENCES `questions` (`id`),
   CONSTRAINT `fk_customQs_sectionId` FOREIGN KEY (`customSectionId`) REFERENCES `customSections` (`id`),
   CONSTRAINT `fk_customQs_templateCustId` FOREIGN KEY (`templateCustomizationId`) REFERENCES `templateCustomizations` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `customSections` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `templateCustomizationId` int unsigned NOT NULL,
  `pinnedSectionId` int unsigned NOT NULL,
  `migrationStatus` varchar(8) NOT NULL DEFAULT 'OK',
  `name` varchar(255) NOT NULL,
  `introduction` text,
  `requirements` text,
  `guidance` text,
  `displayOrder` int NOT NULL,
  `createdById` int unsigned NOT NULL,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedById` int unsigned NOT NULL,
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_customSecs_templateCustId` (`templateCustomizationId`),
  KEY `fk_customSecs_currentId` (`pinnedSectionId`),
  CONSTRAINT `fk_customSecs_currentId` FOREIGN KEY (`pinnedSectionId`) REFERENCES `sections` (`id`),
  CONSTRAINT `fk_customSecs_templateCustId` FOREIGN KEY (`templateCustomizationId`) REFERENCES `templateCustomizations` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `feedback` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `planId` int unsigned NOT NULL,
  `requestedById` int unsigned NOT NULL,
  `requested` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completedById` int unsigned DEFAULT NULL,
  `completed` timestamp NULL DEFAULT NULL,
  `summaryText` text,
  `createdById` int unsigned NOT NULL,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedById` int unsigned NOT NULL,
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `createdById` (`createdById`),
  KEY `modifiedById` (`modifiedById`),
  KEY `planId` (`planId`),
  KEY `requestedById` (`requestedById`),
  KEY `completedById` (`completedById`),
  CONSTRAINT `feedback_ibfk_1` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`),
  CONSTRAINT `feedback_ibfk_2` FOREIGN KEY (`modifiedById`) REFERENCES `users` (`id`),
  CONSTRAINT `feedback_ibfk_3` FOREIGN KEY (`planId`) REFERENCES `plans` (`id`) ON DELETE CASCADE,
  CONSTRAINT `feedback_ibfk_4` FOREIGN KEY (`requestedById`) REFERENCES `users` (`id`),
  CONSTRAINT `feedback_ibfk_5` FOREIGN KEY (`completedById`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `feedbackComments` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `feedbackId` int unsigned NOT NULL,
  `answerId` int unsigned NOT NULL,
  `commentText` text NOT NULL,
  `createdById` int unsigned NOT NULL,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedById` int unsigned NOT NULL,
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `feedback_comments_modified_idx` (`answerId`,`modified`),
  KEY `createdById` (`createdById`),
  KEY `modifiedById` (`modifiedById`),
  KEY `feedbackId` (`feedbackId`),
  CONSTRAINT `feedbackcomments_ibfk_1` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`),
  CONSTRAINT `feedbackcomments_ibfk_2` FOREIGN KEY (`modifiedById`) REFERENCES `users` (`id`),
  CONSTRAINT `feedbackcomments_ibfk_3` FOREIGN KEY (`feedbackId`) REFERENCES `feedback` (`id`) ON DELETE CASCADE,
  CONSTRAINT `feedbackcomments_ibfk_4` FOREIGN KEY (`answerId`) REFERENCES `answers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `guidance` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `guidanceGroupId` int UNSIGNED NOT NULL,
  `guidanceText` text,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdById` int UNSIGNED NOT NULL,
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedById` int UNSIGNED NOT NULL,
  KEY `idx_guidance_guidanceGroupId` (`guidanceGroupId`),
  KEY `idx_guidance_createdById` (`createdById`),
  KEY `idx_guidance_modifiedById` (`modifiedById`),
  CONSTRAINT `fk_guidance_guidanceGroupId`
    FOREIGN KEY (`guidanceGroupId`) REFERENCES `guidanceGroups` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_guidance_createdById`
    FOREIGN KEY (`createdById`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_guidance_modifiedById`
    FOREIGN KEY (`modifiedById`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `guidanceGroups` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `affiliationId` VARCHAR(255) NOT NULL,
  `name` text,
  `isDirty` tinyint(1) NOT NULL DEFAULT '1',
  `bestPractice` tinyint(1) NOT NULL DEFAULT '0',
  `optionalSubset` tinyint(1) NOT NULL DEFAULT '0',
  `latestPublishedVersion` int DEFAULT NULL,
  `latestPublishedDate` timestamp DEFAULT NULL,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdById` INT UNSIGNED NOT NULL,
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedById` INT UNSIGNED NOT NULL,
  KEY `idx_guidanceGroups_affiliationId` (`affiliationId`),
  KEY `idx_guidanceGroups_createdById` (`createdById`),
  KEY `idx_guidanceGroups_modifiedById` (`modifiedById`),
  CONSTRAINT `fk_guidanceGroups_affiliationId`
    FOREIGN KEY (`affiliationId`) REFERENCES `affiliations` (`uri`) ON DELETE CASCADE,
  CONSTRAINT `fk_guidanceGroups_createdById`
    FOREIGN KEY (`createdById`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_guidanceGroups_modifiedById`
    FOREIGN KEY (`modifiedById`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `guidanceTags` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `guidanceId` int UNSIGNED NOT NULL,
  `tagId` int UNSIGNED NOT NULL,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdById` int UNSIGNED NOT NULL,
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedById` int UNSIGNED NOT NULL,
  KEY `idx_guidanceTags_guidanceId` (`guidanceId`),
  KEY `idx_guidanceTags_tagId` (`tagId`),
  KEY `idx_guidanceTags_createdById` (`createdById`),
  KEY `idx_guidanceTags_modififiedById` (`modifiedById`),
  CONSTRAINT `fk_guidanceTags_guidanceId`
    FOREIGN KEY (`guidanceId`) REFERENCES `guidance` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_guidanceTags_tagId`
    FOREIGN KEY (`tagId`) REFERENCES `tags` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_guidanceTags_createdById`
    FOREIGN KEY (`createdById`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_guidanceTags_modifiedById`
    FOREIGN KEY (`modifiedById`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `licenses` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `uri` varchar(255) NOT NULL,
  `description` text,
  `recommended` tinyint(1) NOT NULL DEFAULT '0',
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdById` int unsigned NOT NULL,
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedById` int unsigned NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_license_name` (`name`),
  UNIQUE KEY `unique_license_uri` (`uri`),
  KEY `createdById` (`createdById`),
  KEY `modifiedById` (`modifiedById`),
  CONSTRAINT `licenses_ibfk_1` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`),
  CONSTRAINT `licenses_ibfk_2` FOREIGN KEY (`modifiedById`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `memberRoles` (
 `id` int unsigned NOT NULL AUTO_INCREMENT,
 `label` varchar(255) NOT NULL,
 `uri` varchar(255) NOT NULL,
 `description` text,
 `displayOrder` int NOT NULL,
 `isDefault` tinyint(1) NOT NULL DEFAULT '0',
 `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `createdById` int unsigned NOT NULL,
 `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `modifiedById` int unsigned NOT NULL,
 PRIMARY KEY (`id`),
 UNIQUE KEY `unique_member_role_uri` (`uri`),
 UNIQUE KEY `unique_member_role_order` (`displayOrder`),
 KEY `createdById` (`createdById`),
 KEY `modifiedById` (`modifiedById`),
 CONSTRAINT `memberroles_ibfk_1` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`),
 CONSTRAINT `memberroles_ibfk_2` FOREIGN KEY (`modifiedById`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `metadataStandardResearchDomains` (
 `id` int unsigned NOT NULL AUTO_INCREMENT,
 `metadataStandardId` int unsigned NOT NULL,
 `researchDomainId` int unsigned NOT NULL,
 `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `createdById` int unsigned NOT NULL,
 `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `modifiedById` int unsigned NOT NULL,
 PRIMARY KEY (`id`),
 KEY `createdById` (`createdById`),
 KEY `modifiedById` (`modifiedById`),
 KEY `metadataStandardId` (`metadataStandardId`),
 KEY `researchDomainId` (`researchDomainId`),
 CONSTRAINT `metadatastandardresearchdomains_ibfk_1` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`),
 CONSTRAINT `metadatastandardresearchdomains_ibfk_2` FOREIGN KEY (`modifiedById`) REFERENCES `users` (`id`),
 CONSTRAINT `metadatastandardresearchdomains_ibfk_3` FOREIGN KEY (`metadataStandardId`) REFERENCES `metadataStandards` (`id`) ON DELETE CASCADE,
 CONSTRAINT `metadatastandardresearchdomains_ibfk_4` FOREIGN KEY (`researchDomainId`) REFERENCES `researchDomains` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `metadataStandards` (
 `id` int unsigned NOT NULL AUTO_INCREMENT,
 `name` varchar(255) NOT NULL,
 `uri` varchar(255) NOT NULL,
 `description` text,
 `keywords` json DEFAULT NULL,
 `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `createdById` int unsigned NOT NULL,
 `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `modifiedById` int unsigned NOT NULL,
 PRIMARY KEY (`id`),
 UNIQUE KEY `unique_mstandard_name` (`name`),
 UNIQUE KEY `unique_mstandard_uri` (`uri`),
 KEY `createdById` (`createdById`),
 KEY `modifiedById` (`modifiedById`),
 CONSTRAINT `metadatastandards_ibfk_1` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`),
 CONSTRAINT `metadatastandards_ibfk_2` FOREIGN KEY (`modifiedById`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `planFundings` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `planId` int unsigned NOT NULL,
  `projectFundingId` int unsigned NOT NULL,
  `createdById` int unsigned NOT NULL,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedById` int unsigned NOT NULL,
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `createdById` (`createdById`),
  KEY `modifiedById` (`modifiedById`),
  KEY `planId` (`planId`),
  KEY `projectFundingId` (`projectFundingId`),
  CONSTRAINT `planfundings_ibfk_1` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`),
  CONSTRAINT `planfundings_ibfk_2` FOREIGN KEY (`modifiedById`) REFERENCES `users` (`id`),
  CONSTRAINT `planfundings_ibfk_3` FOREIGN KEY (`planId`) REFERENCES `plans` (`id`) ON DELETE CASCADE,
  CONSTRAINT `planfundings_ibfk_4` FOREIGN KEY (`projectFundingId`) REFERENCES `projectFundings` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `planMemberRoles` (
 `id` int unsigned NOT NULL AUTO_INCREMENT,
 `planMemberId` int unsigned NOT NULL,
 `memberRoleId` int unsigned NOT NULL,
 `createdById` int unsigned NOT NULL,
 `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `modifiedById` int unsigned NOT NULL,
 `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`),
 KEY `createdById` (`createdById`),
 KEY `modifiedById` (`modifiedById`),
 KEY `planMemberId` (`planMemberId`),
 KEY `memberRoleId` (`memberRoleId`),
 CONSTRAINT `planmemberroles_ibfk_1` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`),
 CONSTRAINT `planmemberroles_ibfk_2` FOREIGN KEY (`modifiedById`) REFERENCES `users` (`id`),
 CONSTRAINT `planmemberroles_ibfk_3` FOREIGN KEY (`planMemberId`) REFERENCES `planMembers` (`id`) ON DELETE CASCADE,
 CONSTRAINT `planmemberroles_ibfk_4` FOREIGN KEY (`memberRoleId`) REFERENCES `memberRoles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `planMembers` (
 `id` int unsigned NOT NULL AUTO_INCREMENT,
 `planId` int unsigned NOT NULL,
 `projectMemberId` int unsigned NOT NULL,
 `isPrimaryContact` tinyint(1) NOT NULL DEFAULT '0',
 `createdById` int unsigned NOT NULL,
 `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `modifiedById` int unsigned NOT NULL,
 `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`),
 KEY `createdById` (`createdById`),
 KEY `modifiedById` (`modifiedById`),
 KEY `planId` (`planId`),
 KEY `projectMemberId` (`projectMemberId`),
 CONSTRAINT `planmembers_ibfk_1` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`),
 CONSTRAINT `planmembers_ibfk_2` FOREIGN KEY (`modifiedById`) REFERENCES `users` (`id`),
 CONSTRAINT `planmembers_ibfk_3` FOREIGN KEY (`planId`) REFERENCES `plans` (`id`) ON DELETE CASCADE,
 CONSTRAINT `planmembers_ibfk_4` FOREIGN KEY (`projectMemberId`) REFERENCES `projectMembers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `plans` (
 `id` int unsigned NOT NULL AUTO_INCREMENT,
 `projectId` int unsigned NOT NULL,
 `versionedTemplateId` int unsigned NOT NULL,
 `title` varchar(255) DEFAULT NULL,
 `visibility` varchar(16) NOT NULL,
 `status` varchar(16) NOT NULL,
 `dmpId` varchar(255) DEFAULT NULL,
 `registeredById` int unsigned DEFAULT NULL,
 `registered` timestamp NULL DEFAULT NULL,
 `languageId` char(5) NOT NULL DEFAULT 'en-US',
 `featured` tinyint(1) NOT NULL DEFAULT '0',
 `createdById` int unsigned NOT NULL,
 `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `modifiedById` int unsigned NOT NULL,
 `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`),
 KEY `plans_dmpid_idx` (`dmpId`),
 KEY `plans_modified_idx` (`id`,`modified`),
 KEY `plans_status_idx` (`status`),
 KEY `plans_featured_idx` (`featured`),
 KEY `createdById` (`createdById`),
 KEY `modifiedById` (`modifiedById`),
 KEY `projectId` (`projectId`),
 KEY `versionedTemplateId` (`versionedTemplateId`),
 CONSTRAINT `plans_ibfk_1` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`),
 CONSTRAINT `plans_ibfk_2` FOREIGN KEY (`modifiedById`) REFERENCES `users` (`id`),
 CONSTRAINT `plans_ibfk_3` FOREIGN KEY (`projectId`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
 CONSTRAINT `plans_ibfk_4` FOREIGN KEY (`versionedTemplateId`) REFERENCES `versionedTemplates` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `projectCollaborators` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `projectId` int unsigned NOT NULL,
  `email` varchar(255) NOT NULL,
  `invitedById` int unsigned NOT NULL,
  `userId` int unsigned DEFAULT NULL,
  `accessLevel` varchar(8) NOT NULL DEFAULT 'COMMENT',
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdById` int unsigned NOT NULL,
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedById` int unsigned NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_template_collaborator` (`projectId`,`email`),
  KEY `projectCollaborators_email_idx` (`email`),
  KEY `createdById` (`createdById`),
  KEY `modifiedById` (`modifiedById`),
  KEY `invitedById` (`invitedById`),
  KEY `userId` (`userId`),
  CONSTRAINT `projectcollaborators_ibfk_1` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`),
  CONSTRAINT `projectcollaborators_ibfk_2` FOREIGN KEY (`modifiedById`) REFERENCES `users` (`id`),
  CONSTRAINT `projectcollaborators_ibfk_3` FOREIGN KEY (`projectId`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `projectcollaborators_ibfk_4` FOREIGN KEY (`invitedById`) REFERENCES `users` (`id`),
  CONSTRAINT `projectcollaborators_ibfk_5` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `projectFundings` (
 `id` int unsigned NOT NULL AUTO_INCREMENT,
 `projectId` int unsigned NOT NULL,
 `affiliationId` varchar(255) NOT NULL,
 `status` varchar(16) NOT NULL,
 `funderProjectNumber` varchar(255) DEFAULT NULL,
 `grantId` varchar(255) DEFAULT NULL,
 `funderOpportunityNumber` varchar(255) DEFAULT NULL,
 `createdById` int unsigned NOT NULL,
 `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `modifiedById` int unsigned NOT NULL,
 `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`),
 KEY `createdById` (`createdById`),
 KEY `modifiedById` (`modifiedById`),
 KEY `projectId` (`projectId`),
 KEY `affiliationId` (`affiliationId`),
 CONSTRAINT `projectfundings_ibfk_1` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`),
 CONSTRAINT `projectfundings_ibfk_2` FOREIGN KEY (`modifiedById`) REFERENCES `users` (`id`),
 CONSTRAINT `projectfundings_ibfk_3` FOREIGN KEY (`projectId`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
 CONSTRAINT `projectfundings_ibfk_4` FOREIGN KEY (`affiliationId`) REFERENCES `affiliations` (`uri`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `projectMemberRoles` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `projectMemberId` int unsigned NOT NULL,
  `memberRoleId` int unsigned NOT NULL,
  `createdById` int unsigned NOT NULL,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedById` int unsigned NOT NULL,
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `createdById` (`createdById`),
  KEY `modifiedById` (`modifiedById`),
  KEY `projectMemberId` (`projectMemberId`),
  KEY `memberRoleId` (`memberRoleId`),
  CONSTRAINT `projectmemberroles_ibfk_1` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`),
  CONSTRAINT `projectmemberroles_ibfk_2` FOREIGN KEY (`modifiedById`) REFERENCES `users` (`id`),
  CONSTRAINT `projectmemberroles_ibfk_3` FOREIGN KEY (`projectMemberId`) REFERENCES `projectMembers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `projectmemberroles_ibfk_4` FOREIGN KEY (`memberRoleId`) REFERENCES `memberRoles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `projectMembers` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `projectId` int unsigned NOT NULL,
  `affiliationId` varchar(255) DEFAULT NULL,
  `givenName` varchar(255) DEFAULT NULL,
  `surName` varchar(255) DEFAULT NULL,
  `orcid` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `createdById` int unsigned NOT NULL,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedById` int unsigned NOT NULL,
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `isPrimaryContact` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `createdById` (`createdById`),
  KEY `modifiedById` (`modifiedById`),
  KEY `projectId` (`projectId`),
  KEY `affiliationId` (`affiliationId`),
  CONSTRAINT `projectmembers_ibfk_1` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`),
  CONSTRAINT `projectmembers_ibfk_2` FOREIGN KEY (`modifiedById`) REFERENCES `users` (`id`),
  CONSTRAINT `projectmembers_ibfk_3` FOREIGN KEY (`projectId`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `projectmembers_ibfk_4` FOREIGN KEY (`affiliationId`) REFERENCES `affiliations` (`uri`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `projects` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `abstractText` text,
  `researchDomainId` varchar(255) DEFAULT NULL,
  `startDate` varchar(16) DEFAULT NULL,
  `endDate` varchar(16) DEFAULT NULL,
  `isTestProject` tinyint(1) NOT NULL DEFAULT '0',
  `createdById` int unsigned NOT NULL,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedById` int unsigned NOT NULL,
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `projects_title_idx` (`id`,`title`),
  KEY `projects_modified_idx` (`id`,`modified`),
  KEY `projects_test_idx` (`id`,`isTestProject`),
  KEY `projects_dates_idx` (`id`,`startDate`,`endDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `questionConditions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `questionId` int unsigned NOT NULL,
  `action` varchar(255) NOT NULL DEFAULT 'SHOW_QUESTION',
  `conditionType` varchar(255) NOT NULL DEFAULT 'EQUAL',
  `conditionMatch` varchar(255) DEFAULT NULL,
  `target` varchar(255) NOT NULL,
  `createdById` int unsigned NOT NULL,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedById` int unsigned NOT NULL,
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `createdById` (`createdById`),
  KEY `modifiedById` (`modifiedById`),
  KEY `questionId` (`questionId`),
  CONSTRAINT `questionconditions_ibfk_1` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`),
  CONSTRAINT `questionconditions_ibfk_2` FOREIGN KEY (`modifiedById`) REFERENCES `users` (`id`),
  CONSTRAINT `questionconditions_ibfk_3` FOREIGN KEY (`questionId`) REFERENCES `questions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `questionCustomizations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `templateCustomizationId` int unsigned NOT NULL,
  `questionId` int unsigned NOT NULL,
  `migrationStatus` varchar(8) NOT NULL DEFAULT 'OK',
  `requirementText` text,
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

CREATE TABLE `questions` (
 `id` int unsigned NOT NULL AUTO_INCREMENT,
 `templateId` int unsigned NOT NULL,
 `sectionId` int unsigned NOT NULL,
 `sourceQuestionId` int unsigned DEFAULT NULL,
 `displayOrder` int NOT NULL,
 `isDirty` tinyint(1) NOT NULL DEFAULT '1',
 `questionText` text NOT NULL,
 `json` json DEFAULT NULL,
 `requirementText` text,
 `guidanceText` text,
 `sampleText` text,
 `useSampleTextAsDefault` tinyint(1) NOT NULL DEFAULT '0',
 `required` tinyint(1) NOT NULL DEFAULT '0',
 `createdById` int unsigned NOT NULL,
 `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `modifiedById` int unsigned NOT NULL,
 `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`),
 KEY `questions_section_idx` (`sectionId`,`displayOrder`),
 KEY `questions_isDirty_idx` (`templateId`,`isDirty`),
 KEY `questions_template_idx` (`templateId`,`displayOrder`),
 KEY `createdById` (`createdById`),
 KEY `modifiedById` (`modifiedById`),
 CONSTRAINT `questions_ibfk_1` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`),
 CONSTRAINT `questions_ibfk_2` FOREIGN KEY (`modifiedById`) REFERENCES `users` (`id`),
 CONSTRAINT `questions_ibfk_3` FOREIGN KEY (`templateId`) REFERENCES `templates` (`id`) ON DELETE CASCADE,
 CONSTRAINT `questions_ibfk_4` FOREIGN KEY (`sectionId`) REFERENCES `sections` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `relatedWorks` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `planId` int unsigned NOT NULL,
  `workVersionId` int unsigned NOT NULL,
  `score` float NOT NULL,
  `status` varchar(256) NOT NULL DEFAULT 'PENDING',
  `doiMatch` json DEFAULT NULL,
  `contentMatch` json DEFAULT NULL,
  `authorMatches` json DEFAULT NULL,
  `institutionMatches` json DEFAULT NULL,
  `funderMatches` json DEFAULT NULL,
  `awardMatches` json DEFAULT NULL,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdById` int unsigned DEFAULT NULL,
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `modifiedById` int unsigned DEFAULT NULL,
  `scoreMax` float NOT NULL,
  `sourceType` varchar(32) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_planId_workVersionId` (`planId`,`workVersionId`),
  KEY `fk_relatedWorks_workVersions_workVersionId` (`workVersionId`),
  KEY `fk_relatedWorks_users_createdById` (`createdById`),
  KEY `fk_relatedWorks_users_modifiedById` (`modifiedById`),
  CONSTRAINT `fk_relatedWorks_plans_planId` FOREIGN KEY (`planId`) REFERENCES `plans` (`id`),
  CONSTRAINT `fk_relatedWorks_users_createdById` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_relatedWorks_users_modifiedById` FOREIGN KEY (`modifiedById`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_relatedWorks_workVersions_workVersionId` FOREIGN KEY (`workVersionId`) REFERENCES `workVersions` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `repositories` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `uri` varchar(255) NOT NULL,
  `description` text,
  `website` varchar(255) DEFAULT NULL,
  `keywords` json DEFAULT NULL,
  `repositoryTypes` json DEFAULT NULL,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdById` int unsigned NOT NULL,
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedById` int unsigned NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_license_name` (`name`),
  UNIQUE KEY `unique_license_uri` (`uri`),
  UNIQUE KEY `unique_license_website` (`website`),
  KEY `createdById` (`createdById`),
  KEY `modifiedById` (`modifiedById`),
  CONSTRAINT `repositories_ibfk_1` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`),
  CONSTRAINT `repositories_ibfk_2` FOREIGN KEY (`modifiedById`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `repositoryResearchDomains` (
 `id` int unsigned NOT NULL AUTO_INCREMENT,
 `repositoryId` int unsigned NOT NULL,
 `researchDomainId` int unsigned NOT NULL,
 `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `createdById` int unsigned NOT NULL,
 `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `modifiedById` int unsigned NOT NULL,
 PRIMARY KEY (`id`),
 KEY `repositoryId` (`repositoryId`),
 KEY `researchDomainId` (`researchDomainId`),
 CONSTRAINT `repositoryresearchdomains_ibfk_1` FOREIGN KEY (`repositoryId`) REFERENCES `repositories` (`id`) ON DELETE CASCADE,
 CONSTRAINT `repositoryresearchdomains_ibfk_2` FOREIGN KEY (`researchDomainId`) REFERENCES `researchDomains` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `researchDomains` (
 `id` int unsigned NOT NULL AUTO_INCREMENT,
 `name` varchar(255) NOT NULL,
 `uri` varchar(255) NOT NULL,
 `description` text NOT NULL,
 `parentResearchDomainId` int unsigned DEFAULT NULL,
 `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `createdById` int unsigned NOT NULL,
 `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `modifiedById` int unsigned NOT NULL,
 PRIMARY KEY (`id`),
 UNIQUE KEY `unique_research_domain_name` (`name`),
 UNIQUE KEY `unique_research_domain_uri` (`uri`),
 KEY `createdById` (`createdById`),
 KEY `modifiedById` (`modifiedById`),
 CONSTRAINT `researchdomains_ibfk_1` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`),
 CONSTRAINT `researchdomains_ibfk_2` FOREIGN KEY (`modifiedById`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `sectionCustomizations` (
 `id` int unsigned NOT NULL AUTO_INCREMENT,
 `templateCustomizationId` int unsigned NOT NULL,
 `sectionId` int unsigned NOT NULL,
 `migrationStatus` varchar(8) NOT NULL DEFAULT 'OK',
 `requirements` text,
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

CREATE TABLE `sections` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `templateId` int unsigned NOT NULL,
  `sourceSectionId` int unsigned DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `introduction` text,
  `requirements` text,
  `guidance` text,
  `displayOrder` int NOT NULL,
  `bestPractice` tinyint(1) NOT NULL DEFAULT '0',
  `isDirty` tinyint(1) NOT NULL DEFAULT '1',
  `createdById` int unsigned NOT NULL,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedById` int unsigned NOT NULL,
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `sections_name_idx` (`name`),
  KEY `sections_isDirty_idx` (`templateId`,`isDirty`),
  KEY `sections_template_idx` (`templateId`,`displayOrder`),
  KEY `createdById` (`createdById`),
  KEY `modifiedById` (`modifiedById`),
  KEY `sourceSectionId` (`sourceSectionId`),
  CONSTRAINT `sections_ibfk_1` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`),
  CONSTRAINT `sections_ibfk_2` FOREIGN KEY (`modifiedById`) REFERENCES `users` (`id`),
  CONSTRAINT `sections_ibfk_3` FOREIGN KEY (`templateId`) REFERENCES `templates` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sections_ibfk_4` FOREIGN KEY (`sourceSectionId`) REFERENCES `sections` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `sectionTags` (
 `id` int unsigned NOT NULL AUTO_INCREMENT,
 `sectionId` int unsigned NOT NULL,
 `tagId` int unsigned NOT NULL,
 `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `createdById` int unsigned NOT NULL,
 `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `modifiedById` int unsigned NOT NULL,
 PRIMARY KEY (`id`),
 KEY `sectionTags_idx` (`sectionId`,`tagId`),
 KEY `createdById` (`createdById`),
 KEY `modifiedById` (`modifiedById`),
 KEY `tagId` (`tagId`),
 CONSTRAINT `sectiontags_ibfk_1` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`),
 CONSTRAINT `sectiontags_ibfk_2` FOREIGN KEY (`modifiedById`) REFERENCES `users` (`id`),
 CONSTRAINT `sectiontags_ibfk_3` FOREIGN KEY (`sectionId`) REFERENCES `sections` (`id`) ON DELETE CASCADE,
 CONSTRAINT `sectiontags_ibfk_4` FOREIGN KEY (`tagId`) REFERENCES `tags` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `tags` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `slug` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `createdById` int unsigned NOT NULL,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedById` int unsigned NOT NULL,
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_tag_slug` (`slug`),
  KEY `tags_name_idx` (`name`),
  KEY `createdById` (`createdById`),
  KEY `modifiedById` (`modifiedById`),
  CONSTRAINT `tags_ibfk_1` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`),
  CONSTRAINT `tags_ibfk_2` FOREIGN KEY (`modifiedById`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `templateCollaborators` (
 `id` int unsigned NOT NULL AUTO_INCREMENT,
 `templateId` int unsigned NOT NULL,
 `email` varchar(255) NOT NULL,
 `invitedById` int unsigned NOT NULL,
 `userId` int unsigned DEFAULT NULL,
 `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `createdById` int unsigned NOT NULL,
 `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `modifiedById` int unsigned NOT NULL,
 PRIMARY KEY (`id`),
 UNIQUE KEY `unique_template_collaborator` (`templateId`,`email`),
 KEY `templateCollaborators_email_idx` (`email`),
 KEY `createdById` (`createdById`),
 KEY `modifiedById` (`modifiedById`),
 KEY `invitedById` (`invitedById`),
 KEY `userId` (`userId`),
 CONSTRAINT `templatecollaborators_ibfk_1` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`),
 CONSTRAINT `templatecollaborators_ibfk_2` FOREIGN KEY (`modifiedById`) REFERENCES `users` (`id`),
 CONSTRAINT `templatecollaborators_ibfk_3` FOREIGN KEY (`templateId`) REFERENCES `templates` (`id`) ON DELETE CASCADE,
 CONSTRAINT `templatecollaborators_ibfk_4` FOREIGN KEY (`invitedById`) REFERENCES `users` (`id`),
 CONSTRAINT `templatecollaborators_ibfk_5` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `templateCustomizations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `affiliationId` varchar(255) NOT NULL,
  `templateId` int unsigned NOT NULL,
  `status` varchar(8) NOT NULL DEFAULT 'DRAFT',
  `migrationStatus` varchar(8) NOT NULL DEFAULT 'OK',
  `createdById` int unsigned NOT NULL,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedById` int unsigned NOT NULL,
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_templateCusts` (`affiliationId`,`templateId`),
  KEY `fk_templateCust_templateId` (`templateId`),
  CONSTRAINT `fk_templateCust_affiliationId` FOREIGN KEY (`affiliationId`) REFERENCES `affiliations` (`uri`),
  CONSTRAINT `fk_templateCust_templateId` FOREIGN KEY (`templateId`) REFERENCES `templates` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `templateLinks` (
 `id` int unsigned NOT NULL AUTO_INCREMENT,
 `templateId` int unsigned NOT NULL,
 `linkType` varchar(255) NOT NULL DEFAULT 'FUNDER',
 `url` varchar(255) DEFAULT NULL,
 `text` varchar(255) DEFAULT NULL,
 `createdById` int unsigned NOT NULL,
 `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `modifiedById` int unsigned NOT NULL,
 `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`),
 UNIQUE KEY `unique_templateLinks` (`templateId`,`url`),
 CONSTRAINT `fk_templateLinks_templateId` FOREIGN KEY (`templateId`) REFERENCES `templates` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `templates` (
 `id` int unsigned NOT NULL AUTO_INCREMENT,
 `sourceTemplateId` int unsigned DEFAULT NULL,
 `name` text NOT NULL,
 `description` text,
 `ownerId` varchar(255) NOT NULL,
 `latestPublishVisibility` varchar(16) NOT NULL,
 `latestPublishVersion` varchar(16) DEFAULT NULL,
 `latestPublishDate` timestamp NULL DEFAULT NULL,
 `isDirty` tinyint(1) NOT NULL DEFAULT '1',
 `bestPractice` tinyint(1) NOT NULL DEFAULT '0',
 `languageId` char(5) NOT NULL DEFAULT 'en-US',
 `createdById` int unsigned NOT NULL,
 `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `modifiedById` int unsigned NOT NULL,
 `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`),
 KEY `templates_bestPractice_idx` (`bestPractice`),
 KEY `templates_owner_idx` (`ownerId`),
 KEY `createdById` (`createdById`),
 KEY `modifiedById` (`modifiedById`),
 KEY `sourceTemplateId` (`sourceTemplateId`),
 CONSTRAINT `templates_ibfk_1` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`),
 CONSTRAINT `templates_ibfk_2` FOREIGN KEY (`modifiedById`) REFERENCES `users` (`id`),
 CONSTRAINT `templates_ibfk_3` FOREIGN KEY (`sourceTemplateId`) REFERENCES `templates` (`id`) ON DELETE CASCADE,
 CONSTRAINT `templates_ibfk_4` FOREIGN KEY (`ownerId`) REFERENCES `affiliations` (`uri`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `userDepartments` (
 `id` int unsigned NOT NULL AUTO_INCREMENT,
 `affiliationDepartmentId` int unsigned NOT NULL,
 `userId` int unsigned NOT NULL,
 `createdById` int unsigned NOT NULL,
 `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `modifiedById` int unsigned NOT NULL,
 `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`),
 UNIQUE KEY `unique_userDepts` (`affiliationDepartmentId`,`userId`),
 CONSTRAINT `fk_userDepts_aDeptId` FOREIGN KEY (`affiliationDepartmentId`) REFERENCES `affiliationDepartments` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `userEmails` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `userId` int unsigned NOT NULL,
  `email` varchar(255) NOT NULL,
  `isPrimary` tinyint(1) NOT NULL DEFAULT '0',
  `isConfirmed` tinyint(1) NOT NULL DEFAULT '0',
  `createdById` int unsigned NOT NULL,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedById` int unsigned NOT NULL,
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_userEmails_userId_email` (`userId`,`email`),
  KEY `userEmails_email_idx` (`email`),
  KEY `createdById` (`createdById`),
  KEY `modifiedById` (`modifiedById`),
  CONSTRAINT `useremails_ibfk_1` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`),
  CONSTRAINT `useremails_ibfk_2` FOREIGN KEY (`modifiedById`) REFERENCES `users` (`id`),
  CONSTRAINT `useremails_ibfk_3` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `users` (
 `id` int unsigned NOT NULL AUTO_INCREMENT,
 `password` varchar(255) NOT NULL,
 `role` varchar(16) NOT NULL DEFAULT 'RESEARCHER',
 `givenName` varchar(255) NOT NULL,
 `surName` varchar(255) NOT NULL,
 `affiliationId` varchar(255) DEFAULT NULL,
 `acceptedTerms` tinyint(1) NOT NULL DEFAULT '0',
 `orcid` varchar(255) DEFAULT NULL,
 `ssoId` varchar(255) DEFAULT NULL,
 `locked` tinyint(1) NOT NULL DEFAULT '0',
 `active` tinyint(1) NOT NULL DEFAULT '1',
 `languageId` char(5) NOT NULL DEFAULT 'en-US',
 `last_sign_in` timestamp NULL DEFAULT NULL,
 `last_sign_in_via` varchar(10) DEFAULT NULL,
 `failed_sign_in_attempts` int NOT NULL DEFAULT '0',
 `notify_on_comment_added` tinyint(1) NOT NULL DEFAULT '1',
 `notify_on_template_shared` tinyint(1) NOT NULL DEFAULT '1',
 `notify_on_feedback_complete` tinyint(1) NOT NULL DEFAULT '1',
 `notify_on_plan_shared` tinyint(1) NOT NULL DEFAULT '1',
 `notify_on_plan_visibility_change` tinyint(1) NOT NULL DEFAULT '1',
 `oldPasswordHash` varchar(255) DEFAULT NULL,
 `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `createdById` int unsigned DEFAULT NULL,
 `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `modifiedById` int unsigned DEFAULT NULL,
 PRIMARY KEY (`id`),
 KEY `users_surName_idx` (`surName`),
 KEY `users_affiliation_idx` (`affiliationId`),
 KEY `users_role_idx` (`role`),
 KEY `createdById` (`createdById`),
 KEY `modifiedById` (`modifiedById`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `versionedCustomQuestions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `versionedTemplateCustomizationId` int unsigned NOT NULL,
  `customQuestionId` int unsigned NOT NULL,
  `versionedCustomSectionId` int unsigned DEFAULT NULL,
  `displayOrder` int DEFAULT NULL,
  `currentPinnedVersionedQuestionId` int unsigned DEFAULT NULL,
  `priorPinnedVersionedQuestionId` int unsigned DEFAULT NULL,
  `questionTypeId` int unsigned NOT NULL,
  `questionText` text NOT NULL,
  `requirementText` text,
  `guidanceText` text,
  `sampleText` text,
  `required` tinyint(1) NOT NULL DEFAULT '0',
  `createdById` int unsigned NOT NULL,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedById` int unsigned NOT NULL,
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_vCustomQs_templateCustId` (`versionedTemplateCustomizationId`),
  KEY `fk_vCustomQs_questionId` (`customQuestionId`),
  KEY `fk_vCustomQs_sectionId` (`versionedCustomSectionId`),
  KEY `fk_vCustomQs_currentId` (`currentPinnedVersionedQuestionId`),
  KEY `fk_vCustomQs_priorId` (`priorPinnedVersionedQuestionId`),
  CONSTRAINT `fk_vCustomQs_currentId` FOREIGN KEY (`currentPinnedVersionedQuestionId`) REFERENCES `versionedQuestions` (`id`),
  CONSTRAINT `fk_vCustomQs_priorId` FOREIGN KEY (`priorPinnedVersionedQuestionId`) REFERENCES `versionedQuestions` (`id`),
  CONSTRAINT `fk_vCustomQs_questionId` FOREIGN KEY (`customQuestionId`) REFERENCES `customQuestions` (`id`),
  CONSTRAINT `fk_vCustomQs_sectionId` FOREIGN KEY (`versionedCustomSectionId`) REFERENCES `customSections` (`id`),
  CONSTRAINT `fk_vCustomQs_templateCustId` FOREIGN KEY (`versionedTemplateCustomizationId`) REFERENCES `templateCustomizations` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `versionedCustomSections` (
 `id` int unsigned NOT NULL AUTO_INCREMENT,
 `versionedTemplateCustomizationId` int unsigned NOT NULL,
 `customSectionId` int unsigned NOT NULL,
 `currentPinnedVersionedSectionId` int unsigned NOT NULL,
 `priorPinnedVersionedSectionId` int unsigned DEFAULT NULL,
 `name` varchar(255) NOT NULL,
 `introduction` text,
 `requirements` text,
 `guidance` text,
 `displayOrder` int NOT NULL,
 `createdById` int unsigned NOT NULL,
 `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `modifiedById` int unsigned NOT NULL,
 `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`),
 KEY `fk_vCustomSecs_templateCustId` (`versionedTemplateCustomizationId`),
 KEY `fk_vCustomSecs_sectionId` (`customSectionId`),
 KEY `fk_vCustomSecs_currentId` (`currentPinnedVersionedSectionId`),
 KEY `fk_vCustomSecs_priorId` (`priorPinnedVersionedSectionId`),
 CONSTRAINT `fk_vCustomSecs_currentId` FOREIGN KEY (`currentPinnedVersionedSectionId`) REFERENCES `versionedSections` (`id`),
 CONSTRAINT `fk_vCustomSecs_priorId` FOREIGN KEY (`priorPinnedVersionedSectionId`) REFERENCES `versionedSections` (`id`),
 CONSTRAINT `fk_vCustomSecs_sectionId` FOREIGN KEY (`customSectionId`) REFERENCES `customSections` (`id`),
 CONSTRAINT `fk_vCustomSecs_templateCustId` FOREIGN KEY (`versionedTemplateCustomizationId`) REFERENCES `templateCustomizations` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `versionedGuidance` (
 `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 `versionedGuidanceGroupId` int UNSIGNED NOT NULL,
 `guidanceId` int UNSIGNED NOT NULL,
 `guidanceText` text,
 `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `createdById` int UNSIGNED NOT NULL,
 `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `modifiedById` int UNSIGNED NOT NULL,
 KEY `idx_vg_versionedGuidanceGroupId` (`versionedGuidanceGroupId`),
 KEY `idx_vg_createdById` (`createdById`),
 KEY `idx_vg_modifiedById` (`modifiedById`),
 CONSTRAINT `fk_vg_versionedGuidanceGroupId`
   FOREIGN KEY (`versionedGuidanceGroupId`) REFERENCES `versionedGuidanceGroups` (`id`) ON DELETE CASCADE,
 CONSTRAINT `fk_vg_createdById`
   FOREIGN KEY (`createdById`) REFERENCES `users` (`id`) ON DELETE CASCADE,
 CONSTRAINT `fk_vg_modifiedById`
   FOREIGN KEY (`modifiedById`) REFERENCES `users` (`id`) ON DELETE CASCADE,
 CONSTRAINT `fk_vg_guidanceId`
   FOREIGN KEY (`guidanceId`) REFERENCES `guidance` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `versionedGuidanceGroups` (
 `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 `guidanceGroupId` int UNSIGNED NOT NULL,
 `version` int DEFAULT NULL,
 `bestPractice` tinyint(1) NOT NULL DEFAULT '0',
 `active` tinyint(1) NOT NULL DEFAULT '0',
 `optionalSubset` tinyint(1) NOT NULL DEFAULT '0',
 `name` text,
 `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `createdById` int UNSIGNED NOT NULL,
 `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `modifiedById` int UNSIGNED NOT NULL,
 KEY `idx_vgg_guidanceGroupId` (`guidanceGroupId`),
 KEY `idx_vgg_createdById` (`createdById`),
 KEY `idx_vgg_modifiedById` (`modifiedById`),
 CONSTRAINT `fk_vgg_guidanceGroupId`
   FOREIGN KEY (`guidanceGroupId`) REFERENCES `guidanceGroups` (`id`) ON DELETE CASCADE,
 CONSTRAINT `fk_vgg_createdById`
   FOREIGN KEY (`createdById`) REFERENCES `users` (`id`) ON DELETE CASCADE,
 CONSTRAINT `fk_vgg_modifiedById`
   FOREIGN KEY (`modifiedById`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `versionedGuidanceTags` (
 `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 `versionedGuidanceId` int UNSIGNED NOT NULL,
 `tagId` int UNSIGNED NOT NULL,
 `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `createdById` int UNSIGNED NOT NULL,
 `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `modifiedById` int UNSIGNED NOT NULL,
 KEY `idx_vgt_versionedGuidanceId` (`versionedGuidanceId`),
 KEY `idx_vgt_tagId` (`tagId`),
 KEY `idx_vgt_createdById` (`createdById`),
 KEY `idx_vgt_modifiedById` (`modifiedById`),
 CONSTRAINT `fk_vgt_versionedGuidanceId`
   FOREIGN KEY (`versionedGuidanceId`) REFERENCES `versionedGuidance` (`id`) ON DELETE CASCADE,
 CONSTRAINT `fk_vgt_tagId`
   FOREIGN KEY (`tagId`) REFERENCES `tags` (`id`) ON DELETE CASCADE,
 CONSTRAINT `fk_vgt_createdById`
   FOREIGN KEY (`createdById`) REFERENCES `users` (`id`) ON DELETE CASCADE,
 CONSTRAINT `fk_vgt_modifiedById`
   FOREIGN KEY (`modifiedById`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `versionedQuestionConditions` (
 `id` int unsigned NOT NULL AUTO_INCREMENT,
 `versionedQuestionId` int unsigned NOT NULL,
 `questionConditionId` int unsigned NOT NULL,
 `action` varchar(255) NOT NULL DEFAULT 'SHOW_QUESTION',
 `conditionType` varchar(255) NOT NULL DEFAULT 'EQUAL',
 `conditionMatch` varchar(255) DEFAULT NULL,
 `target` varchar(255) NOT NULL,
 `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `createdById` int unsigned NOT NULL,
 `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `modifiedById` int unsigned NOT NULL,
 PRIMARY KEY (`id`),
 KEY `createdById` (`createdById`),
 KEY `modifiedById` (`modifiedById`),
 KEY `versionedQuestionId` (`versionedQuestionId`),
 KEY `questionConditionId` (`questionConditionId`),
 CONSTRAINT `versionedquestionconditions_ibfk_1` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`),
 CONSTRAINT `versionedquestionconditions_ibfk_2` FOREIGN KEY (`modifiedById`) REFERENCES `users` (`id`),
 CONSTRAINT `versionedquestionconditions_ibfk_3` FOREIGN KEY (`versionedQuestionId`) REFERENCES `versionedQuestions` (`id`) ON DELETE CASCADE,
 CONSTRAINT `versionedquestionconditions_ibfk_4` FOREIGN KEY (`questionConditionId`) REFERENCES `questionConditions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `versionedQuestionCustomizations` (
 `id` int unsigned NOT NULL AUTO_INCREMENT,
 `templateCustomizationId` int unsigned NOT NULL,
 `questionCustomizationId` int unsigned NOT NULL,
 `currentVersionedQuestionId` int unsigned NOT NULL,
 `priorVersionedQuestionId` int unsigned DEFAULT NULL,
 `requirementText` text,
 `guidanceText` text,
 `sampleText` text,
 `createdById` int unsigned NOT NULL,
 `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `modifiedById` int unsigned NOT NULL,
 `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`),
 UNIQUE KEY `unique_vQuestionCusts` (`templateCustomizationId`,`questionCustomizationId`),
 KEY `fk_vQCust_questionId` (`questionCustomizationId`),
 KEY `fk_vQCust_currentId` (`currentVersionedQuestionId`),
 KEY `fk_vQCust_priorId` (`priorVersionedQuestionId`),
 CONSTRAINT `fk_vQCust_currentId` FOREIGN KEY (`currentVersionedQuestionId`) REFERENCES `versionedQuestions` (`id`),
 CONSTRAINT `fk_vQCust_priorId` FOREIGN KEY (`priorVersionedQuestionId`) REFERENCES `versionedQuestions` (`id`),
 CONSTRAINT `fk_vQCust_questionId` FOREIGN KEY (`questionCustomizationId`) REFERENCES `questionCustomizations` (`id`),
 CONSTRAINT `fk_vQCust_templateCustId` FOREIGN KEY (`templateCustomizationId`) REFERENCES `templateCustomizations` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `versionedQuestions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `versionedTemplateId` int unsigned NOT NULL,
  `versionedSectionId` int unsigned NOT NULL,
  `questionId` int unsigned NOT NULL,
  `questionText` text NOT NULL,
  `json` json DEFAULT NULL,
  `requirementText` text,
  `guidanceText` text,
  `sampleText` text,
  `required` tinyint(1) NOT NULL DEFAULT '0',
  `displayOrder` int NOT NULL,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdById` int unsigned NOT NULL,
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedById` int unsigned NOT NULL,
  `useSampleTextAsDefault` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `versionedQuestions_template_idx` (`versionedTemplateId`,`displayOrder`),
  KEY `versionedQuestions_section_idx` (`versionedSectionId`,`displayOrder`),
  KEY `createdById` (`createdById`),
  KEY `modifiedById` (`modifiedById`),
  KEY `questionId` (`questionId`),
  CONSTRAINT `versionedquestions_ibfk_1` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`),
  CONSTRAINT `versionedquestions_ibfk_2` FOREIGN KEY (`modifiedById`) REFERENCES `users` (`id`),
  CONSTRAINT `versionedquestions_ibfk_3` FOREIGN KEY (`versionedTemplateId`) REFERENCES `versionedTemplates` (`id`) ON DELETE CASCADE,
  CONSTRAINT `versionedquestions_ibfk_4` FOREIGN KEY (`versionedSectionId`) REFERENCES `versionedSections` (`id`) ON DELETE CASCADE,
  CONSTRAINT `versionedquestions_ibfk_5` FOREIGN KEY (`questionId`) REFERENCES `questions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `versionedSectionCustomizations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `templateCustomizationId` int unsigned NOT NULL,
  `sectionCustomizationId` int unsigned NOT NULL,
  `currentVersionedSectionId` int unsigned NOT NULL,
  `priorVersionedSectionId` int unsigned DEFAULT NULL,
  `requirements` text,
  `guidance` text,
  `createdById` int unsigned NOT NULL,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedById` int unsigned NOT NULL,
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_vSectionCusts` (`templateCustomizationId`,`sectionCustomizationId`),
  KEY `fk_vSectionCust_sectionId` (`sectionCustomizationId`),
  KEY `fk_vSectionCust_currentId` (`currentVersionedSectionId`),
  KEY `fk_vSectionCust_priorId` (`priorVersionedSectionId`),
  CONSTRAINT `fk_vSectionCust_currentId` FOREIGN KEY (`currentVersionedSectionId`) REFERENCES `versionedSections` (`id`),
  CONSTRAINT `fk_vSectionCust_priorId` FOREIGN KEY (`priorVersionedSectionId`) REFERENCES `versionedSections` (`id`),
  CONSTRAINT `fk_vSectionCust_sectionId` FOREIGN KEY (`sectionCustomizationId`) REFERENCES `sectionCustomizations` (`id`),
  CONSTRAINT `fk_vSectionCust_templateCustId` FOREIGN KEY (`templateCustomizationId`) REFERENCES `templateCustomizations` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `versionedSections` (
 `id` int unsigned NOT NULL AUTO_INCREMENT,
 `versionedTemplateId` int unsigned NOT NULL,
 `sectionId` int unsigned NOT NULL,
 `name` varchar(255) NOT NULL,
 `introduction` text,
 `requirements` text,
 `guidance` text,
 `displayOrder` int NOT NULL,
 `bestPractice` tinyint(1) NOT NULL DEFAULT '0',
 `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `createdById` int unsigned NOT NULL,
 `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `modifiedById` int unsigned NOT NULL,
 PRIMARY KEY (`id`),
 KEY `versionedSections_template_idx` (`versionedTemplateId`,`displayOrder`),
 KEY `versionedSections_name_ids` (`name`),
 KEY `createdById` (`createdById`),
 KEY `modifiedById` (`modifiedById`),
 KEY `sectionId` (`sectionId`),
 CONSTRAINT `versionedsections_ibfk_1` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`),
 CONSTRAINT `versionedsections_ibfk_2` FOREIGN KEY (`modifiedById`) REFERENCES `users` (`id`),
 CONSTRAINT `versionedsections_ibfk_3` FOREIGN KEY (`sectionId`) REFERENCES `sections` (`id`) ON DELETE CASCADE,
 CONSTRAINT `versionedsections_ibfk_4` FOREIGN KEY (`versionedTemplateId`) REFERENCES `versionedTemplates` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `versionedSectionTags` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `versionedSectionId` int unsigned NOT NULL,
  `tagId` int unsigned NOT NULL,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdById` int unsigned NOT NULL,
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedById` int unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `versionedSectionTags_idx` (`versionedSectionId`,`tagId`),
  KEY `createdById` (`createdById`),
  KEY `modifiedById` (`modifiedById`),
  KEY `tagId` (`tagId`),
  CONSTRAINT `versionedsectiontags_ibfk_1` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`),
  CONSTRAINT `versionedsectiontags_ibfk_2` FOREIGN KEY (`modifiedById`) REFERENCES `users` (`id`),
  CONSTRAINT `versionedsectiontags_ibfk_3` FOREIGN KEY (`versionedSectionId`) REFERENCES `versionedSections` (`id`) ON DELETE CASCADE,
  CONSTRAINT `versionedsectiontags_ibfk_4` FOREIGN KEY (`tagId`) REFERENCES `tags` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `versionedTemplateCustomizations` (
 `id` int unsigned NOT NULL AUTO_INCREMENT,
 `affiliationId` varchar(255) NOT NULL,
 `templateCustomizationId` int unsigned NOT NULL,
 `currentVersionedTemplateId` int unsigned NOT NULL,
 `priorVersionedTemplateId` int unsigned DEFAULT NULL,
 `status` varchar(8) NOT NULL DEFAULT 'DRAFT',
 `active` tinyint(1) NOT NULL DEFAULT '1',
 `createdById` int unsigned NOT NULL,
 `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `modifiedById` int unsigned NOT NULL,
 `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`),
 UNIQUE KEY `unique_vTemplateCusts` (`affiliationId`,`templateCustomizationId`),
 KEY `fk_vTemplateCust_templateId` (`templateCustomizationId`),
 KEY `fk_vTemplateCust_currentId` (`currentVersionedTemplateId`),
 KEY `fk_vTemplateCust_priorId` (`priorVersionedTemplateId`),
 CONSTRAINT `fk_vTemplateCust_affiliationId` FOREIGN KEY (`affiliationId`) REFERENCES `affiliations` (`uri`),
 CONSTRAINT `fk_vTemplateCust_currentId` FOREIGN KEY (`currentVersionedTemplateId`) REFERENCES `versionedTemplates` (`id`),
 CONSTRAINT `fk_vTemplateCust_priorId` FOREIGN KEY (`priorVersionedTemplateId`) REFERENCES `versionedTemplates` (`id`),
 CONSTRAINT `fk_vTemplateCust_templateId` FOREIGN KEY (`templateCustomizationId`) REFERENCES `templateCustomizations` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `versionedTemplateLinks` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `versionedTemplateId` int unsigned NOT NULL,
  `linkType` varchar(255) NOT NULL DEFAULT 'FUNDER',
  `url` varchar(255) DEFAULT NULL,
  `text` varchar(255) DEFAULT NULL,
  `createdById` int unsigned NOT NULL,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedById` int unsigned NOT NULL,
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_vtemplateLinks` (`versionedTemplateId`,`url`),
  CONSTRAINT `fk_vtemplateLinks_vtemplateId` FOREIGN KEY (`versionedTemplateId`) REFERENCES `versionedTemplates` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `versionedTemplates` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `templateId` int unsigned NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '0',
  `version` varchar(16) NOT NULL,
  `versionType` varchar(16) NOT NULL DEFAULT 'Draft',
  `versionedById` int unsigned NOT NULL,
  `comment` text,
  `name` text NOT NULL,
  `description` text,
  `ownerId` varchar(255) NOT NULL,
  `visibility` varchar(16) NOT NULL,
  `bestPractice` tinyint(1) NOT NULL DEFAULT '0',
  `languageId` char(5) NOT NULL DEFAULT 'en-US',
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdById` int unsigned NOT NULL,
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedById` int unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `versionedTemplates_active_idx` (`active`),
  KEY `versionedTemplates_owner_idx` (`ownerId`),
  KEY `createdById` (`createdById`),
  KEY `modifiedById` (`modifiedById`),
  KEY `templateId` (`templateId`),
  KEY `versionedById` (`versionedById`),
  CONSTRAINT `versionedtemplates_ibfk_1` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`),
  CONSTRAINT `versionedtemplates_ibfk_2` FOREIGN KEY (`modifiedById`) REFERENCES `users` (`id`),
  CONSTRAINT `versionedtemplates_ibfk_3` FOREIGN KEY (`templateId`) REFERENCES `templates` (`id`) ON DELETE CASCADE,
  CONSTRAINT `versionedtemplates_ibfk_4` FOREIGN KEY (`versionedById`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `works` (
 `id` int unsigned NOT NULL AUTO_INCREMENT,
 `doi` varchar(255) NOT NULL,
 `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `createdById` int unsigned DEFAULT NULL,
 `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 `modifiedById` int unsigned DEFAULT NULL,
 PRIMARY KEY (`id`),
 UNIQUE KEY `unique_doi` (`doi`),
 KEY `fk_works_users_createdById` (`createdById`),
 CONSTRAINT `fk_works_users_createdById` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `workVersions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `workId` int unsigned NOT NULL,
  `hash` binary(16) NOT NULL,
  `workType` varchar(255) NOT NULL,
  `publicationDate` date DEFAULT NULL,
  `title` text,
  `abstractText` mediumtext,
  `authors` json NOT NULL,
  `institutions` json NOT NULL,
  `funders` json NOT NULL,
  `awards` json NOT NULL,
  `publicationVenue` varchar(1000) DEFAULT NULL,
  `sourceName` varchar(255) NOT NULL,
  `sourceUrl` varchar(255) DEFAULT NULL,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdById` int unsigned DEFAULT NULL,
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `modifiedById` int unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_hash` (`workId`,`hash`),
  KEY `fk_workVersions_users_createdById` (`createdById`),
  CONSTRAINT `fk_workVersions_users_createdById` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_workVersions_works_workId` FOREIGN KEY (`workId`) REFERENCES `works` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET FOREIGN_KEY_CHECKS = 1;

COMMIT;


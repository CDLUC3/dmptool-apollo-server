-- Need to first drop table if it already exists because we have to rebuild them
DROP TABLE IF EXISTS questionTags;
DROP TABLE IF EXISTS versionedQuestionTags;


CREATE TABLE `questionTags` (
 `id` int unsigned NOT NULL AUTO_INCREMENT,
 `questionId` int unsigned NOT NULL,
 `tagId` int unsigned NOT NULL,
 `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `createdById` int unsigned NOT NULL,
 `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `modifiedById` int unsigned NOT NULL,
 PRIMARY KEY (`id`),
 KEY `questionTags_idx` (`questionId`,`tagId`),
 KEY `createdById` (`createdById`),
 KEY `modifiedById` (`modifiedById`),
 KEY `tagId` (`tagId`),
 CONSTRAINT `questiontags_ibfk_1` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`),
 CONSTRAINT `questiontags_ibfk_2` FOREIGN KEY (`modifiedById`) REFERENCES `users` (`id`),
 CONSTRAINT `questiontags_ibfk_3` FOREIGN KEY (`questionId`) REFERENCES `questions` (`id`) ON DELETE CASCADE,
 CONSTRAINT `questiontags_ibfk_4` FOREIGN KEY (`tagId`) REFERENCES `tags` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `versionedQuestionTags` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `versionedQuestionId` int unsigned NOT NULL,
  `tagId` int unsigned NOT NULL,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdById` int unsigned NOT NULL,
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedById` int unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `versionedQuestionTags_idx` (`versionedQuestionId`,`tagId`),
  KEY `createdById` (`createdById`),
  KEY `modifiedById` (`modifiedById`),
  KEY `tagId` (`tagId`),
  CONSTRAINT `versionedquestiontags_ibfk_1` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`),
  CONSTRAINT `versionedquestiontags_ibfk_2` FOREIGN KEY (`modifiedById`) REFERENCES `users` (`id`),
  CONSTRAINT `versionedquestiontags_ibfk_3` FOREIGN KEY (`versionedQuestionId`) REFERENCES `versionedQuestions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `versionedquestiontags_ibfk_4` FOREIGN KEY (`tagId`) REFERENCES `tags` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
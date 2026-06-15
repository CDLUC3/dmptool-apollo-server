CREATE TABLE `adminNotifications` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `notificationType` varchar(50) NOT NULL,
  `affiliationId` varchar(255) NOT NULL,
  `metadata` json DEFAULT NULL,
  `isRead` tinyint(1) NOT NULL DEFAULT 0,
  `createdById` int unsigned NOT NULL,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedById` int unsigned NOT NULL,
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `affiliationId` (`affiliationId`),
  KEY `notificationType` (`notificationType`),
  CONSTRAINT `adminNotifications_ibfk_2` FOREIGN KEY (`affiliationId`) REFERENCES `affiliations` (`uri`),
  CONSTRAINT `adminNotifications_ibfk_3` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`),
  CONSTRAINT `adminNotifications_ibfk_4` FOREIGN KEY (`modifiedById`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
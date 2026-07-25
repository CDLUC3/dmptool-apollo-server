CREATE TABLE `passwordResetTokens` (
 `id` int unsigned NOT NULL AUTO_INCREMENT,
  `userId` int unsigned DEFAULT NULL,
  `resetPasswordToken` varchar(255) DEFAULT NULL,
  `resetPasswordExpiresAt` timestamp NULL DEFAULT NULL,
  `usedAt` timestamp NULL DEFAULT NULL,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdById` int unsigned NOT NULL,
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedById` int unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_userId` (`userId`),
  UNIQUE KEY `uq_resetPasswordToken` (`resetPasswordToken`),
  CONSTRAINT `passwordResetTokens_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci; 
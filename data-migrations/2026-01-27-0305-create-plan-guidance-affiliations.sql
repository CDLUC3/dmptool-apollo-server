-- Join table to store relationship between plans and guidance affiliations per userId
CREATE TABLE `planGuidance` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `planId` INT UNSIGNED NOT NULL,
  `affiliationId` VARCHAR(255) NOT NULL,
  `userId` INT UNSIGNED NOT NULL,
  `created` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdById` int NOT NULL,
  `modified` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `modifiedById` int NOT NULL,

  UNIQUE KEY `unique_plan_affiliation_user` (`planId`, `affiliationId`, `userId`),
  
  FOREIGN KEY (`planId`) REFERENCES `plans`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`affiliationId`) REFERENCES `affiliations`(`uri`) ON DELETE CASCADE,
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  
  KEY `idx_plan_id` (`planId`),
  KEY `idx_affiliation_id` (`affiliationId`),
  KEY `idx_user_id` (`userId`),
  KEY `idx_plan_user` (`planId`, `userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
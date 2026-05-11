-- Join table to store relationship between plans and alternate identifiers
CREATE TABLE `alternateIdentifiers` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `planId` INT UNSIGNED NOT NULL,
  `alternateIdentifier` VARCHAR(512) NOT NULL,
  `created` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdById` int NOT NULL,
  `modified` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `modifiedById` int NOT NULL,

  FOREIGN KEY (`planId`) REFERENCES `plans`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `unique_planAlternateIds` (`planId`,`alternateIdentifier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

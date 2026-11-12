-- Table to support data sync jobs, tracking their status, cursor position, and error information.
CREATE TABLE `syncJobStatus` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `jobName` VARCHAR(100) NOT NULL,
  `status` ENUM('IDLE', 'RUNNING', 'FAILED', 'COMPLETED') NOT NULL DEFAULT 'IDLE',
  `cursorTimestamp` DATETIME(3) NOT NULL DEFAULT '1900-01-01 00:00:00.000',
  `cursorId` BIGINT UNSIGNED DEFAULT NULL,
  `lockedAt` DATETIME(3) DEFAULT NULL,
  `lastRunAt` DATETIME(3) DEFAULT NULL,
  `lastSuccessAt` DATETIME(3) DEFAULT NULL,
  `failureCount` INT UNSIGNED NOT NULL DEFAULT 0,
  `errorMessage` TEXT DEFAULT NULL,
  `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdById` BIGINT UNSIGNED NOT NULL,
  `modified` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `modifiedById` BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_job_name` (`jobName`),
  KEY `idx_status` (`status`),
  FOREIGN KEY (`createdById`) REFERENCES `user`(`id`),
  FOREIGN KEY (`modifiedById`) REFERENCES `user`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

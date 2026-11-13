-- Table to support data sync jobs, tracking their status, cursor position, and error information.
CREATE TABLE `syncJobStatus` (
  `jobName` VARCHAR(100) NOT NULL,
  `status` ENUM('IDLE', 'RUNNING', 'FAILED', 'COMPLETED') NOT NULL DEFAULT 'IDLE',
  `cursorTimestamp` timestamp NOT NULL DEFAULT '1990-01-01 00:00:00',
  `cursorId` BIGINT UNSIGNED DEFAULT NULL,
  `lockedAt` timestamp DEFAULT NULL,
  `lastRunAt` timestamp DEFAULT NULL,
  `lastSuccessAt` timestamp DEFAULT NULL,
  `failureCount` INT UNSIGNED NOT NULL DEFAULT 0,
  `errorMessage` TEXT DEFAULT NULL,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`jobName`),
  UNIQUE KEY `unique_job_name` (`jobName`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

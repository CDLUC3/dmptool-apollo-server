ALTER TABLE `users`
ADD COLUMN `isArchived` tinyint(1) NOT NULL DEFAULT '0' AFTER `active`;
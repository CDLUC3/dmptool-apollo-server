ALTER TABLE `repositories` ADD COLUMN `re3data_id` varchar(255) DEFAULT NULL;
ALTER TABLE `repositories` ADD UNIQUE KEY `unique_re3data_id` (`re3data_id`);

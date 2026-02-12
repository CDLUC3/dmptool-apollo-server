ALTER TABLE `repositories` ADD COLUMN `re3data_id` varchar(255) DEFAULT NULL;
ALTER TABLE `repositories` ADD UNIQUE KEY `unique_re3data_id` (`re3data_id`);

UPDATE repositories
SET re3data_id = SUBSTRING(
  uri,
  LENGTH('https://www.re3data.org/repository/') + 1
                 )
WHERE uri LIKE 'https://www.re3data.org/repository/%'
  AND (re3data_id IS NULL OR re3data_id = '');


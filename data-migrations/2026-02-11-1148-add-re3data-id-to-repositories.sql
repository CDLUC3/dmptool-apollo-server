ALTER TABLE `repositories` ADD COLUMN `re3dataId` varchar(255) DEFAULT NULL;
ALTER TABLE `repositories` ADD UNIQUE KEY `unique_re3dataId` (`re3dataId`);

UPDATE repositories
SET re3dataId = SUBSTRING(
  uri,
  LENGTH('https://www.re3data.org/repository/') + 1
                 )
WHERE uri LIKE 'https://www.re3data.org/repository/%'
  AND (re3dataId IS NULL OR re3dataId = '');


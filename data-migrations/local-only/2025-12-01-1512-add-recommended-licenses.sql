SET @default_super_id := (SELECT userId FROM userEmails WHERE email = 'super@example.com');

-- Set all existing licenses to not be recommended
UPDATE `licenses` SET `recommended` = 0;
-- If our recommended licenses already exist, delete them
DELETE FROM `licenses` WHERE `name` IN ('CC0-1.0', 'CC-BY-4.0', 'MIT');

-- Add the recommended licenses
INSERT INTO licenses (name, description, uri, recommended, createdById, created, modifiedById, modified) VALUES ('CC0-1.0', 'Creative Commons Zero v1.0 Universal', 'https://spdx.org/licenses/CC0-1.0.json', 1, @default_super_id, CURDATE(), @default_super_id, CURDATE());
INSERT INTO licenses (name, description, uri, recommended, createdById, created, modifiedById, modified) VALUES ('CC-BY-4.0', 'Creative Commons Attribution 4.0 International', 'https://spdx.org/licenses/CC-BY-4.0.json', 1, @default_super_id, CURDATE(), @default_super_id, CURDATE());
INSERT INTO licenses (name, description, uri, recommended, createdById, created, modifiedById, modified) VALUES ('MIT', 'MIT License', 'https://spdx.org/licenses/MIT.json', 1, @default_super_id, CURDATE(), @default_super_id, CURDATE());

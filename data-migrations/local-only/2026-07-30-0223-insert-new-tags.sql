SET @default_email_domain = 'example.com';
SET @default_super_id := (SELECT userId FROM userEmails WHERE email = CONCAT('super@', @default_email_domain));
SET @default_admin_id := (SELECT userId FROM userEmails WHERE email = CONCAT('admin@', @default_email_domain));

INSERT INTO tags (name, slug, description, createdById, created, modifiedById, modified)
VALUES ('Software management', 'software-management', 'Tracking and managing software used in research projects.', @default_super_id, NOW(), @default_admin_id, NOW());

INSERT INTO tags (name, slug, description, createdById, created, modifiedById, modified)
VALUES ('AI-Ready data', 'ai-ready-data', 'Data that is ready to be used with AI/ML models.', @default_super_id, NOW(), @default_admin_id, NOW());
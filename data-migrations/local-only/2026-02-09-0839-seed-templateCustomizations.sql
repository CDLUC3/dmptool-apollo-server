-- Use the test ADMIN user and NSF templates to seed some customization data
SET @affiliation_uri := 'https://ror.org/03yrm5c26';
SET @nsf_uri = 'https://ror.org/021nxhr62';
SET @admin_id := (SELECT id FROM userEmails WHERE email = 'admin@example.com');


-- Customization migrationStatus `OK`, status `PUBLISHED` and isDirty is false
SET @nsf_gen_id := (SELECT id FROM templates WHERE name = 'NSF-GEN: Generic' AND ownerId = @nsf_uri);
SET @v_nsf_gen_id := (SELECT id FROM versionedTemplates WHERE templateId = @nsf_gen_id AND active = 1);

INSERT INTO templateCustomizations (affiliationId, templateId, currentVersionedTemplateId, status, migrationStatus, isDirty, latestPublishedDate, createdById, created, modifiedById, modified) VALUES (@affiliation_uri, @nsf_gen_id, @v_nsf_gen_id, 'PUBLISHED', 'OK', 0, CURDATE(), @admin_id, CURDATE(), @admin_id, CURDATE());
SET @ok_gen_id := (SELECT id FROM templateCustomizations WHERE affiliationId = @affiliation_uri AND templateId = @nsf_gen_id);
INSERT INTO versionedTemplateCustomizations (affiliationId, templateCustomizationId, currentVersionedTemplateId, active, createdById, created, modifiedById, modified) VALUES (@affiliation_uri, @ok_gen_id, @v_nsf_gen_id, 1, @admin_id, CURDATE(), @admin_id, CURDATE());
SET @v_ok_gen_id := (SELECT id FROM versionedTemplateCustomizations WHERE affiliationId = @affiliation_uri AND currentVersionedTemplateId = @v_nsf_gen_id);
UPDATE templateCustomizations SET latestPublishedVersionId = @v_ok_gen_id WHERE affiliationId = @affiliation_uri AND templateId = @nsf_gen_id;


-- Customization migrationStatus `STALE` status `PUBLISHED` isDirty `1`
SET @nsf_phy_id := (SELECT id FROM templates WHERE name = 'NSF-PHY: Physics' AND ownerId = @nsf_uri);
SET @v_nsf_phy_id := (SELECT id FROM versionedTemplates WHERE templateId = @nsf_phy_id AND active = 0 ORDER BY created DESC LIMIT 1);

INSERT INTO templateCustomizations (affiliationId, templateId, currentVersionedTemplateId, status, migrationStatus, isDirty, latestPublishedDate, createdById, created, modifiedById, modified) VALUES (@affiliation_uri, @nsf_phy_id, @v_nsf_phy_id, 'PUBLISHED', 'STALE', 1, CURDATE(), @admin_id, CURDATE(), @admin_id, CURDATE());
SET @ok_phy_id := (SELECT id FROM templateCustomizations WHERE affiliationId = @affiliation_uri AND templateId = @nsf_phy_id);
INSERT INTO versionedTemplateCustomizations (affiliationId, templateCustomizationId, currentVersionedTemplateId, active, createdById, created, modifiedById, modified) VALUES (@affiliation_uri, @ok_phy_id, @v_nsf_phy_id, 1, @admin_id, CURDATE(), @admin_id, CURDATE());
SET @v_ok_phy_id := (SELECT id FROM versionedTemplateCustomizations WHERE affiliationId = @affiliation_uri AND currentVersionedTemplateId = @v_nsf_phy_id);
UPDATE templateCustomizations SET latestPublishedVersionId = @v_ok_phy_id WHERE affiliationId = @affiliation_uri AND templateId = @nsf_phy_id;


-- Customization migrationStatus `ORPHANED` status `PUBLISHED`
SET @nsf_bio_id := (SELECT id FROM templates WHERE name = 'NSF-BIO: Biological Sciences (2011-2012) OBSOLETE' AND ownerId = @nsf_uri);
SET @v_nsf_bio_id := (SELECT id FROM versionedTemplates WHERE templateId = @nsf_bio_id AND active = 0 ORDER BY created DESC LIMIT 1);

INSERT INTO templateCustomizations (affiliationId, templateId, currentVersionedTemplateId, status, migrationStatus, isDirty, latestPublishedDate, createdById, created, modifiedById, modified) VALUES (@affiliation_uri, @nsf_bio_id, @v_nsf_bio_id, 'PUBLISHED', 'ORPHANED', 0, CURDATE(), @admin_id, CURDATE(), @admin_id, CURDATE());
SET @ok_bio_id := (SELECT id FROM templateCustomizations WHERE affiliationId = @affiliation_uri AND templateId = @nsf_bio_id);
INSERT INTO versionedTemplateCustomizations (affiliationId, templateCustomizationId, currentVersionedTemplateId, active, createdById, created, modifiedById, modified) VALUES (@affiliation_uri, @ok_bio_id, @v_nsf_bio_id, 1, @admin_id, CURDATE(), @admin_id, CURDATE());
SET @v_ok_bio_id := (SELECT id FROM versionedTemplateCustomizations WHERE affiliationId = @affiliation_uri AND currentVersionedTemplateId = @v_nsf_bio_id);
UPDATE templateCustomizations SET latestPublishedVersionId = @v_ok_bio_id WHERE affiliationId = @affiliation_uri AND templateId = @nsf_bio_id;


-- Customization migrationStatus `OK`, status `PUBLISHED` and isDirty is true
SET @nsf_dms_id := (SELECT id FROM templates WHERE name = 'NSF-DMS: Mathematical Sciences' AND ownerId = @nsf_uri);
SET @v_nsf_dms_id := (SELECT id FROM versionedTemplates WHERE templateId = @nsf_dms_id AND active = 1);

INSERT INTO templateCustomizations (affiliationId, templateId, currentVersionedTemplateId, status, migrationStatus, isDirty, latestPublishedDate, createdById, created, modifiedById, modified) VALUES (@affiliation_uri, @nsf_dms_id, @v_nsf_dms_id, 'PUBLISHED', 'OK', 1, CURDATE(), @admin_id, CURDATE(), @admin_id, CURDATE());
SET @ok_dms_id := (SELECT id FROM templateCustomizations WHERE affiliationId = @affiliation_uri AND templateId = @nsf_dms_id);
INSERT INTO versionedTemplateCustomizations (affiliationId, templateCustomizationId, currentVersionedTemplateId, active, createdById, created, modifiedById, modified) VALUES (@affiliation_uri, @ok_dms_id, @v_nsf_dms_id, 1, @admin_id, CURDATE(), @admin_id, CURDATE());
SET @v_ok_dms_id := (SELECT id FROM versionedTemplateCustomizations WHERE affiliationId = @affiliation_uri AND currentVersionedTemplateId = @v_nsf_dms_id);
UPDATE templateCustomizations SET latestPublishedVersionId = @v_ok_dms_id WHERE affiliationId = @affiliation_uri AND templateId = @nsf_dms_id;


-- Customization migrationStatus `OK`, status `DRAFT` and isDirty is true
SET @nsf_ehr_id := (SELECT id FROM templates WHERE name = 'NSF-EHR: Education and Human Resources' AND ownerId = @nsf_uri);
SET @v_nsf_ehr_id := (SELECT id FROM versionedTemplates WHERE templateId = @nsf_ehr_id AND active = 1);

INSERT INTO templateCustomizations (affiliationId, templateId, currentVersionedTemplateId, status, migrationStatus, isDirty, latestPublishedDate, createdById, created, modifiedById, modified) VALUES (@affiliation_uri, @nsf_ehr_id, @v_nsf_ehr_id, 'DRAFT', 'OK', 1, CURDATE(), @admin_id, CURDATE(), @admin_id, CURDATE());
SET @ok_ehr_id := (SELECT id FROM templateCustomizations WHERE affiliationId = @affiliation_uri AND templateId = @nsf_ehr_id);
INSERT INTO versionedTemplateCustomizations (affiliationId, templateCustomizationId, currentVersionedTemplateId, active, createdById, created, modifiedById, modified) VALUES (@affiliation_uri, @ok_ehr_id, @v_nsf_ehr_id, 1, @admin_id, CURDATE(), @admin_id, CURDATE());
SET @v_ok_ehr_id := (SELECT id FROM versionedTemplateCustomizations WHERE affiliationId = @affiliation_uri AND currentVersionedTemplateId = @v_nsf_ehr_id);
UPDATE templateCustomizations SET latestPublishedVersionId = @v_ok_ehr_id WHERE affiliationId = @affiliation_uri AND templateId = @nsf_ehr_id;


-- Customization migrationStatus `OK`, status `ARCHIVED` and isDirty is true
SET @nsf_ast_id := (SELECT id FROM templates WHERE name = 'NSF-AST: Astronomical Sciences' AND ownerId = @nsf_uri);
SET @v_nsf_ast_id := (SELECT id FROM versionedTemplates WHERE templateId = @nsf_ast_id AND active = 1);

INSERT INTO templateCustomizations (affiliationId, templateId, currentVersionedTemplateId, status, migrationStatus, isDirty, latestPublishedDate, createdById, created, modifiedById, modified) VALUES (@affiliation_uri, @nsf_ast_id, @v_nsf_ast_id, 'DRAFT', 'OK', 1, CURDATE(), @admin_id, CURDATE(), @admin_id, CURDATE());
SET @ok_ast_id := (SELECT id FROM templateCustomizations WHERE affiliationId = @affiliation_uri AND templateId = @nsf_ast_id);
INSERT INTO versionedTemplateCustomizations (affiliationId, templateCustomizationId, currentVersionedTemplateId, active, createdById, created, modifiedById, modified) VALUES (@affiliation_uri, @ok_ast_id, @v_nsf_ast_id, 1, @admin_id, CURDATE(), @admin_id, CURDATE());
SET @v_ok_ast_id := (SELECT id FROM versionedTemplateCustomizations WHERE affiliationId = @affiliation_uri AND currentVersionedTemplateId = @v_nsf_ast_id);
UPDATE templateCustomizations SET latestPublishedVersionId = @v_ok_ast_id WHERE affiliationId = @affiliation_uri AND templateId = @nsf_ast_id;

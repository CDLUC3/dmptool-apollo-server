SET @affiliation_uri := 'https://ror.org/03yrm5c26';
SET @nsf_uri = 'https://ror.org/021nxhr62';
SET @admin_id := (SELECT id FROM userEmails WHERE email = 'admin@example.com');

-- =============================================================================
-- Template Customization migrationStatus `OK`, status `PUBLISHED` and isDirty is false
-- WITH A CUSTOMIZATION OF A FUNDER SECTION AND QUESTION
SET @nsf_gen_id := (SELECT id FROM templates WHERE name = 'NSF-GEN: Generic' AND ownerId = @nsf_uri);
SET @v_nsf_gen_id := (SELECT id FROM versionedTemplates WHERE templateId = @nsf_gen_id AND active = 1);
SET @ok_gen_id := (SELECT id FROM templateCustomizations WHERE affiliationId = @affiliation_uri AND templateId = @nsf_gen_id);
SET @v_ok_gen_id := (SELECT id FROM versionedTemplateCustomizations WHERE affiliationId = @affiliation_uri AND currentVersionedTemplateId = @v_nsf_gen_id);

SET @nsf_gen_sec_id := (SELECT id FROM sections WHERE templateId = @nsf_gen_id ORDER BY displayOrder LIMIT 1);
SET @nsf_gen_quest_id := (SELECT id FROM questions WHERE templateId = @nsf_gen_id AND sectionId = @nsf_gen_sec_id ORDER BY displayOrder LIMIT 1);
SET @v_nsf_gen_sec_id := (SELECT id FROM versionedSections WHERE versionedTemplateId = @v_nsf_gen_id ORDER BY displayOrder LIMIT 1);
SET @v_nsf_gen_quest_id := (SELECT id FROM versionedQuestions WHERE versionedTemplateId = @v_nsf_gen_id AND versionedSectionId = @v_nsf_gen_sec_id ORDER BY displayOrder LIMIT 1);

-- Customization of a funder section
INSERT INTO sectionCustomizations (templateCustomizationId, sectionId, migrationStatus, guidance, createdById, created, modifiedById, modified)
  VALUES (@ok_gen_id, @nsf_gen_sec_id, 'OK', 'Custom guidance from a published and unchanged customization', @admin_id, NOW(), @admin_id, NOW());
SET @ok_nsf_gen_sec_cust_id := (SELECT id FROM sectionCustomizations WHERE templateCustomizationId = @ok_gen_id AND sectionId = @nsf_gen_sec_id);

INSERT INTO versionedSectionCustomizations (versionedTemplateCustomizationId, sectionCustomizationId, versionedSectionId, guidance, createdById, created, modifiedById, modified)
  VALUES (@v_ok_gen_id, @ok_nsf_gen_sec_cust_id, @v_nsf_gen_sec_id, 'Custom guidance from a published and unchanged customization', @admin_id, NOW(), @admin_id, NOW());

-- Customization of a funder question
INSERT INTO questionCustomizations (templateCustomizationId, questionId, migrationStatus, guidanceText, sampleText, createdById, created, modifiedById, modified)
  VALUES (@ok_gen_id, @nsf_gen_quest_id, 'OK', 'Custom guidance from a published customization', 'Sample text from a published and unchanged customization', @admin_id, NOW(), @admin_id, NOW());
SET @ok_nsf_gen_quest_cust_id := (SELECT id FROM questionCustomizations WHERE templateCustomizationId = @ok_gen_id AND questionId = @nsf_gen_quest_id);

INSERT INTO versionedQuestionCustomizations (versionedTemplateCustomizationId, questionCustomizationId, versionedQuestionId, guidanceText, sampleText, createdById, created, modifiedById, modified)
  VALUES (@v_ok_gen_id, @ok_nsf_gen_quest_cust_id,@v_nsf_gen_quest_id, 'Custom guidance from a published customization', 'Sample text from a published and unchanged customization', @admin_id, NOW(), @admin_id, NOW());


-- =============================================================================
-- Customization migrationStatus `OK`, status `PUBLISHED` and isDirty is true
-- WITH customization of a funder question and custom section with a custom question
SET @nsf_dms_id := (SELECT id FROM templates WHERE name = 'NSF-DMS: Mathematical Sciences' AND ownerId = @nsf_uri);
SET @v_nsf_dms_id := (SELECT id FROM versionedTemplates WHERE templateId = @nsf_dms_id AND active = 1);
SET @ok_dms_id := (SELECT id FROM templateCustomizations WHERE affiliationId = @affiliation_uri AND templateId = @nsf_dms_id);
SET @v_ok_dms_id := (SELECT id FROM versionedTemplateCustomizations WHERE affiliationId = @affiliation_uri AND currentVersionedTemplateId = @v_nsf_dms_id);

SET @nsf_dms_sec_id := (SELECT id FROM sections WHERE templateId = @nsf_dms_id ORDER BY displayOrder LIMIT 1);
SET @nsf_dms_quest_id := (SELECT id FROM questions WHERE templateId = @nsf_dms_id AND sectionId = @nsf_dms_sec_id ORDER BY displayOrder LIMIT 1);
SET @v_nsf_dms_sec_id := (SELECT id FROM versionedSections WHERE versionedTemplateId = @v_nsf_dms_id ORDER BY displayOrder LIMIT 1);
SET @v_nsf_dms_quest_id := (SELECT id FROM versionedQuestions WHERE versionedTemplateId = @v_nsf_dms_id AND versionedSectionId = @v_nsf_dms_sec_id ORDER BY displayOrder LIMIT 1);

-- Customization of a funder question
INSERT INTO questionCustomizations (templateCustomizationId, questionId, migrationStatus, guidanceText, sampleText, createdById, created, modifiedById, modified)
VALUES (@ok_dms_id, @nsf_dms_quest_id, 'OK', 'Custom guidance from a published customization', 'Sample STALE text from a published and unchanged customization', @admin_id, NOW(), @admin_id, NOW());
SET @ok_nsf_dms_quest_cust_id := (SELECT id FROM questionCustomizations WHERE templateCustomizationId = @ok_dms_id AND questionId = @nsf_dms_quest_id);

INSERT INTO versionedQuestionCustomizations (versionedTemplateCustomizationId, questionCustomizationId, versionedQuestionId, guidanceText, sampleText, createdById, created, modifiedById, modified)
  VALUES (@v_ok_dms_id, @ok_nsf_dms_quest_cust_id,@v_nsf_dms_quest_id, 'Custom guidance from a published customization', 'Sample STALE text from a published and unchanged customization', @admin_id, NOW(), @admin_id, NOW());

-- Custom section pinned to a template section
INSERT INTO customSections (templateCustomizationId, pinnedSectionType, pinnedSectionid, migrationStatus, name, introduction, requirements, guidance, createdById, created, modifiedById, modified)
  VALUES (@ok_dms_id, 'BASE', @nsf_dms_sec_id, 'OK', 'Custom section', 'Custom introduction', 'Custom requirements', 'Custom guidance',@admin_id, NOW(), @admin_id, NOW());
SET @ok_dms_cust_sec_id := (SELECT id FROM customSections WHERE templateCustomizationId = @ok_dms_id AND pinnedSectionType = 'BASE' AND pinnedSectionid = @nsf_dms_sec_id);

INSERT INTO versionedCustomSections (versionedTemplateCustomizationId, customSectionId, pinnedVersionedSectionType, pinnedVersionedSectionid, name, introduction, requirements, guidance, createdById, created, modifiedById, modified)
  VALUES (@v_ok_dms_id, @ok_dms_cust_sec_id,'BASE', @v_nsf_dms_sec_id, 'Custom section', 'Custom introduction', 'Custom requirements', 'Custom guidance',@admin_id, NOW(), @admin_id, NOW());
SET @v_ok_dms_cust_sec_id := (SELECT id FROM versionedCustomSections WHERE versionedTemplateCustomizationId = @v_ok_dms_id AND customSectionId = @ok_dms_cust_sec_id);

-- Custom question attached to the custom section (first one)
INSERT INTO customQuestions (templateCustomizationId, sectionType, sectionId, pinnedQuestionType, pinnedQuestionId, migrationStatus, questionText, json, requirementText, guidanceText, sampleText, useSampleTextAsDefault, createdById, created, modifiedById, modified)
  VALUES (@ok_dms_id, 'CUSTOM', @ok_dms_cust_sec_id, 'CUSTOM', NULL,'OK', 'Custom question', '{"type":"text","attributes":{"maxLength":255},"meta":{"schemaVersion":"1.0"}}', 'Custom requirements', 'Custom guidance', 'Custom sample text', 0,@admin_id, NOW(), @admin_id, NOW());
SET @ok_dms_cust_quest_id := (SELECT id FROM customQuestions WHERE templateCustomizationId = @ok_dms_id AND pinnedQuestionType = 'CUSTOM' AND pinnedQuestionId IS NULL);

INSERT INTO versionedCustomQuestions (versionedTemplateCustomizationId, customQuestionId, versionedSectionType, versionedSectionId, pinnedVersionedQuestionType, pinnedVersionedQuestionId, questionText, json, requirementText, guidanceText, sampleText, useSampleTextAsDefault, createdById, created, modifiedById, modified)
  VALUES (@v_ok_dms_id, @ok_dms_cust_quest_id, 'CUSTOM', @v_ok_dms_cust_sec_id, 'CUSTOM', NULL,'Custom question', '{"type":"text","attributes":{"maxLength":255},"meta":{"schemaVersion":"1.0"}}', 'Custom requirements', 'Custom guidance', 'Custom sample text', 0, @admin_id, NOW(), @admin_id, NOW());


-- Add some custom questions that are part of custom sections

-- =============================================================================
-- Customization migrationStatus `OK`, status `DRAFT` and isDirty is true
-- WITH custom section with 2 custom questions. Appearing as the first section of
-- funder template and a custom question pinned to a base funder question
SET @nsf_ehr_id := (SELECT id FROM templates WHERE name = 'NSF-EHR: Education and Human Resources' AND ownerId = @nsf_uri);
SET @v_nsf_ehr_id := (SELECT id FROM versionedTemplates WHERE templateId = @nsf_ehr_id AND active = 1);
SET @ok_ehr_id := (SELECT id FROM templateCustomizations WHERE affiliationId = @affiliation_uri AND templateId = @nsf_ehr_id);
SET @v_ok_ehr_id := (SELECT id FROM versionedTemplateCustomizations WHERE affiliationId = @affiliation_uri AND currentVersionedTemplateId = @v_nsf_ehr_id);

SET @nsf_ehr_sec_id := (SELECT id FROM sections WHERE templateId = @nsf_ehr_id ORDER BY displayOrder LIMIT 1);
SET @nsf_ehr_quest_id := (SELECT id FROM questions WHERE templateId = @nsf_ehr_id AND sectionId = @nsf_ehr_sec_id ORDER BY displayOrder LIMIT 1);
SET @v_nsf_ehr_sec_id := (SELECT id FROM versionedSections WHERE versionedTemplateId = @v_nsf_ehr_id ORDER BY displayOrder LIMIT 1);
SET @v_nsf_ehr_quest_id := (SELECT id FROM versionedQuestions WHERE versionedTemplateId = @v_nsf_ehr_id AND versionedSectionId = @v_nsf_ehr_sec_id ORDER BY displayOrder LIMIT 1);

-- Custom section appearing as first section of the funder template
INSERT INTO customSections (templateCustomizationId, pinnedSectionType, pinnedSectionId, migrationStatus, name, introduction, requirements, guidance, createdById, created, modifiedById, modified)
VALUES (@ok_ehr_id, 'BASE', NULL, 'OK', 'Custom section', 'Custom introduction', 'Custom requirements', 'Custom guidance', @admin_id, NOW(), @admin_id, NOW());
SET @ok_ehr_cust_sec_id := (SELECT id FROM customSections WHERE templateCustomizationId = @ok_ehr_id AND pinnedSectionType = 'BASE' AND pinnedSectionid IS NULL);

INSERT INTO versionedCustomSections (versionedTemplateCustomizationId, customSectionId, pinnedVersionedSectionType, pinnedVersionedSectionid, name, introduction, requirements, guidance, createdById, created, modifiedById, modified)
VALUES (@v_ok_ehr_id, @ok_ehr_cust_sec_id,'BASE', NULL, 'Custom section', 'Custom introduction', 'Custom requirements', 'Custom guidance', @admin_id, NOW(), @admin_id, NOW());
SET @v_ok_ehr_cust_sec_id := (SELECT id FROM versionedCustomSections WHERE versionedTemplateCustomizationId = @v_ok_ehr_id AND customSectionId = @ok_ehr_cust_sec_id);

-- Custom question attached to the custom section (first one)
INSERT INTO customQuestions (templateCustomizationId, sectionType, sectionId, pinnedQuestionType, pinnedQuestionId, migrationStatus, questionText, json, requirementText, guidanceText, sampleText, useSampleTextAsDefault, createdById, created, modifiedById, modified)
VALUES (@ok_ehr_id, 'CUSTOM', @ok_ehr_cust_sec_id, 'CUSTOM', NULL,'OK', 'Custom question', '{"type":"text","attributes":{"maxLength":255},"meta":{"schemaVersion":"1.0"}}', 'Custom requirements', 'Custom guidance', 'Custom sample text', 0, @admin_id, NOW(), @admin_id, NOW());
SET @ok_ehr_cust_quest_id := (SELECT id FROM customQuestions WHERE templateCustomizationId = @ok_ehr_id AND pinnedQuestionType = 'CUSTOM' AND pinnedQuestionId IS NULL);

INSERT INTO versionedCustomQuestions (versionedTemplateCustomizationId, customQuestionId, versionedSectionType, versionedSectionId, pinnedVersionedQuestionType, pinnedVersionedQuestionId, questionText, json, requirementText, guidanceText, sampleText, useSampleTextAsDefault, createdById, created, modifiedById, modified)
  VALUES (@v_ok_ehr_id, @ok_ehr_cust_quest_id, 'CUSTOM', @v_ok_ehr_cust_sec_id, 'CUSTOM', NULL,'Custom question', '{"type":"text","attributes":{"maxLength":255},"meta":{"schemaVersion":"1.0"}}', 'Custom requirements', 'Custom guidance', 'Custom sample text', 0, @admin_id, NOW(), @admin_id, NOW());
SET @v_ok_ehr_cust_quest_id := (SELECT id FROM versionedCustomQuestions WHERE versionedTemplateCustomizationId = @v_ok_ehr_id AND customQuestionId = @ok_ehr_cust_quest_id);

-- Custom question attached to the custom section (second one)
INSERT INTO customQuestions (templateCustomizationId, sectionType, sectionId, pinnedQuestionType, pinnedQuestionId, migrationStatus, questionText, json, requirementText, guidanceText, sampleText, useSampleTextAsDefault, createdById, created, modifiedById, modified)
VALUES (@ok_ehr_id, 'CUSTOM', @ok_ehr_cust_sec_id, 'CUSTOM', @ok_ehr_cust_quest_id,'OK', 'Custom question', '{"type":"text","attributes":{"maxLength":255},"meta":{"schemaVersion":"1.0"}}', 'Custom requirements', 'Custom guidance', 'Custom sample text', 0, @admin_id, NOW(), @admin_id, NOW());
SET @ok_ehr_cust_quest_id2 := (SELECT id FROM customQuestions WHERE templateCustomizationId = @ok_ehr_id AND pinnedQuestionType = 'CUSTOM' AND pinnedQuestionId = @ok_ehr_cust_quest_id);

INSERT INTO versionedCustomQuestions (versionedTemplateCustomizationId, customQuestionId, versionedSectionType, versionedSectionId, pinnedVersionedQuestionType, pinnedVersionedQuestionId, questionText, json, requirementText, guidanceText, sampleText, useSampleTextAsDefault, createdById, created, modifiedById, modified)
  VALUES (@v_ok_ehr_id, @ok_ehr_cust_quest_id2, 'CUSTOM', @v_ok_ehr_cust_sec_id, 'CUSTOM', @v_ok_ehr_cust_quest_id,'Custom question', '{"type":"text","attributes":{"maxLength":255},"meta":{"schemaVersion":"1.0"}}', 'Custom requirements', 'Custom guidance', 'Custom sample text', 0, @admin_id, NOW(), @admin_id, NOW());

-- Custom question attached to a funder question
INSERT INTO customQuestions (templateCustomizationId, sectionType, sectionId, pinnedQuestionType, pinnedQuestionId, migrationStatus, questionText, json, requirementText, guidanceText, sampleText, useSampleTextAsDefault, createdById, created, modifiedById, modified)
VALUES (@ok_ehr_id, 'BASE', @nsf_ehr_sec_id, 'BASE', @nsf_ehr_quest_id,'OK', 'Custom question', '{"type":"text","attributes":{"maxLength":255},"meta":{"schemaVersion":"1.0"}}', 'Custom requirements', 'Custom guidance', 'Custom sample text', 0, @admin_id, NOW(), @admin_id, NOW());
SET @ok_ehr_cust_quest_id3 := (SELECT id FROM customQuestions WHERE templateCustomizationId = @ok_ehr_id AND pinnedQuestionType = 'BASE' AND pinnedQuestionId = @nsf_ehr_quest_id);

INSERT INTO versionedCustomQuestions (versionedTemplateCustomizationId, customQuestionId, versionedSectionType, versionedSectionId, pinnedVersionedQuestionType, pinnedVersionedQuestionId, questionText, json, requirementText, guidanceText, sampleText, useSampleTextAsDefault, createdById, created, modifiedById, modified)
VALUES (@v_ok_ehr_id, @ok_ehr_cust_quest_id3, 'BASE', @v_nsf_ehr_sec_id, 'BASE', @v_nsf_ehr_quest_id,'Custom question', '{"type":"text","attributes":{"maxLength":255},"meta":{"schemaVersion":"1.0"}}', 'Custom requirements', 'Custom guidance', 'Custom sample text', 0, @admin_id, NOW(), @admin_id, NOW());


-- =============================================================================
-- Customization migrationStatus `OK`, status `ARCHIVED` and isDirty is true
-- WITH 2 custom questions pinned to a funder section. One is the first question and the other is pinned
SET @nsf_ast_id := (SELECT id FROM templates WHERE name = 'NSF-AST: Astronomical Sciences' AND ownerId = @nsf_uri);
SET @v_nsf_ast_id := (SELECT id FROM versionedTemplates WHERE templateId = @nsf_ast_id AND active = 1);
SET @ok_ast_id := (SELECT id FROM templateCustomizations WHERE affiliationId = @affiliation_uri AND templateId = @nsf_ast_id);
SET @v_ok_ast_id := (SELECT id FROM versionedTemplateCustomizations WHERE affiliationId = @affiliation_uri AND currentVersionedTemplateId = @v_nsf_ast_id);

SET @nsf_ast_sec_id := (SELECT id FROM sections WHERE templateId = @nsf_ast_id ORDER BY displayOrder LIMIT 1);
SET @nsf_ast_quest_id := (SELECT id FROM questions WHERE templateId = @nsf_ast_id AND sectionId = @nsf_ast_sec_id ORDER BY displayOrder LIMIT 1);
SET @v_nsf_ast_sec_id := (SELECT id FROM versionedSections WHERE versionedTemplateId = @v_nsf_ast_id ORDER BY displayOrder LIMIT 1);
SET @v_nsf_ast_quest_id := (SELECT id FROM versionedQuestions WHERE versionedTemplateId = @v_nsf_ast_id AND versionedSectionId = @v_nsf_ast_sec_id ORDER BY displayOrder LIMIT 1);

-- Custom question attached to the custom section (second one)
INSERT INTO customQuestions (templateCustomizationId, sectionType, sectionId, pinnedQuestionType, pinnedQuestionId, migrationStatus, questionText, json, requirementText, guidanceText, sampleText, useSampleTextAsDefault, createdById, created, modifiedById, modified)
  VALUES (@ok_ast_id, 'CUSTOM', @nsf_ast_sec_id, 'CUSTOM', NULL,'OK', 'Custom question', '{"type":"text","attributes":{"maxLength":255},"meta":{"schemaVersion":"1.0"}}', 'Custom requirements', 'Custom guidance', 'Custom sample text', 0, @admin_id, NOW(), @admin_id, NOW());
SET @ok_ast_cust_quest_id := (SELECT id FROM customQuestions WHERE templateCustomizationId = @ok_ast_id AND pinnedQuestionType = 'CUSTOM' AND pinnedQuestionId IS NULL);

INSERT INTO versionedCustomQuestions (versionedTemplateCustomizationId, customQuestionId, versionedSectionType, versionedSectionId, pinnedVersionedQuestionType, pinnedVersionedQuestionId, questionText, json, requirementText, guidanceText, sampleText, useSampleTextAsDefault, createdById, created, modifiedById, modified)
  VALUES (@v_ok_ast_id, @ok_ast_cust_quest_id, 'CUSTOM', @v_nsf_ast_sec_id, 'CUSTOM', NULL,'Custom question', '{"type":"text","attributes":{"maxLength":255},"meta":{"schemaVersion":"1.0"}}', 'Custom requirements', 'Custom guidance', 'Custom sample text', 0,@admin_id, NOW(), @admin_id, NOW());

INSERT INTO customQuestions (templateCustomizationId, sectionType, sectionId, pinnedQuestionType, pinnedQuestionId, migrationStatus, questionText, json, requirementText, guidanceText, sampleText, useSampleTextAsDefault, createdById, created, modifiedById, modified)
  VALUES (@ok_ast_id, 'CUSTOM', @nsf_ast_sec_id, 'CUSTOM', @nsf_ast_quest_id,'OK', 'Custom question', '{"type":"text","attributes":{"maxLength":255},"meta":{"schemaVersion":"1.0"}}', 'Custom requirements', 'Custom guidance', 'Custom sample text', 0, @admin_id, NOW(), @admin_id, NOW());
SET @ok_ast_cust_quest_id2 := (SELECT id FROM customQuestions WHERE templateCustomizationId = @ok_ast_id AND pinnedQuestionType = 'CUSTOM' AND pinnedQuestionId = @nsf_ast_quest_id);

INSERT INTO versionedCustomQuestions (versionedTemplateCustomizationId, customQuestionId, versionedSectionType, versionedSectionId, pinnedVersionedQuestionType, pinnedVersionedQuestionId, questionText, json, requirementText, guidanceText, sampleText, useSampleTextAsDefault, createdById, created, modifiedById, modified)
  VALUES (@v_ok_ast_id, @ok_ast_cust_quest_id2, 'CUSTOM', @v_nsf_ast_sec_id, 'CUSTOM', @v_nsf_ast_quest_id,'Custom question', '{"type":"text","attributes":{"maxLength":255},"meta":{"schemaVersion":"1.0"}}', 'Custom requirements', 'Custom guidance', 'Custom sample text', 0, @admin_id, NOW(), @admin_id, NOW());

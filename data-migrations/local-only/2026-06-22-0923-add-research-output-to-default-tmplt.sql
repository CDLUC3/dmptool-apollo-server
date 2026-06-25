SET @default_super_id := (SELECT id FROM userEmails WHERE email = 'super@example.com');
SET @default_template_id := (SELECT id FROM templates WHERE name = 'Digital Curation Centre');

-- Ensure that the default template is set
UPDATE templates SET isDefault = 0 WHERE isDefault = 1;
UPDATE templates SET isDefault = 1 WHERE id = @default_template_id;

-- Add the new Research Output section and question to the default template
INSERT INTO sections (templateId, name, displayOrder, createdById, created, modifiedById, modified)
VALUES (@default_template_id, 'Research Outputs', 8, @default_super_id, CURDATE(), @default_super_id, CURDATE());
SET @section_id := LAST_INSERT_ID();

INSERT INTO sectionTags (sectionId, tagId, createdById, created, modifiedById, modified)
VALUES (@section_id, 10, @default_super_id, CURDATE(), @default_super_id, CURDATE());
INSERT INTO sectionTags (sectionId, tagId, createdById, created, modifiedById, modified)
VALUES (@section_id, 11, @default_super_id, CURDATE(), @default_super_id, CURDATE());
INSERT INTO sectionTags (sectionId, tagId, createdById, created, modifiedById, modified)
VALUES (@section_id, 13, @default_super_id, CURDATE(), @default_super_id, CURDATE());

INSERT INTO questions (templateId, sectionId, displayOrder, questionText, requirementText, createdById, created, modifiedById, modified, json)
VALUES (@default_template_id, @section_id, 1, 'Please list all research outputs that you intend to create as part of your project.', '<p>Include all datasets, software, audio visual files, etc.</p>', @default_super_id, CURDATE(), @default_super_id, CURDATE(), '{"meta": {"title": "Research Output Table", "schemaVersion": "1.0", "usageDescription": "A table for collecting structured research output data"}, "type": "researchOutputTable", "columns": [{"help": "Enter the title of this research output", "content": {"meta": {"schemaVersion": "1.0"}, "type": "text", "attributes": {"maxLength": 120}}, "enabled": true, "heading": "Title", "required": true}, {"help": "Enter a brief description of this research output", "content": {"meta": {"schemaVersion": "1.0"}, "type": "textArea", "attributes": {"cols": 20, "rows": 2, "label": "Description", "maxLength": 10000, "asRichText": true, "labelTranslationKey": "labels.description"}}, "enabled": true, "heading": "Description", "required": false}, {"help": "Select the type of this research output", "content": {"meta": {"schemaVersion": "1.0"}, "type": "selectBox", "options": [], "attributes": {"label": "Output Type", "multiple": false, "labelTranslationKey": "labels.outputType"}}, "enabled": true, "heading": "Output Type", "required": false}, {"help": "Mark all of the statements that are true about the dataset", "content": {"meta": {"schemaVersion": "1.0"}, "type": "checkBoxes", "options": [{"label": "May contain sensitive data?", "value": "sensitive", "selected": true}, {"label": "May contain personally identifiable information?", "value": "personal", "selected": true}], "attributes": {"labelTranslationKey": "labels.dataFlags"}}, "enabled": true, "heading": "Data Flags", "required": false}, {"help": "Select repository(ies) you would prefer users to deposit in", "content": {"meta": {"schemaVersion": "1.0"}, "type": "repositorySearch", "graphQL": {"query": "query Repositories($term: String, $keywords: [String!], $repositoryType: String, $paginationOptions: PaginationOptions){ repositories(term: $term, keywords: $keywords, repositoryType: $repositoryType, paginationOptions: $paginationOptions) { totalCount currentOffset limit hasNextPage hasPreviousPage availableSortFields items { id name uri description website keywords repositoryTypes } } }", "queryId": "useRepositoriesQuery", "variables": [{"name": "term", "type": "string", "label": "Search for a repository", "minLength": 3, "labelTranslationKey": "RepositorySearch.term"}, {"name": "keywords", "type": "string", "label": "Subject Areas", "minLength": 3, "labelTranslationKey": "RepositorySearch.keywords"}, {"name": "repositoryType", "type": "string", "label": "Repository type", "minLength": 3, "labelTranslationKey": "RepositorySearch.repositoryType"}, {"name": "paginationOptions", "type": "OFFSET", "label": "Pagination Options", "labelTranslationKey": "PaginationOptions.label"}], "answerField": "uri", "displayFields": [{"label": "Name", "propertyName": "name", "labelTranslationKey": "RepositorySearch.name"}, {"label": "Description", "propertyName": "description", "labelTranslationKey": "RepositorySearch.description"}, {"label": "Website", "propertyName": "website", "labelTranslationKey": "RepositorySearch.website"}, {"label": "Subject Areas", "propertyName": "keywords", "labelTranslationKey": "RepositorySearch.keywords"}], "responseField": "repositories.items"}, "attributes": {"help": "", "label": "Repositories", "labelTranslationKey": "labels.repositories"}}, "enabled": true, "heading": "Repositories", "required": false, "preferences": []}, {"help": "Select metadata standard(s) you would prefer users to use", "content": {"meta": {"schemaVersion": "1.0"}, "type": "metadataStandardSearch", "graphQL": {"query": "query MetadataStandards($term: String, $keywords: [String!], $paginationOptions: PaginationOptions){ metadataStandards(term: $term, keywords: $keywords, paginationOptions: $paginationOptions) { totalCount currentOffset limit hasNextPage hasPreviousPage availableSortFields items { id name uri description keywords } } }", "queryId": "useMetadataStandardsQuery", "variables": [{"name": "term", "type": "string", "label": "Search for a metadata standard", "minLength": 3, "labelTranslationKey": "MetadataStandardSearch.term"}, {"name": "keywords", "type": "string", "label": "Subject Areas", "minLength": 3, "labelTranslationKey": "MetadataStandardSearch.keywords"}, {"name": "paginationOptions", "type": "OFFSET", "label": "Pagination Options", "labelTranslationKey": "PaginationOptions.label"}], "answerField": "uri", "displayFields": [{"label": "Name", "propertyName": "name", "labelTranslationKey": "MetadataStandardSearch.name"}, {"label": "Description", "propertyName": "description", "labelTranslationKey": "MetadataStandardSearch.description"}, {"label": "Website", "propertyName": "website", "labelTranslationKey": "MetadataStandardSearch.website"}, {"label": "Subject Areas", "propertyName": "keywords", "labelTranslationKey": "MetadataStandardSearch.keywords"}], "responseField": "metadataStandards.items"}, "attributes": {"help": "", "label": "Metadata Standards", "labelTranslationKey": "labels.metadataStandards"}}, "enabled": true, "heading": "Metadata Standards", "required": false, "preferences": []}, {"help": "Select the license you will apply to the research output", "content": {"meta": {"schemaVersion": "1.0"}, "type": "licenseSearch", "graphQL": {"query": "query Licenses{ licenses { id name uri description } }", "queryId": "useLicensesQuery", "variables": [], "answerField": "uri", "displayFields": [{"label": "Name", "propertyName": "name", "labelTranslationKey": "LicenseSearch.name"}, {"label": "Description", "propertyName": "description", "labelTranslationKey": "LicenseSearch.description"}, {"label": "Recommended", "propertyName": "recommended", "labelTranslationKey": "LicenseSearch.recommended"}], "responseField": "licenses"}, "attributes": {"help": "", "label": "Licenses", "labelTranslationKey": "labels.licenses"}}, "enabled": true, "heading": "Licenses", "required": false, "preferences": []}, {"help": "Select the access level for this research output", "content": {"meta": {"schemaVersion": "1.0"}, "type": "radioButtons", "options": [], "attributes": {"label": "Initial Access Levels", "labelTranslationKey": "labels.initialAccessLevels"}}, "enabled": true, "heading": "Initial Access Levels", "required": false}], "attributes": {"help": "", "label": "", "canAddRows": true, "initialRows": 1, "canRemoveRows": true, "labelTranslationKey": ""}, "showCommentField": false}');
SET @question_id := LAST_INSERT_ID();

-- Then generate/publish the new version
SET @prior_versioned_template_id := (SELECT id FROM versionedTemplates WHERE templateId = @default_template_id AND active = 1);
UPDATE versionedTemplates SET active = 0 WHERE templateId = @default_template_id AND active = 1;
INSERT INTO versionedTemplates (templateId, active, version, versionType, versionedById, comment, name, description, ownerId, visibility, bestPractice, isDefault, languageId, created, createdById, modified, modifiedById)
  (SELECT id, 1, 'v3', 'PUBLISHED', createdById, 'Added a research output table question', name, description, ownerId, 'PUBLIC', bestPractice, isDefault, languageId, CURDATE(), createdById, CURDATE(), modifiedById
   FROM templates WHERE id = @default_template_id);
SET @versioned_template_id := LAST_INSERT_ID();

-- Make sure the new version has all the existing sections
INSERT INTO versionedSections (versionedTemplateId, sectionId, name, introduction, requirements, guidance, displayOrder, bestPractice, created, createdById, modified, modifiedById)
  (SELECT @versioned_template_id, sectionId, name, introduction, requirements, guidance, displayOrder, bestPractice, CURDATE(), createdById, CURDATE(), modifiedById
   FROM versionedSections WHERE versionedTemplateId = @prior_versioned_template_id);

-- Then add the new research output section
INSERT INTO versionedSections (versionedTemplateId, sectionId, name, introduction, requirements, guidance, displayOrder, bestPractice, created, createdById, modified, modifiedById)
  (SELECT @versioned_template_id, id, name, introduction, requirements, guidance, displayOrder, bestPractice, CURDATE(), createdById, CURDATE(), modifiedById
   FROM sections WHERE id = @section_id);
SET @versioned_section_id := LAST_INSERT_ID();

-- Then make sure all the existing section tags and questions are copied across to the new version
INSERT INTO versionedSectionTags (versionedSectionId, tagId, created, createdById, modified, modifiedById)
  (SELECT newVSS.id, st.tagId, CURDATE(), st.createdById, CURDATE(), st.modifiedById
   FROM versionedSections AS vss
    INNER JOIN versionedSectionTags AS st ON vss.id = st.versionedSectionId
    INNER JOIN versionedSections AS newVSS on newVSS.sectionId = vss.sectionId AND newVSS.versionedTemplateId = @versioned_template_id
   WHERE vss.versionedTemplateId = @prior_versioned_template_id);

INSERT INTO versionedQuestions (versionedTemplateId, versionedSectionId, questionId, questionText, json, requirementText, guidanceText, sampleText, required, displayOrder, created, createdById, modified, modifiedById)
  (SELECT @versioned_template_id, newVSS.id, vsq.questionId, vsq.questionText, vsq.json, vsq.requirementText, vsq.guidanceText, vsq.sampleText, vsq.required, vsq.displayOrder, CURDATE(), vsq.createdById, CURDATE(), vsq.modifiedById
   FROM versionedSections AS vss
     INNER JOIN versionedQuestions vsq ON vss.id = vsq.versionedSectionId
     INNER JOIN versionedSections AS newVSS on newVSS.sectionId = vss.sectionId AND newVSS.versionedTemplateId = @versioned_template_id
   WHERE vss.versionedTemplateId = @prior_versioned_template_id);

-- Finally add the new section tags and question to the research output question
INSERT INTO versionedSectionTags (versionedSectionId, tagId, created, createdById, modified, modifiedById)
  (SELECT @versioned_section_id, tagId, CURDATE(), createdById, CURDATE(), modifiedById
   FROM sectionTags WHERE sectionId = @section_id);

INSERT INTO versionedQuestions (versionedTemplateId, versionedSectionId, questionId, questionText, json, requirementText, guidanceText, sampleText, required, displayOrder, created, createdById, modified, modifiedById)
  (SELECT @versioned_template_id, @versioned_section_id, id, questionText, json, requirementText, guidanceText, sampleText, required, displayOrder, CURDATE(), createdById, CURDATE(), modifiedById
   FROM questions WHERE id = @question_id);

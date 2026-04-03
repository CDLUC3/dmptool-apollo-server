-- Add ON DELETE CASCADE to the versioned* FKs to their respective parent tables, 
-- to ensure that when a template customization is deleted, 
-- all associated versioned records are also deleted so that we don't have orphaned versioned records that reference deleted template customizations.
ALTER TABLE customQuestions
  DROP FOREIGN KEY fk_customQs_templateCustId;
ALTER TABLE customQuestions
  ADD CONSTRAINT fk_customQs_templateCustId_cascade
    FOREIGN KEY (templateCustomizationId) REFERENCES templateCustomizations(id) ON DELETE CASCADE;

ALTER TABLE customSections
  DROP FOREIGN KEY fk_customSecs_templateCustId;
ALTER TABLE customSections
  ADD CONSTRAINT fk_customSecs_templateCustId_cascade
    FOREIGN KEY (templateCustomizationId) REFERENCES templateCustomizations(id) ON DELETE CASCADE;

ALTER TABLE questionCustomizations
  DROP FOREIGN KEY fk_qCust_templateCustId;
ALTER TABLE questionCustomizations
  ADD CONSTRAINT fk_qCust_templateCustId_cascade
    FOREIGN KEY (templateCustomizationId) REFERENCES templateCustomizations(id) ON DELETE CASCADE;

ALTER TABLE sectionCustomizations
  DROP FOREIGN KEY fk_sectionCust_templateCustId;
ALTER TABLE sectionCustomizations
  ADD CONSTRAINT fk_sectionCust_templateCustId_cascade
    FOREIGN KEY (templateCustomizationId) REFERENCES templateCustomizations(id) ON DELETE CASCADE;

ALTER TABLE versionedTemplateCustomizations
  DROP FOREIGN KEY fk_vTemplateCust_templateId;
ALTER TABLE versionedTemplateCustomizations
  ADD CONSTRAINT fk_vTemplateCust_templateId_cascade
    FOREIGN KEY (templateCustomizationId) REFERENCES templateCustomizations(id) ON DELETE CASCADE;

ALTER TABLE versionedCustomQuestions
  DROP FOREIGN KEY fk_vCustomQs_questionId;
ALTER TABLE versionedCustomQuestions
  ADD CONSTRAINT fk_vCustomQs_questionId_cascade
    FOREIGN KEY (customQuestionId) REFERENCES customQuestions(id) ON DELETE CASCADE;

ALTER TABLE versionedCustomSections
  DROP FOREIGN KEY fk_vCustomSecs_sectionId;
ALTER TABLE versionedCustomSections
  ADD CONSTRAINT fk_vCustomSecs_sectionId_cascade
    FOREIGN KEY (customSectionId) REFERENCES customSections(id) ON DELETE CASCADE;

ALTER TABLE versionedQuestionCustomizations
  DROP FOREIGN KEY fk_vQCust_questionId;
ALTER TABLE versionedQuestionCustomizations
  ADD CONSTRAINT fk_vQCust_questionId_cascade
    FOREIGN KEY (questionCustomizationId) REFERENCES questionCustomizations(id) ON DELETE CASCADE;

ALTER TABLE versionedSectionCustomizations
  DROP FOREIGN KEY fk_vSectionCust_sectionId;
ALTER TABLE versionedSectionCustomizations
  ADD CONSTRAINT fk_vSectionCust_sectionId_cascade
    FOREIGN KEY (sectionCustomizationId) REFERENCES sectionCustomizations(id) ON DELETE CASCADE;
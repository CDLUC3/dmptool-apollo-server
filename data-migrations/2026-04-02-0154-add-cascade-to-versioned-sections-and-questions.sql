-- Add ON DELETE CASCADE to versionedTemplateCustomizationId FKs on all four
-- child tables. Previously these had no cascade, requiring manual deletion
-- order in application code when rolling back a published snapshot.
--
-- Note: MariaDB requires DROP and ADD of a same-named FK constraint to be
-- in separate ALTER TABLE statements to avoid a duplicate constraint name error.

ALTER TABLE versionedSectionCustomizations
  DROP FOREIGN KEY fk_vSectionCust_templateCustId;
ALTER TABLE versionedSectionCustomizations
  ADD CONSTRAINT fk_vSectionCust_templateCustId_cascade
    FOREIGN KEY (versionedTemplateCustomizationId)
    REFERENCES versionedTemplateCustomizations(id)
    ON DELETE CASCADE;


ALTER TABLE versionedQuestionCustomizations
  DROP FOREIGN KEY fk_vQCust_templateCustId;
ALTER TABLE versionedQuestionCustomizations
  ADD CONSTRAINT fk_vQCust_templateCustId_cascade
    FOREIGN KEY (versionedTemplateCustomizationId)
    REFERENCES versionedTemplateCustomizations(id)
    ON DELETE CASCADE;


ALTER TABLE versionedCustomSections
  DROP FOREIGN KEY fk_vCustomSecs_templateCustId;
ALTER TABLE versionedCustomSections
  ADD CONSTRAINT fk_vCustomSecs_templateCustId_cascade
    FOREIGN KEY (versionedTemplateCustomizationId)
    REFERENCES versionedTemplateCustomizations(id)
    ON DELETE CASCADE;


ALTER TABLE versionedCustomQuestions
  DROP FOREIGN KEY fk_vCustomQs_templateCustId;
ALTER TABLE versionedCustomQuestions
  ADD CONSTRAINT fk_vCustomQs_templateCustId_cascade
    FOREIGN KEY (versionedTemplateCustomizationId)
    REFERENCES versionedTemplateCustomizations(id)
    ON DELETE CASCADE;

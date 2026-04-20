ALTER TABLE `answers`
  MODIFY `versionedSectionId` int unsigned NULL,
  MODIFY `versionedQuestionId` int unsigned NULL,
  ADD COLUMN `versionedCustomSectionId` int unsigned NULL,
  ADD COLUMN `versionedCustomQuestionId` int unsigned NULL,
  ADD KEY `versionedCustomSectionId` (`versionedCustomSectionId`),
  ADD KEY `versionedCustomQuestionId` (`versionedCustomQuestionId`),
  ADD CONSTRAINT `answers_ibfk_6`
    FOREIGN KEY (`versionedCustomSectionId`)
    REFERENCES `versionedCustomSections` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `answers_ibfk_7`
    FOREIGN KEY (`versionedCustomQuestionId`)
    REFERENCES `versionedCustomQuestions` (`id`) ON DELETE CASCADE,
  -- Answer can be linked to either a question or a custom question, but not both. This constraint ensures that only 
  -- one of the pairs (versionedSectionId, versionedQuestionId) or (versionedCustomSectionId, versionedCustomQuestionId) can be non-null at any given time.  
  ADD CONSTRAINT `chk_answer_question_type` CHECK (
    (
      versionedSectionId IS NOT NULL AND
      versionedQuestionId IS NOT NULL AND
      versionedCustomSectionId IS NULL AND
      versionedCustomQuestionId IS NULL
    )
    OR
    (
      versionedCustomSectionId IS NOT NULL AND
      versionedCustomQuestionId IS NOT NULL AND
      versionedSectionId IS NULL AND
      versionedQuestionId IS NULL
    )
  );
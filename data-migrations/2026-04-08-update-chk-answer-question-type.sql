-- The answers table now includes versionedCustomSectionId and versionedCustomQuestionId. We can have three valid combinations of these four fields:
-- 1) Base question in a base section: versionedSectionId and versionedQuestionId are non-null, versionedCustomSectionId and versionedCustomQuestionId are null
-- 2) Custom question in a custom section: versionedCustomSectionId and versionedCustomQuestionId are non-null, versionedSectionId and versionedQuestionId are null
-- 3) Custom question pinned to a base section: versionedSectionId and versionedCustomQuestionId are non-null, versionedQuestionId and versionedCustomSectionId are null
ALTER TABLE `answers`
  DROP CONSTRAINT `chk_answer_question_type`,
  ADD CONSTRAINT `chk_answer_question_type` CHECK (
    -- Base question in a base section
    (
      versionedSectionId IS NOT NULL AND
      versionedQuestionId IS NOT NULL AND
      versionedCustomSectionId IS NULL AND
      versionedCustomQuestionId IS NULL
    )
    OR
    -- Custom question in a custom section
    (
      versionedCustomSectionId IS NOT NULL AND
      versionedCustomQuestionId IS NOT NULL AND
      versionedSectionId IS NULL AND
      versionedQuestionId IS NULL
    )
    OR
    -- Custom question pinned to a base section
    (
      versionedSectionId IS NOT NULL AND
      versionedCustomQuestionId IS NOT NULL AND
      versionedQuestionId IS NULL AND
      versionedCustomSectionId IS NULL
    )
  );

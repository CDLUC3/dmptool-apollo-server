ALTER TABLE versionedQuestionConditions
  DROP FOREIGN KEY versionedquestionconditions_ibfk_4,
  DROP FOREIGN KEY versionedquestionconditions_ibfk_3,
  DROP COLUMN versionedQuestionId,
  DROP COLUMN action,
  DROP COLUMN target,
  ADD COLUMN versionedQuestionConditionGroupId int unsigned NOT NULL,
  MODIFY conditionMatch json DEFAULT NULL,
  ADD CONSTRAINT versionedquestionconditions_groupid_fk
    FOREIGN KEY (versionedQuestionConditionGroupId) REFERENCES versionedQuestionConditionGroups(id) ON DELETE CASCADE;
-- Remove the versionedQuestionId, action, and target columns from versionedQuestionConditions, and 
-- add a versionedQuestionConditionGroupId column that references versionedQuestionConditionGroups.
ALTER TABLE versionedQuestionConditions
  DROP FOREIGN KEY versionedquestionconditions_ibfk_4,
  DROP FOREIGN KEY versionedquestionconditions_ibfk_3,
  DROP COLUMN versionedQuestionId,  DROP COLUMN questionConditionId,  DROP COLUMN action,
  DROP COLUMN target,
  ADD COLUMN versionedQuestionConditionGroupId int unsigned NOT NULL AFTER id,
  ADD CONSTRAINT versionedquestionconditions_groupid_fk
    FOREIGN KEY (versionedQuestionConditionGroupId) REFERENCES versionedQuestionConditionGroups(id) ON DELETE CASCADE;
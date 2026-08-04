ALTER TABLE questionConditions
  DROP FOREIGN KEY questionconditions_ibfk_3,
  DROP COLUMN questionId,
  DROP COLUMN action,
  DROP COLUMN target,
  ADD COLUMN groupId int unsigned NOT NULL,
  MODIFY conditionMatch json DEFAULT NULL,
  ADD CONSTRAINT questionconditions_groupid_fk
    FOREIGN KEY (groupId) REFERENCES questionConditionGroups (id) ON DELETE CASCADE;
-- Remove the questionId, action, and target columns from questionConditions, and add a groupId column that references questionConditionGroups. 
-- Also modify conditionMatch to allow NULL values.
ALTER TABLE questionConditions
  DROP FOREIGN KEY questionconditions_ibfk_3,
  DROP COLUMN questionId,
  DROP COLUMN action,
  DROP COLUMN target,
  ADD COLUMN groupId int unsigned NOT NULL AFTER id,
  ADD CONSTRAINT questionconditions_groupid_fk
    FOREIGN KEY (groupId) REFERENCES questionConditionGroups (id) ON DELETE CASCADE;
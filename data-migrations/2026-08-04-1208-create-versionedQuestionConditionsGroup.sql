-- Create a new table for versioned question condition groups
CREATE TABLE versionedQuestionConditionGroups (
  id int unsigned NOT NULL AUTO_INCREMENT,
  versionedQuestionId int unsigned NOT NULL,
  questionConditionGroupId int unsigned NOT NULL,  -- informational, no cascade (see below)
  triggerQuestionId int unsigned NOT NULL,
  created timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  createdById int unsigned NOT NULL,
  modified timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modifiedById int unsigned NOT NULL,
  PRIMARY KEY (id),
  KEY versionedQuestionId (versionedQuestionId),
  KEY questionConditionGroupId (questionConditionGroupId),
  KEY createdById (createdById),
  KEY modifiedById (modifiedById),
  CONSTRAINT versionedquestionconditiongroups_ibfk_1 FOREIGN KEY (versionedQuestionId) REFERENCES versionedQuestions(id) ON DELETE CASCADE,
  CONSTRAINT versionedquestionconditiongroups_ibfk_2 FOREIGN KEY (triggerQuestionId) REFERENCES questions(id),
  CONSTRAINT versionedquestionconditiongroups_ibfk_3 FOREIGN KEY (createdById) REFERENCES users(id),
  CONSTRAINT versionedquestionconditiongroups_ibfk_4 FOREIGN KEY (modifiedById) REFERENCES users(id)
  -- deliberately NO FK on questionConditionGroupId 
  -- reason: live groups get deleted/recreated on every save, and a snapshot must survive that.
);
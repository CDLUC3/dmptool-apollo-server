CREATE TABLE questionConditionGroups (
  id int unsigned NOT NULL AUTO_INCREMENT,
  questionId int unsigned NOT NULL,        -- the active/dependent question
  triggerQuestionId int unsigned NOT NULL, -- the prior options question being checked
  createdById int unsigned NOT NULL,
  created timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modifiedById int unsigned NOT NULL,
  modified timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY questionId (questionId),
  KEY triggerQuestionId (triggerQuestionId),
  CONSTRAINT questionconditiongroups_ibfk_1 FOREIGN KEY (questionId) REFERENCES questions(id) ON DELETE CASCADE,
  CONSTRAINT questionconditiongroups_ibfk_2 FOREIGN KEY (triggerQuestionId) REFERENCES questions(id) ON DELETE CASCADE,
  CONSTRAINT questionconditiongroups_ibfk_3 FOREIGN KEY (createdById) REFERENCES users(id),
  CONSTRAINT questionconditiongroups_ibfk_4 FOREIGN KEY (modifiedById) REFERENCES users(id)
);
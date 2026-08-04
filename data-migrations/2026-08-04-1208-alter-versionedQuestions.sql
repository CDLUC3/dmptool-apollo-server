ALTER TABLE versionedQuestions
  ADD COLUMN displayLogicAction varchar(255) NOT NULL DEFAULT 'SHOW_QUESTION',
  ADD COLUMN displayLogicMatchType varchar(255) NOT NULL DEFAULT 'ANY';
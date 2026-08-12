-- Adding new columns to versionedQuestions for display logic action and match type
ALTER TABLE versionedQuestions
  ADD COLUMN displayLogicAction varchar(255) NOT NULL DEFAULT 'SHOW_QUESTION' AFTER required,
  ADD COLUMN displayLogicMatchType varchar(255) NOT NULL DEFAULT 'ANY' AFTER displayLogicAction;
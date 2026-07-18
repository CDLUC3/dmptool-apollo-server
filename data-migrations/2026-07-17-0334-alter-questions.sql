-- Added to support display logic for questions
ALTER TABLE questions
  ADD COLUMN displayLogicAction varchar(255) NOT NULL DEFAULT 'SHOW_QUESTION',
  ADD COLUMN displayLogicMatchType varchar(255) NOT NULL DEFAULT 'ANY';

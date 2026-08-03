-- Add the displayAbbreviation column to the affiliations table
ALTER TABLE affiliations
  ADD COLUMN displayAbbreviation VARCHAR(10) NULL AFTER displayName;

ALTER TABLE affiliations
  ADD COLUMN displayDomain VARCHAR(255) NULL AFTER displayAbbreviation;

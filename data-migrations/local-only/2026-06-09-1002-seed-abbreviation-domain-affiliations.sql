-- Seed the new displayAbbreviation and displayDomain columns in the affiliations table based on existing data.
UPDATE affiliations SET displayAbbreviation = REPLACE(COALESCE(acronyms->'$[0]', ''), '"', '')
WHERE displayAbbreviation IS NULL;

UPDATE affiliations SET displayDomain = REPLACE(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(homepage, '/', 3), '://', -1), '/', 1), '?', 1), 'www.', '')
WHERE displayDomain IS NULL;

-- Add relationType column to relatedWorks table
ALTER TABLE relatedWorks
  ADD COLUMN relationType VARCHAR(255) DEFAULT 'REFERENCES' NOT NULL;

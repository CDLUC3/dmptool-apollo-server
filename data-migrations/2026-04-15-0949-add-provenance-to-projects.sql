-- Adds a provenance column to projects
ALTER TABLE projects
  ADD COLUMN provenance VARCHAR(50) NOT NULL DEFAULT 'dmptool' AFTER id,
  ADD INDEX projects_provenance_idx (provenance);

-- Seed the new plans.affiliationId column with the affiliationId of the user who created the plan
UPDATE plans p
  JOIN users u ON p.createdById = u.id
SET p.affiliationId = u.affiliationId
WHERE p.affiliationId IS NULL;

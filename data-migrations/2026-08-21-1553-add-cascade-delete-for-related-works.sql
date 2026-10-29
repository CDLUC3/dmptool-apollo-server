-- Remove the old constraint that does not cascade delete
ALTER TABLE relatedWorks
  DROP FOREIGN KEY fk_relatedWorks_plans_planId;

-- Add constraint that will delete related works when the plan is deleted
ALTER TABLE relatedWorks
  ADD CONSTRAINT fk_relatedWorks_planId_cascade
    FOREIGN KEY (planId)
      REFERENCES plans(id)
      ON DELETE CASCADE;

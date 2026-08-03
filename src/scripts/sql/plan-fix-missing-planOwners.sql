
-- List all Projects that do NOT have a primary owner (and show the first collaborator with 'OWN' permission)
SELECT projects.id, projects.title,
  (SELECT pc.id
   FROM projectCollaborators pc
   WHERE pc.projectId = projects.id AND pc.accessLevel = 'OWN'
   ORDER BY pc.created ASC LIMIT 1) AS first_owner
FROM projects
  JOIN (
    SELECT p.id,
      (SELECT COUNT(id)
       FROM projectCollaborators
       WHERE projectId = p.id AND accessLevel = 'PRIMARY') AS primary_count
    FROM projects AS p
    GROUP BY p.id
    HAVING primary_count = 0
  ) AS primary_check ON primary_check.id = projects.id;

-- Update all Projects that have at least one owner but do not have a primary owner
UPDATE projectCollaborators SET projectCollaborators.accessLevel = 'PRIMARY'
WHERE projectCollaborators.id IN (
  SELECT first_owner
  FROM (
    SELECT projects.id, projects.title,
       (SELECT pc.id
        FROM projectCollaborators pc
        WHERE pc.projectId = projects.id AND pc.accessLevel = 'OWN'
        ORDER BY pc.created ASC LIMIT 1) AS first_owner
    FROM projects
      JOIN (
        SELECT p.id,
          (SELECT COUNT(id)
           FROM projectCollaborators
           WHERE projectId = p.id AND accessLevel = 'PRIMARY') AS primary_count
        FROM projects AS p
        GROUP BY p.id
        HAVING primary_count = 0
      ) AS primary_check ON primary_check.id = projects.id
  ) AS missing_primary
  WHERE missing_primary.first_owner IS NOT NULL
);

-- Add the designated user as the primary owner for all projects that did not have at least one owner
-- Basically everything else that has no PRIMARY owner.
SET @user_id := <a valid user id>;
INSERT INTO projectCollaborators (projectId, email, invitedById, userId, accessLevel, created, createdById, modified, modifiedById)
(SELECT p.id, super.email, super.id, super.id, 'PRIMARY', NOW(), super.id, NOW(), super.id
 FROM projects p
   JOIN (
     SELECT u.id, ue.email
     FROM users u
       JOIN userEmails ue on u.id = ue.userId
     WHERE u.id = @user_id) as super
 WHERE p.id IN (
   SELECT id
   FROM (
     SELECT projects.id, projects.title, (SELECT pc.id
                                          FROM projectCollaborators pc
                                          WHERE pc.projectId = projects.id
                                          AND pc.accessLevel = 'OWN'
                                          ORDER BY pc.created ASC
                                          LIMIT 1) AS first_owner
     FROM projects
       JOIN (
         SELECT p.id, (SELECT COUNT(id)
                       FROM projectCollaborators
                       WHERE projectId = p.id
                       AND accessLevel = 'PRIMARY') AS primary_count
         FROM projects AS p
         GROUP BY p.id
         HAVING primary_count = 0
       ) AS primary_check ON primary_check.id = projects.id
   ) AS missing_primary
   WHERE missing_primary.first_owner IS NULL
 )
)

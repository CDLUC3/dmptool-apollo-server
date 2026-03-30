DROP PROCEDURE IF EXISTS create_related_works_staging_tables;
DROP PROCEDURE IF EXISTS batch_update_related_works;
DROP PROCEDURE IF EXISTS cleanup_orphan_works;

DELIMITER $$

-- Creates the two temporary staging tables that callers populate before
-- calling batch_update_related_works.
CREATE PROCEDURE `create_related_works_staging_tables`()
BEGIN
  DROP TEMPORARY TABLE IF EXISTS stagingWorkVersions;
  CREATE TEMPORARY TABLE stagingWorkVersions
  (
    `doi`              VARCHAR(255) NOT NULL PRIMARY KEY,
    `hash`             BINARY(16)   NOT NULL,
    `workType`         VARCHAR(255) NOT NULL,
    `publicationDate`  DATE         NULL,
    `title`            TEXT         NULL,
    `abstractText`     MEDIUMTEXT         NULL,
    `authors`          JSON         NOT NULL,
    `institutions`     JSON         NOT NULL,
    `funders`          JSON         NOT NULL,
    `awards`           JSON         NOT NULL,
    `publicationVenue` VARCHAR(1000) NULL,
    `sourceName`       VARCHAR(255) NOT NULL,
    `sourceUrl`        VARCHAR(255) NOT NULL
  ) ENGINE = InnoDB
    DEFAULT CHARSET = utf8mb4
    COLLATE = utf8mb4_0900_ai_ci;

  DROP TEMPORARY TABLE IF EXISTS stagingRelatedWorks;
  CREATE TEMPORARY TABLE stagingRelatedWorks
  (
    `id`                 INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `planId`             INT UNSIGNED NOT NULL,
    `workDoi`            VARCHAR(255) NOT NULL,
    `hash`               BINARY(16)   NOT NULL,
    `sourceType`         VARCHAR(32)  NOT NULL,
    `score`              FLOAT        NOT NULL,
    `status`             VARCHAR(255) NOT NULL,
    `scoreMax`           FLOAT        NOT NULL,
    `doiMatch`           JSON         NOT NULL,
    `contentMatch`       JSON         NOT NULL,
    `authorMatches`      JSON         NOT NULL,
    `institutionMatches` JSON         NOT NULL,
    `funderMatches`      JSON         NOT NULL,
    `awardMatches`       JSON         NOT NULL,

    INDEX (`planId`, `workDoi`),
    CONSTRAINT unique_plan_work UNIQUE (`planId`, `workDoi`)
  ) ENGINE = InnoDB
    DEFAULT CHARSET = utf8mb4
    COLLATE = utf8mb4_0900_ai_ci;
END$$

DELIMITER ;

DELIMITER $$

-- Upserts staging data into works, workVersions, and relatedWorks within a transaction.
--
-- Flow:
--   1. Insert new works and workVersions (deduplicated by DOI and hash).
--   2. Resolve staging rows to real foreign keys (planId, workVersionId).
--   3. Insert new relatedWorks links for plans that don't already link to a given DOI.
--   4. Update existing relatedWorks links (matched by DOI, not workVersionId)
--      with the latest staging data (behaviour depends on mode: see below).
--   5. (System mode only) Delete stale PENDING links no longer present in this batch.
--
-- Modes:
--   systemMatched = FALSE (user-triggered): only syncs the status field on existing links.
--   systemMatched = TRUE  (system re-match): overwrites all scoring fields on PENDING rows,
--     if a new workVersion was crated in step 1 the workVersionId is updated,
--     and garbage-collects stale PENDING links no longer present in this batch.
CREATE PROCEDURE `batch_update_related_works`(IN systemMatched BOOLEAN)
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
      ROLLBACK;
      RESIGNAL;
    END;

  START TRANSACTION;

  -- works: register any new DOIs, skips if DOI already exists (unique_doi constraint)
  INSERT IGNORE INTO works (doi)
  SELECT doi
  FROM stagingWorkVersions;

  -- workVersions: insert new version snapshots. Skips if this (workId, hash) pair
  -- already exists (unique_hash composite constraint). workId is resolved via s.doi = w.doi.
  INSERT IGNORE INTO workVersions (workId, hash, workType, publicationDate, title,
                                   abstractText, authors, institutions, funders,
                                   awards, publicationVenue, sourceName,
                                   sourceUrl)
  SELECT w.id,
         s.hash,
         s.workType,
         s.publicationDate,
         s.title,
         s.abstractText,
         s.authors,
         s.institutions,
         s.funders,
         s.awards,
         s.publicationVenue,
         s.sourceName,
         s.sourceUrl
  FROM stagingWorkVersions s
         INNER JOIN works w ON s.doi = w.doi;

  DROP TEMPORARY TABLE IF EXISTS resolvedStagingLinks;
  CREATE TEMPORARY TABLE resolvedStagingLinks
  (
    `id`            INT UNSIGNED NOT NULL,
    `planId`        INT          NOT NULL,
    `workVersionId` INT UNSIGNED NOT NULL,
    `workDoi`       VARCHAR(255) NOT NULL,
    UNIQUE KEY (`planId`, `workVersionId`)
  )
    ENGINE = InnoDB
    DEFAULT CHARSET = utf8mb4
    COLLATE = utf8mb4_0900_ai_ci;

  -- resolvedStagingLinks: map each staging row to its real foreign keys (planId, workVersionId)
  -- by joining through works and workVersions on doi and hash.
  -- The id column carries stagingRelatedWorks.id so we can join back to it later.
  INSERT INTO resolvedStagingLinks (id, planId, workVersionId, workDoi)
  SELECT s.id  AS id,
         p.id  AS planId,
         wv.id AS workVersionId,
         s.workDoi
  FROM stagingRelatedWorks s
         JOIN plans p ON s.planId = p.id
         JOIN works w ON s.workDoi = w.doi
         JOIN workVersions wv ON wv.workId = w.id AND wv.hash = s.hash;

  -- relatedWorks: link works to plans. Deduplicates by (planId, DOI) rather than
  -- relying on the table's unique_planId_workVersionId constraint, because a single
  -- work can have multiple workVersions (different hashes) and we only want one
  -- link per plan per work.
  INSERT INTO relatedWorks (planId, workVersionId, sourceType, score, status,
                            scoreMax, doiMatch, contentMatch, authorMatches,
                            institutionMatches, funderMatches, awardMatches)
  SELECT links.planId,
         links.workVersionId,
         s.sourceType,
         s.score,
         s.status,
         s.scoreMax,
         s.doiMatch,
         s.contentMatch,
         s.authorMatches,
         s.institutionMatches,
         s.funderMatches,
         s.awardMatches
  FROM resolvedStagingLinks links
         JOIN stagingRelatedWorks s ON links.id = s.id
         LEFT JOIN (
    relatedWorks r
      JOIN workVersions wv ON r.workVersionId = wv.id
      JOIN works w ON wv.workId = w.id
    ) ON links.planId = r.planId AND links.workDoi = w.doi
  WHERE r.id IS NULL;                   -- only insert if not already linked

  -- User-triggered match: only sync the status field, preserving existing scoring data.
  -- <=> treats NULL = NULL as true.
  IF systemMatched = FALSE THEN
    UPDATE relatedWorks r
      JOIN workVersions wv ON r.workVersionId = wv.id
      JOIN works w ON wv.workId = w.id
      JOIN resolvedStagingLinks links ON r.planId = links.planId AND w.doi = links.workDoi
      JOIN stagingRelatedWorks s ON links.id = s.id
    SET r.status = s.status
    WHERE NOT (r.status <=> s.status);
  END IF;

  -- System re-match: update PENDING rows with latest scoring data and workVersionId
  -- (which may point to a newer version of the same work if its metadata hash changed)
  IF systemMatched = TRUE THEN
    UPDATE relatedWorks r
      JOIN workVersions wv ON r.workVersionId = wv.id
      JOIN works w ON wv.workId = w.id
      JOIN resolvedStagingLinks links ON r.planId = links.planId AND w.doi = links.workDoi
      JOIN stagingRelatedWorks s ON links.id = s.id
    SET r.workVersionId      = links.workVersionId,
        r.sourceType         = s.sourceType,
        r.score              = s.score,
        r.scoreMax           = s.scoreMax,
        r.doiMatch           = s.doiMatch,
        r.contentMatch       = s.contentMatch,
        r.authorMatches      = s.authorMatches,
        r.institutionMatches = s.institutionMatches,
        r.funderMatches      = s.funderMatches,
        r.awardMatches       = s.awardMatches
    WHERE r.status = 'PENDING';

    -- affectedPlanIds: collect plans in this batch so the stale-link cleanup only touches relevant plans
    DROP TEMPORARY TABLE IF EXISTS affectedPlanIds;
    CREATE TEMPORARY TABLE affectedPlanIds (
      `planId` INT NOT NULL PRIMARY KEY
    ) ENGINE = InnoDB;
    INSERT INTO affectedPlanIds (planId)
    SELECT DISTINCT planId FROM resolvedStagingLinks;

    -- Remove stale PENDING links for affected plans that were not present
    -- in this batch. Joins on (planId, workVersionId), so if a work's hash
    -- changed, the old version's link is deleted.
    DELETE r
    FROM relatedWorks r
      JOIN affectedPlanIds ap ON r.planId = ap.planId
      LEFT JOIN resolvedStagingLinks links ON r.planId = links.planId AND r.workVersionId = links.workVersionId
    WHERE r.status = 'PENDING'
      AND links.id IS NULL;
  END IF;

  COMMIT;

END$$

DELIMITER ;

DELIMITER $$

-- cleanup_orphan_works: garbage-collect workVersions and works that are no longer
-- referenced by any relatedWorks row
CREATE PROCEDURE `cleanup_orphan_works`()
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
      ROLLBACK;
      RESIGNAL;
    END;

  START TRANSACTION;

  -- Delete workVersions that are no longer referenced by any relatedWorks row
  DELETE wv
  FROM workVersions wv
         LEFT JOIN relatedWorks r ON r.workVersionId = wv.id
  WHERE r.id IS NULL;

  -- Delete works that have no remaining workVersions
  DELETE w
  FROM works w
         LEFT JOIN workVersions wv ON wv.workId = w.id
  WHERE wv.id IS NULL;

  COMMIT;
END$$

DELIMITER ;

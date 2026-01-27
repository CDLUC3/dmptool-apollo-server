DROP PROCEDURE IF EXISTS create_related_works_staging_tables;
DROP PROCEDURE IF EXISTS batch_update_related_works;

-- Procedure to create staging tables for related works
DELIMITER $$
-- ********************************************************
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
    `planId`             INT UNSIGNED NULL,
    `dmpDoi`             VARCHAR(255) NULL,
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

    INDEX (`planId`, `dmpDoi`, `workDoi`),
    CONSTRAINT unique_hash UNIQUE (`planId`, `dmpDoi`, `workDoi`),
    CONSTRAINT one_of_plan_id_dmp_doi_not_null CHECK (planId IS NOT NULL OR dmpDoi IS NOT NULL)
  ) ENGINE = InnoDB
    DEFAULT CHARSET = utf8mb4
    COLLATE = utf8mb4_0900_ai_ci;
END$$

DELIMITER ;

-- Procedure to upsert and delete related works based on data in staging tables
DELIMITER $$

-- ********************************************************
CREATE PROCEDURE `batch_update_related_works`(IN systemMatched BOOLEAN)
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
      ROLLBACK;
      RESIGNAL;
    END;

  START TRANSACTION;

  INSERT IGNORE INTO works (doi)
  SELECT doi
  FROM stagingWorkVersions;


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


  INSERT INTO resolvedStagingLinks (id, planId, workVersionId, workDoi)
  SELECT s.id  AS id,
         p.id  AS planId,
         wv.id AS workVersionId,
         s.workDoi
  FROM stagingRelatedWorks s
         JOIN plans p ON (
            (s.planId IS NOT NULL AND s.planId = p.id)
            OR
            (s.planId IS NULL AND LOWER(CONCAT('https://doi.org/', s.dmpDoi)) = LOWER(p.dmpId))
          )
         JOIN works w ON s.workDoi = w.doi
         JOIN workVersions wv ON wv.workId = w.id AND wv.hash = s.hash;

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
  WHERE r.id IS NULL;

  IF systemMatched = FALSE THEN
    UPDATE relatedWorks r
      JOIN workVersions wv ON r.workVersionId = wv.id
      JOIN works w ON wv.workId = w.id
      JOIN resolvedStagingLinks links ON r.planId = links.planId AND w.doi = links.workDoi
      JOIN stagingRelatedWorks s ON links.id = s.id
    SET r.status = s.status
    WHERE NOT (r.status <=> s.status);
  END IF;

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

    WHERE r.status = 'PENDING'
      AND (
        r.workVersionId <> links.workVersionId
        OR NOT (r.score <=> s.score)
        OR NOT (r.scoreMax <=> s.scoreMax)
        OR NOT (r.doiMatch <=> s.doiMatch)
        OR NOT (r.contentMatch <=> s.contentMatch)
        OR NOT (r.authorMatches <=> s.authorMatches)
        OR NOT (r.institutionMatches <=> s.institutionMatches)
        OR NOT (r.funderMatches <=> s.funderMatches)
        OR NOT (r.awardMatches <=> s.awardMatches)
      );

    DELETE r
    FROM relatedWorks r
           LEFT JOIN resolvedStagingLinks links ON r.planId = links.planId AND r.workVersionId = links.workVersionId
    WHERE r.status = 'PENDING' AND links.id IS NULL;


    DELETE wv
    FROM workVersions wv
           LEFT JOIN relatedWorks r ON r.workVersionId = wv.id
    WHERE r.id IS NULL;


    DELETE w
    FROM works w
           LEFT JOIN workVersions wv ON wv.workId = w.id
    WHERE wv.id IS NULL;
  END IF;

  COMMIT;

END$$

DELIMITER ;

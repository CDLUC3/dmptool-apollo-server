-- UPDATE to add the correct commonStandardId to columns within a research output table
-- that do NOT have one defined.

-- 1st: VersionedQuestions
UPDATE versionedQuestions vq
  JOIN (
    -- Aggregate the ordered rows back into a single JSON array
    SELECT id,
      JSON_ARRAYAGG(
        CASE
          WHEN common_standard IS NULL THEN
            -- Set the correct commonStandardId based on the heading or col_type
            JSON_SET(
              column_raw,
              '$.commonStandardId',
              CASE
                WHEN heading = 'Title' THEN 'title'
                WHEN heading = 'Description' THEN 'description'
                WHEN heading = 'Output Type' THEN 'type'
                WHEN heading = 'Data Flags' THEN 'data_flags'
                WHEN heading = 'Repositories' THEN 'host'
                WHEN heading = 'Metadata Standards' THEN 'metadata'
                WHEN heading = 'Licenses' THEN 'license_ref'
                WHEN heading = 'Initial Access Levels' THEN 'data_access'
                WHEN col_type = 'numberWithContext' THEN 'byte_size'
                ELSE 'custom'
              END
            )
          ELSE column_raw
        END
      ) AS new_columns_array
    FROM (
      -- Unpack and explicitly sort by index first
      SELECT v.id, jt.idx, jt.column_raw, jt.heading, jt.col_type, jt.common_standard
      FROM versionedQuestions v,
      JSON_TABLE(
        v.json,
        '$.columns[*]' COLUMNS(
          idx FOR ORDINALITY,
          column_raw JSON PATH '$',
          heading VARCHAR(255) PATH '$.heading',
          col_type VARCHAR(255) PATH '$.content.type',
          common_standard VARCHAR(255) PATH '$.commonStandardId'
        )
      ) jt
      ORDER BY v.id, jt.idx
    ) sorted_columns
    GROUP BY id
  ) updates ON vq.id = updates.id
-- Replace the columns array
SET vq.json = JSON_SET(vq.json, '$.columns', updates.new_columns_array);


-- 2nd: Questions
UPDATE questions q
  JOIN (
    -- Aggregate the ordered rows back into a single JSON array
    SELECT id,
      JSON_ARRAYAGG(
        CASE
        WHEN common_standard IS NULL THEN
          -- Set the correct commonStandardId based on the heading or col_type
          JSON_SET(
            column_raw,
            '$.commonStandardId',
            CASE
              WHEN heading = 'Title' THEN 'title'
              WHEN heading = 'Description' THEN 'description'
              WHEN heading = 'Output Type' THEN 'type'
              WHEN heading = 'Data Flags' THEN 'data_flags'
              WHEN heading = 'Repositories' THEN 'host'
              WHEN heading = 'Metadata Standards' THEN 'metadata'
              WHEN heading = 'Licenses' THEN 'license_ref'
              WHEN heading = 'Initial Access Levels' THEN 'data_access'
              WHEN col_type = 'numberWithContext' THEN 'byte_size'
              ELSE 'custom'
            END
          )
        ELSE column_raw
        END
      ) AS new_columns_array
    FROM (
      -- Unpack and explicitly sort by index first
      SELECT v.id, jt.idx, jt.column_raw, jt.heading, jt.col_type, jt.common_standard
      FROM versionedQuestions v,
      JSON_TABLE(
        v.json,
        '$.columns[*]' COLUMNS(
        idx FOR ORDINALITY,
        column_raw JSON PATH '$',
        heading VARCHAR(255) PATH '$.heading',
        col_type VARCHAR(255) PATH '$.content.type',
        common_standard VARCHAR(255) PATH '$.commonStandardId'
      )
    ) jt
    ORDER BY v.id, jt.idx
  ) sorted_columns
  GROUP BY id
) updates ON q.id = updates.id
-- Replace the columns array
SET q.json = JSON_SET(q.json, '$.columns', updates.new_columns_array);

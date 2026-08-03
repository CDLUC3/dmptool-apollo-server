
-- Delete ALL questions and answers of type researchOutputTable
DELETE FROM answers WHERE json->>'$.type' = 'researchOutputTable';
DELETE FROM versionedQuestions WHERE json->>'$.type' = 'researchOutputTable';
DELETE FROM questions WHERE json->>'$.type' = 'researchOutputTable';

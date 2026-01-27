
# Patch existing question JSON to comply with the latest version of @dmptool/types
UPDATE questions SET json = REPLACE(json, '"selected": 0', '"selected": false') WHERE json LIKE '"selected":';
UPDATE questions SET json = REPLACE(json, '"selected": 1', '"selected": true') WHERE json LIKE '"selected":';

#!/bin/bash

# Configuration
ENDPOINT="http://localhost:9200"
INDEX_NAME="re3data-idx1"
ALIAS_NAME="re3data"

echo "Deleting existing index (if it exists) to start fresh..."
curl -X DELETE "$ENDPOINT/$INDEX_NAME" -u 'admin:admin' --insecure -s

echo -e "\nCreating OpenSearch index: $INDEX_NAME..."

# The Index Mapping
curl -X PUT "$ENDPOINT/$INDEX_NAME" \
     -u 'admin:admin' \
     --insecure \
     -H "Content-Type: application/json" \
     -d '{
  "settings": {
    "index": {
      "number_of_shards": 1,
      "number_of_replicas": 0
    }
  },
  "mappings": {
    "properties": {
      "id": { "type": "keyword", "copy_to": "search_all" },
      "name": {
        "type": "text",
        "copy_to": "search_all",
        "fields": { "keyword": { "type": "keyword", "ignore_above": 256 } }
      },
      "description": { "type": "text", "copy_to": "search_all" },
      "website": { "type": "keyword" },
      "contact": { "type": "text", "copy_to": "search_all" },
      "uri": { "type": "keyword" },
      "repositoryTypes": { "type": "keyword", "copy_to": "search_all" },
      "subjects": { "type": "keyword", "copy_to": "search_all" },
      "provider_types": { "type": "keyword" },
      "keywords": {
        "type": "text",
        "copy_to": "search_all",
        "fields": { "keyword": { "type": "keyword", "ignore_above": 256 } }
      },
      "access": { "type": "keyword" },
      "pid_system": { "type": "keyword" },
      "policies": { "type": "keyword" },
      "upload_types": { "type": "keyword" },
      "certificates": { "type": "keyword", "copy_to": "search_all" },
      "software": { "type": "keyword", "copy_to": "search_all" },
      "created": { "type": "date" },
      "modified": { "type": "date" },
      "search_all": { "type": "text" }
    }
  }
}'

echo -e "\n\nIndex created successfully."

echo -e "\n\nCreating alias: $ALIAS_NAME -> $INDEX_NAME..."

curl -X POST "$ENDPOINT/_aliases" \
     -u 'admin:admin' \
     --insecure \
     -H "Content-Type: application/json" \
     -d "{
  \"actions\": [
    { \"add\": { \"index\": \"$INDEX_NAME\", \"alias\": \"$ALIAS_NAME\" } }
  ]
}"

echo -e "\nDone."

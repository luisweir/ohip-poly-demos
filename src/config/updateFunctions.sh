#!/bin/bash

# JSON file with your list
JSON_FILE="./src/config/functionMap.json"

# PolyAPI token
TOKEN="b6008c20-d944-40b3-88ec-b67be0de3f92"

# Base URL
BASE_URL="https://eu1.polyapi.io/functions/api"

# Loop through each element
jq -c '.[]' "$JSON_FILE" | while read -r item; do
  id=$(echo "$item" | jq -r '.id')
  name=$(echo "$item" | jq -r '.name')
  context=$(echo "$item" | jq -r '.context')
  contextName=$(echo "$item" | jq -r '.contextName')

  echo "Updating function: $name ($id)"

  curl --silent --show-error --location --request PATCH "$BASE_URL/$id" \
    --header "Content-Type: application/json" \
    --header "Authorization: Bearer $TOKEN" \
    --data "{
      \"name\": \"$name\",
      \"context\": \"$context\"
    }"

  echo -e "\n---\n"
done

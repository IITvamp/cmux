#!/usr/bin/env bash

# Fetch the OpenAPI spec (it comes as a JSON-encoded string, so we need to parse it twice)
curl -s https://api.freestyle.sh/openapi.json | jq -r . | jq . > /tmp/freestyle-openapi.json

# Generate the TypeScript client

bunx @hey-api/openapi-ts -i /tmp/freestyle-openapi.json -o ./scripts/freestyle/freestyle-openapi-client/src/client -c @hey-api/client-fetch --plugins @hey-api/client-fetch @hey-api/typescript
# Clean up
rm /tmp/freestyle-openapi.json
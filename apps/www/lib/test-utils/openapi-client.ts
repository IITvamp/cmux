import { createClient } from "@cmux/www-openapi-client/client";
import { honoTestFetch } from "@/lib/utils/hono-test-fetch";

export const testApiClient = createClient({
  fetch: honoTestFetch,
  baseUrl: "http://localhost",
});


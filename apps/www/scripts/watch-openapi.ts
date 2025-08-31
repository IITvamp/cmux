import { app } from "@/lib/hono-app";
import { createClient } from "@hey-api/openapi-ts";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

console.time("watch-openapi");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.time("fetch /api/doc");
const doc = await app.request("/api/doc", {
  method: "GET",
});
console.timeEnd("fetch /api/doc");

const outputPath = path.join(
  __dirname,
  "../../../packages/www-openapi-client/src/client"
);
const tsConfigPath = path.join(
  __dirname,
  "../../../packages/www-openapi-client/tsconfig.json"
);

// write to tmp file
const tmpFile = path.join(os.tmpdir(), "openapi.json");
fs.writeFileSync(tmpFile, await doc.text());

console.time("generate client");
await createClient({
  input: tmpFile,
  output: {
    path: outputPath,
    tsConfigPath,
  },
  plugins: ["@hey-api/typescript", "@tanstack/react-query"],
});
console.timeEnd("generate client");

fs.unlinkSync(tmpFile);

console.timeEnd("watch-openapi");

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

console.time("watch-openapi");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let docText: string | null = null;
console.time("fetch /api/doc");
try {
  const mod = await import("@/lib/hono-app");
  const app = mod.app as { request: (path: string, init: RequestInit) => Promise<Response> };
  const doc = await app.request("/api/doc", { method: "GET" });
  docText = await doc.text();
} catch (e) {
  console.warn(
    "[watch-openapi] Skipping doc fetch (app init/env failed):",
    e instanceof Error ? e.message : e
  );
}
console.timeEnd("fetch /api/doc");

const outputPath = path.join(
  __dirname,
  "../../../packages/www-openapi-client/src/client"
);
const tsConfigPath = path.join(
  __dirname,
  "../../../packages/www-openapi-client/tsconfig.json"
);

// write to tmp file (unique name to avoid concurrent collisions)
const tmpFile = path.join(
  os.tmpdir(),
  `openapi-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
);
if (docText) {
  fs.writeFileSync(tmpFile, docText);
}

console.time("generate client");
try {
  if (docText) {
    const { createClient } = await import("@hey-api/openapi-ts");
    await createClient({
      input: tmpFile,
      output: {
        path: outputPath,
        tsConfigPath,
      },
      plugins: [
        "@hey-api/client-fetch",
        "@hey-api/typescript",
        "@tanstack/react-query",
      ],
    });
  }
  console.timeEnd("generate client");
} catch (e) {
  console.warn(
    "[watch-openapi] Skipping client generation (dependency unavailable):",
    e instanceof Error ? e.message : e
  );
  console.timeEnd("generate client");
}

try {
  fs.unlinkSync(tmpFile);
} catch {
  // ignore if already removed by concurrent runs
}

console.timeEnd("watch-openapi");

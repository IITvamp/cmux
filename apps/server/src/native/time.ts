import { createRequire } from "node:module";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

export interface NativeTimeModule {
  getTime?: () => Promise<string>;
}

// Avoid top-level `require`/`__dirname` to prevent bundler collisions (Electron SSR)

function tryLoadNative(): NativeTimeModule | null {
  try {
    const nodeRequire = createRequire(import.meta.url);
    const here = path.dirname(fileURLToPath(import.meta.url));
    const plat = process.platform;
    const arch = process.arch;

    const dirCandidates = [
      // Explicit override for development or packaging scenarios
      process.env.CMUX_NATIVE_TIME_DIR,
      // When packaged by electron-builder, extraResources are placed under resourcesPath
      typeof (process as unknown as { resourcesPath?: string }).resourcesPath ===
      "string"
        ? path.join(
            (process as unknown as { resourcesPath: string }).resourcesPath,
            "native",
            "time"
          )
        : undefined,
      // Normal backend path
      fileURLToPath(new URL("../../native/time/", import.meta.url)),
      // When bundled into Electron main (dist-electron/main)
      path.resolve(here, "../../../server/native/time"),
      path.resolve(here, "../../../../apps/server/native/time"),
      // Based on current working directory during dev
      path.resolve(process.cwd(), "../server/native/time"),
      path.resolve(process.cwd(), "../../apps/server/native/time"),
      path.resolve(process.cwd(), "apps/server/native/time"),
      path.resolve(process.cwd(), "server/native/time"),
    ];

    for (const maybeDir of dirCandidates) {
      const nativeDir = maybeDir ?? "";
      if (!nativeDir) continue;
      try {
        const files = fs.readdirSync(nativeDir);
        const nodes = files.filter((f) => f.startsWith("index.") && f.endsWith(".node"));
        const preferred = nodes.find((f) => f.includes(plat) && f.includes(arch)) || nodes[0];
        if (!preferred) continue;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = nodeRequire(path.join(nativeDir, preferred)) as unknown as NativeTimeModule;
        if (mod && typeof mod.getTime === "function") return mod;
      } catch {
        // try next
      }
    }
    return null;
  } catch {
    return null;
  }
}

let cached: NativeTimeModule | null = null;

function loadNative(): NativeTimeModule | null {
  if (!cached) cached = tryLoadNative();
  return cached;
}

export async function getRustTime(): Promise<string> {
  const mod = loadNative();
  if (mod?.getTime) return mod.getTime();
  throw new Error("@cmux/native-time not built or failed to load");
}

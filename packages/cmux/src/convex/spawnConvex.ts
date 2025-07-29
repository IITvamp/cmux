import { $ } from "bun";
import { ChildProcess, spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { logger } from "../logger";

// @ts-expect-error this is a real file!
import cmux_bundle_zip from "./cmux-bundle.zip" with { type: "file" };

// console.log(embeddedFiles);
// logger.info(`convex: ${JSON.stringify(convex)}`).catch(() => {});

export interface ConvexProcesses {
  backend: ChildProcess;
}

export async function spawnConvex(
  convexDir?: string
): Promise<ConvexProcesses> {
  if (!convexDir) {
    convexDir = path.resolve(os.homedir(), ".cmux");
  }
  const convexPort = process.env.CONVEX_PORT || "9777";

  await logger.info("Starting Convex CLI...");
  await logger.info(`Creating directory: ${convexDir}`);
  const dirStartTime = performance.now();
  await fs.mkdir(convexDir, { recursive: true });
  const dirEndTime = performance.now();
  await logger.info(
    `Directory creation took ${(dirEndTime - dirStartTime).toFixed(2)}ms`
  );

  const convexBinaryPath = path.resolve(convexDir, "convex-local-backend");
  const versionFilePath = path.resolve(convexDir, ".cmux-version");

  // Get the current version from package.json in the bundle
  const tempZipPath = path.join(os.tmpdir(), `cmux-bundle-${Date.now()}.zip`);
  const zipData = await fs.readFile(cmux_bundle_zip);
  await fs.writeFile(tempZipPath, zipData);

  // Extract just the package.json to check version
  const tempVersionCheckDir = path.join(
    os.tmpdir(),
    `cmux-version-check-${Date.now()}`
  );
  await $`unzip -jo ${tempZipPath} "cmux-bundle/package.json" -d ${tempVersionCheckDir}`;
  const bundlePackageJson = JSON.parse(
    await fs.readFile(path.join(tempVersionCheckDir, "package.json"), "utf8")
  );
  const bundleVersion = bundlePackageJson.version;
  await fs.rm(tempVersionCheckDir, { recursive: true, force: true });

  // Check if we need to extract
  let shouldExtract = false;
  let isUpgrade = false;

  try {
    const currentVersion = await fs.readFile(versionFilePath, "utf8");
    if (currentVersion.trim() !== bundleVersion) {
      await logger.info(
        `Version changed from ${currentVersion.trim()} to ${bundleVersion}, upgrading...`
      );
      shouldExtract = true;
      isUpgrade = true;
    } else {
      await logger.info(
        `Already running version ${bundleVersion}, skipping extraction`
      );
    }
  } catch {
    // Version file doesn't exist, this is a fresh install
    await logger.info(`Fresh installation of version ${bundleVersion}`);
    shouldExtract = true;
    isUpgrade = false;
  }

  if (shouldExtract) {
    await logger.info("Extracting cmux bundle...");

    const unzipStartTime = performance.now();
    // Extract to temp directory first
    const tempExtractDir = path.join(os.tmpdir(), `cmux-extract-${Date.now()}`);
    await $`unzip -o ${tempZipPath} -d ${tempExtractDir}`;

    if (isUpgrade) {
      await logger.info("Upgrading cmux, preserving user data...");

      // Backup user data files
      const sqliteDbPath = path.join(convexDir, "convex_local_backend.sqlite3");
      const convexStoragePath = path.join(convexDir, "convex_local_storage");
      const tempBackupDir = path.join(os.tmpdir(), `cmux-backup-${Date.now()}`);

      await fs.mkdir(tempBackupDir, { recursive: true });

      // Backup SQLite database if it exists
      const hasDb = await fs
        .access(sqliteDbPath)
        .then(() => true)
        .catch(() => false);
      if (hasDb) {
        await $`cp ${sqliteDbPath} ${tempBackupDir}/`;
        await logger.info("Backed up SQLite database");
      }

      // Backup convex_local_storage if it exists
      const hasStorage = await fs
        .access(convexStoragePath)
        .then(() => true)
        .catch(() => false);
      if (hasStorage) {
        // Use rsync to ensure all files are copied, including hidden files
        await $`rsync -av ${convexStoragePath}/ ${tempBackupDir}/convex_local_storage/`;
        await logger.info("Backed up convex_local_storage");
      }

      // Clear the convexDir
      await fs.rm(convexDir, { recursive: true, force: true });
      await fs.mkdir(convexDir, { recursive: true });

      // Move new files
      await $`mv ${tempExtractDir}/cmux-bundle/* ${convexDir}/`;

      // Restore user data
      if (hasDb) {
        await $`mv ${tempBackupDir}/convex_local_backend.sqlite3 ${convexDir}/`;
        await logger.info("Restored SQLite database");
      }

      if (hasStorage) {
        // Remove the extracted empty storage directory first
        await $`rm -rf ${convexDir}/convex_local_storage`;
        // Use rsync to restore, preserving all file attributes
        await $`rsync -av ${tempBackupDir}/convex_local_storage/ ${convexDir}/convex_local_storage/`;
        await logger.info("Restored convex_local_storage");

        // Verify the restoration
        const restoredFiles =
          await $`find ${convexDir}/convex_local_storage -type f | wc -l`.text();
        const backupFiles =
          await $`find ${tempBackupDir}/convex_local_storage -type f | wc -l`.text();
        await logger.info(
          `Restored ${restoredFiles.trim()} files (backup had ${backupFiles.trim()} files)`
        );
      }

      // Cleanup backup dir
      await $`rm -rf ${tempBackupDir}`;
      await logger.info("Upgrade complete!");
    } else {
      await logger.info("Fresh installation...");
      // Clear the convexDir and move the contents of cmux-bundle
      await fs.rm(convexDir, { recursive: true, force: true });
      await fs.mkdir(convexDir, { recursive: true });
      await $`mv ${tempExtractDir}/cmux-bundle/* ${convexDir}/`;
    }

    // Cleanup
    await $`rm -rf ${tempExtractDir}`;

    const unzipEndTime = performance.now();
    await logger.info(
      `Extraction took ${(unzipEndTime - unzipStartTime).toFixed(2)}ms`
    );

    // Write the version file
    await fs.writeFile(versionFilePath, bundleVersion);
    await logger.info(`Saved version ${bundleVersion}`);
  }

  // Cleanup temp zip file
  await fs.unlink(tempZipPath);

  // Make sure the binary is executable
  try {
    await fs.chmod(convexBinaryPath, 0o755);
  } catch (error) {
    await logger.error(`Failed to make binary executable: ${error}`);
  }

  await logger.info("Starting convex process...");
  const convexBackend = spawn(
    convexBinaryPath,
    [
      "--port",
      convexPort,
      "--site-proxy-port",
      process.env.CONVEX_SITE_PROXY_PORT || "9778",
      "--instance-name",
      process.env.CONVEX_INSTANCE_NAME || "cmux-dev",
      "--instance-secret",
      process.env.CONVEX_INSTANCE_SECRET ||
        "29dd272e3cd3cce53ff444cac387925c2f6f53fd9f50803a24e5a11832d36b9c",
      "--disable-beacon",
    ],
    {
      cwd: convexDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    }
  );

  convexBackend.stdout.on("data", (data) => {
    logger.info(`[CONVEX-BACKEND] ${data}`).catch(() => {});
  });

  convexBackend.stderr.on("data", (data) => {
    logger.error(`[CONVEX-BACKEND] ${data}`).catch(() => {});
  });

  // wait until we can fetch the instance
  let instance: Response | undefined;
  let retries = 0;
  const maxRetries = 100;

  while ((!instance || !instance.ok) && retries < maxRetries) {
    try {
      instance = await fetch(`http://localhost:${convexPort}/`);
    } catch (error) {
      // Ignore fetch errors and continue retrying
    }

    if (!instance || !instance.ok) {
      retries++;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  if (!instance || !instance.ok) {
    throw new Error(
      `Failed to connect to Convex instance after ${maxRetries} retries`
    );
  }

  return {
    backend: convexBackend,
  };
}

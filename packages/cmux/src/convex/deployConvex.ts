import { $ } from "bun";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { logger } from "../logger";

export async function deployConvexFunctions(convexDir: string, convexPort: string): Promise<void> {
  await logger.info("Deploying Convex functions...");

  const convexAdminKey =
    "cmux-dev|017aebe6643f7feb3fe831fbb93a348653c63e5711d2427d1a34b670e3151b0165d86a5ff9";

  try {
    // Ensure logs dir exists
    await fs.mkdir(path.join(convexDir, "logs"), { recursive: true });

    // Create .env.local if it doesn't exist
    const envLocalPath = path.join(convexDir, ".env.local");
    if (!existsSync(envLocalPath)) {
      await $`echo "CONVEX_URL=http://localhost:${convexPort}" > ${envLocalPath}`.quiet();
    }

    await logger.info(`process.execPath: ${process.execPath}`);
    await logger.info(`convexDir: ${convexDir}`);

    // Run convex deploy using the bundled CLI via bun x
    const deployResult = await $`cd ${convexDir} && BUN_BE_BUN=1 ${process.execPath} install 2>&1 | tee -a ${convexDir}/logs/convex-install.log && BUN_BE_BUN=1 ${process.execPath} x convex deploy --url http://localhost:${convexPort} --admin-key ${convexAdminKey} 2>&1 | tee -a ${convexDir}/logs/convex-deploy.log`.quiet();

    if (deployResult.exitCode === 0) {
      await logger.info("Convex functions deployed successfully!");
    } else {
      await logger.error(`Convex deployment failed with exit code ${deployResult.exitCode}`);
      throw new Error(`Convex deployment failed with exit code ${deployResult.exitCode}`);
    }
  } catch (error) {
    await logger.error(`Failed to deploy Convex functions: ${error}`);
    throw error;
  }
}


import { CONVEX_URL } from "./convexClient";
import { serverLogger } from "./fileLogger.js";

export async function waitForConvex(): Promise<void> {
  serverLogger.info("Waiting for convex to be ready...");

  const maxRetries = 20;
  const retryDelay = 100;
  let attempt = 1;

  for (; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(CONVEX_URL, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) {
        serverLogger.info(
          `Convex is ready after ${attempt} ${
            attempt === 1 ? "attempt" : "attempts"
          }`
        );
        return;
      }
    } catch (error) {
      if (attempt > 5) {
        serverLogger.error(`Convex connection attempt ${attempt} failed:`, error);
      }

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  }

  throw new Error(`Convex not ready after ${maxRetries} attempts`);
}

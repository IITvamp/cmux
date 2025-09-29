import { Octokit } from "octokit";

const MAX_RATE_LIMIT_RETRIES = 5;
const MAX_RATE_LIMIT_WAIT_SECONDS = 15;

type ThrottleOptions = {
  method?: string;
  url?: string;
};

export function getOctokit(token: string): Octokit {
  return new Octokit({
    auth: token,
    request: {
      timeout: 30000,
    },
    throttle: {
      // Retry on primary rate limits only if the wait is short
      onRateLimit: (
        retryAfter: number,
        options: ThrottleOptions,
        _octokit: Octokit,
        retryCount: number
      ) => {
        if (
          retryCount < MAX_RATE_LIMIT_RETRIES &&
          retryAfter <= MAX_RATE_LIMIT_WAIT_SECONDS
        ) {
          console.warn(
            `GitHub rate limit on ${options.method} ${options.url}. Retrying after ${retryAfter}s (retry #${retryCount + 1}).`
          );
          return true;
        }
        return false;
      },
      // Retry on secondary rate limits only if the wait is short
      onSecondaryRateLimit: (
        retryAfter: number,
        options: ThrottleOptions,
        _octokit: Octokit,
        retryCount: number
      ) => {
        if (
          retryCount < MAX_RATE_LIMIT_RETRIES &&
          retryAfter <= MAX_RATE_LIMIT_WAIT_SECONDS
        ) {
          console.warn(
            `GitHub secondary rate limit on ${options.method} ${options.url}. Retrying after ${retryAfter}s (retry #${retryCount + 1}).`
          );
          return true;
        }
        return false;
      },
    },
  });
}

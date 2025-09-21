import { waitUntil } from "@vercel/functions";

export const runBackgroundTask = (
  label: string,
  task: () => Promise<void>
): void => {
  const promise = task();
  waitUntil(
    promise.catch((error) => {
      console.error(`[sandboxes.start] ${label} failed`, error);
    })
  );
};

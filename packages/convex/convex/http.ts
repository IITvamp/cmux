import { httpRouter } from "convex/server";
import {
  crownEvaluate,
  crownSummarize,
  crownWorkerCheck,
  crownWorkerFinalize,
  crownWorkerStatus,
} from "./crown_http";
import { workerComplete, workerScheduleStop } from "./worker_http";
import { githubSetup } from "./github_setup";
import { githubWebhook } from "./github_webhook";
import { stackWebhook } from "./stack_webhook";

const http = httpRouter();

http.route({
  path: "/github_webhook",
  method: "POST",
  handler: githubWebhook,
});

http.route({
  path: "/stack_webhook",
  method: "POST",
  handler: stackWebhook,
});

http.route({
  path: "/api/crown/evaluate",
  method: "POST",
  handler: crownEvaluate,
});

http.route({
  path: "/api/crown/summarize",
  method: "POST",
  handler: crownSummarize,
});

http.route({
  path: "/api/crown/worker/status",
  method: "POST",
  handler: crownWorkerStatus,
});

http.route({
  path: "/api/crown/worker/check",
  method: "POST",
  handler: crownWorkerCheck,
});

http.route({
  path: "/api/crown/worker/finalize",
  method: "POST",
  handler: crownWorkerFinalize,
});

http.route({
  path: "/api/worker/task-run/complete",
  method: "POST",
  handler: workerComplete,
});

http.route({
  path: "/api/worker/task-run/schedule-stop",
  method: "POST",
  handler: workerScheduleStop,
});

http.route({
  path: "/github_setup",
  method: "GET",
  handler: githubSetup,
});

export default http;

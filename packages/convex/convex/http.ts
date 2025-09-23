import { httpRouter } from "convex/server";
import { crownEvaluate, crownSummarize } from "./crown_http";
import { workerTaskComplete } from "./worker_http";
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
  path: "/api/worker/task-complete",
  method: "POST",
  handler: workerTaskComplete,
});

http.route({
  path: "/github_setup",
  method: "GET",
  handler: githubSetup,
});

export default http;

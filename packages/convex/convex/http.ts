import { httpRouter } from "convex/server";
import {
  crownEvaluate,
  crownSummarize,
  crownWorkerEvaluate,
  crownWorkerBegin,
  crownWorkerContext,
  crownWorkerFail,
  crownWorkerFinalize,
} from "./crown_http";
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
  path: "/api/crown/worker/context",
  method: "POST",
  handler: crownWorkerContext,
});

http.route({
  path: "/api/crown/worker/begin",
  method: "POST",
  handler: crownWorkerBegin,
});

http.route({
  path: "/api/crown/worker/evaluate",
  method: "POST",
  handler: crownWorkerEvaluate,
});

http.route({
  path: "/api/crown/worker/finalize",
  method: "POST",
  handler: crownWorkerFinalize,
});

http.route({
  path: "/api/crown/worker/fail",
  method: "POST",
  handler: crownWorkerFail,
});

http.route({
  path: "/github_setup",
  method: "GET",
  handler: githubSetup,
});

export default http;

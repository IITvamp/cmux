import { httpRouter } from "convex/server";
import { stackWebhook } from "./stack_webhook";

const http = httpRouter();

http.route({
  path: "/stack_webhook",
  method: "POST",
  handler: stackWebhook,
});

export default http;

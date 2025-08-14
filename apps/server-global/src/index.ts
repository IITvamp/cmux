import { Hono } from "hono";
import { cors } from "hono/cors";
import { stackServerApp } from "./utils/stack";

const app = new Hono();

app.use(
  cors({
    origin: "http://localhost:5173",
    allowHeaders: ["x-stack-auth"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);
app.get("/", (c) => c.text("cmux!"));
app.get("/user", async (c) => {
  const user = await stackServerApp.getUser({ tokenStore: c.req.raw });
  console.log("user", user);
  return c.json(user);
});

export default {
  port: 9779,
  fetch: app.fetch,
};

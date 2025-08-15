import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { booksRouter, healthRouter, usersRouter } from "./routes";
import { stackServerApp } from "./utils/stack";

const app = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        path: issue.path,
        message: issue.message,
      }));

      return c.json(
        {
          code: 422,
          message: "Validation Error",
          errors,
        },
        422
      );
    }
  },
});

app.use(logger());
app.use("/doc/*", prettyJSON());
app.use(
  cors({
    origin: "http://localhost:5173",
    allowHeaders: ["x-stack-auth", "content-type"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

app.get("/", (c) => c.text("cmux!"));
app.get("/user", async (c) => {
  const user = await stackServerApp.getUser({ tokenStore: c.req.raw });
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return c.json(user);
});

app.openAPIRegistry.registerComponent("securitySchemes", "Bearer", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
});

app.route("/api", usersRouter);
app.route("/api", booksRouter);
app.route("/api", healthRouter);

app.doc("/doc", {
  openapi: "3.0.0",
  info: {
    version: "1.0.0",
    title: "Cmux Server Global API",
    description: "Demo API with OpenAPI documentation",
  },
  servers: [
    {
      url: "http://localhost:9779",
      description: "Local development server",
    },
  ],
  tags: [
    {
      name: "Users",
      description: "User management endpoints",
    },
    {
      name: "Books",
      description: "Book library management",
    },
    {
      name: "System",
      description: "System endpoints",
    },
  ],
});

app.doc31("/doc/v3.1", {
  openapi: "3.1.0",
  info: {
    version: "1.0.0",
    title: "Cmux Server Global API",
    description: "Demo API with OpenAPI 3.1 documentation",
  },
  servers: [
    {
      url: "http://localhost:9779",
      description: "Local development server",
    },
  ],
});

app.get("/ui", swaggerUI({ url: "/doc" }));

export default {
  port: 9779,
  fetch: app.fetch,
};

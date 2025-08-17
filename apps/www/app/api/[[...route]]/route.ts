import { handle } from "hono/vercel";
import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { booksRouter, healthRouter, usersRouter } from "@/lib/routes/index";
import { stackServerApp } from "@/lib/utils/stack";

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
        422,
      );
    }
  },
});

// Debug middleware
app.use("*", async (c, next) => {
  console.log("Request path:", c.req.path);
  console.log("Request url:", c.req.url);
  return next();
});

// Middleware
app.use("*", logger());
app.use("*", prettyJSON());
app.use(
  "*",
  cors({
    origin: ["http://localhost:3000", "http://localhost:4321"],
    credentials: true,
  }),
);

// Routes - Next.js passes the full /api/* path
app.route("/api", healthRouter);
app.route("/api", usersRouter);
app.route("/api", booksRouter);

// Authentication endpoints
app.post("/api/auth/signup", async (c) => {
  const body = await c.req.json();
  const user = await stackServerApp.signUpWithCredential({
    email: body.email,
    password: body.password,
  });
  return c.json({ user });
});

app.post("/api/auth/signin", async (c) => {
  const body = await c.req.json();
  const user = await stackServerApp.signInWithCredential({
    email: body.email,
    password: body.password,
  });
  return c.json({ user });
});

// OpenAPI documentation
app.doc("/api/doc", {
  openapi: "3.0.0",
  info: {
    version: "1.0.0",
    title: "cmux API",
    description: "API for cmux",
  },
});

app.get("/api/swagger", swaggerUI({ url: "/api/doc" }));

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      code: 404,
      message: `Route ${c.req.path} not found`,
    },
    404,
  );
});

// Error handler
app.onError((err, c) => {
  console.error(`${err}`);
  return c.json(
    {
      code: 500,
      message: "Internal Server Error",
    },
    500,
  );
});

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);
export const OPTIONS = handle(app);
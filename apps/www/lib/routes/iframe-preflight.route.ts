import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

const QuerySchema = z
  .object({
    url: z
      .string()
      .url()
      .openapi({
        description:
          "Absolute HTTP(S) URL to check before embedding in an iframe.",
      }),
  })
  .openapi("IframePreflightQuery");

const ResponseSchema = z
  .object({
    ok: z.boolean().openapi({
      description:
        "Whether the target responded successfully to the probe request.",
    }),
    status: z
      .number()
      .int()
      .nullable()
      .openapi({ description: "HTTP status code returned by the target." }),
    method: z
      .enum(["HEAD", "GET"])
      .nullable()
      .openapi({
        description: "HTTP method used for the successful probe.",
      }),
    error: z
      .string()
      .optional()
      .openapi({ description: "Error message if the probe failed." }),
  })
  .openapi("IframePreflightResponse");

export const iframePreflightRouter = new OpenAPIHono();

iframePreflightRouter.openapi(
  createRoute({
    method: "get",
    path: "/iframe/preflight",
    tags: ["Iframe"],
    summary: "Validate iframe target availability via server-side preflight.",
    request: {
      query: QuerySchema,
    },
    responses: {
      200: {
        description:
          "Result of the preflight check for the requested iframe URL.",
        content: {
          "application/json": {
            schema: ResponseSchema,
          },
        },
      },
      400: {
        description: "The provided URL was not an HTTP(S) URL.",
      },
    },
  }),
  async (c) => {
    const { url } = c.req.valid("query");
    const target = new URL(url);

    if (target.protocol !== "https:" && target.protocol !== "http:") {
      return c.json(
        {
          ok: false,
          status: null,
          method: null,
          error: "Only HTTP(S) URLs are supported.",
        },
        400,
      );
    }

    const probe = async (method: "HEAD" | "GET") => {
      const response = await fetch(target, {
        method,
        redirect: "manual",
      });
      await response.body?.cancel().catch(() => undefined);
      return response;
    };

    try {
      const headResponse = await probe("HEAD");

      if (headResponse.ok) {
        return c.json({
          ok: true,
          status: headResponse.status,
          method: "HEAD",
        });
      }

      if (headResponse.status === 405) {
        const getResponse = await probe("GET");
        if (getResponse.ok) {
          return c.json({
            ok: true,
            status: getResponse.status,
            method: "GET",
          });
        }

        return c.json({
          ok: false,
          status: getResponse.status,
          method: "GET",
          error: `Request failed with status ${getResponse.status}.`,
        });
      }

      return c.json({
        ok: false,
        status: headResponse.status,
        method: "HEAD",
        error: `Request failed with status ${headResponse.status}.`,
      });
    } catch (error) {
      return c.json({
        ok: false,
        status: null,
        method: null,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error during preflight.",
      });
    }
  },
);

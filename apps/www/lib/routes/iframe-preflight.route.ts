import { getAccessTokenFromRequest } from "@/lib/utils/auth";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

const ALLOWED_HOST_SUFFIXES = [
  ".cmux.sh",
  ".cmux.dev",
  ".cmux.local",
  ".cmux.localhost",
  ".cmux.app",
  ".autobuild.app",
  ".http.cloud.morph.so",
  ".vm.freestyle.sh",
] as const;

const ALLOWED_EXACT_HOSTS = new Set<string>([
  "cmux.sh",
  "www.cmux.sh",
  "cmux.dev",
  "www.cmux.dev",
  "cmux.local",
  "cmux.localhost",
  "cmux.app",
]);

const DEV_ONLY_HOSTS = new Set<string>(["localhost", "127.0.0.1", "::1"]);

function isAllowedHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();

  if (ALLOWED_EXACT_HOSTS.has(normalized)) {
    return true;
  }

  if (ALLOWED_HOST_SUFFIXES.some((suffix) => normalized.endsWith(suffix))) {
    return true;
  }

  const isDevelopment = process.env.NODE_ENV !== "production";

  if (isDevelopment && DEV_ONLY_HOSTS.has(normalized)) {
    return true;
  }

  return false;
}

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
      403: {
        description: "The target host is not permitted for probing.",
      },
      401: {
        description: "Request is missing valid authentication.",
      },
    },
  }),
  async (c) => {
    const accessToken = await getAccessTokenFromRequest(c.req.raw);
    if (!accessToken) {
      return c.json(
        {
          ok: false,
          status: null,
          method: null,
          error: "Unauthorized",
        },
        401,
      );
    }

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

    if (target.username || target.password) {
      return c.json(
        {
          ok: false,
          status: null,
          method: null,
          error: "Authentication credentials in URL are not supported.",
        },
        400,
      );
    }

    if (!isAllowedHost(target.hostname)) {
      return c.json(
        {
          ok: false,
          status: null,
          method: null,
          error: `Requests to ${target.hostname} are not permitted.`,
        },
        403,
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

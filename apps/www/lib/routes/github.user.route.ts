import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { fetchGithubUserInfoForRequest } from "@/lib/utils/githubUserInfo";

export const githubUserRouter = new OpenAPIHono();

const GithubUserInfo = z
  .object({
    id: z.number().openapi({ description: "GitHub numeric user id" }),
    login: z.string().openapi({ description: "GitHub login" }),
    derivedNoreply: z
      .string()
      .openapi({ description: "<id>+<login>@users.noreply.github.com" }),
    emails: z.array(z.string()).openapi({ description: "Known emails" }),
    primaryEmail: z.string().nullable().openapi({ description: "Primary email, if available" }),
    canReadEmails: z
      .boolean()
      .openapi({ description: "Whether user:email scope allowed /user/emails" }),
  })
  .openapi("GithubUserInfo");

githubUserRouter.openapi(
  createRoute({
    method: "get" as const,
    path: "/integrations/github/user",
    tags: ["Integrations"],
    summary: "Get GitHub user id/login and (optionally) emails using user's OAuth token",
    responses: {
      200: {
        description: "OK",
        content: {
          "application/json": { schema: GithubUserInfo },
        },
      },
      401: { description: "Unauthorized" },
    },
  }),
  async (c) => {
    const info = await fetchGithubUserInfoForRequest(c.req.raw);
    if (!info) return c.text("Unauthorized", 401);

    return c.json(info);
  }
);

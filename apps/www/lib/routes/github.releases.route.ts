import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

const GITHUB_RELEASES_URL = "https://api.github.com/repos/manaflow-ai/cmux/releases/latest";

const GitHubAssetSchema = z.object({
  name: z.string(),
  browser_download_url: z.string().url(),
});

const GitHubReleaseSchema = z.object({
  tag_name: z.string(),
  html_url: z.string().url(),
  assets: z.array(GitHubAssetSchema),
  published_at: z.string().nullable(),
});

const LatestReleaseResponseSchema = z
  .object({
    latestVersion: z.string().nullable(),
    tagName: z.string().nullable(),
    releaseUrl: z.string().url(),
    macDownloadUrl: z.string().url().nullable(),
    publishedAt: z.string().nullable(),
  })
  .openapi("GithubLatestReleaseResponse");

export const githubReleasesRouter = new OpenAPIHono();

githubReleasesRouter.openapi(
  createRoute({
    method: "get",
    path: "/integrations/github/releases/latest",
    tags: ["Integrations"],
    summary: "Fetch the latest GitHub release for cmux",
    responses: {
      200: {
        description: "OK",
        content: {
          "application/json": {
            schema: LatestReleaseResponseSchema,
          },
        },
      },
      502: {
        description: "Failed to reach GitHub",
      },
    },
  }),
  async (c) => {
    try {
      const headers = new Headers({
        Accept: "application/vnd.github+json",
        "User-Agent": "cmux-www",
      });

      const response = await fetch(GITHUB_RELEASES_URL, {
        headers,
      });

      if (!response.ok) {
        console.error(
          `GitHub latest release request failed: ${response.status} ${response.statusText}`
        );
        return c.json(
          {
            latestVersion: null,
            tagName: null,
            releaseUrl: "https://github.com/manaflow-ai/cmux/releases/latest",
            macDownloadUrl: null,
            publishedAt: null,
          },
          502
        );
      }

      const rawRelease = await response.json();
      const parsedRelease = GitHubReleaseSchema.safeParse(rawRelease);

      if (!parsedRelease.success) {
        console.error("GitHub release payload parsing error", parsedRelease.error);
        return c.json(
          {
            latestVersion: null,
            tagName: null,
            releaseUrl: "https://github.com/manaflow-ai/cmux/releases/latest",
            macDownloadUrl: null,
            publishedAt: null,
          },
          502
        );
      }

      const { tag_name: tagName, html_url: releaseUrl, assets, published_at: publishedAt } =
        parsedRelease.data;

      const macAsset = assets.find((asset) =>
        /\.(dmg|pkg)$/i.test(asset.name) && /arm64|mac|osx/i.test(asset.name)
      );

      const latestVersion = tagName?.startsWith("v") ? tagName.slice(1) : tagName;

      return c.json({
        latestVersion,
        tagName,
        releaseUrl,
        macDownloadUrl: macAsset?.browser_download_url ?? null,
        publishedAt,
      });
    } catch (error) {
      console.error("Unexpected error fetching GitHub latest release", error);
      return c.json(
        {
          latestVersion: null,
          tagName: null,
          releaseUrl: "https://github.com/manaflow-ai/cmux/releases/latest",
          macDownloadUrl: null,
          publishedAt: null,
        },
        502
      );
    }
  }
);

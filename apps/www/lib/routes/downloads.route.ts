import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

type GitHubReleaseAsset = {
  name: string;
  browser_download_url: string;
  content_type: string | null;
  state: string;
};

type GitHubLatestReleaseResponse = {
  tag_name: string;
  assets: GitHubReleaseAsset[];
};

export const downloadsRouter = new OpenAPIHono();

const pickMacArm64Asset = (assets: GitHubReleaseAsset[]): GitHubReleaseAsset | null => {
  const isUploaded = (a: GitHubReleaseAsset) => a.state === "uploaded";
  const isArm64 = (a: GitHubReleaseAsset) => /arm64|aarch64/i.test(a.name);
  const isDmg = (a: GitHubReleaseAsset) => a.content_type === "application/x-apple-diskimage" || /\.dmg$/i.test(a.name);
  const looksMacZip = (a: GitHubReleaseAsset) => /mac|darwin/i.test(a.name) && /\.zip$/i.test(a.name);

  const candidates = assets.filter((a) => isUploaded(a) && isArm64(a) && (isDmg(a) || looksMacZip(a)));
  if (candidates.length === 0) return null;

  // Prefer DMG when available
  const dmg = candidates.find(isDmg);
  return dmg ?? candidates[0];
};

downloadsRouter.openapi(
  createRoute({
    method: "get" as const,
    path: "/downloads/mac",
    tags: ["Downloads"],
    summary: "Redirect to latest macOS arm64 asset",
    responses: {
      302: {
        description: "Redirects to the latest macOS arm64 download asset",
      },
      502: {
        content: {
          "application/json": {
            schema: z.object({
              code: z.literal(502),
              message: z.string(),
            }),
          },
        },
        description: "Bad gateway when contacting GitHub API",
      },
      404: {
        content: {
          "application/json": {
            schema: z.object({
              code: z.literal(404),
              message: z.string(),
            }),
          },
        },
        description: "No matching macOS arm64 asset found",
      },
    },
  }),
  async (c) => {
    const res = await fetch("https://api.github.com/repos/manaflow-ai/cmux/releases/latest", {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "cmux-www",
      },
      // Node 24 global fetch supports this; keep simple GET
    });

    if (!res.ok) {
      return c.json({ code: 502 as const, message: `GitHub API error: ${res.status}` }, 502);
    }

    const json = (await res.json()) as GitHubLatestReleaseResponse;
    const asset = pickMacArm64Asset(json.assets ?? []);

    if (!asset) {
      return c.json({ code: 404 as const, message: "No macOS arm64 asset found in latest release" }, 404);
    }

    return c.redirect(asset.browser_download_url, 302);
  }
);


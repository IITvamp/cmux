export type Platform = "darwin-arm64" | "darwin-x64";

export type ReleaseAsset = {
  readonly name: string;
  readonly url: string;
};

export type Release = {
  readonly version: string;
  readonly publishedAt: string;
  readonly platforms: Partial<Record<Platform, ReleaseAsset>>;
};

type GitHubReleaseAsset = {
  readonly name?: string;
  readonly browser_download_url?: string;
};

type GitHubReleaseResponse = {
  readonly tag_name?: string;
  readonly published_at?: string;
  readonly assets?: readonly GitHubReleaseAsset[];
};

function assetToPlatform(name: string): Platform | undefined {
  const lower = name.toLowerCase();

  if (lower.includes("arm64") || lower.includes("aarch64")) {
    return "darwin-arm64";
  }

  if (lower.includes("x64") || lower.includes("amd64")) {
    return "darwin-x64";
  }

  return undefined;
}

export async function getLatestRelease(): Promise<Release | null> {
  try {
    const response = await fetch(
      "https://api.github.com/repos/manaflow-ai/cmux/releases/latest",
      {
        headers: {
          Accept: "application/vnd.github+json",
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return null;
    }

    const json = (await response.json()) as GitHubReleaseResponse;
    const assets = json.assets ?? [];

    const platforms: Partial<Record<Platform, ReleaseAsset>> = {};

    for (const asset of assets) {
      if (!asset.name || !asset.browser_download_url) {
        continue;
      }

      const platform = assetToPlatform(asset.name);

      if (!platform) {
        continue;
      }

      platforms[platform] = {
        name: asset.name,
        url: asset.browser_download_url,
      };
    }

    if (!json.tag_name || !json.published_at) {
      return null;
    }

    return {
      version: json.tag_name,
      publishedAt: json.published_at,
      platforms,
    };
  } catch {
    return null;
  }
}

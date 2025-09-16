export type Platform = "darwin-arm64" | "darwin-x64";

export interface PlatformRelease {
  url: string;
}

export interface Release {
  version: string;
  platforms: Partial<Record<Platform, PlatformRelease>>;
}

export const latestRelease: Release = {
  version: "v1.0.5",
  platforms: {
    "darwin-arm64": {
      url: "https://github.com/manaflow-ai/cmux/releases/download/v1.0.5/Cmux-1.0.5.dmg",
    },
    "darwin-x64": {
      url: "https://github.com/manaflow-ai/cmux/releases/download/v1.0.5/Cmux-1.0.5.dmg",
    },
  },
};

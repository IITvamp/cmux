import { randomBytes } from "node:crypto";

export type EnvironmentBootstrapMarkers = {
  envMarker?: string;
  bashrcMarker?: string;
  tempFilePath?: string;
};

const DEFAULT_BOOTSTRAP_SNIPPET = [
  "# cmux environment bootstrap",
  "set -a",
  ". /root/.cmux-env",
  "set +a",
].join("\n");

function randomMarker(prefix: string): string {
  return `${prefix}_${randomBytes(4).toString("hex")}`;
}

function resolveMarkers(
  overrides?: EnvironmentBootstrapMarkers
): Required<EnvironmentBootstrapMarkers> {
  return {
    envMarker: overrides?.envMarker ?? randomMarker("CMUX_ENV"),
    bashrcMarker:
      overrides?.bashrcMarker ?? randomMarker("CMUX_ENV_BOOTSTRAP"),
    tempFilePath:
      overrides?.tempFilePath ?? `/tmp/cmux_env_${randomBytes(6).toString("hex")}`,
  };
}

/**
 * Build a bash command that loads the provided `.env` content inside the
 * sandbox. When `envctl` is available it uses `envctl load`, otherwise it falls
 * back to sourcing `/root/.cmux-env` on shell startup.
 */
export function buildEnvironmentBootstrapCommand(
  envContent: string,
  overrides?: EnvironmentBootstrapMarkers
): string {
  const markers = resolveMarkers(overrides);

  const scriptLines = [
    "set -euo pipefail",
    `cat <<'${markers.envMarker}' > ${markers.tempFilePath}`,
    envContent,
    markers.envMarker,
    `chmod 600 ${markers.tempFilePath}`,
    "if command -v envctl >/dev/null 2>&1; then",
    `  envctl load ${markers.tempFilePath} && rm -f ${markers.tempFilePath}`,
    "else",
    `  mv ${markers.tempFilePath} /root/.cmux-env`,
    "  chmod 600 /root/.cmux-env",
    "  if ! grep -q 'cmux environment bootstrap' /root/.bashrc 2>/dev/null; then",
    `    cat <<'${markers.bashrcMarker}' >> /root/.bashrc`,
    DEFAULT_BOOTSTRAP_SNIPPET,
    markers.bashrcMarker,
    "  fi",
    "fi",
  ];

  const script = scriptLines.join("\n");
  return `bash -lc ${JSON.stringify(script)}`;
}

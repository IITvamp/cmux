import { describe, expect, it } from "vitest";

import { buildEnvironmentBootstrapCommand } from "./env-bootstrap";

describe("buildEnvironmentBootstrapCommand", () => {
  it("embeds env content without modification", () => {
    const envContent = "FOO=bar\nSPECIAL=spaced value\n";
    const cmd = buildEnvironmentBootstrapCommand(envContent, {
      envMarker: "ENV_MARK",
      bashrcMarker: "BOOT_MARK",
      tempFilePath: "/tmp/test-env",
    });

    expect(cmd).toContain("tmpfile=/tmp/test-env");
    expect(cmd).toContain("envctl_bin=$(command -v envctl 2>/dev/null || true)");
    expect(cmd).toContain("cat <<'ENV_MARK' > \"$tmpfile\"");
    expect(cmd).toContain(envContent);
    expect(cmd).toContain("\"$envctl_bin\" load \"$tmpfile\"");
  });

  it("adds fallback bootstrap snippet", () => {
    const cmd = buildEnvironmentBootstrapCommand("KEY=value", {
      envMarker: "ENV_M",
      bashrcMarker: "BOOT_M",
      tempFilePath: "/tmp/fallback.env",
    });

    expect(cmd).toContain(
      "if ! grep -q 'cmux environment bootstrap' /root/.bashrc"
    );
    expect(cmd).toContain("cat <<'BOOT_M' >> /root/.bashrc");
  });
});

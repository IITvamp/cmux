import { __TEST_INTERNAL_ONLY_GET_STACK_TOKENS } from "@/lib/test-utils/__TEST_INTERNAL_ONLY_GET_STACK_TOKENS";
import { __TEST_INTERNAL_ONLY_MORPH_CLIENT } from "@/lib/test-utils/__TEST_INTERNAL_ONLY_MORPH_CLIENT";
import { testApiClient } from "@/lib/test-utils/openapi-client";
import { postApiSandboxesStart } from "@cmux/www-openapi-client";
import { buildAutoCommitPushCommand } from "../../server/src/utils/autoCommitPushCommand";

const TEAM_SLUG = process.env.DEBUG_TEAM_SLUG ?? "manaflow";
const ENVIRONMENT_ID =
  process.env.DEBUG_ENVIRONMENT_ID ?? "mn71ep1paqg13wdxr1zfxv3pws7r3r4t";
const TTL_SECONDS = Number(process.env.DEBUG_SANDBOX_TTL_SECONDS ?? "300");

async function main() {
  const tokens = await __TEST_INTERNAL_ONLY_GET_STACK_TOKENS();

  const startRes = await postApiSandboxesStart({
    client: testApiClient,
    headers: { "x-stack-auth": JSON.stringify(tokens) },
    body: {
      teamSlugOrId: TEAM_SLUG,
      environmentId: ENVIRONMENT_ID,
      ttlSeconds: TTL_SECONDS,
    },
  });

  if (startRes.response.status !== 200 || !startRes.data) {
    console.error(
      "Failed to start sandbox",
      startRes.response.status,
      startRes.error
    );
    process.exit(1);
  }

  const instanceId = startRes.data.instanceId;
  console.log("Sandbox started", {
    instanceId,
    workerUrl: startRes.data.workerUrl,
  });

  const instance = await __TEST_INTERNAL_ONLY_MORPH_CLIENT.instances.get({
    instanceId,
  });

  const run = async (command: string | string[]) => {
    const printable = typeof command === "string" ? command : command.join(" ");
    console.log(`\n$ ${printable}`);
    const result = await instance.exec(command, { timeout: 120_000 });
    console.log(`[exit=${result.exit_code}] stdout:\n${result.stdout}`);
    if (result.stderr) {
      console.log(`stderr:\n${result.stderr}`);
    }
    return result;
  };

  try {
    const diagnostics = [
      "ls -ld /root/workspace",
      "readlink -f /root/workspace || true",
      "cd /root/workspace && pwd",
      "cd /root/workspace && ls -a",
      "cd /root/workspace && find . -maxdepth 3 -name .git -print",
      'cd /root/workspace && for repo in workspace/*; do if [ -f "$repo/.git" ]; then echo "=== $repo/.git ==="; cat "$repo/.git"; fi; done',
      'cd /root/workspace && for repo in workspace/*; do if [ -d "$repo/.git" ]; then echo "=== $repo ==="; ls -a "$repo/.git"; fi; done',
      "cd /root/workspace && git -C workspace/cmux rev-parse --is-inside-work-tree",
      "cd /root/workspace && git -C workspace/cmux-env rev-parse --is-inside-work-tree",
      "env | grep ^GIT || true",
      "cd /root/workspace && (cd workspace/cmux && pwd)",
      "cd /root/workspace && (cd workspace/cmux-env && pwd)",
      `cd /root/workspace && for repo in workspace/cmux workspace/cmux-env; do echo "[debug repo] $repo"; if cd "$repo"; then pwd; ls -a; cd - >/dev/null; else echo "cd failed"; fi; done`,
      "cd /root/workspace && git -C workspace/cmux config --get core.worktree || true",
      "cd /root/workspace && git -C workspace/cmux-env config --get core.worktree || true",
      "cd /root/workspace && git -C workspace/cmux status --short || true",
      "cd /root/workspace && git -C workspace/cmux-env status --short || true",
    ];

    for (const command of diagnostics) {
      await run(["bash", "-lc", command]);
    }

    const autoCommitScript = buildAutoCommitPushCommand();

    // Write the bun script to a temp file and execute it
    await run([
      "bash",
      "-c",
      "cd /root/workspace && cat > /tmp/auto-commit.ts << 'EOF'\n" +
        autoCommitScript +
        "\nEOF",
    ]);
    await run(["bash", "-lc", "cd /root/workspace && bun /tmp/auto-commit.ts"]);
  } finally {
    try {
      await instance.stop();
      console.log("Sandbox stopped", instanceId);
    } catch (error) {
      console.warn("Failed to stop sandbox", error);
    }
  }
}

void main();

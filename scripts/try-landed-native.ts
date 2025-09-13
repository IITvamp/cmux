import { landedDiffForRepo } from "../apps/server/src/native/git.js";

async function main() {
  const originPathOverride = "/Users/lawrencechen/cmux/cmux/origin";
  const baseRef = "origin/main";
  const headRef = "cmux/reduce-get-by-task-db-bandwidth-help-7wpfe";
  const diffs = await landedDiffForRepo({
    baseRef,
    headRef,
    originPathOverride,
    includeContents: true,
  });
  console.log("count:", diffs.length);
  for (const d of diffs) console.log(d.filePath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

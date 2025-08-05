import { ConvexHttpClient } from "convex/browser";

async function debugTaskRun() {
  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "https://feeble-chipmunk-966.convex.cloud");
  
  // Get the latest task
  const tasks = await client.query(async ({ db }) => {
    return await db.query("tasks").order("desc").take(10);
  });
  
  if (tasks.length === 0) {
    console.log("No tasks found");
    return;
  }
  
  const latestTask = tasks[0];
  console.log(`Latest task: ${latestTask.text} (${latestTask._id})`);
  
  // Get task runs for this task
  const taskRuns = await client.query(async ({ db }, { taskId }) => {
    return await db
      .query("taskRuns")
      .withIndex("by_task", (q) => q.eq("taskId", taskId))
      .collect();
  }, { taskId: latestTask._id });
  
  console.log(`Found ${taskRuns.length} task runs`);
  
  // Check each run's log
  for (const run of taskRuns) {
    console.log(`\n=== Run ${run._id} (${run.status}) ===`);
    console.log(`Agent: ${run.prompt}`);
    console.log(`Log length: ${run.log.length} chars`);
    
    // Look for git diff patterns
    if (run.log.includes("diff --git")) {
      console.log("✓ Contains 'diff --git'");
    }
    if (run.log.includes("new file mode")) {
      console.log("✓ Contains 'new file mode'");
    }
    if (run.log.includes("create mode")) {
      console.log("✓ Contains 'create mode'");
    }
    if (run.log.includes("insertions(+)")) {
      console.log("✓ Contains 'insertions(+)'");
    }
    if (run.log.includes("file changed")) {
      console.log("✓ Contains 'file changed'");
    }
    if (run.log.includes("=== GIT DIFF ===")) {
      console.log("✓ Contains '=== GIT DIFF ==='");
    }
    
    // Show last 500 chars of log
    console.log("\nLast 500 chars of log:");
    console.log(run.log.slice(-500));
  }
}

debugTaskRun().catch(console.error);
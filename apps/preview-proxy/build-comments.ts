#!/usr/bin/env bun
import { existsSync } from "fs";
import { rm } from "fs/promises";
import path from "path";

console.log("\n🚀 Building cmux-comments widget...\n");

const outdir = path.join(process.cwd(), "dist-comments");

if (existsSync(outdir)) {
  console.log(`🗑️ Cleaning previous build at ${outdir}`);
  await rm(outdir, { recursive: true, force: true });
}

const start = performance.now();

const result = await Bun.build({
  entrypoints: ["./src/cmux-comments/cmux-comments.tsx"],
  outdir,
  minify: true,
  target: "browser",
  sourcemap: "linked",
  format: "iife",
  naming: {
    entry: "cmux-comments.js",
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    "process.env.NEXT_PUBLIC_CONVEX_URL": JSON.stringify(""),
    "process.env.VITE_CONVEX_URL": JSON.stringify(""),
  },
  external: [],
});

const end = performance.now();

if (result.success) {
  console.log("✅ Build successful!");
  console.log(`📦 Output: ${outdir}/cmux-comments.js`);
  console.log(`⏱️ Build time: ${(end - start).toFixed(2)}ms`);
  
  // Create an example HTML file showing how to use the widget
  const exampleHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cmux Comments Example</title>
</head>
<body>
  <h1>Cmux Comments Widget Example</h1>
  <p>This page demonstrates the cmux-comments widget.</p>
  
  <div style="padding: 20px; background: #f5f5f5; margin: 20px 0;">
    <h2>Installation</h2>
    <p>Add this script tag at the end of your HTML body:</p>
    <pre style="background: #333; color: #fff; padding: 10px; border-radius: 4px; overflow-x: auto;">
&lt;script 
  src="cmux-comments.js" 
  data-auto-init="true" 
  data-convex-url="YOUR_CONVEX_URL"&gt;
&lt;/script&gt;</pre>
  </div>
  
  <div style="padding: 20px; background: #f5f5f5; margin: 20px 0;">
    <h2>Usage</h2>
    <ul>
      <li>Press "C" to add a comment</li>
      <li>Click the floating button to open the comments widget</li>
      <li>The widget can be dragged around the screen</li>
    </ul>
  </div>
  
  <!-- Example usage with auto-init -->
  <script 
    src="cmux-comments.js" 
    data-auto-init="true" 
    data-convex-url="https://your-convex-deployment.convex.cloud">
  </script>
  
  <!-- Or manual initialization:
  <script src="cmux-comments.js"></script>
  <script>
    window.CmuxComments.init('https://your-convex-deployment.convex.cloud');
  </script>
  -->
</body>
</html>`;
  
  await Bun.write(path.join(outdir, "example.html"), exampleHtml);
  console.log(`📄 Example file: ${outdir}/example.html`);
  
} else {
  console.error("❌ Build failed!");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}
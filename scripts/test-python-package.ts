#!/usr/bin/env tsx

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

function test() {
  console.log("🧪 Testing Python package...\n");

  // Check if python package directory exists
  const pythonPackageDir = path.join(projectRoot, "python-package");
  if (!fs.existsSync(pythonPackageDir)) {
    console.error("❌ Python package directory not found!");
    process.exit(1);
  }

  // Install the package in development mode
  console.log("📦 Installing package in development mode...");
  try {
    execSync("pip install -e .", { cwd: projectRoot, stdio: "inherit" });
    console.log("✓ Package installed successfully");
  } catch (error) {
    console.error("❌ Failed to install package:", error);
    process.exit(1);
  }

  // Test the CLI
  console.log("\n🔧 Testing CLI...");
  try {
    const result = execSync("cmux --help", { 
      cwd: projectRoot, 
      encoding: "utf8",
      timeout: 10000 
    });
    console.log("✓ CLI help command works");
    console.log("Output preview:", result.split('\n').slice(0, 3).join('\n'));
  } catch (error) {
    console.error("❌ CLI test failed:", error);
    process.exit(1);
  }

  // Test version
  console.log("\n📋 Testing version...");
  try {
    const result = execSync("cmux --version", { 
      cwd: projectRoot, 
      encoding: "utf8",
      timeout: 10000 
    });
    console.log("✓ CLI version command works");
    console.log("Version output:", result.trim());
  } catch (error) {
    console.error("❌ Version test failed:", error);
    process.exit(1);
  }

  console.log("\n✅ All tests passed!");
  console.log("The Python package is ready for publishing.");
}

// Run the test
test();
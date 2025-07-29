#!/usr/bin/env tsx

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const pythonPackageDir = path.join(projectRoot, "python-package");

function publish() {
  console.log("🐍 Publishing cmux to PyPI...\n");

  // Check if python package directory exists
  if (!fs.existsSync(pythonPackageDir)) {
    console.error("❌ Python package directory not found!");
    console.error("Please ensure the python-package directory exists");
    process.exit(1);
  }

  // Get version from package.json to sync with Python package
  const packageJsonPath = path.join(projectRoot, "packages", "cmux", "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  const version = packageJson.version;

  console.log(`📦 Publishing version ${version} to PyPI`);

  // Update Python package version
  const initPyPath = path.join(pythonPackageDir, "cmux", "__init__.py");
  const cliPyPath = path.join(pythonPackageDir, "cmux", "cli.py");
  
  // Update __init__.py version
  let initContent = fs.readFileSync(initPyPath, "utf-8");
  initContent = initContent.replace(
    /__version__ = ".*?"/,
    `__version__ = "${version}"`
  );
  fs.writeFileSync(initPyPath, initContent);

  // Update cli.py version
  let cliContent = fs.readFileSync(cliPyPath, "utf-8");
  cliContent = cliContent.replace(
    /VERSION = ".*?"/,
    `VERSION = "${version}"`
  );
  fs.writeFileSync(cliPyPath, cliContent);

  console.log("✓ Updated Python package version");

  // Build the package
  console.log("\n🔨 Building Python package...");
  try {
    execSync("python -m build", { cwd: projectRoot, stdio: "inherit" });
    console.log("✓ Package built successfully");
  } catch (error) {
    console.error("❌ Failed to build package:", error);
    process.exit(1);
  }

  // Check if twine is installed
  try {
    execSync("twine --version", { stdio: "ignore" });
  } catch (error) {
    console.log("📦 Installing twine...");
    execSync("pip install twine build", { stdio: "inherit" });
  }

  // Upload to PyPI
  console.log("\n📤 Uploading to PyPI...");
  try {
    execSync("twine upload dist/*", { cwd: projectRoot, stdio: "inherit" });
    console.log("\n✅ Successfully published to PyPI!");
  } catch (error) {
    console.error("\n❌ Failed to publish to PyPI:", error);
    process.exit(1);
  }

  // Clean up build artifacts
  console.log("\n🧹 Cleaning up build artifacts...");
  if (fs.existsSync(path.join(projectRoot, "dist"))) {
    fs.rmSync(path.join(projectRoot, "dist"), { recursive: true, force: true });
  }
  if (fs.existsSync(path.join(projectRoot, "build"))) {
    fs.rmSync(path.join(projectRoot, "build"), { recursive: true, force: true });
  }
  if (fs.existsSync(path.join(projectRoot, "cmux.egg-info"))) {
    fs.rmSync(path.join(projectRoot, "cmux.egg-info"), { recursive: true, force: true });
  }
  console.log("✓ Build artifacts cleaned up");

  console.log("\n🎉 Python package published successfully!");
  console.log("Users can now install with: uvx cmux");
}

// Run the publish script
publish();
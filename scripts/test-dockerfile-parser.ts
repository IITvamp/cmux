#!/usr/bin/env bun
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DockerfileParser } from "./dockerfile-parser.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testParser() {
  console.log("Testing Dockerfile parser...\n");

  const projectRoot = path.join(__dirname, "..");
  const dockerfilePath = path.join(projectRoot, "Dockerfile");

  const parser = new DockerfileParser(dockerfilePath, projectRoot);
  const parsedDockerfile = await parser.parse(dockerfilePath);

  console.log(`Parsed ${parsedDockerfile.instructions.length} instructions\n`);

  // Display a summary of instructions
  const instructionCounts = new Map<string, number>();
  for (const instruction of parsedDockerfile.instructions) {
    const count = instructionCounts.get(instruction.type) || 0;
    instructionCounts.set(instruction.type, count + 1);
  }

  console.log("Instruction Summary:");
  for (const [type, count] of instructionCounts) {
    console.log(`  ${type}: ${count}`);
  }

  console.log("\nStages found:");
  for (const [name, index] of parsedDockerfile.stages) {
    console.log(`  - ${name} (at instruction ${index})`);
  }

  console.log("\nBuild Args:");
  for (const [name, value] of Object.entries(parsedDockerfile.buildArgs)) {
    console.log(`  ${name} = ${value || "(no default)"}`);
  }

  // Show first few instructions for verification
  console.log("\nFirst 10 instructions:");
  for (let i = 0; i < Math.min(10, parsedDockerfile.instructions.length); i++) {
    const inst = parsedDockerfile.instructions[i];
    const preview = inst.value.substring(0, 60).replace(/\n/g, " ");
    console.log(`  ${i + 1}. ${inst.type}: ${preview}${inst.value.length > 60 ? "..." : ""}`);
    if (inst.options?.length) {
      console.log(`     Options: ${inst.options.join(", ")}`);
    }
  }

  // Test COPY with --parents parsing
  console.log("\nCOPY instructions with options:");
  for (const inst of parsedDockerfile.instructions) {
    if (inst.type === "COPY" && inst.options?.length) {
      console.log(`  COPY ${inst.options.join(" ")} ${inst.value}`);
    }
  }

  console.log("\n✅ Parser test completed successfully!");
}

testParser().catch(console.error);
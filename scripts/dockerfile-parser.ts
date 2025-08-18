import { execSync } from "child_process";
import fs from "fs/promises";
import type { Instance } from "morphcloud";
import os from "os";
import path from "path";

export interface DockerfileInstruction {
  type: string;
  value: string;
  args?: Record<string, string | boolean>;
  options?: string[];
}

export interface ParsedDockerfile {
  instructions: DockerfileInstruction[];
  buildArgs: Record<string, string>;
  currentStage?: string;
  stages: Map<string, number>;
}

export class DockerfileParser {
  private content: string;
  private lines: string[];
  private buildArgs: Record<string, string> = {};
  private stages: Map<string, number> = new Map();
  private currentStage?: string;
  private instructions: DockerfileInstruction[] = [];
  private isInHeredoc: boolean = false;
  private heredocDelimiter: string = "";
  private heredocContent: string = "";

  constructor(
    _dockerfilePath: string,
    private projectRoot: string
  ) {
    this.content = "";
    this.lines = [];
  }

  async parse(dockerfilePath: string): Promise<ParsedDockerfile> {
    this.content = await fs.readFile(dockerfilePath, "utf-8");
    this.lines = this.content.split("\n");

    let currentInstruction = "";
    let isMultiline = false;

    for (let i = 0; i < this.lines.length; i++) {
      let line = this.lines[i];

      // Handle heredoc content
      if (this.isInHeredoc) {
        if (line.trim() === this.heredocDelimiter) {
          // End of heredoc
          this.instructions.push({
            type: "RUN",
            value: this.heredocContent.trim(),
            args: { heredoc: true },
          });
          this.isInHeredoc = false;
          this.heredocDelimiter = "";
          this.heredocContent = "";
          continue;
        } else {
          this.heredocContent += line + "\n";
          continue;
        }
      }

      // Check for heredoc start
      if (line.includes("<<")) {
        const heredocMatch = line.match(/^(RUN)\s+<<(-?)['"]?(\w+)['"]?$/);
        if (heredocMatch) {
          this.isInHeredoc = true;
          this.heredocDelimiter = heredocMatch[3];
          this.heredocContent = "";
          continue;
        }
      }

      // Handle line continuations
      if (line.endsWith("\\") && !line.endsWith("\\\\")) {
        currentInstruction += line.slice(0, -1) + " ";
        isMultiline = true;
        continue;
      }

      if (isMultiline) {
        currentInstruction += line;
        line = currentInstruction;
        currentInstruction = "";
        isMultiline = false;
      }

      // Skip empty lines and comments
      line = line.trim();
      if (!line || line.startsWith("#")) {
        // Check for syntax directive
        if (line.startsWith("# syntax=")) {
          this.instructions.push({
            type: "SYNTAX",
            value: line.replace("# syntax=", "").trim(),
          });
        }
        continue;
      }

      this.parseInstruction(line);
    }

    return {
      instructions: this.instructions,
      buildArgs: this.buildArgs,
      currentStage: this.currentStage,
      stages: this.stages,
    };
  }

  private parseInstruction(line: string): void {
    const parts = line.split(/\s+/);
    const instruction = parts[0].toUpperCase();
    const value = parts.slice(1).join(" ");

    switch (instruction) {
      case "FROM":
        this.parseFrom(value);
        break;
      case "ARG":
        this.parseArg(value);
        break;
      case "ENV":
        this.parseEnv(value);
        break;
      case "RUN":
        this.instructions.push({ type: "RUN", value });
        break;
      case "COPY":
        this.parseCopy(value);
        break;
      case "ADD":
        this.instructions.push({ type: "ADD", value });
        break;
      case "WORKDIR":
        this.instructions.push({ type: "WORKDIR", value });
        break;
      case "EXPOSE":
        this.instructions.push({ type: "EXPOSE", value });
        break;
      case "VOLUME":
        this.instructions.push({ type: "VOLUME", value });
        break;
      case "CMD":
      case "ENTRYPOINT":
        this.instructions.push({ type: instruction, value });
        break;
      default:
        // Handle other instructions generically
        if (instruction && !instruction.startsWith("#")) {
          this.instructions.push({ type: instruction, value });
        }
    }
  }

  private parseFrom(value: string): void {
    const parts = value.split(/\s+AS\s+/i);
    const baseImage = parts[0];
    const stageName = parts[1];

    if (stageName) {
      this.currentStage = stageName;
      this.stages.set(stageName, this.instructions.length);
    }

    this.instructions.push({
      type: "FROM",
      value: baseImage,
      args: stageName ? { stage: stageName } : undefined,
    });
  }

  private parseArg(value: string): void {
    const [name, defaultValue] = value.split("=");
    this.buildArgs[name] = defaultValue || "";
    this.instructions.push({
      type: "ARG",
      value,
      args: { name, defaultValue },
    });
  }

  private parseEnv(value: string): void {
    const [name, envValue] = value.split("=");
    this.instructions.push({
      type: "ENV",
      value,
      args: { name, value: envValue },
    });
  }

  private parseCopy(value: string): void {
    const options: string[] = [];
    let cleanValue = value;

    // Parse COPY options like --from, --parents, --chown, etc.
    const optionRegex = /--(\w+)(?:=([^\s]+))?/g;
    let match;
    while ((match = optionRegex.exec(value)) !== null) {
      options.push(match[0]);
      cleanValue = cleanValue.replace(match[0], "").trim();
    }

    this.instructions.push({
      type: "COPY",
      value: cleanValue,
      options,
    });
  }
}

export interface DockerfileExecutionResult {
  exposedPorts: Array<{ port: number; name: string }>;
  entrypoint: string | null;
  cmd: string | null;
}

export class DockerfileExecutor {
  private stepNumber: number = 0;
  private totalSteps: number = 0;
  private startTime: number = 0;
  private stepStartTime: number = 0;
  private updateInterval: NodeJS.Timeout | null = null;
  private exposedPorts: Array<{ port: number; name: string }> = [];
  private entrypoint: string | null = null;
  private cmd: string | null = null;

  constructor(
    private instance: Instance,
    private projectRoot: string
  ) {}

  async execute(dockerfile: ParsedDockerfile): Promise<DockerfileExecutionResult> {
    console.log("Executing Dockerfile instructions on Morph instance...");

    // Track environment variables and working directory
    let currentWorkdir = "/";
    const envVars: Record<string, string> = {};

    // Count total steps (excluding metadata instructions)
    this.totalSteps = dockerfile.instructions.filter(
      (i) =>
        (!["SYNTAX", "ARG"].includes(i.type) && i.type !== "FROM") ||
        i.args?.stage
    ).length;
    this.startTime = Date.now();

    for (const instruction of dockerfile.instructions) {
      // Skip counting for certain instructions
      if (!["SYNTAX", "ARG"].includes(instruction.type)) {
        this.stepNumber++;
        this.stepStartTime = Date.now();

        // Start real-time timer update
        this.startTimerUpdate();

        // Print step header
        this.printStepHeader(instruction);
      }

      try {
        switch (instruction.type) {
          case "FROM":
            await this.executeFrom(instruction);
            break;
          case "RUN":
            await this.executeRun(instruction, envVars, currentWorkdir);
            break;
          case "COPY":
            await this.executeCopy(instruction, currentWorkdir);
            break;
          case "ADD":
            await this.executeAdd(instruction, currentWorkdir);
            break;
          case "WORKDIR":
            currentWorkdir = await this.executeWorkdir(
              instruction,
              currentWorkdir
            );
            break;
          case "ENV":
            this.executeEnv(instruction, envVars);
            break;
          case "ARG":
            if (instruction.args?.name) {
              const name = String(instruction.args.name);
              const defVal = instruction.args?.defaultValue
                ? String(instruction.args.defaultValue)
                : "";
              if (defVal) {
                envVars[name] = defVal;
                console.log(`  Setting build arg: ${name}=${defVal}`);
              } else {
                // Don't set empty values for ARGs without defaults
                // They should remain unset so conditional logic in RUN commands works
                console.log(
                  `  Declaring build arg: ${name} (no default, will remain unset)`
                );
              }
            }
            break;
          case "EXPOSE":
            await this.executeExpose(instruction);
            break;
          case "VOLUME":
            await this.executeVolume(instruction);
            break;
          case "ENTRYPOINT":
            this.entrypoint = instruction.value;
            console.log(`  Setting ENTRYPOINT: ${instruction.value}`);
            break;
          case "CMD":
            this.cmd = instruction.value;
            console.log(`  Setting CMD: ${instruction.value}`);
            break;
          case "SYNTAX":
            console.log(`  Using syntax: ${instruction.value}`);
            break;
          default:
            console.log(
              `  Skipping unsupported instruction: ${instruction.type}`
            );
        }

        // Stop timer update after successful execution
        this.stopTimerUpdate();

        // Print completion time for this step
        if (!["SYNTAX", "ARG"].includes(instruction.type)) {
          const stepTime = ((Date.now() - this.stepStartTime) / 1000).toFixed(
            1
          );
          console.log(`  ✓ Step completed in ${stepTime}s\n`);
        }
      } catch (error) {
        this.stopTimerUpdate();
        console.error(`\n  ✗ Error executing ${instruction.type}:`, error);
        throw error;
      }
    }

    // Print total build time
    const totalTime = ((Date.now() - this.startTime) / 1000).toFixed(1);
    console.log(`\n==> Build completed in ${totalTime}s`);

    // Return the results for the caller to handle
    return {
      exposedPorts: this.exposedPorts,
      entrypoint: this.entrypoint,
      cmd: this.cmd
    };
  }

  private printStepHeader(instruction: DockerfileInstruction): void {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    let displayValue = instruction.value;

    // Truncate long commands for header
    if (displayValue.length > 80) {
      displayValue = displayValue.substring(0, 77) + "...";
    }

    console.log(
      `\n[${this.stepNumber}/${this.totalSteps}] ${instruction.type} ${displayValue}`
    );
    console.log(`  ⏱  Elapsed: ${elapsed}s`);
  }

  private startTimerUpdate(): void {
    // Update timer every 100ms for real-time feel
    this.updateInterval = setInterval(() => {
      const stepElapsed = ((Date.now() - this.stepStartTime) / 1000).toFixed(1);
      process.stdout.write(`\r  ⏳ Running... ${stepElapsed}s`);
    }, 100);
  }

  private stopTimerUpdate(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      // Clear the running line
      process.stdout.write("\r" + " ".repeat(30) + "\r");
    }
  }

  private async executeFrom(instruction: DockerfileInstruction): Promise<void> {
    const baseImage = instruction.value;
    console.log(`  Setting up base image environment for: ${baseImage}`);

    // For Ubuntu-based images, ensure basic packages are installed
    if (baseImage.includes("ubuntu")) {
      await this.runSSHCommand("apt-get update", true, "  ");
    }
  }

  private async executeRun(
    instruction: DockerfileInstruction,
    envVars: Record<string, string>,
    workdir: string
  ): Promise<void> {
    let command = instruction.value;

    // Handle heredoc content
    if (instruction.args?.heredoc) {
      command = instruction.value;
    }

    // Replace ARG/ENV variables in the command
    // This handles ${VAR} syntax in the command
    for (const [key, value] of Object.entries(envVars)) {
      // Replace ${VAR} syntax - only if the variable has a value
      if (value) {
        command = command.replace(new RegExp(`\\$\\{${key}\\}`, "g"), value);
      }
      // Replace $VAR syntax - only if the variable has a value
      if (value) {
        command = command.replace(
          new RegExp(`\\$${key}(?![A-Za-z0-9_])`, "g"),
          value
        );
      }
    }

    // Prepare environment variables - only include variables with values
    const envString = Object.entries(envVars)
      .filter(([_, value]) => value) // Only export variables that have values
      .map(([key, value]) => `export ${key}="${value}"`)
      .join("; ");

    // Use bash -c to properly handle cd and other shell built-ins
    const fullCommand = `bash -c "cd ${workdir} && ${envString ? envString + " && " : ""}${command.replace(/"/g, '\\"')}"`;
    await this.runSSHCommand(fullCommand, true, "  ");
  }

  private async executeCopy(
    instruction: DockerfileInstruction,
    workdir: string
  ): Promise<void> {
    const parts = instruction.value.trim().split(/\s+/);
    const dest = parts[parts.length - 1];
    const sources = parts.slice(0, -1);

    // Check for --parents option
    const hasParents =
      instruction.options?.some((opt) => opt.startsWith("--parents")) ?? false;

    // Check for --from option (copy from another stage)
    const fromOption = instruction.options?.find((opt) =>
      opt.startsWith("--from=")
    );
    if (fromOption) {
      console.log(
        `  Note: --from option not yet supported, skipping stage copy`
      );
      return;
    }

    const absoluteDest = path.isAbsolute(dest)
      ? dest
      : path.join(workdir, dest);

    // Batch all files into a single tar archive for efficient transfer
    await this.batchCopyFiles(sources, absoluteDest, workdir, hasParents);
  }

  private async batchCopyFiles(
    sources: string[],
    remoteDest: string,
    _workdir: string,
    preserveParents: boolean
  ): Promise<void> {
    console.log(`  Copying ${sources.length} source(s) to ${remoteDest}`);

    // Collect all files to copy
    const filesToCopy: Array<{ localPath: string; relativePath: string }> = [];
    
    for (const source of sources) {
      const localPath = path.join(this.projectRoot, source);
      
      try {
        const stats = await fs.stat(localPath);
        
        if (stats.isDirectory()) {
          // For directories, we need to get all files recursively
          const files = await this.getDirectoryFiles(localPath, this.projectRoot);
          filesToCopy.push(...files);
        } else {
          filesToCopy.push({
            localPath,
            relativePath: path.relative(this.projectRoot, localPath)
          });
        }
      } catch (error) {
        // Handle glob patterns
        if (source.includes("*")) {
          const files = await this.expandGlobPattern(source);
          filesToCopy.push(...files);
        } else {
          console.error(`  Failed to process ${source}:`, error);
          throw error;
        }
      }
    }

    if (filesToCopy.length === 0) {
      console.log(`  No files to copy`);
      return;
    }

    // Create a single tar archive with all files
    const tarballName = `transfer-${Date.now()}.tar.gz`;
    // Use proper temp directory with mkdtemp
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "morph-transfer-"));
    const tarballPath = path.join(tempDir, tarballName);

    try {
      // Detect if we're on macOS to use --no-xattrs
      const isMacOS = process.platform === "darwin";
      const tarFlags = isMacOS ? "--no-xattrs -czf" : "-czf";

      // Create tar archive with all files
      const tarCommand = preserveParents
        ? `cd "${this.projectRoot}" && tar ${tarFlags} "${tarballPath}" ${filesToCopy.map(f => `"${f.relativePath}"`).join(" ")}`
        : await this.createNonParentsTar(filesToCopy, tarballPath, tarFlags);

      execSync(tarCommand, { stdio: "pipe" });

      // Upload the tar archive
      await this.instance.sync(tempDir, `${this.instance.id}:/tmp`);

      // Determine if destination is a file or directory
      // If copying a single file to a path without trailing slash, it's likely a file destination
      const isSingleFile = filesToCopy.length === 1 && !remoteDest.endsWith("/");
      
      if (isSingleFile) {
        // For single file, extract to parent directory and rename if needed
        const destDir = path.dirname(remoteDest);
        const destFileName = path.basename(remoteDest);
        const sourceFileName = path.basename(filesToCopy[0].localPath);
        
        await this.runSSHCommand(`mkdir -p ${destDir}`, true, "    ", false);
        await this.runSSHCommand(
          `cd ${destDir} && tar -xzf /tmp/${tarballName}`,
          true,
          "    ",
          false
        );
        
        // If the destination filename is different from source, rename it
        if (destFileName !== sourceFileName && !preserveParents) {
          await this.runSSHCommand(
            `cd ${destDir} && mv "${sourceFileName}" "${destFileName}"`,
            true,
            "    ",
            false
          );
        }
        
        await this.runSSHCommand(`rm /tmp/${tarballName}`, true, "    ", false);
      } else {
        // For directories or multiple files, extract into the destination directory
        await this.runSSHCommand(`mkdir -p ${remoteDest}`, true, "    ", false);
        await this.runSSHCommand(
          `cd ${remoteDest} && tar -xzf /tmp/${tarballName} && rm /tmp/${tarballName}`,
          true,
          "    ",
          false
        );
      }

      console.log(`    ✓ Uploaded ${filesToCopy.length} file(s)`);
    } finally {
      // Clean up temp directory
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  private async getDirectoryFiles(
    dirPath: string,
    baseDir: string
  ): Promise<Array<{ localPath: string; relativePath: string }>> {
    const files: Array<{ localPath: string; relativePath: string }> = [];
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    // Check for .dockerignore and .gitignore
    const dockerignorePath = path.join(baseDir, ".dockerignore");
    const gitignorePath = path.join(baseDir, ".gitignore");
    const ignorePatterns: string[] = [];
    
    try {
      const dockerignore = await fs.readFile(dockerignorePath, "utf-8");
      ignorePatterns.push(...dockerignore.split("\n").filter(line => line.trim() && !line.startsWith("#")));
    } catch (e) {
      // No .dockerignore
    }
    
    try {
      const gitignore = await fs.readFile(gitignorePath, "utf-8");
      ignorePatterns.push(...gitignore.split("\n").filter(line => line.trim() && !line.startsWith("#")));
    } catch (e) {
      // No .gitignore
    }

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(baseDir, fullPath);
      
      // Skip if matches ignore patterns
      if (this.shouldIgnore(relativePath, ignorePatterns)) {
        continue;
      }
      
      // Skip special files
      if (entry.isSocket() || entry.isFIFO() || entry.isCharacterDevice() || entry.isBlockDevice()) {
        console.log(`    Skipping special file: ${relativePath}`);
        continue;
      }
      
      if (entry.isDirectory()) {
        const subFiles = await this.getDirectoryFiles(fullPath, baseDir);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        files.push({
          localPath: fullPath,
          relativePath
        });
      } else if (entry.isSymbolicLink()) {
        // For symlinks, check if target exists and is a regular file
        try {
          const stats = await fs.stat(fullPath);
          if (stats.isFile()) {
            files.push({
              localPath: fullPath,
              relativePath
            });
          }
        } catch (e) {
          console.log(`    Skipping broken symlink: ${relativePath}`);
        }
      }
    }

    return files;
  }

  private shouldIgnore(filePath: string, patterns: string[]): boolean {
    // Common patterns to always ignore
    const alwaysIgnore = ["node_modules", ".git", ".DS_Store"];
    
    for (const ignore of alwaysIgnore) {
      if (filePath.includes(ignore)) {
        return true;
      }
    }
    
    for (const pattern of patterns) {
      // Simple pattern matching (not full gitignore spec)
      if (pattern.endsWith("/")) {
        // Directory pattern
        if (filePath.startsWith(pattern) || filePath.includes("/" + pattern)) {
          return true;
        }
      } else if (pattern.includes("*")) {
        // Glob pattern - simplified
        const regex = new RegExp(pattern.replace(/\*/g, ".*"));
        if (regex.test(filePath)) {
          return true;
        }
      } else {
        // Exact match or path contains
        if (filePath === pattern || filePath.startsWith(pattern + "/") || filePath.includes("/" + pattern)) {
          return true;
        }
      }
    }
    
    return false;
  }

  private async expandGlobPattern(
    pattern: string
  ): Promise<Array<{ localPath: string; relativePath: string }>> {
    const files = execSync(
      `cd "${this.projectRoot}" && ls -d ${pattern} 2>/dev/null || true`,
      { encoding: "utf-8" }
    )
      .trim()
      .split("\n")
      .filter((f) => f);

    return files.map(file => ({
      localPath: path.join(this.projectRoot, file),
      relativePath: file
    }));
  }

  private async createNonParentsTar(
    files: Array<{ localPath: string; relativePath: string }>,
    tarballPath: string,
    tarFlags: string
  ): Promise<string> {
    // For non-parents mode, we need to create a staging directory
    const stagingDir = await fs.mkdtemp(path.join(os.tmpdir(), "morph-staging-"));

    // Copy all files to staging with just their basenames
    for (const file of files) {
      const destPath = path.join(stagingDir, path.basename(file.localPath));
      try {
        // Check if it's a regular file before copying
        const stats = await fs.lstat(file.localPath);
        if (stats.isFile() || (stats.isSymbolicLink() && (await fs.stat(file.localPath)).isFile())) {
          await fs.copyFile(file.localPath, destPath);
        } else {
          console.log(`    Skipping non-file during staging: ${file.relativePath}`);
        }
      } catch (err: any) {
        if (err.code === 'ENOTSUP' || err.code === 'EISDIR') {
          console.log(`    Skipping special file: ${file.relativePath}`);
        } else {
          throw err;
        }
      }
    }

    // Clean up staging dir after tar creation
    const cleanupCommand = ` && rm -rf "${stagingDir}"`;
    return `cd "${stagingDir}" && tar ${tarFlags} "${tarballPath}" .${cleanupCommand}`;
  }



  private async executeAdd(
    instruction: DockerfileInstruction,
    workdir: string
  ): Promise<void> {
    // ADD is similar to COPY but can also handle URLs and tar extraction
    const parts = instruction.value.trim().split(/\s+/);
    const dest = parts[parts.length - 1];
    const source = parts[0];

    const absoluteDest = path.isAbsolute(dest)
      ? dest
      : path.join(workdir, dest);

    if (source.startsWith("http://") || source.startsWith("https://")) {
      // Download from URL
      console.log(`  Downloading from URL: ${source}`);
      await this.runSSHCommand(
        `mkdir -p ${path.dirname(absoluteDest)}`,
        true,
        "  "
      );
      await this.runSSHCommand(
        `curl -fsSL -o ${absoluteDest} ${source}`,
        true,
        "  "
      );

      // If it's a tar file, extract it
      if (
        source.endsWith(".tar") ||
        source.endsWith(".tar.gz") ||
        source.endsWith(".tgz")
      ) {
        await this.runSSHCommand(
          `cd ${path.dirname(absoluteDest)} && tar -xf ${path.basename(absoluteDest)}`,
          true,
          "  "
        );
      }
    } else {
      // Local file - use COPY logic
      await this.executeCopy(instruction, workdir);
    }
  }

  private async executeWorkdir(
    instruction: DockerfileInstruction,
    currentWorkdir: string
  ): Promise<string> {
    const dir = instruction.value.trim();
    const absoluteDir = path.isAbsolute(dir)
      ? dir
      : path.join(currentWorkdir, dir);

    await this.runSSHCommand(`mkdir -p ${absoluteDir}`, true, "  ", false);
    console.log(`  Changed working directory to: ${absoluteDir}`);

    return absoluteDir;
  }

  private executeEnv(
    instruction: DockerfileInstruction,
    envVars: Record<string, string>
  ): void {
    if (instruction.args?.name && instruction.args?.value) {
      const name = instruction.args.name;
      const value = instruction.args.value;
      if (typeof name === "string" && typeof value === "string") {
        envVars[name] = value;
        console.log(`  Set environment variable: ${name}=${value}`);
      }
    }
  }

  private async executeVolume(
    instruction: DockerfileInstruction
  ): Promise<void> {
    const volume = instruction.value.trim();
    await this.runSSHCommand(`mkdir -p ${volume}`, true, "  ", false);
    console.log(`  Created volume directory: ${volume}`);
  }

  private async executeExpose(
    instruction: DockerfileInstruction
  ): Promise<void> {
    const ports = instruction.value.trim().split(/\s+/);

    for (const portSpec of ports) {
      // Parse port number (ignore protocol like /tcp or /udp)
      const port = parseInt(portSpec.split("/")[0]);

      if (!isNaN(port)) {
        // Simple naming: port-XXXX
        const serviceName = `port-${port}`;

        // Store for later exposure after build completes
        this.exposedPorts.push({ port, name: serviceName });
        console.log(`  Marked port ${port} for exposure as '${serviceName}'`);
      } else {
        console.log(`  Warning: Invalid port specification: ${portSpec}`);
      }
    }
  }


  private async runSSHCommand(
    command: string,
    sudo = false,
    indent = "  ",
    showCommand = true
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    // Wrap commands with cd in bash -c when using sudo
    let fullCommand = command;
    if (sudo && !command.startsWith("sudo ")) {
      if (command.includes("cd ") || command.includes("&&")) {
        fullCommand = `sudo bash -c "${command.replace(/"/g, '\\"')}"`;
      } else {
        fullCommand = `sudo ${command}`;
      }
    }

    if (showCommand) {
      // Show abbreviated command for readability
      let displayCommand = fullCommand;
      if (displayCommand.length > 100) {
        displayCommand = displayCommand.substring(0, 97) + "...";
      }
      console.log(`${indent}→ ${displayCommand}`);
    }

    const result = await this.instance.exec(fullCommand);

    if (result.stdout) {
      // Indent output for better readability
      const lines = result.stdout.split("\n").filter((line) => line.trim());
      for (const line of lines) {
        console.log(`${indent}  ${line}`);
      }
    }
    if (result.stderr) {
      const lines = result.stderr.split("\n").filter((line) => line.trim());
      for (const line of lines) {
        console.error(`${indent}  ⚠ ${line}`);
      }
    }

    if (result.exit_code !== 0) {
      console.log(
        `${indent}  ⚠ Command returned exit code ${result.exit_code}`
      );
    }

    return {
      exitCode: result.exit_code,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }
}

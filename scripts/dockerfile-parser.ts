import fs from "fs/promises";
import path from "path";
import { execSync } from "child_process";
import type { Instance } from "morphcloud";

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

  constructor(dockerfilePath: string, private projectRoot: string) {
    this.content = "";
    this.lines = [];
    this.projectRoot = projectRoot;
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
            args: { heredoc: true }
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
            value: line.replace("# syntax=", "").trim()
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
      stages: this.stages
    };
  }

  private parseInstruction(line: string): void {
    // Handle heredoc syntax
    if (line.includes("<<")) {
      this.parseHeredoc(line);
      return;
    }

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
      args: stageName ? { stage: stageName } : undefined
    });
  }

  private parseArg(value: string): void {
    const [name, defaultValue] = value.split("=");
    this.buildArgs[name] = defaultValue || "";
    this.instructions.push({
      type: "ARG",
      value,
      args: { name, defaultValue }
    });
  }

  private parseEnv(value: string): void {
    const [name, envValue] = value.split("=");
    this.instructions.push({
      type: "ENV",
      value,
      args: { name, value: envValue }
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
      options
    });
  }

  private parseHeredoc(line: string): void {
    // This method is now obsolete since we handle heredocs in the main parse loop
    // Keeping it empty to avoid breaking existing code structure
  }
}

export class DockerfileExecutor {
  constructor(
    private instance: Instance,
    private projectRoot: string,
    private localTempDir: string = "/tmp/morph-docker-build"
  ) {}

  async execute(dockerfile: ParsedDockerfile): Promise<void> {
    console.log("Executing Dockerfile instructions on Morph instance...");
    
    // Create temp directory for local operations
    await fs.mkdir(this.localTempDir, { recursive: true });

    // Track environment variables and working directory
    let currentWorkdir = "/";
    const envVars: Record<string, string> = {};

    for (const instruction of dockerfile.instructions) {
      console.log(`\nExecuting ${instruction.type}: ${instruction.value.substring(0, 100)}...`);
      
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
            currentWorkdir = await this.executeWorkdir(instruction, currentWorkdir);
            break;
          case "ENV":
            this.executeEnv(instruction, envVars);
            break;
          case "ARG":
            if (instruction.args?.name) {
              const name = String(instruction.args.name);
              const defVal = instruction.args?.defaultValue ? String(instruction.args.defaultValue) : "";
              if (defVal) {
                envVars[name] = defVal;
                console.log(`Set build arg: ${name}=${defVal}`);
              } else if (!(name in envVars)) {
                envVars[name] = "";
                console.log(`Declared build arg: ${name} (no default)`);
              }
            }
            break;
          case "EXPOSE":
            console.log(`Note: EXPOSE ${instruction.value} - ports will need to be exposed via Morph`);
            break;
          case "VOLUME":
            await this.executeVolume(instruction);
            break;
          case "ENTRYPOINT":
          case "CMD":
            console.log(`Note: ${instruction.type} saved for container runtime`);
            break;
          default:
            console.log(`Skipping unsupported instruction: ${instruction.type}`);
        }
      } catch (error) {
        console.error(`Error executing ${instruction.type}:`, error);
        throw error;
      }
    }

    // Cleanup temp directory
    await fs.rm(this.localTempDir, { recursive: true, force: true });
  }

  private async executeFrom(instruction: DockerfileInstruction): Promise<void> {
    const baseImage = instruction.value;
    console.log(`Setting up base image environment for: ${baseImage}`);
    
    // For Ubuntu-based images, ensure basic packages are installed
    if (baseImage.includes("ubuntu")) {
      await this.runSSHCommand("apt-get update", true);
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

    // Prepare environment variables
    const envString = Object.entries(envVars)
      .map(([key, value]) => `export ${key}="${value}"`)
      .join("; ");

    const fullCommand = `cd ${workdir} && ${envString ? envString + " && " : ""}${command}`;
    await this.runSSHCommand(fullCommand, true);
  }

  private async executeCopy(
    instruction: DockerfileInstruction,
    workdir: string
  ): Promise<void> {
    const parts = instruction.value.trim().split(/\s+/);
    const dest = parts[parts.length - 1];
    const sources = parts.slice(0, -1);
    
    // Check for --parents option
    const hasParents = instruction.options?.some(opt => opt.startsWith("--parents")) ?? false;
    
    // Check for --from option (copy from another stage)
    const fromOption = instruction.options?.find(opt => opt.startsWith("--from="));
    if (fromOption) {
      console.log(`Note: --from option not yet supported, skipping stage copy`);
      return;
    }

    const absoluteDest = path.isAbsolute(dest) ? dest : path.join(workdir, dest);

    for (const source of sources) {
      const localPath = path.join(this.projectRoot, source);
      
      try {
        const stats = await fs.stat(localPath);
        
        if (stats.isDirectory()) {
          await this.copyDirectory(localPath, absoluteDest, hasParents);
        } else {
          await this.copyFile(localPath, absoluteDest, hasParents);
        }
      } catch (error) {
        // Handle glob patterns
        if (source.includes("*")) {
          await this.copyGlob(source, absoluteDest, hasParents);
        } else {
          console.error(`Failed to copy ${source}:`, error);
        }
      }
    }
  }

  private async copyFile(
    localPath: string,
    remoteDest: string,
    preserveParents: boolean
  ): Promise<void> {
    console.log(`Copying file: ${localPath} -> ${remoteDest}`);

    const relativePath = path.relative(this.projectRoot, localPath);
    const remoteFilePath = preserveParents
      ? path.join(remoteDest, relativePath)
      : remoteDest;
    const remoteDir = preserveParents
      ? path.dirname(remoteFilePath)
      : remoteDest.endsWith("/")
        ? remoteDest
        : path.dirname(remoteDest);

    await this.runSSHCommand(`mkdir -p ${remoteDir}`, true);

    // Upload to a temp path first, then move into place to avoid sync quirks
    const tmpName = `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const tmpRemote = `/tmp/${tmpName}`;
    try {
      await this.instance.sync(localPath, `${this.instance.id}:${tmpRemote}`);
      await this.runSSHCommand(`mv ${tmpRemote} ${remoteFilePath}`, true);
    } catch (err) {
      console.error(`Failed to sync file via direct upload, attempting fallback:`, err);
      // Fallback: base64 encode and write remotely
      const data = await fs.readFile(localPath, { encoding: "base64" });
      const writeCmd = `mkdir -p ${remoteDir} && echo '${data}' | base64 -d > ${remoteFilePath}`;
      await this.runSSHCommand(writeCmd, true);
    }
  }

  private async copyDirectory(
    localPath: string,
    remoteDest: string,
    preserveParents: boolean
  ): Promise<void> {
    console.log(`Copying directory: ${localPath} -> ${remoteDest}`);
    
    // Create tarball for efficient transfer
    const tarballName = `transfer-${Date.now()}.tar.gz`;
    const tarballPath = path.join(this.localTempDir, tarballName);
    
    if (preserveParents) {
      const relativePath = path.relative(this.projectRoot, localPath);
      execSync(
        `cd "${this.projectRoot}" && tar -czf "${tarballPath}" "${relativePath}"`,
        { stdio: "inherit" }
      );
    } else {
      execSync(
        `cd "${localPath}" && tar -czf "${tarballPath}" .`,
        { stdio: "inherit" }
      );
    }
    
    // Upload and extract
    await this.instance.sync(tarballPath, `${this.instance.id}:/tmp/${tarballName}`);
    await this.runSSHCommand(`mkdir -p ${remoteDest}`, true);
    await this.runSSHCommand(
      `cd ${remoteDest} && tar -xzf /tmp/${tarballName} && rm /tmp/${tarballName}`,
      true
    );
    
    // Clean up local tarball
    await fs.unlink(tarballPath);
  }

  private async copyGlob(
    pattern: string,
    remoteDest: string,
    preserveParents: boolean
  ): Promise<void> {
    console.log(`Copying glob pattern: ${pattern} -> ${remoteDest}`);
    
    // Use shell to expand glob pattern
    const files = execSync(`cd "${this.projectRoot}" && ls -d ${pattern} 2>/dev/null || true`, {
      encoding: "utf-8"
    }).trim().split("\n").filter(f => f);
    
    for (const file of files) {
      const localPath = path.join(this.projectRoot, file);
      await this.copyFile(localPath, remoteDest, preserveParents);
    }
  }

  private async executeAdd(
    instruction: DockerfileInstruction,
    workdir: string
  ): Promise<void> {
    // ADD is similar to COPY but can also handle URLs and tar extraction
    const parts = instruction.value.trim().split(/\s+/);
    const dest = parts[parts.length - 1];
    const source = parts[0];
    
    const absoluteDest = path.isAbsolute(dest) ? dest : path.join(workdir, dest);
    
    if (source.startsWith("http://") || source.startsWith("https://")) {
      // Download from URL
      await this.runSSHCommand(`mkdir -p ${path.dirname(absoluteDest)}`, true);
      await this.runSSHCommand(`curl -fsSL -o ${absoluteDest} ${source}`, true);
      
      // If it's a tar file, extract it
      if (source.endsWith(".tar") || source.endsWith(".tar.gz") || source.endsWith(".tgz")) {
        await this.runSSHCommand(`cd ${path.dirname(absoluteDest)} && tar -xf ${path.basename(absoluteDest)}`, true);
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
    const absoluteDir = path.isAbsolute(dir) ? dir : path.join(currentWorkdir, dir);
    
    await this.runSSHCommand(`mkdir -p ${absoluteDir}`, true);
    console.log(`Changed working directory to: ${absoluteDir}`);
    
    return absoluteDir;
  }

  private executeEnv(
    instruction: DockerfileInstruction,
    envVars: Record<string, string>
  ): void {
    if (instruction.args?.name && instruction.args?.value) {
      const name = instruction.args.name;
      const value = instruction.args.value;
      if (typeof name === 'string' && typeof value === 'string') {
        envVars[name] = value;
        console.log(`Set environment variable: ${name}=${value}`);
      }
    }
  }

  private async executeVolume(instruction: DockerfileInstruction): Promise<void> {
    const volume = instruction.value.trim();
    await this.runSSHCommand(`mkdir -p ${volume}`, true);
    console.log(`Created volume directory: ${volume}`);
  }

  private async runSSHCommand(
    command: string,
    sudo = false
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    const fullCommand = sudo && !command.startsWith("sudo ") ? `sudo ${command}` : command;
    
    console.log(`Running: ${fullCommand}`);
    const result = await this.instance.exec(fullCommand);
    
    if (result.stdout) {
      console.log(result.stdout);
    }
    if (result.stderr) {
      console.error(`ERR: ${result.stderr}`);
    }
    
    if (result.exit_code !== 0) {
      console.log(`Command returned non-zero exit (${result.exit_code}), continuing: ${fullCommand}`);
    }
    
    return {
      exitCode: result.exit_code,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }
}

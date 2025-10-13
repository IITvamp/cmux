import { spawn } from "node:child_process";
import { log } from "./logger";

export interface DetectedPort {
  port: number;
  processName: string;
  pid: number;
  timestamp: number;
}

export interface DevServerHeuristics {
  // Common dev server ports
  likelyDevServer: boolean;
  // Process name suggests dev server
  processNameMatch: boolean;
  // Common framework indicators
  framework?: "vite" | "next" | "webpack" | "create-react-app" | "parcel" | "esbuild" | "rollup" | "unknown";
}

/**
 * Common dev server ports that are likely to be development servers
 */
const COMMON_DEV_SERVER_PORTS = new Set([
  3000, // Create React App, Next.js default
  3001, // Common alternative
  4200, // Angular CLI
  5000, // Flask, general dev
  5173, // Vite default
  5174, // Vite alternative
  8000, // Django, Python SimpleHTTPServer
  8080, // Common dev server port
  8081, // Common alternative
  8888, // Jupyter, common dev
  9000, // Various frameworks
  9999, // Various frameworks
]);

/**
 * Process name patterns that indicate dev servers
 */
const DEV_SERVER_PROCESS_PATTERNS = [
  /vite/i,
  /webpack/i,
  /next/i,
  /parcel/i,
  /rollup/i,
  /esbuild/i,
  /tsc/i,
  /react-scripts/i,
  /ng\s+serve/i, // Angular
  /vue-cli-service/i,
  /nuxt/i,
  /svelte-kit/i,
  /astro/i,
  /gatsby/i,
  /remix/i,
];

/**
 * Apply heuristics to determine if a port is likely a dev server
 */
export function analyzePort(detectedPort: DetectedPort): DevServerHeuristics {
  const { port, processName } = detectedPort;

  // Check if it's a common dev server port
  const likelyDevServer = COMMON_DEV_SERVER_PORTS.has(port);

  // Check if process name matches known dev servers
  let processNameMatch = false;
  let framework: DevServerHeuristics["framework"] = "unknown";

  for (const pattern of DEV_SERVER_PROCESS_PATTERNS) {
    if (pattern.test(processName)) {
      processNameMatch = true;

      // Identify framework
      if (/vite/i.test(processName)) {
        framework = "vite";
      } else if (/next/i.test(processName)) {
        framework = "next";
      } else if (/webpack|react-scripts/i.test(processName)) {
        framework = processName.includes("react-scripts") ? "create-react-app" : "webpack";
      } else if (/parcel/i.test(processName)) {
        framework = "parcel";
      } else if (/esbuild/i.test(processName)) {
        framework = "esbuild";
      } else if (/rollup/i.test(processName)) {
        framework = "rollup";
      }

      break;
    }
  }

  return {
    likelyDevServer,
    processNameMatch,
    framework,
  };
}

/**
 * Parse lsof output to detect open ports
 */
function parseLsofOutput(output: string): DetectedPort[] {
  const lines = output.trim().split("\n");
  const ports: DetectedPort[] = [];

  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Parse lsof output format: COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME
    const parts = line.trim().split(/\s+/);
    if (parts.length < 9) continue;

    const command = parts[0] || "";
    const pid = parseInt(parts[1] || "0", 10);
    const name = parts[8] || "";

    // Extract port from NAME field (format: *:PORT or IP:PORT)
    const portMatch = name.match(/:(\d+)$/);
    if (!portMatch) continue;

    const port = parseInt(portMatch[1], 10);
    if (isNaN(port) || port <= 0) continue;

    ports.push({
      port,
      processName: command,
      pid,
      timestamp: Date.now(),
    });
  }

  return ports;
}

/**
 * Scan for listening ports in the specified range
 * @param minPort Minimum port to scan (default: 3000)
 * @param maxPort Maximum port to scan (default: 9999)
 */
export async function scanPorts(
  minPort = 3000,
  maxPort = 9999
): Promise<DetectedPort[]> {
  return new Promise<DetectedPort[]>((resolve) => {
    // Use lsof to find all listening TCP ports in the range
    const lsof = spawn("lsof", [
      "-iTCP",
      "-sTCP:LISTEN",
      "-P", // Don't resolve port names
      "-n", // Don't resolve hostnames
    ]);

    let output = "";

    lsof.stdout.on("data", (data) => {
      output += data.toString();
    });

    lsof.stderr.on("data", (data) => {
      log("DEBUG", "lsof stderr:", data.toString());
    });

    lsof.on("close", (code) => {
      if (code !== 0 && code !== 1) {
        // lsof returns 1 when no results found, which is fine
        log("WARN", `lsof exited with code ${code}`);
        resolve([]);
        return;
      }

      try {
        const allPorts = parseLsofOutput(output);

        // Filter to the specified range
        const portsInRange = allPorts.filter(
          (p) => p.port >= minPort && p.port <= maxPort
        );

        log("DEBUG", `Scanned ports ${minPort}-${maxPort}, found ${portsInRange.length} ports`, {
          ports: portsInRange.map((p) => `${p.port} (${p.processName})`),
        });

        resolve(portsInRange);
      } catch (error) {
        log("ERROR", "Failed to parse lsof output", error);
        resolve([]);
      }
    });

    lsof.on("error", (error) => {
      log("ERROR", "Failed to execute lsof", error);
      resolve([]);
    });
  });
}

/**
 * Monitor for new ports and call callback when detected
 */
export class PortMonitor {
  private knownPorts = new Set<number>();
  private intervalId: NodeJS.Timeout | null = null;
  private scanning = false;

  constructor(
    private readonly onNewPort: (port: DetectedPort, heuristics: DevServerHeuristics) => void,
    private readonly options: {
      scanIntervalMs?: number;
      minPort?: number;
      maxPort?: number;
      filterByHeuristics?: boolean; // Only report ports that match dev server heuristics
    } = {}
  ) {}

  /**
   * Start monitoring for new ports
   */
  start(): void {
    if (this.intervalId) {
      log("WARN", "PortMonitor already started");
      return;
    }

    const intervalMs = this.options.scanIntervalMs ?? 5000; // Default: scan every 5 seconds

    log("INFO", "Starting port monitor", {
      scanIntervalMs: intervalMs,
      minPort: this.options.minPort ?? 3000,
      maxPort: this.options.maxPort ?? 9999,
      filterByHeuristics: this.options.filterByHeuristics ?? true,
    });

    // Do initial scan
    void this.scan();

    // Start periodic scanning
    this.intervalId = setInterval(() => {
      void this.scan();
    }, intervalMs);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      log("INFO", "Stopped port monitor");
    }
  }

  /**
   * Perform a single scan
   */
  private async scan(): Promise<void> {
    if (this.scanning) {
      return; // Skip if already scanning
    }

    this.scanning = true;

    try {
      const ports = await scanPorts(
        this.options.minPort ?? 3000,
        this.options.maxPort ?? 9999
      );

      for (const port of ports) {
        // Check if this is a new port
        if (!this.knownPorts.has(port.port)) {
          this.knownPorts.add(port.port);

          // Analyze the port
          const heuristics = analyzePort(port);

          // Apply filtering if enabled
          if (this.options.filterByHeuristics !== false) {
            if (heuristics.likelyDevServer || heuristics.processNameMatch) {
              log("INFO", `New dev server detected on port ${port.port}`, {
                port: port.port,
                processName: port.processName,
                framework: heuristics.framework,
                likelyDevServer: heuristics.likelyDevServer,
                processNameMatch: heuristics.processNameMatch,
              });

              this.onNewPort(port, heuristics);
            } else {
              log("DEBUG", `Ignoring port ${port.port} (doesn't match dev server heuristics)`, {
                port: port.port,
                processName: port.processName,
              });
            }
          } else {
            // Report all new ports
            this.onNewPort(port, heuristics);
          }
        }
      }

      // Clean up ports that are no longer open
      const currentPorts = new Set(ports.map((p) => p.port));
      const knownPortsArray = Array.from(this.knownPorts);
      for (const knownPort of knownPortsArray) {
        if (!currentPorts.has(knownPort)) {
          log("DEBUG", `Port ${knownPort} is no longer open`);
          this.knownPorts.delete(knownPort);
        }
      }
    } catch (error) {
      log("ERROR", "Error during port scan", error);
    } finally {
      this.scanning = false;
    }
  }

  /**
   * Get currently known ports
   */
  getKnownPorts(): Set<number> {
    return new Set(this.knownPorts);
  }
}

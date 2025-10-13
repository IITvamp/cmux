import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";

export interface PortInfo {
  port: number;
  processName?: string;
  pid?: number;
  command?: string;
}

export interface DevServerDetection {
  port: number;
  url: string;
  confidence: number; // 0-1, how confident we are this is a dev server
  processInfo?: PortInfo;
}

export class PortMonitor extends EventEmitter {
  private knownPorts = new Set<number>();
  private monitoring = false;
  private intervalId?: NodeJS.Timeout;

  constructor(private pollInterval = 2000) {
    super();
  }

  start() {
    if (this.monitoring) return;
    this.monitoring = true;

    // Initial scan
    this.scanPorts();

    // Set up periodic scanning
    this.intervalId = setInterval(() => {
      this.scanPorts();
    }, this.pollInterval);
  }

  stop() {
    this.monitoring = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  private async scanPorts() {
    try {
      const ports = await this.getOpenPorts();
      const newPorts = ports.filter(p => !this.knownPorts.has(p.port));

      for (const portInfo of newPorts) {
        this.knownPorts.add(portInfo.port);
        this.emit('new-port', portInfo);

        // Check if this looks like a dev server
        const devServer = this.detectDevServer(portInfo);
        if (devServer) {
          this.emit('dev-server-detected', devServer);
        }
      }
    } catch (error) {
      this.emit('error', error);
    }
  }

  private async getOpenPorts(): Promise<PortInfo[]> {
    return new Promise((resolve, reject) => {
      const lsof = spawn('lsof', ['-i', '-P', '-n', '-sTCP:LISTEN']);

      let output = '';
      let errorOutput = '';

      lsof.stdout.on('data', (data) => {
        output += data.toString();
      });

      lsof.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      lsof.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`lsof failed: ${errorOutput}`));
          return;
        }

        const ports: PortInfo[] = [];
        const lines = output.trim().split('\n').slice(1); // Skip header

        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length < 9) continue;

          const command = parts[0];
          const pid = parseInt(parts[1]);
          const address = parts[8];

          // Extract port from address like "*:3000" or "127.0.0.1:3000"
          const portMatch = address.match(/:(\d+)$/);
          if (portMatch) {
            const port = parseInt(portMatch[1]);
            ports.push({
              port,
              processName: command,
              pid,
              command: parts.slice(0, 9).join(' ')
            });
          }
        }

        resolve(ports);
      });

      lsof.on('error', reject);
    });
  }

  private detectDevServer(portInfo: PortInfo): DevServerDetection | null {
    const { port, processName } = portInfo;

    // Common dev server ports
    const commonDevPorts = [
      3000, 3001, 3002, 3003, 3004, 3005, // React, Next.js, etc.
      4000, 4001, 4002, // Some frameworks
      5000, 5001, 5002, // Flask, Django dev servers
      8000, 8001, 8002, 8080, 8081, 8082, // Various dev servers
      9000, 9001, // Some build tools
      5173, 5174, // Vite
      24678, // Vite HMR
      9292, // Rails dev server
      4000, // Gatsby
      1313, // Hugo
      2368, // Ghost
      8787, // Pollen
      4321, // Astro
      4173, // Vite preview
      6006, // TensorBoard
      8888, // Jupyter
      19999, // Netlify dev
    ];

    let confidence = 0;

    // High confidence for known dev server ports
    if (commonDevPorts.includes(port)) {
      confidence = 0.8;
    }

    // Additional confidence from process name
    if (processName) {
      const devProcessNames = [
        'node', 'npm', 'yarn', 'pnpm', 'bun',
        'python', 'python3', 'pipenv',
        'ruby', 'rails',
        'go', 'rust', 'cargo',
        'java', 'gradle', 'maven',
        'dotnet',
        'vite', 'webpack', 'parcel',
        'next', 'nuxt', 'svelte',
        'django', 'flask', 'fastapi',
        'express', 'hapi', 'koa'
      ];

      if (devProcessNames.some(name => processName.toLowerCase().includes(name))) {
        confidence = Math.max(confidence, 0.6);
      }

      // Very high confidence for known dev server processes
      const highConfidenceProcesses = [
        'vite', 'webpack-dev-server', 'next-server',
        'nuxt', 'svelte-kit', 'parcel',
        'django', 'flask', 'rails'
      ];

      if (highConfidenceProcesses.some(proc => processName.toLowerCase().includes(proc))) {
        confidence = Math.max(confidence, 0.9);
      }
    }

    // Only return if we have reasonable confidence
    if (confidence >= 0.5) {
      return {
        port,
        url: `http://localhost:${port}`,
        confidence,
        processInfo: portInfo
      };
    }

    return null;
  }
}
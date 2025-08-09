import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

const PROTECTED_PROCESSES = [
  'orbstack',
  'com.orbstack',
  'Docker',
  'docker-desktop',
  'systemd',
  'launchd',
  'kernel_task'
];

export async function killPortsIfNeeded(portsToCheck: number[]): Promise<string[]> {
  const portsInUse: string[] = [];
  
  for (const port of portsToCheck) {
    try {
      // Get detailed info about processes using this port
      const { stdout } = await execAsync(`lsof -n -i :${port} -P`);
      const lines = stdout.trim().split('\n').slice(1); // Skip header
      
      if (lines.length > 0 && lines[0]) {
        portsInUse.push(port.toString());
        
        for (const line of lines) {
          const parts = line.split(/\s+/);
          const command = parts[0];
          const pid = parts[1];
          
          // Check if this is a protected process
          const isProtected = PROTECTED_PROCESSES.some(proc => 
            command.toLowerCase().includes(proc.toLowerCase())
          );
          
          if (isProtected) {
            // Silently skip protected processes - no console output
          } else {
            try {
              // Try graceful shutdown first
              await execAsync(`kill -TERM ${pid}`);
              // Give it a moment to shut down
              await new Promise(resolve => setTimeout(resolve, 100));
              
              // Check if still running
              try {
                await execAsync(`kill -0 ${pid}`);
                // If we get here, process is still running, force kill
                await execAsync(`kill -9 ${pid}`);
              } catch {
                // Process already terminated
              }
            } catch (error) {
              // Process might have already exited
            }
          }
        }
      }
    } catch (error) {
      // Port is not in use or lsof failed
    }
  }
  
  return portsInUse;
}
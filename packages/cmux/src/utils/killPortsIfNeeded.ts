import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export async function killPortsIfNeeded(portsToCheck: number[]): Promise<string[]> {
  const portsInUse: string[] = [];
  
  for (const port of portsToCheck) {
    try {
      // Check if port is in use
      const { stdout } = await execAsync(`lsof -ti :${port}`);
      const pids = stdout.trim().split('\n').filter(pid => pid);
      
      if (pids.length > 0) {
        portsInUse.push(port.toString());
        
        // Kill all processes using this port
        for (const pid of pids) {
          try {
            await execAsync(`kill -9 ${pid}`);
          } catch (error) {
            // Process might have already exited
          }
        }
      }
    } catch (error) {
      // Port is not in use or lsof failed
    }
  }
  
  return portsInUse;
}
import { spawn } from "node:child_process";

export function checkPorts(portsToCheck: number[]): Promise<string[]> {
  return new Promise<string[]>((resolve) => {
    const portsArg = portsToCheck.map((p) => `-i :${p}`).join(" ");
    const lsof = spawn("lsof", portsArg.split(" "));
    let output = "";

    lsof.stdout.on("data", (data) => {
      output += data.toString();
    });

    lsof.on("close", () => {
      const lines = output
        .trim()
        .split("\n")
        .filter((line) => line);
      if (lines.length === 0) {
        resolve([]);
        return;
      }

      // Parse which ports are in use
      const portsInUse: string[] = [];
      portsToCheck.forEach((port) => {
        if (output.includes(`:${port}`)) {
          portsInUse.push(port.toString());
        }
      });
      resolve(portsInUse);
    });

    lsof.on("error", () => {
      // If lsof fails, assume ports are free
      resolve([]);
    });
  });
}

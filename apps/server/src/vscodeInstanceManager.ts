import type { Id } from "@cmux/convex/dataModel";
import { VSCodeInstance } from "./vscode/VSCodeInstance.js";

/**
 * Global registry for VSCode instances mapped to task runs
 */
class VSCodeInstanceManager {
  private static instance: VSCodeInstanceManager;
  private instances: Map<string, VSCodeInstance> = new Map();

  private constructor() {}

  static getInstance(): VSCodeInstanceManager {
    if (!VSCodeInstanceManager.instance) {
      VSCodeInstanceManager.instance = new VSCodeInstanceManager();
    }
    return VSCodeInstanceManager.instance;
  }

  /**
   * Register a VSCode instance for a task run
   */
  register(taskRunId: string | Id<"taskRuns">, instance: VSCodeInstance): void {
    this.instances.set(taskRunId.toString(), instance);
    console.log(`[VSCodeInstanceManager] Registered instance for task run ${taskRunId}`);
  }

  /**
   * Get a VSCode instance by task run ID
   */
  get(taskRunId: string | Id<"taskRuns">): VSCodeInstance | undefined {
    return this.instances.get(taskRunId.toString());
  }

  /**
   * Get all instances for a set of task runs
   */
  getMultiple(taskRunIds: (string | Id<"taskRuns">)[]): Map<string, VSCodeInstance> {
    const result = new Map<string, VSCodeInstance>();
    for (const taskRunId of taskRunIds) {
      const instance = this.get(taskRunId);
      if (instance) {
        result.set(taskRunId.toString(), instance);
      }
    }
    return result;
  }

  /**
   * Remove a VSCode instance from the registry
   */
  unregister(taskRunId: string | Id<"taskRuns">): void {
    this.instances.delete(taskRunId.toString());
    console.log(`[VSCodeInstanceManager] Unregistered instance for task run ${taskRunId}`);
  }

  /**
   * Get all registered instances
   */
  getAll(): Map<string, VSCodeInstance> {
    return new Map(this.instances);
  }

  /**
   * Clear all instances
   */
  clear(): void {
    this.instances.clear();
    console.log(`[VSCodeInstanceManager] Cleared all instances`);
  }
}

export const vscodeInstanceManager = VSCodeInstanceManager.getInstance();
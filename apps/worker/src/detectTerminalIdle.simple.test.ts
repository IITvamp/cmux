import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { spawn } from "node:child_process";
import { detectTerminalIdle } from "./detectTerminalIdle.js";
import { EventEmitter } from "node:events";

// Mock the logger
vi.mock("./logger.js", () => ({
  log: vi.fn(),
}));

// Mock child_process spawn
vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

describe("detectTerminalIdle", () => {
  let mockChildProcess: any;
  let tmuxCheckProcess: any;
  let stdoutEmitter: EventEmitter;
  let stderrEmitter: EventEmitter;
  let processEmitter: EventEmitter;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Create event emitters for simulating streams
    stdoutEmitter = new EventEmitter();
    stderrEmitter = new EventEmitter();
    processEmitter = new EventEmitter();
    
    // Create mock tmux check process
    tmuxCheckProcess = {
      on: vi.fn((event, handler) => {
        if (event === "exit") {
          // Simulate successful tmux session check
          setImmediate(() => handler(0));
        }
      }),
    };

    // Create mock child process
    mockChildProcess = {
      stdout: stdoutEmitter,
      stderr: stderrEmitter,
      stdin: {
        write: vi.fn(),
      },
      on: processEmitter.on.bind(processEmitter),
      pid: 12345,
    };

    // Setup spawn mock behavior
    const spawnMock = spawn as any;
    spawnMock.mockImplementation((command: string, args: string[]) => {
      if (command === "tmux" && args[0] === "has-session") {
        return tmuxCheckProcess;
      }
      if (command === "script") {
        return mockChildProcess;
      }
      throw new Error(`Unexpected spawn command: ${command}`);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should detect idle after no activity for idleTimeoutMs", async () => {
    const onIdleMock = vi.fn();
    
    const idlePromise = detectTerminalIdle({
      sessionName: "test-session",
      idleTimeoutMs: 3000,
      onIdle: onIdleMock,
    });

    // Wait for initial setup (5 second wait in the code)
    await vi.advanceTimersByTimeAsync(5100);

    // Send some initial activity
    stdoutEmitter.emit("data", Buffer.from("Starting process...\n"));
    
    // Wait less than idle timeout
    await vi.advanceTimersByTimeAsync(2000);
    
    // Should not be idle yet
    expect(onIdleMock).not.toHaveBeenCalled();
    
    // Wait for idle timeout
    await vi.advanceTimersByTimeAsync(1100);
    
    // Should trigger idle
    expect(onIdleMock).toHaveBeenCalled();
    expect(mockChildProcess.stdin.write).toHaveBeenCalledWith("\x02");
    expect(mockChildProcess.stdin.write).toHaveBeenCalledWith("d");
    
    // Simulate clean exit after detach
    processEmitter.emit("exit", 0, null);
    
    const result = await idlePromise;
    expect(result.elapsedMs).toBeGreaterThan(8000);
  });

  it("should reset idle timer on new activity", async () => {
    const onIdleMock = vi.fn();
    
    const idlePromise = detectTerminalIdle({
      sessionName: "test-session",
      idleTimeoutMs: 2000,
      onIdle: onIdleMock,
    });

    await vi.advanceTimersByTimeAsync(5100);

    // Send activity
    stdoutEmitter.emit("data", Buffer.from("Line 1\n"));
    await vi.advanceTimersByTimeAsync(1500);
    
    // Activity before timeout should reset timer
    stdoutEmitter.emit("data", Buffer.from("Line 2\n"));
    await vi.advanceTimersByTimeAsync(1500);
    
    // Still not idle
    expect(onIdleMock).not.toHaveBeenCalled();
    
    // Activity again
    stdoutEmitter.emit("data", Buffer.from("Line 3\n"));
    await vi.advanceTimersByTimeAsync(1500);
    
    // Still not idle
    expect(onIdleMock).not.toHaveBeenCalled();
    
    // Now wait for full idle timeout
    await vi.advanceTimersByTimeAsync(2100);
    
    // Should be idle now
    expect(onIdleMock).toHaveBeenCalled();
    
    processEmitter.emit("exit", 0, null);
    const result = await idlePromise;
    expect(result.elapsedMs).toBeGreaterThan(10000);
  });

  it("should ignore patterns like cursor positioning", async () => {
    const onIdleMock = vi.fn();
    
    const idlePromise = detectTerminalIdle({
      sessionName: "test-session",
      idleTimeoutMs: 2000,
      onIdle: onIdleMock,
    });

    await vi.advanceTimersByTimeAsync(5100);

    // Send real activity
    stdoutEmitter.emit("data", Buffer.from("Real output\n"));
    await vi.advanceTimersByTimeAsync(1000);
    
    // Send ignored patterns (should not reset timer)
    stdoutEmitter.emit("data", Buffer.from("\x1b[2;1H"));
    await vi.advanceTimersByTimeAsync(500);
    stdoutEmitter.emit("data", Buffer.from("\x1b[K"));
    await vi.advanceTimersByTimeAsync(500);
    stdoutEmitter.emit("data", Buffer.from("   \n"));
    await vi.advanceTimersByTimeAsync(500);
    
    // Should trigger idle after 2 seconds from last real activity
    expect(onIdleMock).toHaveBeenCalled();
    
    processEmitter.emit("exit", 0, null);
    const result = await idlePromise;
    expect(result.elapsedMs).toBeGreaterThan(7000);
  });

  it("should reject if process exits too quickly", async () => {
    const idlePromise = detectTerminalIdle({
      sessionName: "test-session",
      idleTimeoutMs: 2000,
    });

    await vi.advanceTimersByTimeAsync(5100);
    
    // Exit immediately after start
    processEmitter.emit("exit", 1, null);
    
    await expect(idlePromise).rejects.toThrow(/too quickly/);
  });

  it("should handle max runtime timeout", async () => {
    const onIdleMock = vi.fn();
    
    const idlePromise = detectTerminalIdle({
      sessionName: "test-session",
      idleTimeoutMs: 5000,
      onIdle: onIdleMock,
    });

    await vi.advanceTimersByTimeAsync(5100);
    
    // Keep sending activity to prevent idle
    const interval = setInterval(() => {
      stdoutEmitter.emit("data", Buffer.from("Still active...\n"));
    }, 4000);
    
    // Fast forward to just before max runtime (20 minutes)
    await vi.advanceTimersByTimeAsync(19 * 60 * 1000);
    
    // Still not idle
    expect(onIdleMock).not.toHaveBeenCalled();
    
    // Fast forward past max runtime
    await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
    
    clearInterval(interval);
    
    // Should force idle at max runtime
    expect(onIdleMock).toHaveBeenCalled();
    
    const result = await idlePromise;
    expect(result.elapsedMs).toBeGreaterThanOrEqual(20 * 60 * 1000);
  });

  it("should debounce rapid output bursts", async () => {
    const onIdleMock = vi.fn();
    
    const idlePromise = detectTerminalIdle({
      sessionName: "test-session",
      idleTimeoutMs: 1000,
      onIdle: onIdleMock,
    });

    await vi.advanceTimersByTimeAsync(5100);

    // Send rapid burst of output
    for (let i = 0; i < 100; i++) {
      stdoutEmitter.emit("data", Buffer.from(`Line ${i}\n`));
      // Advance just a tiny bit
      await vi.advanceTimersByTimeAsync(5);
    }
    
    // Should have only reset timer once or a few times due to debouncing
    // Wait for idle
    await vi.advanceTimersByTimeAsync(1100);
    
    expect(onIdleMock).toHaveBeenCalled();
    
    processEmitter.emit("exit", 0, null);
    const result = await idlePromise;
    expect(result.elapsedMs).toBeGreaterThan(6000);
  });

  describe("Streaming simulation", () => {
    it("should handle streaming text like in Ink apps", async () => {
      const onIdleMock = vi.fn();
      
      const idlePromise = detectTerminalIdle({
        sessionName: "test-session",
        idleTimeoutMs: 2000,
        onIdle: onIdleMock,
      });

      await vi.advanceTimersByTimeAsync(5100);

      // Simulate streaming text output
      const messages = [
        "Initializing...",
        "Loading configuration...",
        "Connecting to server...",
        "Fetching data...",
        "Processing...",
        "Complete!",
      ];

      for (const msg of messages) {
        stdoutEmitter.emit("data", Buffer.from(msg + "\n"));
        await vi.advanceTimersByTimeAsync(500);
      }
      
      // Wait for idle after streaming stops
      await vi.advanceTimersByTimeAsync(2100);
      
      expect(onIdleMock).toHaveBeenCalled();
      
      processEmitter.emit("exit", 0, null);
      const result = await idlePromise;
      expect(result.elapsedMs).toBeGreaterThan(8000);
    });

    it("should handle spinner/loading indicators", async () => {
      const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
      const onIdleMock = vi.fn();
      
      const idlePromise = detectTerminalIdle({
        sessionName: "test-session",
        idleTimeoutMs: 2000,
        ignorePatterns: [
          /^\x1b\[\d+;?\d*H/, // Cursor positioning
          /^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏] Loading/, // Spinner with "Loading"
          /^\s*$/, // Empty lines
        ],
        onIdle: onIdleMock,
      });

      await vi.advanceTimersByTimeAsync(5100);

      // Send real activity
      stdoutEmitter.emit("data", Buffer.from("Starting task...\n"));
      await vi.advanceTimersByTimeAsync(500);
      
      // Simulate spinner (should be ignored)
      for (let i = 0; i < 20; i++) {
        const frame = spinnerFrames[i % spinnerFrames.length];
        stdoutEmitter.emit("data", Buffer.from(`${frame} Loading...\r`));
        await vi.advanceTimersByTimeAsync(100);
      }
      
      // Should trigger idle since spinner was ignored
      expect(onIdleMock).toHaveBeenCalled();
      
      processEmitter.emit("exit", 0, null);
      const result = await idlePromise;
      expect(result.elapsedMs).toBeGreaterThan(7000);
    });
  });
});
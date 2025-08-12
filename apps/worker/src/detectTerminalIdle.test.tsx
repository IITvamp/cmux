import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { spawn } from "node:child_process";
import { detectTerminalIdle } from "./detectTerminalIdle.js";
import React, { useEffect, useState } from "react";
import { render, Text, Box } from "ink";
import { setTimeout as setTimeoutPromise } from "node:timers/promises";

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

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create mock tmux check process
    tmuxCheckProcess = {
      on: vi.fn((event, handler) => {
        if (event === "exit") {
          // Simulate successful tmux session check
          setTimeout(() => handler(0), 10);
        }
      }),
    };

    // Create mock child process
    mockChildProcess = {
      stdout: {
        on: vi.fn(),
      },
      stderr: {
        on: vi.fn(),
      },
      stdin: {
        write: vi.fn(),
      },
      on: vi.fn(),
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

  describe("Streaming Text Simulation", () => {
    it("should detect idle after streaming text stops", async () => {
      vi.useFakeTimers();

      // Simulate streaming text output
      let stdoutHandler: any;
      mockChildProcess.stdout.on.mockImplementation((event: string, handler: any) => {
        if (event === "data") {
          stdoutHandler = handler;
        }
      });

      // Setup exit handler
      let exitHandler: any;
      mockChildProcess.on.mockImplementation((event: string, handler: any) => {
        if (event === "exit") {
          exitHandler = handler;
        }
      });

      const idlePromise = detectTerminalIdle({
        sessionName: "test-session",
        idleTimeoutMs: 3000,
      });

      // Wait for initial setup (5 second wait in the code)
      await vi.advanceTimersByTimeAsync(5000);

      // Simulate streaming text output
      const streamingTexts = [
        "Loading configuration...",
        "Connecting to server...",
        "Fetching data...",
        "Processing items [1/100]",
        "Processing items [50/100]",
        "Processing items [100/100]",
        "Complete!",
      ];

      // Stream text with delays
      for (const text of streamingTexts) {
        if (stdoutHandler) {
          stdoutHandler(Buffer.from(text + "\n"));
        }
        await vi.advanceTimersByTimeAsync(500);
      }

      // Now wait for idle timeout
      await vi.advanceTimersByTimeAsync(3500);

      // The idle detection should trigger detach, don't simulate exit immediately
      // Let the promise resolve from the idle detection

      const result = await idlePromise;
      expect(result.elapsedMs).toBeGreaterThan(8000);
      expect(mockChildProcess.stdin.write).toHaveBeenCalledWith("\x02");
      expect(mockChildProcess.stdin.write).toHaveBeenCalledWith("d");
    });

    it("should reset idle timer when new activity occurs", async () => {
      vi.useFakeTimers();

      let stdoutHandler: any;
      mockChildProcess.stdout.on.mockImplementation((event: string, handler: any) => {
        if (event === "data") {
          stdoutHandler = handler;
        }
      });

      let exitHandler: any;
      mockChildProcess.on.mockImplementation((event: string, handler: any) => {
        if (event === "exit") {
          exitHandler = handler;
        }
      });

      const idlePromise = detectTerminalIdle({
        sessionName: "test-session",
        idleTimeoutMs: 2000,
      });

      await vi.advanceTimersByTimeAsync(5000);

      // Send data, wait 1.5s, send more data (resetting timer)
      if (stdoutHandler) {
        stdoutHandler(Buffer.from("First output\n"));
      }
      await vi.advanceTimersByTimeAsync(1500);

      if (stdoutHandler) {
        stdoutHandler(Buffer.from("Second output - timer reset\n"));
      }
      await vi.advanceTimersByTimeAsync(1500);

      if (stdoutHandler) {
        stdoutHandler(Buffer.from("Third output - timer reset again\n"));
      }
      
      // Now let it go idle
      await vi.advanceTimersByTimeAsync(2500);

      // The idle detection should trigger detach, don't simulate exit immediately

      const result = await idlePromise;
      expect(result.elapsedMs).toBeGreaterThan(9000);
    });
  });

  describe("Loading Indicator Simulation", () => {
    it("should ignore repeated loading indicator patterns", async () => {
      vi.useFakeTimers();

      let stdoutHandler: any;
      mockChildProcess.stdout.on.mockImplementation((event: string, handler: any) => {
        if (event === "data") {
          stdoutHandler = handler;
        }
      });

      let exitHandler: any;
      mockChildProcess.on.mockImplementation((event: string, handler: any) => {
        if (event === "exit") {
          exitHandler = handler;
        }
      });

      const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
      
      const idlePromise = detectTerminalIdle({
        sessionName: "test-session",
        idleTimeoutMs: 2000,
        ignorePatterns: [
          /^\x1b\[\d+;?\d*H/, // Cursor positioning
          /^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/, // Spinner characters
          /^\s*$/, // Empty lines
        ],
      });

      await vi.advanceTimersByTimeAsync(5000);

      // Send real activity first
      if (stdoutHandler) {
        stdoutHandler(Buffer.from("Starting process...\n"));
      }
      await vi.advanceTimersByTimeAsync(500);

      // Simulate spinner animation (should be ignored)
      for (let i = 0; i < 10; i++) {
        if (stdoutHandler) {
          const frame = spinnerFrames[i % spinnerFrames.length];
          // Simulate cursor positioning and spinner update
          stdoutHandler(Buffer.from(`\x1b[2;1H${frame} Loading...`));
        }
        await vi.advanceTimersByTimeAsync(100);
      }

      // This should trigger idle since spinner is ignored
      await vi.advanceTimersByTimeAsync(2000);

      // The idle detection should trigger detach, don't simulate exit immediately

      const result = await idlePromise;
      expect(result.elapsedMs).toBeLessThan(9000); // Should be idle faster since spinner ignored
    });

    it("should detect real output mixed with loading indicators", async () => {
      vi.useFakeTimers();

      let stdoutHandler: any;
      mockChildProcess.stdout.on.mockImplementation((event: string, handler: any) => {
        if (event === "data") {
          stdoutHandler = handler;
        }
      });

      let exitHandler: any;
      mockChildProcess.on.mockImplementation((event: string, handler: any) => {
        if (event === "exit") {
          exitHandler = handler;
        }
      });

      const idlePromise = detectTerminalIdle({
        sessionName: "test-session",
        idleTimeoutMs: 2000,
      });

      await vi.advanceTimersByTimeAsync(5000);

      // Mix real output with spinner
      const outputs = [
        "Starting task...",
        "\x1b[2;1H⠋ Loading...",
        "\x1b[2;1H⠙ Loading...",
        "Task 1 complete",
        "\x1b[2;1H⠹ Loading...",
        "\x1b[2;1H⠸ Loading...",
        "Task 2 complete",
        "\x1b[2;1H⠼ Loading...",
      ];

      for (const output of outputs) {
        if (stdoutHandler) {
          stdoutHandler(Buffer.from(output + "\n"));
        }
        await vi.advanceTimersByTimeAsync(300);
      }

      // Wait for idle
      await vi.advanceTimersByTimeAsync(2500);

      // The idle detection should trigger detach, don't simulate exit immediately

      const result = await idlePromise;
      expect(result.elapsedMs).toBeGreaterThan(7000);
    });
  });

  describe("Ink Component Tests", () => {
    // Component that simulates streaming text
    const StreamingTextApp = ({ onComplete }: { onComplete: () => void }) => {
      const [lines, setLines] = useState<string[]>([]);
      const texts = [
        "Initializing...",
        "Loading modules...",
        "Connecting to database...",
        "Starting server...",
        "Server running on port 3000",
      ];

      useEffect(() => {
        let index = 0;
        const interval = setInterval(() => {
          if (index < texts.length) {
            setLines(prev => [...prev, texts[index]]);
            index++;
          } else {
            clearInterval(interval);
            setTimeout(onComplete, 1000);
          }
        }, 500);

        return () => clearInterval(interval);
      }, []);

      return (
        <Box flexDirection="column">
          {lines.map((line, i) => (
            <Text key={i}>{line}</Text>
          ))}
        </Box>
      );
    };

    // Component that simulates a loading spinner
    const LoadingSpinnerApp = ({ onComplete }: { onComplete: () => void }) => {
      const [frame, setFrame] = useState(0);
      const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

      useEffect(() => {
        const interval = setInterval(() => {
          setFrame(prev => (prev + 1) % spinnerFrames.length);
        }, 80);

        const timeout = setTimeout(() => {
          clearInterval(interval);
          onComplete();
        }, 3000);

        return () => {
          clearInterval(interval);
          clearTimeout(timeout);
        };
      }, []);

      return (
        <Box>
          <Text color="cyan">{spinnerFrames[frame]}</Text>
          <Text> Loading data...</Text>
        </Box>
      );
    };

    it("should handle Ink streaming text component", async () => {
      vi.useFakeTimers();

      let stdoutHandler: any;
      mockChildProcess.stdout.on.mockImplementation((event: string, handler: any) => {
        if (event === "data") {
          stdoutHandler = handler;
        }
      });

      let exitHandler: any;
      mockChildProcess.on.mockImplementation((event: string, handler: any) => {
        if (event === "exit") {
          exitHandler = handler;
        }
      });

      const idlePromise = detectTerminalIdle({
        sessionName: "ink-streaming-test",
        idleTimeoutMs: 2000,
      });

      await vi.advanceTimersByTimeAsync(5000);

      // Simulate Ink component output
      const inkOutputs = [
        "Initializing...",
        "\x1b[1A\x1b[KInitializing...\nLoading modules...",
        "\x1b[2A\x1b[KInitializing...\nLoading modules...\nConnecting to database...",
        "\x1b[3A\x1b[KInitializing...\nLoading modules...\nConnecting to database...\nStarting server...",
        "\x1b[4A\x1b[KInitializing...\nLoading modules...\nConnecting to database...\nStarting server...\nServer running on port 3000",
      ];

      for (const output of inkOutputs) {
        if (stdoutHandler) {
          stdoutHandler(Buffer.from(output));
        }
        await vi.advanceTimersByTimeAsync(500);
      }

      // Wait for idle
      await vi.advanceTimersByTimeAsync(2500);

      // The idle detection should trigger detach, don't simulate exit immediately

      const result = await idlePromise;
      expect(result.elapsedMs).toBeGreaterThan(7000);
    });
  });

  describe("Bug Fixes", () => {
    it("should not exit early on empty output", async () => {
      vi.useFakeTimers();

      let stdoutHandler: any;
      mockChildProcess.stdout.on.mockImplementation((event: string, handler: any) => {
        if (event === "data") {
          stdoutHandler = handler;
        }
      });

      let exitHandler: any;
      mockChildProcess.on.mockImplementation((event: string, handler: any) => {
        if (event === "exit") {
          exitHandler = handler;
        }
      });

      const idlePromise = detectTerminalIdle({
        sessionName: "test-session",
        idleTimeoutMs: 2000,
      });

      await vi.advanceTimersByTimeAsync(5000);

      // Send some empty/whitespace output that should be ignored
      if (stdoutHandler) {
        stdoutHandler(Buffer.from("   \n"));
        stdoutHandler(Buffer.from("\n\n"));
        stdoutHandler(Buffer.from("\t\t"));
      }

      // Should still wait for idle timeout
      await vi.advanceTimersByTimeAsync(2500);

      // The idle detection should trigger detach, don't simulate exit immediately

      const result = await idlePromise;
      expect(result.elapsedMs).toBeGreaterThan(7000);
    });

    it("should handle rapid output bursts correctly", async () => {
      vi.useFakeTimers();

      let stdoutHandler: any;
      mockChildProcess.stdout.on.mockImplementation((event: string, handler: any) => {
        if (event === "data") {
          stdoutHandler = handler;
        }
      });

      let exitHandler: any;
      mockChildProcess.on.mockImplementation((event: string, handler: any) => {
        if (event === "exit") {
          exitHandler = handler;
        }
      });

      const idlePromise = detectTerminalIdle({
        sessionName: "test-session",
        idleTimeoutMs: 1000,
      });

      await vi.advanceTimersByTimeAsync(5000);

      // Rapid burst of output
      if (stdoutHandler) {
        for (let i = 0; i < 100; i++) {
          stdoutHandler(Buffer.from(`Line ${i}\n`));
        }
      }

      // Should reset timer only once for the burst
      await vi.advanceTimersByTimeAsync(1500);

      // The idle detection should trigger detach, don't simulate exit immediately

      const result = await idlePromise;
      expect(result.elapsedMs).toBeGreaterThan(6000);
    });

    it("should reject if process exits too quickly", async () => {
      vi.useFakeTimers();

      let exitHandler: any;
      mockChildProcess.on.mockImplementation((event: string, handler: any) => {
        if (event === "exit") {
          exitHandler = handler;
        }
      });

      const idlePromise = detectTerminalIdle({
        sessionName: "test-session",
        idleTimeoutMs: 2000,
      });

      await vi.advanceTimersByTimeAsync(5000);

      // Exit immediately (simulating a crash)
      await vi.advanceTimersByTimeAsync(100);
      if (exitHandler) {
        exitHandler(1, null);
      }

      await expect(idlePromise).rejects.toThrow(/too quickly/);
    });

    it("should handle max runtime timeout", async () => {
      vi.useFakeTimers();

      const onIdleMock = vi.fn();

      const idlePromise = detectTerminalIdle({
        sessionName: "test-session",
        idleTimeoutMs: 5000,
        onIdle: onIdleMock,
      });

      await vi.advanceTimersByTimeAsync(5000);

      // Fast forward to max runtime (20 minutes)
      await vi.advanceTimersByTimeAsync(20 * 60 * 1000 + 5000);

      const result = await idlePromise;
      expect(result.elapsedMs).toBeGreaterThanOrEqual(20 * 60 * 1000);
      expect(onIdleMock).toHaveBeenCalled();
    });
  });
});
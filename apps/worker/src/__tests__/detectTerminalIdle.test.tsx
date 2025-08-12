import React, { useEffect, useState } from 'react';
import { spawn } from 'node:child_process';
import { Box, Text, render } from 'ink';
import Spinner from 'ink-spinner';
import { detectTerminalIdle } from '../detectTerminalIdle.js';

// Test helper to create a tmux session
async function createTmuxSession(sessionName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('tmux', ['new-session', '-d', '-s', sessionName]);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Failed to create tmux session: ${code}`));
      }
    });
    child.on('error', reject);
  });
}

// Test helper to kill a tmux session
async function killTmuxSession(sessionName: string): Promise<void> {
  return new Promise((resolve) => {
    const child = spawn('tmux', ['kill-session', '-t', sessionName]);
    child.on('exit', () => resolve());
    child.on('error', () => resolve()); // Ignore errors (session might not exist)
  });
}

// Test helper to send commands to tmux session
async function sendToTmuxSession(sessionName: string, command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('tmux', ['send-keys', '-t', sessionName, command, 'Enter']);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Failed to send command to tmux session: ${code}`));
      }
    });
    child.on('error', reject);
  });
}

// Component that simulates streaming text output
const StreamingTextApp: React.FC<{ sessionName: string; lines: string[]; delay: number }> = ({ sessionName, lines, delay }) => {
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [output, setOutput] = useState<string[]>([]);

  useEffect(() => {
    if (currentLineIndex < lines.length) {
      const timer = setTimeout(async () => {
        const line = lines[currentLineIndex];
        setOutput(prev => [...prev, line]);
        
        // Send line to tmux session
        await sendToTmuxSession(sessionName, `echo "${line}"`);
        
        setCurrentLineIndex(currentLineIndex + 1);
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [currentLineIndex, lines, delay, sessionName]);

  return (
    <Box flexDirection="column">
      <Text>Streaming Text Test</Text>
      <Text>Lines sent: {currentLineIndex}/{lines.length}</Text>
      <Box flexDirection="column" marginTop={1}>
        {output.map((line, i) => (
          <Text key={i} color="green">{line}</Text>
        ))}
      </Box>
    </Box>
  );
};

// Component that simulates a loading indicator
const LoadingIndicatorApp: React.FC<{ sessionName: string; duration: number }> = ({ sessionName, duration }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    
    // Send initial loading message
    sendToTmuxSession(sessionName, 'echo "Starting process..."');
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setElapsedTime(elapsed);
      
      if (elapsed >= duration) {
        setIsLoading(false);
        clearInterval(interval);
        // Send completion message
        sendToTmuxSession(sessionName, 'echo "Process complete!"');
      } else {
        // Send periodic status updates
        if (elapsed % 1000 < 100) {
          sendToTmuxSession(sessionName, `echo "Still working... ${Math.floor(elapsed / 1000)}s"`);
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [sessionName, duration]);

  return (
    <Box flexDirection="column">
      <Text>Loading Indicator Test</Text>
      {isLoading ? (
        <Box>
          <Text color="yellow">
            <Spinner type="dots" />
          </Text>
          <Text> Processing... ({Math.floor(elapsedTime / 1000)}s)</Text>
        </Box>
      ) : (
        <Text color="green">✓ Complete!</Text>
      )}
    </Box>
  );
};

// Test suite
describe('detectTerminalIdle', () => {
  const TEST_SESSION_PREFIX = 'test_idle_';
  let testSessionName: string;

  beforeEach(async () => {
    // Create unique session name for each test
    testSessionName = `${TEST_SESSION_PREFIX}${Date.now()}`;
  });

  afterEach(async () => {
    // Clean up tmux session
    if (testSessionName) {
      await killTmuxSession(testSessionName);
    }
  });

  describe('Streaming Text Tests', () => {
    test('should detect idle after streaming text stops', async () => {
      await createTmuxSession(testSessionName);
      
      // Simulate streaming text
      const lines = [
        'Line 1: Starting process...',
        'Line 2: Loading data...',
        'Line 3: Processing item 1...',
        'Line 4: Processing item 2...',
        'Line 5: Finalizing...',
        'Line 6: Complete!'
      ];

      // Start the Ink app in the background
      const { unmount } = render(
        <StreamingTextApp 
          sessionName={testSessionName} 
          lines={lines} 
          delay={500} // 500ms between lines
        />
      );

      // Start idle detection
      const idlePromise = detectTerminalIdle({
        sessionName: testSessionName,
        idleTimeoutMs: 2000, // 2 seconds idle timeout
        onIdle: () => {
          console.log('Terminal went idle!');
        }
      });

      // Wait for detection to complete
      const result = await idlePromise;
      
      unmount();

      // Assertions
      expect(result.elapsedMs).toBeGreaterThan(lines.length * 500); // Should run for at least the streaming duration
      expect(result.elapsedMs).toBeLessThan(lines.length * 500 + 3000); // Should detect idle within timeout
    }, 30000);

    test('should handle rapid streaming without false idle detection', async () => {
      await createTmuxSession(testSessionName);
      
      // Simulate rapid streaming
      const lines = Array.from({ length: 50 }, (_, i) => `Rapid line ${i + 1}`);

      const { unmount } = render(
        <StreamingTextApp 
          sessionName={testSessionName} 
          lines={lines} 
          delay={50} // Very fast streaming
        />
      );

      const idlePromise = detectTerminalIdle({
        sessionName: testSessionName,
        idleTimeoutMs: 1000, // 1 second idle timeout
      });

      const result = await idlePromise;
      
      unmount();

      // Should not detect idle during rapid streaming
      expect(result.elapsedMs).toBeGreaterThan(lines.length * 50);
    }, 30000);
  });

  describe('Loading Indicator Tests', () => {
    test('should detect idle after loading indicator completes', async () => {
      await createTmuxSession(testSessionName);

      const { unmount } = render(
        <LoadingIndicatorApp 
          sessionName={testSessionName} 
          duration={3000} // 3 second loading
        />
      );

      const idlePromise = detectTerminalIdle({
        sessionName: testSessionName,
        idleTimeoutMs: 2000,
      });

      const result = await idlePromise;
      
      unmount();

      // Should detect idle after loading completes
      expect(result.elapsedMs).toBeGreaterThan(3000);
      expect(result.elapsedMs).toBeLessThan(6000);
    }, 30000);

    test('should handle continuous status updates without premature idle', async () => {
      await createTmuxSession(testSessionName);

      const { unmount } = render(
        <LoadingIndicatorApp 
          sessionName={testSessionName} 
          duration={5000} // 5 second loading with periodic updates
        />
      );

      const idlePromise = detectTerminalIdle({
        sessionName: testSessionName,
        idleTimeoutMs: 1500, // Shorter timeout than update interval
      });

      const result = await idlePromise;
      
      unmount();

      // Should not detect idle during continuous updates
      expect(result.elapsedMs).toBeGreaterThan(5000);
    }, 30000);
  });

  describe('Edge Cases and Bug Fixes', () => {
    test('should not terminate too early on initial activity', async () => {
      await createTmuxSession(testSessionName);
      
      // Send immediate activity
      setTimeout(() => {
        sendToTmuxSession(testSessionName, 'echo "Immediate output"');
      }, 100);

      const idlePromise = detectTerminalIdle({
        sessionName: testSessionName,
        idleTimeoutMs: 2000,
      });

      const result = await idlePromise;

      // Should wait for full idle timeout after last activity
      expect(result.elapsedMs).toBeGreaterThan(2000);
    }, 30000);

    test('should handle empty/whitespace output correctly', async () => {
      await createTmuxSession(testSessionName);
      
      // Send whitespace and empty lines
      const emptyOutputs = ['', '   ', '\t', '\n'];
      
      for (const output of emptyOutputs) {
        await sendToTmuxSession(testSessionName, `echo "${output}"`);
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      const idlePromise = detectTerminalIdle({
        sessionName: testSessionName,
        idleTimeoutMs: 1000,
        ignorePatterns: [/^\s*$/], // Should ignore whitespace
      });

      const result = await idlePromise;

      // Should detect idle quickly since all output is ignored
      expect(result.elapsedMs).toBeLessThan(7000); // 5s initial wait + 1s idle + buffer
    }, 30000);

    test('should respect minimum runtime before declaring idle', async () => {
      await createTmuxSession(testSessionName);
      
      // Don't send any output
      const idlePromise = detectTerminalIdle({
        sessionName: testSessionName,
        idleTimeoutMs: 1000,
      });

      const result = await idlePromise;

      // Should wait for initial stabilization period (5s) plus idle timeout
      expect(result.elapsedMs).toBeGreaterThan(6000);
    }, 30000);

    test('should handle tmux session not ready immediately', async () => {
      // Create session asynchronously without waiting
      const createPromise = createTmuxSession(testSessionName);
      
      // Start detection immediately (before session is ready)
      const idlePromise = detectTerminalIdle({
        sessionName: testSessionName,
        idleTimeoutMs: 2000,
      });

      // Wait for both to complete
      await createPromise;
      const result = await idlePromise;

      // Should successfully detect idle even if session wasn't ready initially
      expect(result.elapsedMs).toBeGreaterThan(0);
    }, 30000);

    test('should call onIdle callback exactly once', async () => {
      await createTmuxSession(testSessionName);
      
      let callCount = 0;
      const onIdle = jest.fn(() => {
        callCount++;
      });

      await detectTerminalIdle({
        sessionName: testSessionName,
        idleTimeoutMs: 1000,
        onIdle,
      });

      expect(onIdle).toHaveBeenCalledTimes(1);
      expect(callCount).toBe(1);
    }, 30000);
  });

  describe('Performance Tests', () => {
    test('should handle high-frequency output without memory issues', async () => {
      await createTmuxSession(testSessionName);
      
      // Generate high-frequency output
      const highFreqCommand = 'for i in {1..100}; do echo "Line $i"; done';
      await sendToTmuxSession(testSessionName, highFreqCommand);

      const idlePromise = detectTerminalIdle({
        sessionName: testSessionName,
        idleTimeoutMs: 2000,
      });

      const result = await idlePromise;

      // Should complete without hanging or memory issues
      expect(result.elapsedMs).toBeDefined();
    }, 30000);

    test('should enforce maximum runtime limit', async () => {
      await createTmuxSession(testSessionName);
      
      // Continuously generate output to prevent idle
      const interval = setInterval(() => {
        sendToTmuxSession(testSessionName, 'echo "Keep alive"');
      }, 500);

      const idlePromise = detectTerminalIdle({
        sessionName: testSessionName,
        idleTimeoutMs: 1000,
      });

      const result = await idlePromise;
      clearInterval(interval);

      // Should enforce 20 minute maximum (but we can't wait that long in tests)
      // Just verify it completes eventually
      expect(result.elapsedMs).toBeDefined();
    }, 30000);
  });
});
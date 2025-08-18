import { EventEmitter } from "node:events";

/**
 * Event-based completion detection for Gemini CLI.
 * The Gemini CLI uses a streaming event system where completion
 * is signaled through specific events.
 */

export enum GeminiEventType {
  Finished = "ServerGeminiFinishedEvent",
  // Add other event types as needed
}

export type FinishReason = "STOP" | "MAX_TOKENS" | "ERROR" | "USER_CANCELLED" | "OTHER";

export interface ServerGeminiFinishedEvent {
  type: GeminiEventType.Finished;
  value: FinishReason;
}

export interface GeminiEventDetectorOptions {
  onComplete?: (reason: FinishReason) => void | Promise<void>;
  onError?: (error: Error) => void;
}

/**
 * Event detector for Gemini CLI completion.
 * Listens for ServerGeminiFinishedEvent to determine when the task is complete.
 */
export class GeminiEventDetector extends EventEmitter {
  private completed = false;
  private options: GeminiEventDetectorOptions;

  constructor(options: GeminiEventDetectorOptions = {}) {
    super();
    this.options = options;
  }

  /**
   * Process a Gemini event and check for completion.
   */
  async processEvent(event: any): Promise<void> {
    if (this.completed) return;

    // Check if this is a finish event
    if (event?.type === GeminiEventType.Finished) {
      const finishEvent = event as ServerGeminiFinishedEvent;
      this.completed = true;
      
      // Emit completion
      this.emit("complete", finishEvent.value);
      
      // Call the callback if provided
      if (this.options.onComplete) {
        await this.options.onComplete(finishEvent.value);
      }
    }
  }

  /**
   * Check if the detector has detected completion.
   */
  isCompleted(): boolean {
    return this.completed;
  }

  /**
   * Reset the detector state.
   */
  reset(): void {
    this.completed = false;
  }
}

/**
 * Monitor a stream of Gemini events for completion.
 * This is designed to work with the Gemini CLI's event stream.
 */
export async function monitorGeminiEventStream(
  eventStream: AsyncIterable<any>,
  options: GeminiEventDetectorOptions = {}
): Promise<FinishReason | null> {
  const detector = new GeminiEventDetector(options);
  
  try {
    for await (const event of eventStream) {
      await detector.processEvent(event);
      if (detector.isCompleted()) {
        // Return the finish reason
        return new Promise((resolve) => {
          detector.once("complete", (reason: FinishReason) => {
            resolve(reason);
          });
        });
      }
    }
    
    // Stream ended without a finish event
    return null;
  } catch (error) {
    if (options.onError) {
      options.onError(error instanceof Error ? error : new Error(String(error)));
    }
    throw error;
  }
}

export default {
  GeminiEventDetector,
  GeminiEventType,
  monitorGeminiEventStream,
};
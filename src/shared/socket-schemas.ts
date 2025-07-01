import { z } from "zod";

// Client to Server Events
export const CreateTerminalSchema = z.object({
  id: z.string().optional(),
  cols: z.number().int().positive().default(80),
  rows: z.number().int().positive().default(24),
});

export const TerminalInputSchema = z.object({
  terminalId: z.string().uuid(),
  data: z.string(),
});

export const ResizeSchema = z.object({
  terminalId: z.string().uuid(),
  cols: z.number().int().positive(),
  rows: z.number().int().positive(),
});

export const CloseTerminalSchema = z.object({
  terminalId: z.string().uuid(),
});

// Server to Client Events
export const TerminalCreatedSchema = z.object({
  terminalId: z.string().uuid(),
});

export const TerminalOutputSchema = z.object({
  terminalId: z.string().uuid(),
  data: z.string(),
});

export const TerminalExitSchema = z.object({
  terminalId: z.string().uuid(),
  exitCode: z.number().int(),
  signal: z.number().int().optional(),
});

export const TerminalClosedSchema = z.object({
  terminalId: z.string().uuid(),
});

export const TerminalClearSchema = z.object({
  terminalId: z.string().uuid(),
});

// Type exports
export type CreateTerminal = z.infer<typeof CreateTerminalSchema>;
export type TerminalInput = z.infer<typeof TerminalInputSchema>;
export type Resize = z.infer<typeof ResizeSchema>;
export type CloseTerminal = z.infer<typeof CloseTerminalSchema>;
export type TerminalCreated = z.infer<typeof TerminalCreatedSchema>;
export type TerminalOutput = z.infer<typeof TerminalOutputSchema>;
export type TerminalExit = z.infer<typeof TerminalExitSchema>;
export type TerminalClosed = z.infer<typeof TerminalClosedSchema>;
export type TerminalClear = z.infer<typeof TerminalClearSchema>;

// Socket.io event map types
export interface ClientToServerEvents {
  "create-terminal": (data: CreateTerminal) => void;
  "terminal-input": (data: TerminalInput) => void;
  resize: (data: Resize) => void;
  "close-terminal": (data: CloseTerminal) => void;
}

export interface ServerToClientEvents {
  "terminal-created": (data: TerminalCreated) => void;
  "terminal-output": (data: TerminalOutput) => void;
  "terminal-exit": (data: TerminalExit) => void;
  "terminal-closed": (data: TerminalClosed) => void;
  "terminal-clear": (data: TerminalClear) => void;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface InterServerEvents {
  // No inter-server events in this application
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SocketData {
  // Additional data attached to each socket
}

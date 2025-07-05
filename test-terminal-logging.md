# Testing Terminal Output Logging to Convex

## Implementation Summary

I've successfully implemented debounced saving of terminal outputs to Convex in taskRuns.log with the following changes:

### 1. Modified `server/src/terminal.ts`:
- Added `logBuffer` and `logDebounceTimer` fields to `GlobalTerminal` interface
- Updated `createTerminal` function to accept `convexClient` and `taskRunId` options
- Implemented debounced logging mechanism that:
  - Buffers terminal output data
  - Debounces writes to Convex every 100ms
  - Flushes remaining buffer when terminal exits
  - Handles errors by re-adding failed content to buffer

### 2. Modified `server/src/index.ts`:
- Passed `convex` client and `taskRunId` when creating terminals for Claude sessions

## How it Works

1. When terminal output is received via `ptyProcess.onData()`:
   - The data is written to the terminal and emitted to clients (existing behavior)
   - If a Convex client and taskRunId are provided, the data is added to the log buffer
   - Any existing debounce timer is cleared
   - A new 100ms timer is set to flush the buffer

2. When the debounce timer expires:
   - The `flushLogBuffer` function is called
   - It calls `convex.mutation(api.taskRuns.appendLogPublic)` to append the buffered content
   - The buffer is cleared on success
   - On failure, the content is re-added to the buffer for retry

3. When the terminal exits:
   - Any pending debounce timer is cleared
   - The remaining buffer is flushed immediately

## Testing Steps

To test this implementation:

1. Start the Convex backend: `npx convex dev`
2. Start the server: `npm run server`
3. Start the frontend: `npm run dev`
4. Create a new task and run it
5. Check the Convex dashboard to verify that the `taskRuns` table has the terminal output in the `log` field
6. The log should update in real-time (with 100ms debouncing) as the terminal produces output

## Benefits

- **Performance**: Debouncing reduces the number of database writes
- **Reliability**: Failed writes are retried by keeping content in buffer
- **Completeness**: Final flush on exit ensures no data is lost
- **Real-time**: 100ms debounce provides near real-time updates without overwhelming the server
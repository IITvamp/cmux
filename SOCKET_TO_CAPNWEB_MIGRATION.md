# Socket.io to Cap'n Web Migration Tracking

**Started:** 2025-01-31

## Overview
Migrating from socket.io to Cap'n Web for cleaner RPC-based communication.

## Simplifications
- ❌ Removing `git-file-changed` broadcast event
- ❌ Removing `vscode-spawned` broadcast event  
- ✅ Converting `default-repo` to TanStack Query endpoint
- ✅ Converting `available-editors` to TanStack Query endpoint

## Progress

### Phase 1: Infrastructure ✅
- [x] Created ElectronIpcTransport (`packages/shared/src/transports/electron-ipc-transport.ts`)
- [x] Created RPC interface definitions (`packages/shared/src/rpc-interfaces.ts`)
- [x] Created client helper functions (`packages/shared/src/capnweb-client.ts`)
- [x] Added global Window.electron type definitions
- [x] Fixed handler signature to match IPC renderer types

### Phase 2: Shared Package ✅
- [x] Updated `packages/shared/src/index.ts` exports
- [x] Fixed capnweb-client to use static imports
- [x] Added missing exports (AgentConfig, AGENT_CONFIGS, checkDockerStatus, etc.)
- [x] Added verifyTaskRunToken exports
- [x] Added normalizeOrigin, SERVER_TERMINAL_CONFIG exports
- [x] Added crown types exports
- [x] Fixed all type errors - `bun run check` passes

### Phase 3: Server Migration 🔄
- [ ] Examine socket-handlers.ts to understand scope (~1500 lines)
- [ ] Create server RpcTarget implementation
- [ ] Replace socketio-transport with capnweb transport
- [ ] Update server.ts initialization
- [ ] Remove git-file-changed emissions
- [ ] Remove vscode-spawned emissions
- [ ] Convert socket-handlers.ts to RPC methods
- [ ] Add default-repo endpoint for TanStack Query
- [ ] Add available-editors endpoint for TanStack Query

### Phase 4: Worker Migration ⏳
- [ ] Replace worker socket.io server with capnweb
- [ ] Convert management namespace to RpcTarget
- [ ] Update terminal management code
- [ ] Remove socket.emit calls to main server

### Phase 5: Client Migration ⏳
- [ ] Replace socket context with capnweb client
- [ ] Update all socket hooks and providers
- [ ] Migrate Electron IPC to use ElectronIpcTransport
- [ ] Convert all socket.on/emit to RPC calls
- [ ] Add TanStack Query hooks for default-repo
- [ ] Add TanStack Query hooks for available-editors
- [ ] Remove all git-file-changed listeners
- [ ] Remove all vscode-spawned listeners

### Phase 6: VSCode Extension Migration ⏳
- [ ] Replace socket.io server with capnweb
- [ ] Replace socket.io client with capnweb
- [ ] Update extension handlers

### Phase 7: Dependency Cleanup ⏳
- [ ] Remove socket.io from packages/shared/package.json
- [ ] Remove socket.io from apps/server/package.json
- [ ] Remove socket.io from apps/worker/package.json
- [ ] Remove socket.io from apps/client/package.json
- [ ] Remove socket.io from packages/vscode-extension/package.json
- [ ] Remove socket.io from packages/cmux/package.json
- [ ] Remove socket.io from packages/convex/package.json
- [ ] Remove socket.io from scripts/package.json
- [ ] Update bun.lock

### Phase 8: Verification ⏳
- [ ] Run `bun run check` - fix type errors
- [ ] Run `bun run test` - fix test failures
- [ ] Manual testing of key flows

## Files Modified

### Created
- `packages/shared/src/transports/electron-ipc-transport.ts`
- `packages/shared/src/rpc-interfaces.ts`
- `packages/shared/src/capnweb-client.ts`

### Modified
- `packages/shared/src/index.ts`

### To Modify
- `apps/server/src/server.ts`
- `apps/server/src/socket-handlers.ts`
- `apps/server/src/transports/socketio-transport.ts`
- `apps/worker/src/index.ts`
- `apps/client/src/contexts/socket/*`
- `packages/vscode-extension/src/extension.ts`
- Multiple package.json files

## Notes
- Keeping all Zod schemas for input validation
- Cap'n Web uses promises instead of callbacks
- No more socket.on/socket.emit - using direct method calls
- Server->client broadcasts no longer needed with simplified architecture
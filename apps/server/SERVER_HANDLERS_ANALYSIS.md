# Socket Handler Analysis

This document catalogs all socket handlers in socket-handlers.ts for conversion to Cap'n Web RPC.

## Socket Event Handlers (16 total)

### 1. rust-get-time
- **Type**: Simple callback
- **Input**: None
- **Output**: `{ ok: boolean, time?: string, error?: string }`
- **Purpose**: Test Rust N-API integration

### 2. git-diff
- **Type**: Data + callback
- **Input**: `GitSocketDiffRequestSchema` (headRef, baseRef, repoFullName, repoUrl, originPathOverride, includeContents, maxBytes, lastKnownBaseSha, lastKnownMergeCommitSha)
- **Output**: `{ ok: boolean, diffs: array, error?: string }`
- **Purpose**: Get git diffs between branches
- **Side effect**: Sets up file watcher, emits git-file-changed

### 3. start-task
- **Type**: Data + callback
- **Input**: `StartTaskSchema` (taskId, repoUrl, branch, taskDescription, selectedAgents, isCloudMode, images, theme, environmentId)
- **Output**: `{ taskId, worktreePath?, terminalId?, error? }`
- **Purpose**: Start new task with multiple agents
- **Side effect**: Spawns agents, emits vscode-spawned

### 4. github-sync-pr-state
- **Type**: Data + callback
- **Input**: `GitHubSyncPrStateSchema` (taskRunId)
- **Output**: `{ success, results, aggregate, error? }`
- **Purpose**: Sync PR state from GitHub to Convex

### 5. github-merge-branch
- **Type**: Data + callback
- **Input**: `GitHubMergeBranchSchema` (taskRunId)
- **Output**: `{ success, merged?, commitSha?, error? }`
- **Purpose**: Merge branch directly without PR

### 6. git-status (DEPRECATED)
- **Type**: No input
- **Output**: Emits git-status-response with error
- **Purpose**: Legacy handler, returns error

### 7. git-full-diff
- **Type**: Data, no callback
- **Input**: `GitFullDiffRequestSchema` (workspacePath)
- **Output**: Emits git-full-diff-response
- **Purpose**: Get full git diff for workspace

### 8. open-in-editor
- **Type**: Data + callback
- **Input**: `OpenInEditorSchema` (editor, path)
- **Output**: `{ success, error? }`
- **Purpose**: Open file/folder in various editors
- **Side effect**: Emits open-in-editor-error on failure

### 9. list-files
- **Type**: Data, no callback
- **Input**: `ListFilesRequestSchema` (repoPath, branch, pattern, environmentId)
- **Output**: Emits list-files-response
- **Purpose**: List files in repository/environment

### 10. github-test-auth
- **Type**: Callback only
- **Input**: None
- **Output**: Auth status info
- **Purpose**: Test GitHub CLI authentication

### 11. github-fetch-repos
- **Type**: Data + callback
- **Input**: `GitHubFetchReposSchema` (teamSlugOrId)
- **Output**: `{ success, repos, error? }`
- **Purpose**: Fetch GitHub repositories for team

### 12. spawn-from-comment
- **Type**: Data + callback
- **Input**: `SpawnFromCommentSchema` (url, page, pageTitle, nodeId, x, y, content, selectedAgents, commentId)
- **Output**: `{ success, taskId, taskRunId, worktreePath, terminalId, vscodeUrl, error? }`
- **Purpose**: Spawn task from comment
- **Side effect**: Emits vscode-spawned

### 13. github-fetch-branches
- **Type**: Data + callback
- **Input**: `GitHubFetchBranchesSchema` (repo)
- **Output**: `{ success, branches, error? }`
- **Purpose**: Fetch branches for repository

### 14. github-create-draft-pr
- **Type**: Data + callback
- **Input**: `GitHubCreateDraftPrSchema` (taskRunId)
- **Output**: `{ success, results, aggregate, error? }`
- **Purpose**: Create draft PR for task run

### 15. check-provider-status
- **Type**: Callback only
- **Input**: None
- **Output**: `{ success, ...status, error? }`
- **Purpose**: Check status of all agent providers

### 16. archive-task
- **Type**: Data + callback
- **Input**: `ArchiveTaskSchema` (taskId)
- **Output**: `{ success, error? }`
- **Purpose**: Archive task and stop containers

## Broadcast Emissions (to remove)

### default-repo
- **When**: On connection if default repo available, after storing in Convex
- **Data**: `{ repoFullName, branch, localPath }`
- **Replacement**: TanStack Query endpoint

### available-editors
- **When**: On connection after checking editor availability
- **Data**: `AvailableEditors` object
- **Replacement**: TanStack Query endpoint

### git-file-changed (conditional)
- **When**: File watcher detects changes in git-diff handler
- **Data**: `{ workspacePath, filePath }`
- **Replacement**: Remove file watching, use polling

### vscode-spawned (conditional)
- **When**: VSCode instance is spawned in start-task or spawn-from-comment
- **Data**: `{ instanceId, url, workspaceUrl, provider }`
- **Replacement**: Remove, rely on Convex updates

## Authentication Pattern

All handlers run within `runWithAuth(token, tokenJson, callback)` context from socket.use middleware.
The auth token is extracted from `socket.handshake.query.auth`.

## Conversion Strategy

1. Create ServerRpcTarget class implementing all RPC methods
2. Convert each handler to async RPC method
3. Remove broadcast emissions
4. Add TanStack Query endpoints for default-repo and available-editors
5. Update server.ts to use capnweb transport
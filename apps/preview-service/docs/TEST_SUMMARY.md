# Preview Service Test Summary

## What Was Tested

### 1. Basic API Endpoints
- **Health Check** (`GET /api/health`)
  - ✅ Returns healthy status with timestamp and service name
  - ✅ Response follows expected schema

- **Root Endpoint** (`GET /`)
  - ✅ Returns API information including version and available endpoints
  - ✅ Lists all available endpoints for discovery

### 2. Preview Management
- **Request Validation** (`POST /api/preview/create`)
  - ✅ Validates required fields (gitUrl, branch, etc.)
  - ✅ Returns 400 with proper error message for invalid requests

- **Base Snapshot Management** (`POST /api/preview/set-base-snapshot`)
  - ✅ Successfully sets base snapshot ID for creating instances
  - ✅ Validates snapshot ID exists

### 3. Full Preview Lifecycle (Integration Test)
This comprehensive test validates the entire preview environment workflow:

1. **Environment Creation**
   - ✅ Creates instance from base Morph snapshot
   - ✅ Clones specified Git repository (microsoft/vscode-remote-try-node)
   - ✅ Sets up devcontainer when present
   - ✅ Exposes VSCode and worker services

2. **Status Checking**
   - ✅ Returns current instance status
   - ✅ Provides service URLs (VSCode, worker)
   - ✅ Validates services are accessible via HTTP

3. **Pause/Resume Functionality**
   - ✅ Creates snapshot when pausing instance
   - ✅ Stops instance to save costs
   - ✅ Resumes from snapshot maintaining state
   - ✅ Services become available again after resume

4. **Cleanup**
   - ✅ Properly stops and removes instance
   - ✅ Cleans up resources

## Test Infrastructure

### Environment Setup
- Uses Vitest as testing framework
- Loads environment variables from both root and local .env files
- Validates MORPH_BASE_SNAPSHOT_ID is available
- Starts preview service on port 3001 for testing

### Response Validation
All API responses are validated using Zod schemas:
- `HealthResponseSchema`
- `RootResponseSchema`
- `PreviewResponseSchema`

## Suggested Additional Tests

### 1. Error Handling Tests
- **Invalid Git Repository**: Test with non-existent or private repos
- **Network Failures**: Simulate network issues during clone/setup
- **Resource Limits**: Test behavior when Morph resources are exhausted
- **Invalid Snapshot IDs**: Test with non-existent base snapshots

### 2. Concurrent Operations
- **Multiple Instance Creation**: Create several instances simultaneously
- **Concurrent Pause/Resume**: Test race conditions
- **Status Check During Operations**: Check status while instance is being created/paused

### 3. Edge Cases
- **Large Repositories**: Test with very large Git repos
- **Complex Devcontainers**: Test with multi-stage devcontainer setups
- **Long-Running Operations**: Test timeout handling
- **Malformed Requests**: Test various malformed JSON payloads

### 4. Performance Tests
- **Instance Creation Time**: Benchmark typical creation times
- **Pause/Resume Latency**: Measure snapshot/restore performance
- **API Response Times**: Ensure endpoints respond quickly

### 5. Security Tests
- **Authentication**: Add tests for API key validation
- **Authorization**: Test access control for instances
- **Input Sanitization**: Test for injection attacks in git URLs
- **Rate Limiting**: Test rate limit enforcement

### 6. Provider-Specific Tests
- **E2B Provider**: Test E2B-specific functionality when implemented
- **Daytona Provider**: Test Daytona-specific features
- **Provider Switching**: Test switching between providers

### 7. Webhook Integration Tests
- **GitHub Webhook Processing**: Test PR event handling
- **Webhook Signature Validation**: Ensure security
- **Automatic Preview Creation**: Test end-to-end webhook flow

### 8. Monitoring and Observability
- **Metrics Collection**: Test metric emission
- **Error Tracking**: Ensure errors are properly logged
- **Health Check Details**: Test detailed health status

## Debug Utilities

Two debug scripts were created:

1. **`pnpm debug:instance`**: Interactive debug tool
   - Prompts for repository URL and branch
   - Provides menu for various operations
   - Allows executing commands on instance

2. **`scripts/quick-debug.ts`**: Quick instance creation
   - Usage: `tsx scripts/quick-debug.ts [repo-url] [branch]`
   - Defaults to microsoft/vscode-remote-try-node
   - Prints URLs and keeps running

Both tools are useful for:
- Testing new repositories
- Debugging devcontainer issues
- Exploring instance capabilities
- Manual testing of preview environments
# Preview Service

A microservice for managing preview environments using various sandbox providers (Morph, E2B, Daytona, etc.).

## Architecture

### Provider Abstraction

The service uses a provider-agnostic architecture with a base `SandboxProvider` class that all providers must implement:

```typescript
abstract class SandboxProvider {
  abstract createInstance(config): Promise<SandboxInstance>;
  abstract stopInstance(instanceId): Promise<void>;
  abstract createSnapshot(instanceId, metadata): Promise<string>;
  abstract exec(instanceId, command, options): Promise<ExecResult>;
  abstract exposeHttpService(instanceId, name, port): Promise<string>;
  // ... and more
}
```

### Current Providers

- **MorphProvider** (implemented) - Uses Morph Cloud for sandboxing
- **E2BProvider** (example) - Skeleton for E2B integration
- **DaytonaProvider** (example) - Skeleton for Daytona integration

### Provider Factory

The `ProviderFactory` dynamically selects providers based on environment configuration:

```typescript
// Automatically selects provider based on SANDBOX_PROVIDER env var
const provider = ProviderFactory.getProviderFromEnv();
```

## Running Tests

### Prerequisites

1. Install dependencies:
```bash
pnpm install
```

2. Set up environment variables in `.env`:
```bash
MORPH_API_KEY=your_morph_api_key
# Optional: MORPH_BASE_SNAPSHOT_ID=snapshot_id
# Optional: SANDBOX_PROVIDER=morph (default)
```

### Test Commands

**Run all tests:**
```bash
pnpm test
```

**Run tests in watch mode:**
```bash
pnpm test:watch
```

**Create base snapshot (required for full tests):**
```bash
pnpm test:snapshot
```
This creates a Morph snapshot with VSCode + Docker setup. The snapshot ID will be saved to `.env`.

**Run expensive tests (creates actual preview environments):**
```bash
RUN_EXPENSIVE_TESTS=true pnpm test
```

**Run typecheck:**
```bash
pnpm typecheck
```

## API Endpoints

- `POST /api/preview/create` - Create a new preview environment
- `POST /api/preview/pause/:id` - Pause preview and create snapshot
- `POST /api/preview/resume/:id` - Resume from snapshot
- `GET /api/preview/status/:id` - Get preview status
- `POST /api/preview/stop/:id` - Stop preview environment
- `GET /api/health` - Health check

## Adding New Providers

1. Create a new provider class extending `SandboxProvider`:

```typescript
export class MyProvider extends SandboxProvider {
  readonly providerName = 'MyProvider';
  
  async createInstance(config) {
    // Implementation
  }
  
  // Implement all abstract methods...
}
```

2. Add the provider to `ProviderFactory`:

```typescript
case 'myprovider':
  provider = new MyProvider(config.apiKey);
  break;
```

3. Set environment variables:
```bash
SANDBOX_PROVIDER=myprovider
MYPROVIDER_API_KEY=your_api_key
```

## Development

**Start dev server:**
```bash
pnpm dev
```

The service will run on `http://localhost:3001` by default.

## Deployment

The service is configured for Vercel deployment. See `vercel.json` for configuration.
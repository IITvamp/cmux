# Auto-Preview Feature

The auto-preview feature automatically detects dev servers running on common ports and opens them in Chrome using the Chrome DevTools Protocol (CDP).

## How It Works

1. **Port Monitoring**: The worker continuously scans for listening TCP ports in the range 3000-9999
2. **Dev Server Detection**: Uses heuristics to identify development servers:
   - **Port-based**: Common dev server ports (3000, 5173, 8080, etc.)
   - **Process-based**: Recognizes dev server process names (vite, webpack, next, etc.)
3. **Auto-Open**: When a dev server is detected, automatically opens it in Chrome via CDP

## Supported Frameworks

The system recognizes the following development frameworks:

- **Vite** (default port 5173)
- **Next.js** (default port 3000)
- **Create React App** (default port 3000)
- **Webpack Dev Server** (various ports)
- **Parcel** (various ports)
- **esbuild** (various ports)
- **Rollup** (various ports)
- **Angular CLI** (default port 4200)
- **Vue CLI** (default port 8080)

## Usage

### Enable Auto-Preview

To enable auto-preview, send the `worker:enable-auto-preview` event to the worker:

```typescript
import { connectToWorkerManagement } from "@cmux/shared/socket";

const socket = connectToWorkerManagement({
  url: "http://localhost:39377",
});

socket.emit("worker:enable-auto-preview", (response) => {
  console.log(response); // { success: true, message: "Auto-preview enabled" }
});
```

### Disable Auto-Preview

To disable auto-preview:

```typescript
socket.emit("worker:disable-auto-preview", (response) => {
  console.log(response); // { success: true, message: "Auto-preview disabled" }
});
```

## Configuration

Auto-preview can be configured via environment variables in the worker container:

- `CDP_HOST`: Chrome DevTools Protocol host (default: `127.0.0.1`)
- `CDP_PORT`: Chrome DevTools Protocol port (default: `39381`)

## Architecture

### Components

1. **PortMonitor** (`portMonitor.ts`):
   - Scans for open ports using `lsof`
   - Applies heuristics to identify dev servers
   - Runs periodic scans (default: every 5 seconds)

2. **ChromePreviewClient** (`chromePreview.ts`):
   - Communicates with Chrome via CDP
   - Creates and manages browser tabs
   - Tracks opened ports to avoid duplicates

3. **AutoPreviewManager** (`chromePreview.ts`):
   - Orchestrates port monitoring and Chrome interaction
   - Applies filtering rules based on heuristics

### Heuristics

The system uses the following heuristics to identify dev servers:

1. **Port-based**: Checks if the port is in the list of common dev server ports
2. **Process-based**: Matches the process name against known dev server patterns

A port is considered a dev server if **either** heuristic matches.

### Port Scanning

Ports are scanned using `lsof -iTCP -sTCP:LISTEN` which:
- Lists all TCP ports in LISTEN state
- Includes process name and PID
- Filters to the specified port range (3000-9999)

## Chrome CDP Integration

The system uses the Chrome DevTools Protocol HTTP API for tab management:

- `GET /json/version`: Check if Chrome is available
- `GET /json/list`: List open tabs
- `PUT /json/new?<url>`: Create a new tab
- `POST /json/activate/<id>`: Activate (focus) a tab
- `DELETE /json/close/<id>`: Close a tab

The Chrome instance must be started with the following flags:
```bash
--remote-debugging-address=127.0.0.1
--remote-debugging-port=39382
--remote-allow-origins=*
```

## Example Flow

1. User starts a task that runs `npm run dev` (starts Vite on port 5173)
2. Worker's port monitor detects port 5173 with process name "vite"
3. Heuristics identify this as a dev server (matches both port and process patterns)
4. Auto-preview manager checks if Chrome CDP is available
5. Creates a new tab pointing to `http://localhost:5173`
6. Activates the tab to bring it to the foreground
7. Marks port 5173 as "opened" to avoid creating duplicate tabs

## Limitations

- Only detects servers listening on TCP ports
- Requires `lsof` to be available in the container
- Chrome must be running with CDP enabled
- Only works for servers listening on localhost/0.0.0.0
- Scan interval means there's a delay (max 5 seconds) before detection

## Future Enhancements

- Support for custom port ranges and exclusions
- Configurable heuristics via settings
- Notification when dev server is detected
- Support for opening in specific Chrome profiles/windows
- Integration with devcontainer lifecycle hooks
- WebSocket-based real-time port monitoring (instead of polling)

# VNC WebSocket Proxy

A lightweight, high-performance WebSocket-to-TCP proxy for VNC/noVNC written in Rust. This replaces `websockify` with minimal dependencies and better performance.

## Features

- **WebSocket to TCP proxying** - Bridges WebSocket connections from noVNC clients to VNC servers
- **Static file serving** - Serves noVNC web files (HTML, CSS, JS)
- **Minimal dependencies** - Only uses tokio, tungstenite, and clap
- **High performance** - Compiled to native code with aggressive optimizations
- **Small binary size** - ~1.2MB release binary
- **Comprehensive tests** - Includes integration tests for reliability

## Usage

```bash
# Basic usage (defaults to 0.0.0.0:39380 -> 127.0.0.1:5901)
vnc-websocket-proxy

# Custom listen and target addresses
vnc-websocket-proxy --listen 0.0.0.0:8080 --target 127.0.0.1:5900

# With static file serving
vnc-websocket-proxy --listen 0.0.0.0:39380 --target 127.0.0.1:5901 --web /usr/share/novnc
```

## Command Line Options

- `-l, --listen <ADDRESS>` - WebSocket listen address (default: 0.0.0.0:39380)
- `-t, --target <ADDRESS>` - VNC server address (default: 127.0.0.1:5901)
- `-w, --web <DIRECTORY>` - Directory to serve static files from (optional)

## Building

```bash
# Debug build
cargo build

# Release build (optimized)
cargo build --release

# Run tests
cargo test
```

## Replacing websockify

This proxy is a drop-in replacement for websockify. Update your systemd service:

```ini
[Service]
ExecStart=/usr/local/bin/vnc-websocket-proxy --listen 0.0.0.0:39380 --target 127.0.0.1:5901 --web /usr/share/novnc
```

## Performance Comparison

Compared to Python-based websockify:
- **Smaller memory footprint** - Native compiled binary vs Python runtime
- **Lower latency** - Direct memory handling without Python overhead
- **Single binary** - No Python dependencies or virtual environments needed
- **Faster startup** - Immediate execution without interpreter initialization

## Architecture

The proxy works by:
1. Listening for incoming TCP connections
2. Detecting HTTP vs WebSocket upgrade requests
3. For HTTP requests: Serving static files from the `--web` directory
4. For WebSocket requests: Establishing connection to VNC server
5. Bidirectionally forwarding binary data between WebSocket and TCP

## Security

- Path traversal protection for static file serving
- Proper WebSocket handshake validation
- No dynamic code execution
- Minimal attack surface

## License

Same as the parent cmux project.

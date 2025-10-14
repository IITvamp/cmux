# Changelog

## [0.1.0] - 2025-10-14

### Added
- Initial release of vnc-websocket-proxy
- WebSocket to TCP proxy functionality for VNC/noVNC
- Static file serving for noVNC web interface
- Command-line interface with customizable listen/target addresses
- Comprehensive integration tests
- Security features: path traversal protection
- Minimal dependencies: tokio, tungstenite, futures-util, clap, http, httparse

### Performance
- Binary size: 1.2MB (stripped, optimized)
- Minimal runtime dependencies: only 5 dynamic libraries
- Zero Python dependencies
- Native compiled performance

### Replaced
- Python websockify package

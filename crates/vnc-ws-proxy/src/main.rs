//! VNC WebSocket Proxy
//!
//! A lightweight WebSocket-to-TCP proxy for VNC connections.
//! Replaces Python's websockify with a minimal Rust implementation.
//!
//! Usage:
//!   vnc-ws-proxy --listen 0.0.0.0:39380 --target 127.0.0.1:5901
//!
//! This accepts WebSocket connections on the listen address and forwards
//! raw TCP traffic to the target VNC server.

use std::net::SocketAddr;
use std::sync::Arc;

use clap::Parser;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio_tungstenite::accept_async;
use tracing::{error, info, warn};
use tungstenite::Message;

#[derive(Parser, Debug, Clone)]
#[command(author, version, about = "VNC WebSocket Proxy - WebSocket to TCP proxy for VNC")]
struct Args {
    /// WebSocket listen address
    #[arg(long, default_value = "0.0.0.0:39380")]
    listen: SocketAddr,

    /// Target VNC server address (TCP)
    #[arg(long, default_value = "127.0.0.1:5901")]
    target: SocketAddr,

    /// Buffer size for proxying data (in bytes)
    #[arg(long, default_value = "8192")]
    buffer_size: usize,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = Args::parse();

    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "vnc_ws_proxy=info".into()),
        )
        .compact()
        .init();

    info!(
        listen = %args.listen,
        target = %args.target,
        buffer_size = args.buffer_size,
        "Starting VNC WebSocket proxy"
    );

    let listener = TcpListener::bind(args.listen).await?;
    let actual_addr = listener.local_addr()?;
    info!("Listening on {}", actual_addr);

    let target = Arc::new(args.target);
    let buffer_size = args.buffer_size;

    loop {
        match listener.accept().await {
            Ok((stream, peer)) => {
                let target = Arc::clone(&target);
                tokio::spawn(async move {
                    if let Err(e) = handle_connection(stream, peer, *target, buffer_size).await {
                        error!(peer = %peer, error = %e, "Connection error");
                    }
                });
            }
            Err(e) => {
                error!(error = %e, "Failed to accept connection");
            }
        }
    }
}

async fn handle_connection(
    stream: TcpStream,
    peer: SocketAddr,
    target: SocketAddr,
    buffer_size: usize,
) -> Result<(), Box<dyn std::error::Error>> {
    info!(peer = %peer, target = %target, "New connection");

    // Perform WebSocket handshake
    let ws_stream = match accept_async(stream).await {
        Ok(ws) => ws,
        Err(e) => {
            warn!(peer = %peer, error = %e, "WebSocket handshake failed");
            return Err(e.into());
        }
    };

    info!(peer = %peer, "WebSocket handshake completed");

    // Connect to VNC server
    let vnc_stream = match TcpStream::connect(target).await {
        Ok(stream) => stream,
        Err(e) => {
            error!(peer = %peer, target = %target, error = %e, "Failed to connect to VNC server");
            return Err(e.into());
        }
    };

    info!(peer = %peer, target = %target, "Connected to VNC server");

    // Split both streams for bidirectional communication
    let (ws_sink, ws_stream) = ws_stream.split();
    let (mut vnc_read, mut vnc_write) = vnc_stream.into_split();

    // Use tokio-tungstenite's built-in split types
    use futures_util::{SinkExt, StreamExt};
    let mut ws_write = ws_sink;
    let mut ws_read = ws_stream;

    // Task 1: WebSocket -> VNC (read from WebSocket, write to VNC)
    let ws_to_vnc_task = tokio::spawn(async move {
        loop {
            match ws_read.next().await {
                Some(Ok(msg)) => match msg {
                    Message::Binary(data) => {
                        if let Err(e) = vnc_write.write_all(&data).await {
                            warn!(peer = %peer, error = %e, "Failed to write to VNC");
                            break;
                        }
                    }
                    Message::Close(_) => {
                        info!(peer = %peer, "WebSocket close frame received");
                        break;
                    }
                    Message::Ping(_) => {
                        // Ignore ping, we'll handle it in the other direction
                    }
                    Message::Pong(_) => {
                        // Ignore pong frames
                    }
                    Message::Text(_) => {
                        // VNC uses binary protocol, ignore text messages
                        warn!(peer = %peer, "Received unexpected text message");
                    }
                    Message::Frame(_) => {
                        // Low-level frame, should not occur in normal operation
                    }
                },
                Some(Err(e)) => {
                    warn!(peer = %peer, error = %e, "WebSocket read error");
                    break;
                }
                None => {
                    info!(peer = %peer, "WebSocket stream ended");
                    break;
                }
            }
        }
        let _ = vnc_write.shutdown().await;
    });

    // Task 2: VNC -> WebSocket (read from VNC, write to WebSocket)
    let vnc_to_ws_task = tokio::spawn(async move {
        let mut buffer = vec![0u8; buffer_size];
        loop {
            match vnc_read.read(&mut buffer).await {
                Ok(0) => {
                    info!(peer = %peer, "VNC connection closed");
                    break;
                }
                Ok(n) => {
                    let data = buffer[..n].to_vec();
                    if let Err(e) = ws_write.send(Message::Binary(data)).await {
                        warn!(peer = %peer, error = %e, "Failed to write to WebSocket");
                        break;
                    }
                }
                Err(e) => {
                    warn!(peer = %peer, error = %e, "Failed to read from VNC");
                    break;
                }
            }
        }
        let _ = ws_write.close().await;
    });

    // Wait for both tasks
    let _ = tokio::join!(ws_to_vnc_task, vnc_to_ws_task);

    info!(peer = %peer, "Connection closed");
    Ok(())
}

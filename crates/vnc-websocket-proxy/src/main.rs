use clap::Parser;
use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio_tungstenite::accept_async;
use tungstenite::protocol::Message;
use futures_util::{SinkExt, StreamExt};

#[derive(Parser, Debug)]
#[command(author, version, about = "WebSocket to TCP proxy for VNC/noVNC")]
struct Args {
    /// WebSocket listen address (e.g., 0.0.0.0:39380)
    #[arg(short, long, default_value = "0.0.0.0:39380")]
    listen: String,

    /// VNC server address (e.g., 127.0.0.1:5901)
    #[arg(short, long, default_value = "127.0.0.1:5901")]
    target: String,

    /// Directory to serve static files from (e.g., /usr/share/novnc)
    #[arg(short, long)]
    web: Option<String>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = Args::parse();

    let listen_addr: SocketAddr = args.listen.parse()?;
    let target_addr = args.target.clone();
    let web_dir = args.web.clone();

    let listener = TcpListener::bind(&listen_addr).await?;
    println!("VNC WebSocket proxy listening on {}", listen_addr);
    println!("Forwarding to VNC server at {}", target_addr);
    if let Some(ref dir) = web_dir {
        println!("Serving static files from {}", dir);
    }

    loop {
        let (stream, peer_addr) = listener.accept().await?;
        let target = target_addr.clone();
        let web = web_dir.clone();

        tokio::spawn(async move {
            if let Err(e) = handle_connection(stream, peer_addr, target, web).await {
                eprintln!("Error handling connection from {}: {}", peer_addr, e);
            }
        });
    }
}

async fn handle_connection(
    stream: TcpStream,
    peer_addr: SocketAddr,
    target_addr: String,
    web_dir: Option<String>,
) -> Result<(), Box<dyn std::error::Error>> {
    println!("New connection from {}", peer_addr);

    // Peek at the request to determine if it's HTTP or WebSocket
    let mut peek_buf = [0u8; 1024];
    let n = stream.peek(&mut peek_buf).await?;
    let peek_str = std::str::from_utf8(&peek_buf[..n]).unwrap_or("");

    // Check if it's an HTTP GET request (not an upgrade to WebSocket)
    if peek_str.starts_with("GET") && !peek_str.contains("Upgrade: websocket") {
        if let Some(web_dir) = web_dir {
            return handle_http_request(stream, peer_addr, web_dir).await;
        }
    }

    // Accept WebSocket handshake
    let ws_stream = accept_async(stream).await?;
    println!("WebSocket connection established from {}", peer_addr);

    // Connect to VNC server
    let vnc_stream = TcpStream::connect(&target_addr).await?;
    println!("Connected to VNC server at {} for client {}", target_addr, peer_addr);

    // Split both streams
    let (mut ws_sink, mut ws_stream) = ws_stream.split();
    let (mut vnc_read, mut vnc_write) = vnc_stream.into_split();

    // Create tasks for bidirectional forwarding
    let ws_to_vnc = tokio::spawn(async move {
        while let Some(msg) = ws_stream.next().await {
            match msg {
                Ok(Message::Binary(data)) => {
                    if let Err(e) = vnc_write.write_all(&data).await {
                        eprintln!("Error writing to VNC: {}", e);
                        break;
                    }
                }
                Ok(Message::Close(_)) => {
                    println!("WebSocket closed by client {}", peer_addr);
                    break;
                }
                Ok(Message::Ping(_)) => {
                    // Will be handled by the library automatically
                    continue;
                }
                Ok(Message::Pong(_)) => {
                    continue;
                }
                Ok(Message::Text(text)) => {
                    // noVNC shouldn't send text frames, but handle it as binary
                    if let Err(e) = vnc_write.write_all(text.as_bytes()).await {
                        eprintln!("Error writing text to VNC: {}", e);
                        break;
                    }
                }
                Ok(Message::Frame(_)) => {
                    // Raw frames are handled internally
                    continue;
                }
                Err(e) => {
                    eprintln!("WebSocket error from {}: {}", peer_addr, e);
                    break;
                }
            }
        }
    });

    let vnc_to_ws = tokio::spawn(async move {
        let mut buffer = vec![0u8; 8192];
        loop {
            match vnc_read.read(&mut buffer).await {
                Ok(0) => {
                    println!("VNC connection closed for client {}", peer_addr);
                    break;
                }
                Ok(n) => {
                    let data = &buffer[..n];
                    if let Err(e) = ws_sink.send(Message::Binary(data.to_vec())).await {
                        eprintln!("Error sending to WebSocket: {}", e);
                        break;
                    }
                }
                Err(e) => {
                    eprintln!("Error reading from VNC: {}", e);
                    break;
                }
            }
        }
        // Close WebSocket gracefully
        let _ = ws_sink.close().await;
    });

    // Wait for either task to complete
    tokio::select! {
        _ = ws_to_vnc => {
            println!("WebSocket->VNC task completed for {}", peer_addr);
        }
        _ = vnc_to_ws => {
            println!("VNC->WebSocket task completed for {}", peer_addr);
        }
    }

    Ok(())
}

async fn handle_http_request(
    mut stream: TcpStream,
    peer_addr: SocketAddr,
    web_dir: String,
) -> Result<(), Box<dyn std::error::Error>> {
    // Read the HTTP request
    let mut buf = vec![0u8; 4096];
    let n = stream.read(&mut buf).await?;

    // Parse the HTTP request
    let mut headers = [httparse::EMPTY_HEADER; 64];
    let mut req = httparse::Request::new(&mut headers);

    if req.parse(&buf[..n])?.is_complete() {
        let path = req.path.unwrap_or("/");
        println!("HTTP request from {} for path: {}", peer_addr, path);

        // Sanitize path and construct file path
        let file_path = sanitize_path(path, &web_dir)?;

        // Try to serve the file
        match tokio::fs::read(&file_path).await {
            Ok(content) => {
                let mime_type = get_mime_type(&file_path);
                let response = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: {}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                    mime_type,
                    content.len()
                );
                stream.write_all(response.as_bytes()).await?;
                stream.write_all(&content).await?;
                println!("Served file: {}", file_path.display());
            }
            Err(_) => {
                // File not found
                let response = "HTTP/1.1 404 Not Found\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\n404 Not Found\r\n";
                stream.write_all(response.as_bytes()).await?;
                println!("File not found: {}", file_path.display());
            }
        }
    }

    Ok(())
}

fn sanitize_path(path: &str, web_dir: &str) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let web_root = Path::new(web_dir);

    // Remove leading slash and query string
    let path = path.trim_start_matches('/');
    let path = path.split('?').next().unwrap_or(path);

    // Default to index.html if path is empty or ends with /
    let path = if path.is_empty() || path.ends_with('/') {
        format!("{}index.html", path)
    } else {
        path.to_string()
    };

    // Construct full path
    let full_path = web_root.join(&path);

    // Security: ensure the path doesn't escape web_root
    let canonical = full_path.canonicalize().unwrap_or(full_path.clone());
    let canonical_root = web_root.canonicalize().unwrap_or_else(|_| web_root.to_path_buf());

    if !canonical.starts_with(&canonical_root) {
        return Err("Path traversal attempt detected".into());
    }

    Ok(full_path)
}

fn get_mime_type(path: &Path) -> &'static str {
    match path.extension().and_then(|s| s.to_str()) {
        Some("html") => "text/html",
        Some("css") => "text/css",
        Some("js") => "application/javascript",
        Some("json") => "application/json",
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("svg") => "image/svg+xml",
        Some("ico") => "image/x-icon",
        Some("wasm") => "application/wasm",
        Some("ttf") => "font/ttf",
        Some("woff") => "font/woff",
        Some("woff2") => "font/woff2",
        _ => "application/octet-stream",
    }
}

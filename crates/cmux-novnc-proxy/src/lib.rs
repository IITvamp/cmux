use std::error::Error;
use std::fmt;
use std::future::Future;
use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine as _;
use futures_util::{SinkExt, StreamExt};
use hyper::header::{self, HeaderMap, HeaderValue, CONNECTION, CONTENT_TYPE, UPGRADE};
use hyper::server::conn::AddrStream;
use hyper::service::{make_service_fn, service_fn};
use hyper::{Body, Method, Request, Response, StatusCode};
use sha1::{Digest, Sha1};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::sync::Mutex;
use tokio::task::JoinHandle;
use tokio_tungstenite::tungstenite::protocol::Role;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::WebSocketStream;
use tracing::{error, info, warn};

#[derive(Clone, Debug)]
pub struct ProxyConfig {
    pub listen: SocketAddr,
    pub upstream: SocketAddr,
    pub web_root: PathBuf,
}

#[derive(Clone, Debug)]
struct AppState {
    upstream: SocketAddr,
    web_root: PathBuf,
}

#[derive(Debug)]
pub enum ProxyError {
    Io(std::io::Error),
    WebSocket(tokio_tungstenite::tungstenite::Error),
}

impl fmt::Display for ProxyError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ProxyError::Io(err) => write!(f, "IO error: {err}"),
            ProxyError::WebSocket(err) => write!(f, "WebSocket error: {err}"),
        }
    }
}

impl Error for ProxyError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            ProxyError::Io(err) => Some(err),
            ProxyError::WebSocket(err) => Some(err),
        }
    }
}

impl From<std::io::Error> for ProxyError {
    fn from(err: std::io::Error) -> Self {
        ProxyError::Io(err)
    }
}

impl From<tokio_tungstenite::tungstenite::Error> for ProxyError {
    fn from(err: tokio_tungstenite::tungstenite::Error) -> Self {
        ProxyError::WebSocket(err)
    }
}

/// Spawn the proxy and return the bound address and handle for the running server.
pub fn spawn_proxy<S>(cfg: ProxyConfig, shutdown: S) -> (SocketAddr, JoinHandle<()>)
where
    S: Future<Output = ()> + Send + 'static,
{
    let state = Arc::new(AppState {
        upstream: cfg.upstream,
        web_root: cfg.web_root,
    });

    let make_svc = make_service_fn(move |conn: &AddrStream| {
        let remote_addr = conn.remote_addr();
        let state = state.clone();
        async move {
            Ok::<_, std::convert::Infallible>(service_fn(move |req| {
                handle_request(req, state.clone(), remote_addr)
            }))
        }
    });

    let builder = hyper::Server::bind(&cfg.listen)
        .http1_only(true)
        .serve(make_svc);
    let local_addr = builder.local_addr();
    let server = builder.with_graceful_shutdown(shutdown);

    let handle = tokio::spawn(async move {
        if let Err(err) = server.await {
            error!(%err, "novnc proxy server error");
        }
    });

    (local_addr, handle)
}

async fn handle_request(
    req: Request<Body>,
    state: Arc<AppState>,
    remote_addr: SocketAddr,
) -> Result<Response<Body>, std::convert::Infallible> {
    let method = req.method().clone();
    let path = req.uri().path().to_string();

    if is_websocket_upgrade(&req) {
        match build_websocket_response(&req) {
            Ok(response) => {
                let state_clone = state.clone();
                let path_for_log = path.clone();
                let mut upgrade_req = req;
                tokio::spawn(async move {
                    match hyper::upgrade::on(&mut upgrade_req).await {
                        Ok(upgraded) => {
                            if let Err(err) =
                                proxy_websocket(upgraded, state_clone, remote_addr, path_for_log)
                                    .await
                            {
                                warn!(remote_addr = %remote_addr, error = %err, "websocket proxy terminated");
                            }
                        }
                        Err(err) => {
                            warn!(remote_addr = %remote_addr, error = %err, "failed to upgrade connection to websocket");
                        }
                    }
                });
                return Ok(response);
            }
            Err(response) => return Ok(response),
        }
    }

    let response = serve_static(&state, &method, &path).await;
    Ok(response)
}

fn is_websocket_upgrade(req: &Request<Body>) -> bool {
    if req.method() != Method::GET {
        return false;
    }

    let headers = req.headers();
    header_contains(headers, CONNECTION, "upgrade")
        && header_equals(headers, UPGRADE, "websocket")
        && headers
            .get(header::SEC_WEBSOCKET_VERSION)
            .and_then(|value| value.to_str().ok())
            .map(|v| v == "13")
            .unwrap_or(false)
        && headers.contains_key(header::SEC_WEBSOCKET_KEY)
}

fn header_contains(headers: &HeaderMap, name: header::HeaderName, needle: &str) -> bool {
    headers
        .get_all(name)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .flat_map(|value| value.split(','))
        .any(|part| part.trim().eq_ignore_ascii_case(needle))
}

fn header_equals(headers: &HeaderMap, name: header::HeaderName, expected: &str) -> bool {
    headers
        .get(name)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.eq_ignore_ascii_case(expected))
        .unwrap_or(false)
}

fn build_websocket_response(req: &Request<Body>) -> Result<Response<Body>, Response<Body>> {
    let key = match req.headers().get(header::SEC_WEBSOCKET_KEY) {
        Some(value) => match value.to_str() {
            Ok(v) if !v.trim().is_empty() => v.trim(),
            _ => {
                return Err(response_with(
                    StatusCode::BAD_REQUEST,
                    "invalid Sec-WebSocket-Key",
                ));
            }
        },
        None => {
            return Err(response_with(
                StatusCode::BAD_REQUEST,
                "missing Sec-WebSocket-Key header",
            ));
        }
    };

    let accept = compute_websocket_accept(key);

    let mut builder = Response::builder()
        .status(StatusCode::SWITCHING_PROTOCOLS)
        .header(CONNECTION, "Upgrade")
        .header(UPGRADE, "websocket")
        .header(header::SEC_WEBSOCKET_ACCEPT, accept);

    if let Some(protocol) = req.headers().get(header::SEC_WEBSOCKET_PROTOCOL) {
        builder = builder.header(header::SEC_WEBSOCKET_PROTOCOL, protocol);
    }

    builder.body(Body::empty()).map_err(|_| {
        response_with(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to build response",
        )
    })
}

fn compute_websocket_accept(key: &str) -> String {
    let mut hasher = Sha1::new();
    hasher.update(key.as_bytes());
    hasher.update(b"258EAFA5-E914-47DA-95CA-C5AB0DC85B11");
    let digest = hasher.finalize();
    BASE64_STANDARD.encode(digest)
}

async fn proxy_websocket(
    upgraded: hyper::upgrade::Upgraded,
    state: Arc<AppState>,
    remote_addr: SocketAddr,
    path: String,
) -> Result<(), ProxyError> {
    info!(remote_addr = %remote_addr, ?path, upstream = %state.upstream, "accepted websocket connection");

    let upstream = TcpStream::connect(state.upstream).await?;
    upstream.set_nodelay(true)?;

    let ws_stream = WebSocketStream::from_raw_socket(upgraded, Role::Server, None).await;
    let (ws_sink, ws_stream_reader) = ws_stream.split();
    let ws_sink = Arc::new(Mutex::new(ws_sink));
    let (mut tcp_reader, mut tcp_writer) = upstream.into_split();

    let ws_to_tcp = {
        let ws_sink = ws_sink.clone();
        async move {
            let mut reader = ws_stream_reader;
            while let Some(message) = reader.next().await {
                match message? {
                    Message::Binary(data) => {
                        tcp_writer.write_all(&data).await?;
                    }
                    Message::Text(text) => {
                        tcp_writer.write_all(text.as_bytes()).await?;
                    }
                    Message::Ping(payload) => {
                        let mut sink = ws_sink.lock().await;
                        sink.send(Message::Pong(payload)).await?;
                    }
                    Message::Pong(_) => {}
                    Message::Close(frame) => {
                        tcp_writer.shutdown().await.ok();
                        let mut sink = ws_sink.lock().await;
                        let _ = sink.send(Message::Close(frame)).await;
                        break;
                    }
                    other => {
                        warn!(remote_addr = %remote_addr, kind = ?other, "unexpected websocket message");
                    }
                }
            }
            Ok::<(), ProxyError>(())
        }
    };

    let tcp_to_ws = {
        let ws_sink = ws_sink.clone();
        async move {
            let mut buf = [0u8; 16 * 1024];
            loop {
                let read = tcp_reader.read(&mut buf).await?;
                if read == 0 {
                    let mut sink = ws_sink.lock().await;
                    let _ = sink.close().await;
                    break;
                }
                let mut sink = ws_sink.lock().await;
                sink.send(Message::Binary(buf[..read].to_vec())).await?;
            }
            Ok::<(), ProxyError>(())
        }
    };

    tokio::select! {
        ws = ws_to_tcp => ws?,
        tcp = tcp_to_ws => tcp?,
    };

    info!(remote_addr = %remote_addr, "connection closed");
    Ok(())
}

async fn serve_static(state: &AppState, method: &Method, uri_path: &str) -> Response<Body> {
    if *method != Method::GET && *method != Method::HEAD {
        return response_with(StatusCode::METHOD_NOT_ALLOWED, "method not allowed");
    }

    let resolved = match resolve_path(&state.web_root, uri_path) {
        Some(path) => path,
        None => return response_with(StatusCode::NOT_FOUND, "not found"),
    };

    let path = match tokio::fs::metadata(&resolved).await {
        Ok(metadata) => {
            if metadata.is_dir() {
                resolved.join("index.html")
            } else {
                resolved
            }
        }
        Err(_) => return response_with(StatusCode::NOT_FOUND, "not found"),
    };

    match tokio::fs::read(&path).await {
        Ok(bytes) => {
            let len = bytes.len();
            let body = if *method == Method::HEAD {
                Body::empty()
            } else {
                Body::from(bytes)
            };

            let mut response = Response::new(body);
            let headers = response.headers_mut();
            headers.insert(
                CONTENT_TYPE,
                HeaderValue::from_static(content_type_for(&path)),
            );
            headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-cache"));
            headers.insert(header::PRAGMA, HeaderValue::from_static("no-cache"));
            headers.insert(
                header::EXPIRES,
                HeaderValue::from_static("Thu, 01 Jan 1970 00:00:00 GMT"),
            );
            if *method == Method::HEAD {
                if let Ok(value) = HeaderValue::from_str(&len.to_string()) {
                    headers.insert(header::CONTENT_LENGTH, value);
                }
            }
            response
        }
        Err(err) => {
            warn!(path = %path.display(), error = %err, "failed to read static file");
            response_with(StatusCode::INTERNAL_SERVER_ERROR, "failed to read file")
        }
    }
}

fn resolve_path(web_root: &Path, uri_path: &str) -> Option<PathBuf> {
    let decoded = percent_decode(uri_path)?;
    let mut components = Vec::new();
    for segment in decoded.split('/') {
        if segment.is_empty() || segment == "." {
            continue;
        }
        if segment == ".." {
            return None;
        }
        components.push(segment);
    }

    let mut path = PathBuf::new();
    for segment in components {
        path.push(segment);
    }

    if uri_path.ends_with('/') || path.as_os_str().is_empty() {
        path.push("index.html");
    }

    Some(web_root.join(path))
}

fn percent_decode(input: &str) -> Option<String> {
    let mut output = String::with_capacity(input.len());
    let bytes = input.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'%' => {
                if i + 2 >= bytes.len() {
                    return None;
                }
                let hi = bytes[i + 1];
                let lo = bytes[i + 2];
                let value = (hex_value(hi)? << 4) | hex_value(lo)?;
                output.push(value as char);
                i += 3;
            }
            b'+' => {
                output.push(' ');
                i += 1;
            }
            ch => {
                output.push(ch as char);
                i += 1;
            }
        }
    }
    Some(output)
}

fn hex_value(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(10 + (byte - b'a')),
        b'A'..=b'F' => Some(10 + (byte - b'A')),
        _ => None,
    }
}

fn content_type_for(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or_default()
    {
        "html" | "htm" => "text/html; charset=utf-8",
        "js" => "application/javascript",
        "css" => "text/css",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "svg" => "image/svg+xml",
        "json" => "application/json",
        "wasm" => "application/wasm",
        "map" => "application/json",
        "ico" => "image/x-icon",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "ttf" => "font/ttf",
        "txt" => "text/plain; charset=utf-8",
        _ => "application/octet-stream",
    }
}

fn response_with(status: StatusCode, body: &str) -> Response<Body> {
    Response::builder()
        .status(status)
        .body(Body::from(body.to_string()))
        .unwrap_or_else(|_| {
            Response::builder()
                .status(StatusCode::INTERNAL_SERVER_ERROR)
                .body(Body::empty())
                .unwrap()
        })
}

#[cfg(test)]
mod unit_tests {
    use super::*;

    #[test]
    fn websocket_accept_matches_rfc_example() {
        let key = "dGhlIHNhbXBsZSBub25jZQ==";
        let accept = compute_websocket_accept(key);
        assert_eq!(accept, "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=");
    }

    #[test]
    fn percent_decoding_handles_sequences() {
        assert_eq!(percent_decode("/foo%20bar"), Some("/foo bar".into()));
        assert_eq!(percent_decode("/a%2Fb"), Some("/a/b".into()));
        assert_eq!(percent_decode("/%7Euser"), Some("/~user".into()));
        assert_eq!(percent_decode("/invalid%zz"), None);
    }

    #[test]
    fn resolve_path_prevents_traversal() {
        let root = PathBuf::from("/static");
        assert_eq!(resolve_path(&root, "/"), Some(root.join("index.html")));
        assert_eq!(resolve_path(&root, "/foo"), Some(root.join("foo")));
        assert_eq!(
            resolve_path(&root, "/foo/"),
            Some(root.join("foo/index.html"))
        );
        assert_eq!(resolve_path(&root, "/../secret"), None);
    }
}

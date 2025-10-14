use std::net::SocketAddr;
use std::time::Duration;

use cmux_novnc_proxy::{spawn_proxy, ProxyConfig};
use futures_util::{SinkExt, StreamExt};
use hyper::body::to_bytes;
use hyper::{header, Body, Client, Method, Request, StatusCode};
use tempfile::tempdir;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::sync::{mpsc, oneshot};
use tokio_tungstenite::tungstenite::Message;

fn shutdown_future(
    rx: oneshot::Receiver<()>,
) -> impl std::future::Future<Output = ()> + Send + 'static {
    async move {
        let _ = rx.await;
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn websocket_bridge_round_trip() {
    let web_root = tempdir().unwrap();
    tokio::fs::write(web_root.path().join("index.html"), "ok")
        .await
        .unwrap();

    let upstream_listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let upstream_addr = upstream_listener.local_addr().unwrap();

    let (data_tx, mut data_rx) = mpsc::unbounded_channel::<Vec<u8>>();

    tokio::spawn(async move {
        if let Ok((mut socket, _peer)) = upstream_listener.accept().await {
            let mut buf = [0u8; 1024];
            if let Ok(n) = socket.read(&mut buf).await {
                data_tx.send(buf[..n].to_vec()).ok();
                let _ = socket.write_all(b"pong").await;
                tokio::time::sleep(Duration::from_millis(20)).await;
            }
        }
    });

    let (shutdown_tx, shutdown_rx) = oneshot::channel();
    let (bound_addr, handle) = spawn_proxy(
        ProxyConfig {
            listen: "127.0.0.1:0".parse::<SocketAddr>().unwrap(),
            upstream: upstream_addr,
            web_root: web_root.path().to_path_buf(),
        },
        shutdown_future(shutdown_rx),
    );

    let ws_url = format!("ws://{}/websockify", bound_addr);
    let (mut ws_stream, _) = tokio_tungstenite::connect_async(ws_url).await.unwrap();

    ws_stream
        .send(Message::Binary(b"hello".to_vec()))
        .await
        .unwrap();

    let received = data_rx.recv().await.expect("upstream received data");
    assert_eq!(received, b"hello");

    let msg = ws_stream.next().await.expect("receive from proxy").unwrap();
    match msg {
        Message::Binary(data) => assert_eq!(data, b"pong"),
        other => panic!("unexpected message: {other:?}"),
    }

    ws_stream.close(None).await.unwrap();

    shutdown_tx.send(()).ok();
    handle.await.unwrap();
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn serves_static_files() {
    let web_root = tempdir().unwrap();
    tokio::fs::write(web_root.path().join("vnc.html"), "hello vnc")
        .await
        .unwrap();

    let upstream_listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let upstream_addr = upstream_listener.local_addr().unwrap();

    let (shutdown_tx, shutdown_rx) = oneshot::channel();
    let (bound_addr, handle) = spawn_proxy(
        ProxyConfig {
            listen: "127.0.0.1:0".parse().unwrap(),
            upstream: upstream_addr,
            web_root: web_root.path().to_path_buf(),
        },
        shutdown_future(shutdown_rx),
    );

    // HTTP GET should return file contents
    let client = Client::new();
    let uri = format!("http://{}/vnc.html", bound_addr).parse().unwrap();
    let response = client.get(uri).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response).await.unwrap();
    assert_eq!(body, "hello vnc");

    // HEAD should return correct headers and empty body
    let head_uri = format!("http://{}/vnc.html", bound_addr);
    let head_request = Request::builder()
        .method(Method::HEAD)
        .uri(&head_uri)
        .body(Body::empty())
        .unwrap();
    let head_response = client.request(head_request).await.unwrap();
    assert_eq!(head_response.status(), StatusCode::OK);
    assert_eq!(
        head_response
            .headers()
            .get(header::CONTENT_LENGTH)
            .and_then(|v| v.to_str().ok()),
        Some("9")
    );

    shutdown_tx.send(()).ok();
    handle.await.unwrap();
}

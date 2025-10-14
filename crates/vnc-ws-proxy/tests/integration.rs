use std::net::SocketAddr;
use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::time::timeout;
use tokio_tungstenite::connect_async;
use tungstenite::Message;

/// Start a mock VNC server that echoes back any data it receives
async fn start_mock_vnc_server() -> (SocketAddr, tokio::task::JoinHandle<()>) {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();

    let handle = tokio::spawn(async move {
        if let Ok((mut stream, _)) = listener.accept().await {
            let mut buf = vec![0u8; 8192];
            loop {
                match stream.read(&mut buf).await {
                    Ok(0) => break,
                    Ok(n) => {
                        if stream.write_all(&buf[..n]).await.is_err() {
                            break;
                        }
                    }
                    Err(_) => break,
                }
            }
        }
    });

    (addr, handle)
}

/// Start a mock VNC server that accepts multiple connections
async fn start_mock_vnc_server_multi() -> (SocketAddr, tokio::task::JoinHandle<()>) {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();

    let handle = tokio::spawn(async move {
        loop {
            let (mut stream, _) = match listener.accept().await {
                Ok(s) => s,
                Err(_) => break,
            };
            tokio::spawn(async move {
                let mut buf = vec![0u8; 8192];
                loop {
                    match stream.read(&mut buf).await {
                        Ok(0) => break,
                        Ok(n) => {
                            if stream.write_all(&buf[..n]).await.is_err() {
                                break;
                            }
                        }
                        Err(_) => break,
                    }
                }
            });
        }
    });

    (addr, handle)
}

/// Start the VNC WebSocket proxy
async fn start_proxy(
    listen: SocketAddr,
    target: SocketAddr,
) -> (SocketAddr, tokio::task::JoinHandle<()>) {
    let listener = TcpListener::bind(listen).await.unwrap();
    let bound_addr = listener.local_addr().unwrap();

    let handle = tokio::spawn(async move {
        loop {
            match listener.accept().await {
                Ok((stream, _peer)) => {
                    tokio::spawn(async move {
                        if let Ok(ws_stream) =
                            tokio_tungstenite::accept_async(stream).await
                        {
                            if let Ok(vnc_stream) = TcpStream::connect(target).await {
                                let (ws_write, ws_read) = ws_stream.split();
                                let (mut vnc_read, mut vnc_write) = vnc_stream.into_split();

                                let ws_to_vnc_task = tokio::spawn(async move {
                                    let mut ws_read = ws_read;
                                    while let Some(Ok(msg)) = ws_read.next().await {
                                        match msg {
                                            Message::Binary(data) => {
                                                if vnc_write.write_all(&data).await.is_err() {
                                                    break;
                                                }
                                            }
                                            Message::Close(_) => break,
                                            Message::Ping(_) => {}
                                            _ => {}
                                        }
                                    }
                                    let _ = vnc_write.shutdown().await;
                                });

                                let vnc_to_ws_task = tokio::spawn(async move {
                                    let mut ws_write = ws_write;
                                    let mut buf = vec![0u8; 8192];
                                    loop {
                                        match vnc_read.read(&mut buf).await {
                                            Ok(0) => break,
                                            Ok(n) => {
                                                if ws_write
                                                    .send(Message::Binary(buf[..n].to_vec()))
                                                    .await
                                                    .is_err()
                                                {
                                                    break;
                                                }
                                            }
                                            Err(_) => break,
                                        }
                                    }
                                    let _ = ws_write.close().await;
                                });

                                let _ = tokio::join!(ws_to_vnc_task, vnc_to_ws_task);
                            }
                        }
                    });
                }
                Err(_) => break,
            }
        }
    });

    (bound_addr, handle)
}

#[tokio::test]
async fn test_basic_websocket_to_vnc_proxy() {
    // Start mock VNC server
    let (vnc_addr, _vnc_handle) = start_mock_vnc_server().await;

    // Start proxy
    let (proxy_addr, _proxy_handle) =
        start_proxy("127.0.0.1:0".parse().unwrap(), vnc_addr).await;

    // Connect WebSocket client to proxy
    let url = format!("ws://{}", proxy_addr);
    let (mut ws_stream, _) = timeout(Duration::from_secs(5), connect_async(url))
        .await
        .expect("connect timeout")
        .expect("connect failed");

    // Send binary data through WebSocket
    let test_data = b"Hello VNC Server!";
    ws_stream
        .send(Message::Binary(test_data.to_vec()))
        .await
        .unwrap();

    // Receive echoed data
    let response = timeout(Duration::from_secs(5), ws_stream.next())
        .await
        .expect("response timeout")
        .unwrap()
        .unwrap();

    assert!(response.is_binary());
    assert_eq!(response.into_data(), test_data);

    // Close connection
    ws_stream.close(None).await.ok();
}

#[tokio::test]
async fn test_multiple_messages() {
    let (vnc_addr, _vnc_handle) = start_mock_vnc_server().await;
    let (proxy_addr, _proxy_handle) =
        start_proxy("127.0.0.1:0".parse().unwrap(), vnc_addr).await;

    let url = format!("ws://{}", proxy_addr);
    let (mut ws_stream, _) = timeout(Duration::from_secs(5), connect_async(url))
        .await
        .expect("connect timeout")
        .expect("connect failed");

    // Send multiple messages
    for i in 0..10 {
        let test_data = format!("Message {}", i);
        ws_stream
            .send(Message::Binary(test_data.as_bytes().to_vec()))
            .await
            .unwrap();

        let response = timeout(Duration::from_secs(5), ws_stream.next())
            .await
            .expect("response timeout")
            .unwrap()
            .unwrap();

        assert!(response.is_binary());
        assert_eq!(response.into_data(), test_data.as_bytes());
    }

    ws_stream.close(None).await.ok();
}

#[tokio::test]
async fn test_large_binary_data() {
    let (vnc_addr, _vnc_handle) = start_mock_vnc_server().await;
    let (proxy_addr, _proxy_handle) =
        start_proxy("127.0.0.1:0".parse().unwrap(), vnc_addr).await;

    let url = format!("ws://{}", proxy_addr);
    let (mut ws_stream, _) = timeout(Duration::from_secs(5), connect_async(url))
        .await
        .expect("connect timeout")
        .expect("connect failed");

    // Send large binary data (simulating VNC framebuffer update)
    let large_data: Vec<u8> = (0..65536).map(|i| (i % 256) as u8).collect();
    ws_stream
        .send(Message::Binary(large_data.clone()))
        .await
        .unwrap();

    let response = timeout(Duration::from_secs(5), ws_stream.next())
        .await
        .expect("response timeout")
        .unwrap()
        .unwrap();

    assert!(response.is_binary());
    assert_eq!(response.into_data(), large_data);

    ws_stream.close(None).await.ok();
}

#[tokio::test]
async fn test_ping_pong() {
    let (vnc_addr, _vnc_handle) = start_mock_vnc_server().await;
    let (proxy_addr, _proxy_handle) =
        start_proxy("127.0.0.1:0".parse().unwrap(), vnc_addr).await;

    let url = format!("ws://{}", proxy_addr);
    let (mut ws_stream, _) = timeout(Duration::from_secs(5), connect_async(url))
        .await
        .expect("connect timeout")
        .expect("connect failed");

    // Send ping
    let ping_data = b"ping".to_vec();
    ws_stream.send(Message::Ping(ping_data.clone())).await.unwrap();

    // Expect pong response
    let response = timeout(Duration::from_secs(5), ws_stream.next())
        .await
        .expect("pong timeout")
        .unwrap()
        .unwrap();

    assert!(matches!(response, Message::Pong(data) if data == ping_data));

    ws_stream.close(None).await.ok();
}

#[tokio::test]
async fn test_concurrent_connections() {
    let (vnc_addr, vnc_handle) = start_mock_vnc_server_multi().await;
    let (proxy_addr, _proxy_handle) =
        start_proxy("127.0.0.1:0".parse().unwrap(), vnc_addr).await;

    let mut tasks = Vec::new();
    for i in 0..10 {
        let proxy_addr = proxy_addr;
        tasks.push(tokio::spawn(async move {
            let url = format!("ws://{}", proxy_addr);
            let (mut ws_stream, _) = timeout(Duration::from_secs(5), connect_async(url))
                .await
                .expect("connect timeout")
                .expect("connect failed");

            let test_data = format!("Connection {}", i);
            ws_stream
                .send(Message::Binary(test_data.as_bytes().to_vec()))
                .await
                .unwrap();

            let response = timeout(Duration::from_secs(5), ws_stream.next())
                .await
                .expect("response timeout")
                .unwrap()
                .unwrap();

            assert!(response.is_binary());
            assert_eq!(response.into_data(), test_data.as_bytes());

            ws_stream.close(None).await.ok();
        }));
    }

    for task in tasks {
        task.await.unwrap();
    }

    vnc_handle.abort();
}

#[tokio::test]
async fn test_vnc_server_closes_connection() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let vnc_addr = listener.local_addr().unwrap();

    // VNC server that closes immediately after accepting
    let vnc_handle = tokio::spawn(async move {
        if let Ok((stream, _)) = listener.accept().await {
            drop(stream); // Close immediately
        }
    });

    let (proxy_addr, _proxy_handle) =
        start_proxy("127.0.0.1:0".parse().unwrap(), vnc_addr).await;

    let url = format!("ws://{}", proxy_addr);
    let (mut ws_stream, _) = timeout(Duration::from_secs(5), connect_async(url))
        .await
        .expect("connect timeout")
        .expect("connect failed");

    // WebSocket should close when VNC closes
    let response = timeout(Duration::from_secs(5), ws_stream.next()).await;

    assert!(
        response.is_ok(),
        "Should receive close or end of stream"
    );

    vnc_handle.await.ok();
}

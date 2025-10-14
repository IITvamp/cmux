use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};
use futures_util::{SinkExt, StreamExt};
use std::time::Duration;

/// Mock VNC server for testing
async fn mock_vnc_server(port: u16) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let listener = TcpListener::bind(format!("127.0.0.1:{}", port))
            .await
            .expect("Failed to bind mock VNC server");

        while let Ok((mut socket, _)) = listener.accept().await {
            tokio::spawn(async move {
                let mut buf = vec![0u8; 1024];

                // Read client data and echo it back (simple VNC mock)
                while let Ok(n) = socket.read(&mut buf).await {
                    if n == 0 {
                        break;
                    }

                    // Echo the data back
                    if socket.write_all(&buf[..n]).await.is_err() {
                        break;
                    }
                }
            });
        }
    })
}

/// Start the proxy in a separate task
async fn start_proxy(listen_port: u16, target_port: u16) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let listener = TcpListener::bind(format!("127.0.0.1:{}", listen_port))
            .await
            .expect("Failed to bind proxy");

        while let Ok((stream, _peer_addr)) = listener.accept().await {
            let target_addr = format!("127.0.0.1:{}", target_port);

            tokio::spawn(async move {
                // Accept WebSocket handshake
                let ws_stream = match tokio_tungstenite::accept_async(stream).await {
                    Ok(ws) => ws,
                    Err(_) => return,
                };

                // Connect to VNC server
                let vnc_stream = match TcpStream::connect(&target_addr).await {
                    Ok(s) => s,
                    Err(_) => return,
                };

                // Split both streams
                let (mut ws_sink, mut ws_stream) = ws_stream.split();
                let (mut vnc_read, mut vnc_write) = vnc_stream.into_split();

                // Create tasks for bidirectional forwarding
                let ws_to_vnc = tokio::spawn(async move {
                    while let Some(msg) = ws_stream.next().await {
                        match msg {
                            Ok(Message::Binary(data)) => {
                                if vnc_write.write_all(&data).await.is_err() {
                                    break;
                                }
                            }
                            Ok(Message::Close(_)) => {
                                break;
                            }
                            Ok(Message::Text(text)) => {
                                if vnc_write.write_all(text.as_bytes()).await.is_err() {
                                    break;
                                }
                            }
                            _ => continue,
                        }
                    }
                });

                let vnc_to_ws = tokio::spawn(async move {
                    let mut buffer = vec![0u8; 8192];
                    loop {
                        match vnc_read.read(&mut buffer).await {
                            Ok(0) => break,
                            Ok(n) => {
                                let data = &buffer[..n];
                                if ws_sink.send(Message::Binary(data.to_vec())).await.is_err() {
                                    break;
                                }
                            }
                            Err(_) => break,
                        }
                    }
                    let _ = ws_sink.close().await;
                });

                tokio::select! {
                    _ = ws_to_vnc => {}
                    _ = vnc_to_ws => {}
                }
            });
        }
    })
}

#[tokio::test]
async fn test_websocket_to_tcp_proxy() {
    // Use unique ports for this test
    let vnc_port = 15901;
    let proxy_port = 18080;

    // Start mock VNC server
    let _vnc_server = mock_vnc_server(vnc_port).await;
    tokio::time::sleep(Duration::from_millis(100)).await;

    // Start proxy
    let _proxy = start_proxy(proxy_port, vnc_port).await;
    tokio::time::sleep(Duration::from_millis(100)).await;

    // Connect WebSocket client to proxy
    let ws_url = format!("ws://127.0.0.1:{}", proxy_port);
    let (ws_stream, _) = connect_async(&ws_url)
        .await
        .expect("Failed to connect to proxy");

    let (mut write, mut read) = ws_stream.split();

    // Send test data
    let test_data = b"Hello VNC Server!";
    write
        .send(Message::Binary(test_data.to_vec()))
        .await
        .expect("Failed to send message");

    // Receive echoed data
    let response = tokio::time::timeout(Duration::from_secs(2), read.next())
        .await
        .expect("Timeout waiting for response")
        .expect("No message received")
        .expect("Error receiving message");

    if let Message::Binary(data) = response {
        assert_eq!(data, test_data, "Received data doesn't match sent data");
    } else {
        panic!("Expected binary message");
    }

    // Close connection
    write.send(Message::Close(None)).await.ok();
}

#[tokio::test]
async fn test_multiple_connections() {
    let vnc_port = 15902;
    let proxy_port = 18081;

    // Start mock VNC server
    let _vnc_server = mock_vnc_server(vnc_port).await;
    tokio::time::sleep(Duration::from_millis(100)).await;

    // Start proxy
    let _proxy = start_proxy(proxy_port, vnc_port).await;
    tokio::time::sleep(Duration::from_millis(100)).await;

    // Create multiple connections
    let mut handles = vec![];

    for i in 0..5 {
        let ws_url = format!("ws://127.0.0.1:{}", proxy_port);
        let handle = tokio::spawn(async move {
            let (ws_stream, _) = connect_async(&ws_url)
                .await
                .expect("Failed to connect to proxy");

            let (mut write, mut read) = ws_stream.split();

            // Send unique test data
            let test_data = format!("Test message {}", i);
            write
                .send(Message::Binary(test_data.as_bytes().to_vec()))
                .await
                .expect("Failed to send message");

            // Receive echoed data
            let response = tokio::time::timeout(Duration::from_secs(2), read.next())
                .await
                .expect("Timeout waiting for response")
                .expect("No message received")
                .expect("Error receiving message");

            if let Message::Binary(data) = response {
                assert_eq!(
                    String::from_utf8_lossy(&data),
                    test_data,
                    "Received data doesn't match sent data"
                );
            } else {
                panic!("Expected binary message");
            }

            // Close connection
            write.send(Message::Close(None)).await.ok();
        });

        handles.push(handle);
    }

    // Wait for all connections to complete
    for handle in handles {
        handle.await.expect("Connection task failed");
    }
}

#[tokio::test]
async fn test_large_data_transfer() {
    let vnc_port = 15903;
    let proxy_port = 18082;

    // Start mock VNC server
    let _vnc_server = mock_vnc_server(vnc_port).await;
    tokio::time::sleep(Duration::from_millis(100)).await;

    // Start proxy
    let _proxy = start_proxy(proxy_port, vnc_port).await;
    tokio::time::sleep(Duration::from_millis(100)).await;

    // Connect WebSocket client to proxy
    let ws_url = format!("ws://127.0.0.1:{}", proxy_port);
    let (ws_stream, _) = connect_async(&ws_url)
        .await
        .expect("Failed to connect to proxy");

    let (mut write, mut read) = ws_stream.split();

    // Send large data (simulate VNC framebuffer)
    let large_data = vec![42u8; 64 * 1024]; // 64KB
    write
        .send(Message::Binary(large_data.clone()))
        .await
        .expect("Failed to send large message");

    // Receive echoed data (may come in multiple chunks)
    let mut received_data = Vec::new();
    let timeout_duration = Duration::from_secs(5);
    let start = std::time::Instant::now();

    while received_data.len() < large_data.len() && start.elapsed() < timeout_duration {
        if let Ok(Some(Ok(Message::Binary(data)))) =
            tokio::time::timeout(Duration::from_millis(100), read.next()).await
        {
            received_data.extend_from_slice(&data);
        }
    }

    assert_eq!(
        received_data.len(),
        large_data.len(),
        "Data size mismatch"
    );
    assert_eq!(received_data, large_data, "Large data doesn't match");

    // Close connection
    write.send(Message::Close(None)).await.ok();
}

#[tokio::test]
async fn test_connection_cleanup() {
    let vnc_port = 15904;
    let proxy_port = 18083;

    // Start mock VNC server
    let _vnc_server = mock_vnc_server(vnc_port).await;
    tokio::time::sleep(Duration::from_millis(100)).await;

    // Start proxy
    let _proxy = start_proxy(proxy_port, vnc_port).await;
    tokio::time::sleep(Duration::from_millis(100)).await;

    // Connect and immediately disconnect
    let ws_url = format!("ws://127.0.0.1:{}", proxy_port);
    let (ws_stream, _) = connect_async(&ws_url)
        .await
        .expect("Failed to connect to proxy");

    let (mut write, _read) = ws_stream.split();

    // Close connection immediately
    write.send(Message::Close(None)).await.ok();

    tokio::time::sleep(Duration::from_millis(200)).await;

    // Try another connection to verify cleanup
    let (ws_stream2, _) = connect_async(&ws_url)
        .await
        .expect("Failed to connect after cleanup");

    let (mut write2, _) = ws_stream2.split();
    write2.send(Message::Close(None)).await.ok();
}

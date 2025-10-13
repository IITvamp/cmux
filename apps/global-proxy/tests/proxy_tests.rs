use std::{
    net::{Ipv4Addr, SocketAddr},
    sync::Arc,
    time::Duration,
};

use futures_util::{SinkExt, StreamExt};
use global_proxy::{ProxyConfig, spawn_proxy};
use hyper::{
    Body, Request, Response, Server, StatusCode,
    service::{make_service_fn, service_fn},
};
use reqwest::Method;
use tokio::{sync::oneshot, task::JoinHandle};
use tokio_tungstenite::tungstenite::{Message, client::IntoClientRequest};

struct TestProxy {
    addr: SocketAddr,
    handle: Option<global_proxy::ProxyHandle>,
    client: reqwest::Client,
}

impl TestProxy {
    async fn spawn() -> Self {
        let mut config = ProxyConfig::default();
        config.bind_addr = SocketAddr::from((Ipv4Addr::LOCALHOST, 0));
        config.backend_host = "127.0.0.1".to_string();

        let handle = spawn_proxy(config).await.expect("failed to start proxy");

        let client = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .timeout(Duration::from_secs(5))
            .build()
            .expect("client");

        Self {
            addr: handle.addr,
            handle: Some(handle),
            client,
        }
    }

    fn url(&self, path: &str) -> String {
        format!("http://{}{}", self.addr, path)
    }

    async fn request(
        &self,
        method: Method,
        host: &str,
        path: &str,
        headers: &[(&str, &str)],
    ) -> reqwest::Response {
        let mut request = self.client.request(method, self.url(path));
        request = request.header("Host", host);
        for (name, value) in headers {
            request = request.header(*name, *value);
        }
        request.send().await.expect("request")
    }

    async fn shutdown(mut self) {
        if let Some(handle) = self.handle.take() {
            handle.shutdown().await;
        }
    }
}

struct TestHttpBackend {
    addr: SocketAddr,
    shutdown: Option<oneshot::Sender<()>>,
    task: JoinHandle<()>,
}

impl TestHttpBackend {
    async fn serve(
        handler: Arc<dyn Fn(Request<Body>) -> Response<Body> + Send + Sync + 'static>,
    ) -> Self {
        let listener = std::net::TcpListener::bind(SocketAddr::from((Ipv4Addr::LOCALHOST, 0)))
            .expect("bind backend");
        listener.set_nonblocking(true).expect("set nonblocking");
        let addr = listener.local_addr().expect("local addr");

        let make_svc = make_service_fn(move |_conn| {
            let handler = handler.clone();
            async move {
                Ok::<_, hyper::Error>(service_fn(move |req: Request<Body>| {
                    let handler = handler.clone();
                    async move { Ok::<_, hyper::Error>((handler)(req)) }
                }))
            }
        });

        let server = Server::from_tcp(listener)
            .expect("server from tcp")
            .serve(make_svc);
        let (tx, rx) = oneshot::channel();
        let task = tokio::spawn(async move {
            let server = server.with_graceful_shutdown(async {
                let _ = rx.await;
            });
            if let Err(err) = server.await {
                eprintln!("backend server error: {err}");
            }
        });

        Self {
            addr,
            shutdown: Some(tx),
            task,
        }
    }

    async fn serve_on_port(
        port: u16,
        handler: Arc<dyn Fn(Request<Body>) -> Response<Body> + Send + Sync + 'static>,
    ) -> Self {
        let listener = std::net::TcpListener::bind(SocketAddr::from((Ipv4Addr::LOCALHOST, port)))
            .expect("bind backend on port");
        listener.set_nonblocking(true).expect("set nonblocking");
        let addr = listener.local_addr().expect("local addr");

        let make_svc = make_service_fn(move |_conn| {
            let handler = handler.clone();
            async move {
                Ok::<_, hyper::Error>(service_fn(move |req: Request<Body>| {
                    let handler = handler.clone();
                    async move { Ok::<_, hyper::Error>((handler)(req)) }
                }))
            }
        });

        let server = Server::from_tcp(listener)
            .expect("server from tcp")
            .serve(make_svc);
        let (tx, rx) = oneshot::channel();
        let task = tokio::spawn(async move {
            let server = server.with_graceful_shutdown(async {
                let _ = rx.await;
            });
            if let Err(err) = server.await {
                eprintln!("backend server error: {err}");
            }
        });

        Self {
            addr,
            shutdown: Some(tx),
            task,
        }
    }

    fn port(&self) -> u16 {
        self.addr.port()
    }

    async fn shutdown(mut self) {
        if let Some(tx) = self.shutdown.take() {
            let _ = tx.send(());
        }
        let _ = self.task.await;
    }
}

struct TestWsBackend {
    addr: SocketAddr,
    shutdown: Option<oneshot::Sender<()>>,
    task: JoinHandle<()>,
}

impl TestWsBackend {
    async fn spawn_echo() -> Self {
        let listener = tokio::net::TcpListener::bind(SocketAddr::from((Ipv4Addr::LOCALHOST, 0)))
            .await
            .expect("ws bind");
        let addr = listener.local_addr().expect("ws addr");
        let (tx, mut rx) = oneshot::channel();

        let task = tokio::spawn(async move {
            loop {
                tokio::select! {
                    _ = &mut rx => break,
                    accept = listener.accept() => {
                        match accept {
                            Ok((stream, _)) => {
                                tokio::spawn(async move {
                                    match tokio_tungstenite::accept_async(stream).await {
                                        Ok(mut ws) => {
                                            while let Some(msg) = ws.next().await {
                                                match msg {
                                                    Ok(Message::Text(text)) => {
                                                        if ws.send(Message::Text(text)).await.is_err() {
                                                            break;
                                                        }
                                                    }
                                                    Ok(Message::Binary(bin)) => {
                                                        if ws.send(Message::Binary(bin)).await.is_err() {
                                                            break;
                                                        }
                                                    }
                                                    Ok(Message::Ping(data)) => {
                                                        let _ = ws.send(Message::Pong(data)).await;
                                                    }
                                                    Ok(Message::Pong(_)) => {}
                                                    Ok(Message::Frame(frame)) => {
                                                        if ws.send(Message::Frame(frame)).await.is_err() {
                                                            break;
                                                        }
                                                    }
                                                    Ok(Message::Close(frame)) => {
                                                        let _ = ws.close(frame).await;
                                                        break;
                                                    }
                                                    Err(_) => break,
                                                }
                                            }
                                        }
                                        Err(err) => eprintln!("ws accept error: {err}"),
                                    }
                                });
                            }
                            Err(err) => {
                                eprintln!("ws accept error: {err}");
                                break;
                            }
                        }
                    }
                }
            }
        });

        Self {
            addr,
            shutdown: Some(tx),
            task,
        }
    }

    fn port(&self) -> u16 {
        self.addr.port()
    }

    async fn shutdown(mut self) {
        if let Some(tx) = self.shutdown.take() {
            let _ = tx.send(());
        }
        let _ = self.task.await;
    }
}

#[tokio::test]
async fn health_check() {
    let proxy = TestProxy::spawn().await;

    let response = proxy
        .request(Method::GET, "localhost", "/health", &[])
        .await;
    assert_eq!(response.status(), StatusCode::OK);
    let json: serde_json::Value = response.json().await.expect("json");
    assert_eq!(json["status"], "healthy");

    proxy.shutdown().await;
}

#[tokio::test]
async fn apex_returns_greeting() {
    let proxy = TestProxy::spawn().await;

    let response = proxy.request(Method::GET, "cmux.sh", "/", &[]).await;
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.text().await.expect("text"), "cmux!");

    proxy.shutdown().await;
}

#[tokio::test]
async fn service_worker_route() {
    let proxy = TestProxy::spawn().await;

    let response = proxy
        .request(Method::GET, "port-8080-test.cmux.sh", "/proxy-sw.js", &[])
        .await;
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response
            .headers()
            .get("content-type")
            .and_then(|v| v.to_str().ok()),
        Some("application/javascript")
    );
    let body = response.text().await.expect("body");
    assert!(body.contains("addEventListener"));
    assert!(body.contains("isLoopbackHostname"));

    proxy.shutdown().await;
}

#[tokio::test]
async fn port_options_preflight() {
    let proxy = TestProxy::spawn().await;

    let response = proxy
        .request(Method::OPTIONS, "port-39378-test.cmux.sh", "/", &[])
        .await;
    assert_eq!(response.status(), StatusCode::NO_CONTENT);
    assert_eq!(
        response
            .headers()
            .get("access-control-allow-origin")
            .and_then(|v| v.to_str().ok()),
        Some("https://cmux.sh")
    );

    proxy.shutdown().await;
}

#[tokio::test]
async fn port_loop_detection() {
    let proxy = TestProxy::spawn().await;

    let response = proxy
        .request(
            Method::GET,
            "port-8080-test.cmux.sh",
            "/",
            &[("X-Cmux-Proxied", "true")],
        )
        .await;
    assert_eq!(response.status(), StatusCode::LOOP_DETECTED);
    assert_eq!(
        response.text().await.expect("text"),
        "Loop detected in proxy"
    );

    proxy.shutdown().await;
}

#[tokio::test]
async fn port_head_request_passes_validation() {
    let proxy = TestProxy::spawn().await;

    let response = proxy
        .request(Method::HEAD, "port-8080-j2z9smmu.cmux.sh", "/test", &[])
        .await;
    assert_ne!(response.status(), StatusCode::BAD_REQUEST);
    assert_ne!(response.status(), StatusCode::LOOP_DETECTED);

    proxy.shutdown().await;
}

#[tokio::test]
async fn cmux_subdomain_validation() {
    let proxy = TestProxy::spawn().await;

    let invalid = proxy
        .request(Method::GET, "cmux-test.cmux.sh", "/", &[])
        .await;
    assert_eq!(invalid.status(), StatusCode::BAD_REQUEST);
    assert_eq!(
        invalid.text().await.expect("text"),
        "Invalid cmux proxy subdomain"
    );

    let invalid_port = proxy
        .request(Method::GET, "cmux-test-abc.cmux.sh", "/", &[])
        .await;
    assert_eq!(invalid_port.status(), StatusCode::BAD_REQUEST);
    assert_eq!(
        invalid_port.text().await.expect("text"),
        "Invalid port in cmux proxy subdomain"
    );

    proxy.shutdown().await;
}

#[tokio::test]
async fn cmux_head_request_validation() {
    let proxy = TestProxy::spawn().await;

    let response = proxy
        .request(Method::HEAD, "cmux-j2z9smmu-8080.cmux.sh", "/test", &[])
        .await;
    assert_ne!(response.status(), StatusCode::BAD_REQUEST);
    assert_ne!(response.status(), StatusCode::LOOP_DETECTED);

    proxy.shutdown().await;
}

#[tokio::test]
async fn cmux_domain_header_with_port_is_parsed() {
    let proxy = TestProxy::spawn().await;

    let response = proxy
        .request(
            Method::HEAD,
            "cmux-uopbmezr-39378.cmux.localhost:8090",
            "/",
            &[],
        )
        .await;
    assert_ne!(response.status(), StatusCode::BAD_REQUEST);
    assert_ne!(response.status(), StatusCode::LOOP_DETECTED);

    proxy.shutdown().await;
}

#[tokio::test]
async fn cmux_base_scope_validation() {
    let proxy = TestProxy::spawn().await;

    let response = proxy
        .request(Method::HEAD, "cmux-test-base-8080.cmux.sh", "/", &[])
        .await;
    assert_ne!(response.status(), StatusCode::BAD_REQUEST);

    proxy.shutdown().await;
}

#[tokio::test]
async fn cmux_loop_detection() {
    let proxy = TestProxy::spawn().await;

    let response = proxy
        .request(
            Method::GET,
            "cmux-test-8080.cmux.sh",
            "/",
            &[("X-Cmux-Proxied", "true")],
        )
        .await;
    assert_eq!(response.status(), StatusCode::LOOP_DETECTED);
    assert_eq!(
        response.text().await.expect("text"),
        "Loop detected in proxy"
    );

    proxy.shutdown().await;
}

#[tokio::test]
async fn workspace_subdomain_validation() {
    let proxy = TestProxy::spawn().await;

    let invalid = proxy
        .request(Method::GET, "test-8080.cmux.sh", "/", &[])
        .await;
    assert_eq!(invalid.status(), StatusCode::BAD_REQUEST);
    assert_eq!(
        invalid.text().await.expect("text"),
        "Invalid cmux subdomain"
    );

    let invalid_port = proxy
        .request(Method::GET, "workspace-abc-vmslug.cmux.sh", "/", &[])
        .await;
    assert_eq!(invalid_port.status(), StatusCode::BAD_REQUEST);
    assert_eq!(
        invalid_port.text().await.expect("text"),
        "Invalid port in subdomain"
    );

    proxy.shutdown().await;
}

#[tokio::test]
async fn workspace_head_validation() {
    let proxy = TestProxy::spawn().await;

    let response = proxy
        .request(
            Method::HEAD,
            "my-workspace-8080-vmslug.cmux.sh",
            "/test",
            &[],
        )
        .await;
    assert_ne!(response.status(), StatusCode::BAD_REQUEST);
    assert_ne!(response.status(), StatusCode::LOOP_DETECTED);

    proxy.shutdown().await;
}

#[tokio::test]
async fn workspace_loop_detection() {
    let proxy = TestProxy::spawn().await;

    let response = proxy
        .request(
            Method::GET,
            "workspace-8080-vmslug.cmux.sh",
            "/",
            &[("X-Cmux-Proxied", "true")],
        )
        .await;
    assert_eq!(response.status(), StatusCode::LOOP_DETECTED);
    assert_eq!(
        response.text().await.expect("text"),
        "Loop detected in proxy"
    );

    proxy.shutdown().await;
}

#[tokio::test]
async fn html_responses_inject_scripts() {
    let backend = TestHttpBackend::serve(Arc::new(|_req| {
        Response::builder()
            .status(StatusCode::OK)
            .header("content-type", "text/html")
            .body(Body::from(
                "<html><head><title>Demo</title></head><body>Hello</body></html>",
            ))
            .unwrap()
    }))
    .await;

    let proxy = TestProxy::spawn().await;
    let host = format!("port-{}-test.cmux.sh", backend.port());

    let response = proxy.request(Method::GET, &host, "/", &[]).await;
    assert_eq!(response.status(), StatusCode::OK);
    let body = response.text().await.expect("body");
    assert!(
        body.contains("window.__cmuxLocation"),
        "missing location script"
    );
    assert!(
        body.contains("navigator.serviceWorker.register"),
        "missing service worker script"
    );

    proxy.shutdown().await;
    backend.shutdown().await;
}

#[tokio::test]
async fn html_responses_skip_service_worker_for_cmux_route() {
    let backend = TestHttpBackend::serve(Arc::new(|_req| {
        Response::builder()
            .status(StatusCode::OK)
            .header("content-type", "text/html")
            .body(Body::from(
                "<html><head><title>Demo</title></head><body>Hello</body></html>",
            ))
            .unwrap()
    }))
    .await;

    let proxy = TestProxy::spawn().await;
    let host = format!("cmux-demo-{}.cmux.sh", backend.port());

    let response = proxy.request(Method::GET, &host, "/", &[]).await;
    assert_eq!(response.status(), StatusCode::OK);
    let body = response.text().await.expect("body");
    assert!(body.contains("window.__cmuxLocation"));
    assert!(
        !body.contains("navigator.serviceWorker.register"),
        "service worker script should be skipped"
    );

    proxy.shutdown().await;
    backend.shutdown().await;
}

#[tokio::test]
async fn port_39378_applies_cors_and_csp() {
    let handler = Arc::new(|_req| {
        Response::builder()
            .status(StatusCode::OK)
            .header("content-type", "text/html")
            .header("content-security-policy", "frame-ancestors 'none';")
            .body(Body::from("<html><head></head><body>ok</body></html>"))
            .unwrap()
    });

    let backend = TestHttpBackend::serve_on_port(39_378, handler).await;
    let proxy = TestProxy::spawn().await;

    let response = proxy
        .request(
            Method::GET,
            "port-39378-test.cmux.localhost",
            "/",
            &[("Origin", "https://cmux.dev")],
        )
        .await;

    assert_eq!(response.status(), StatusCode::OK);
    let headers = response.headers();
    assert_eq!(
        headers
            .get("access-control-allow-origin")
            .and_then(|v| v.to_str().ok()),
        Some("https://cmux.dev")
    );
    assert_eq!(
        headers
            .get("content-security-policy")
            .and_then(|v| v.to_str().ok()),
        Some(
            "frame-ancestors 'self' https://cmux.local http://cmux.local https://www.cmux.sh https://cmux.sh https://www.cmux.dev https://cmux.dev http://localhost:5173;",
        )
    );
    let vary = headers
        .get("vary")
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default()
        .to_ascii_lowercase();
    assert!(vary.split(',').any(|part| part.trim() == "origin"));
    assert!(headers.get("x-frame-options").is_none());

    let response_localhost = proxy
        .request(
            Method::GET,
            "port-39378-test.cmux.localhost",
            "/",
            &[("Origin", "http://localhost:5173")],
        )
        .await;
    assert_eq!(response_localhost.status(), StatusCode::OK);
    assert_eq!(
        response_localhost
            .headers()
            .get("access-control-allow-origin")
            .and_then(|v| v.to_str().ok()),
        Some("http://localhost:5173")
    );

    proxy.shutdown().await;
    backend.shutdown().await;
}

#[tokio::test]
async fn websocket_proxy_for_port_route() {
    let backend = TestWsBackend::spawn_echo().await;
    let proxy = TestProxy::spawn().await;

    let host = format!("port-{}-test.cmux.sh", backend.port());

    let url = format!("ws://{}{}", proxy.addr, "/ws");
    let mut request = url.into_client_request().expect("request");
    request
        .headers_mut()
        .insert("Host", host.parse().expect("host header"));
    let (mut ws, _) = tokio_tungstenite::connect_async(request)
        .await
        .expect("connect through proxy");

    ws.send(Message::Text("hello".into())).await.expect("send");
    let reply = ws.next().await.expect("reply").expect("message");
    assert_eq!(reply.into_text().unwrap(), "hello");

    ws.close(None).await.unwrap();

    proxy.shutdown().await;
    backend.shutdown().await;
}

#[tokio::test]
async fn websocket_proxy_for_cmux_route() {
    let backend = TestWsBackend::spawn_echo().await;
    let proxy = TestProxy::spawn().await;

    let host = format!("cmux-demo-feature-{}.cmux.sh", backend.port());

    let url = format!("ws://{}{}", proxy.addr, "/ws");
    let mut request = url.into_client_request().expect("request");
    request
        .headers_mut()
        .insert("Host", host.parse().expect("host header"));
    let (mut ws, _) = tokio_tungstenite::connect_async(request)
        .await
        .expect("connect through proxy");

    ws.send(Message::Text("cmux".into())).await.expect("send");
    let reply = ws.next().await.expect("reply").expect("message");
    assert_eq!(reply.into_text().unwrap(), "cmux");
    ws.close(None).await.unwrap();

    proxy.shutdown().await;
    backend.shutdown().await;
}

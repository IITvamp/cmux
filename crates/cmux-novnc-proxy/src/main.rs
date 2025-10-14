use std::net::SocketAddr;
use std::path::PathBuf;

use clap::Parser;
use cmux_novnc_proxy::{spawn_proxy, ProxyConfig};
use tracing::{error, info, warn};

#[derive(Parser, Debug)]
#[command(author, version, about = "Lightweight noVNC WebSocket proxy")]
struct Args {
    /// Listen socket address for incoming HTTP/WebSocket connections.
    #[arg(long, env = "CMUX_NOVNC_LISTEN", default_value = "0.0.0.0:39380")]
    listen: SocketAddr,

    /// Upstream VNC server address (TCP).
    #[arg(long, env = "CMUX_NOVNC_UPSTREAM", default_value = "127.0.0.1:5901")]
    upstream: SocketAddr,

    /// Directory containing noVNC static assets to serve.
    #[arg(long, env = "CMUX_NOVNC_WEB_ROOT", default_value = "/usr/share/novnc")]
    web_root: PathBuf,
}

#[tokio::main]
async fn main() {
    if let Err(err) = run().await {
        eprintln!("cmux-novnc-proxy error: {err}");
        std::process::exit(1);
    }
}

async fn run() -> Result<(), Box<dyn std::error::Error>> {
    let args = Args::parse();

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "cmux_novnc_proxy=info".into()),
        )
        .with_target(false)
        .compact()
        .init();

    let config = ProxyConfig {
        listen: args.listen,
        upstream: args.upstream,
        web_root: args.web_root,
    };

    info!(listen = %config.listen, upstream = %config.upstream, web_root = %config.web_root.display(), "starting cmux-novnc-proxy");

    let shutdown = async {
        match tokio::signal::ctrl_c().await {
            Ok(_) => info!("shutdown signal received"),
            Err(err) => warn!(error = %err, "failed to listen for ctrl-c"),
        }
    };

    let (bound_addr, handle) = spawn_proxy(config, shutdown);
    info!(bound = %bound_addr, "cmux-novnc-proxy listening");

    match handle.await {
        Ok(_) => {
            info!("proxy stopped");
            Ok(())
        }
        Err(err) => {
            error!(error = %err, "proxy task aborted");
            Err(Box::new(err))
        }
    }
}

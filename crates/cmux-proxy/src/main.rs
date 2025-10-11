use std::net::{IpAddr, Ipv4Addr, SocketAddr};

use clap::Parser;
use tracing::info;

#[derive(Parser, Debug, Clone)]
#[command(
    author,
    version,
    about = "Header-based proxy for HTTP, WS, and TCP (CONNECT)"
)]
struct Args {
    /// Listen address(es). Accepts multiple or comma-separated values.
    /// Example: --listen 0.0.0.0:39379 --listen 127.0.0.1:39379
    #[arg(long, env = "CMUX_LISTEN", value_delimiter = ',', num_args = 1.., default_values = ["0.0.0.0:39379", "127.0.0.1:39379"])]
    listen: Vec<SocketAddr>,

    /// Default upstream host to use with the header-based port.
    /// Typically 127.0.0.1. If you need to reach another host, change this.
    #[arg(long, env = "CMUX_UPSTREAM_HOST", default_value = "127.0.0.1")]
    upstream_host: String,

    /// Allow requests without workspace headers to route to the default upstream host.
    #[arg(long, env = "CMUX_ALLOW_DEFAULT_UPSTREAM", default_value_t = true)]
    allow_default_upstream: bool,
}

#[tokio::main]
async fn main() {
    let args = Args::parse();

    // Init logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "cmux-proxy=info,hyper=warn".into()),
        )
        .compact()
        .init();

    info!(
        "listen" = ?args.listen,
        "upstream_host" = %args.upstream_host,
        allow_default_upstream = args.allow_default_upstream,
        "Starting cmux-proxy"
    );

    // Deduplicate addresses: if 0.0.0.0:port is present, drop other IPv4 addrs with same port to avoid bind conflicts.
    let mut listens = args.listen;
    listens.sort_by(|a, b| {
        a.port()
            .cmp(&b.port())
            .then(a.ip().to_string().cmp(&b.ip().to_string()))
    });
    listens.dedup();
    let listens = dedupe_wildcard_v4(listens);

    let upstream_host = args.upstream_host;
    let allow_default_upstream = args.allow_default_upstream;

    let (bound, handle) =
        cmux_proxy::spawn_proxy_multi(listens, upstream_host, allow_default_upstream, async {
            let _ = tokio::signal::ctrl_c().await;
        });
    info!("bound_addrs" = ?bound, "proxy started");
    let _ = handle.await;
}
// server logic moved to library

fn dedupe_wildcard_v4(listens: Vec<SocketAddr>) -> Vec<SocketAddr> {
    let mut result = Vec::new();
    for addr in listens.into_iter() {
        match addr.ip() {
            IpAddr::V4(ipv4) if ipv4 == Ipv4Addr::UNSPECIFIED => {
                // If wildcard v4 present, drop any existing specific v4 with same port
                result.retain(|a: &SocketAddr| {
                    !(matches!(a.ip(), IpAddr::V4(_)) && a.port() == addr.port())
                });
                result.push(addr);
            }
            _ => {
                // Only add if not shadowed by wildcard v4
                if !result.iter().any(|a: &SocketAddr| {
                    a.port() == addr.port()
                        && matches!(a.ip(), IpAddr::V4(ip) if ip == Ipv4Addr::UNSPECIFIED)
                }) {
                    result.push(addr);
                }
            }
        }
    }
    result
}

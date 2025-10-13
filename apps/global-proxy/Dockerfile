FROM rustlang/rust:nightly-slim AS builder

WORKDIR /app

# Leverage incremental Docker caching by copying manifests first.
COPY Cargo.toml ./
COPY src ./src
# Build the binary in release mode.
RUN apt-get update && apt-get install -y --no-install-recommends pkg-config build-essential \
  && rm -rf /var/lib/apt/lists/* \
  && cargo build --release

FROM gcr.io/distroless/cc-debian12

ENV PORT=8080 \
    GLOBAL_PROXY_BACKEND_SCHEME=https \
    GLOBAL_PROXY_MORPH_DOMAIN_SUFFIX=.http.cloud.morph.so \
    GLOBAL_PROXY_WORKSPACE_DOMAIN_SUFFIX=.vm.freestyle.sh

WORKDIR /app

COPY --from=builder /app/target/release/global-proxy /usr/local/bin/global-proxy

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/global-proxy"]

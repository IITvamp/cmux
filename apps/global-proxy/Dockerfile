FROM lukemathwalker/cargo-chef:latest-rust-nightly AS chef

WORKDIR /app

COPY Cargo.toml Cargo.lock ./
COPY src ./src

RUN cargo chef prepare --recipe-path recipe.json

FROM lukemathwalker/cargo-chef:latest-rust-nightly AS builder

WORKDIR /app

COPY --from=chef /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json

COPY Cargo.toml Cargo.lock ./
COPY src ./src

RUN cargo build --release --locked

FROM gcr.io/distroless/cc-debian12

ENV PORT=8080 \
    GLOBAL_PROXY_BACKEND_SCHEME=https \
    GLOBAL_PROXY_MORPH_DOMAIN_SUFFIX=.http.cloud.morph.so \
    GLOBAL_PROXY_WORKSPACE_DOMAIN_SUFFIX=.vm.freestyle.sh

WORKDIR /app

COPY --from=builder /app/target/release/global-proxy /usr/local/bin/global-proxy

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/global-proxy"]

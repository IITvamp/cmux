package main

import (
	"fmt"
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strconv"
	"time"
)

type proxyConfig struct {
	listenPort int
	targetPort int
	targetHost string
	hostHeader string
}

func getenv(key string, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func parsePort(raw string, fallback int) int {
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value <= 0 || value > 65535 {
		log.Fatalf("invalid port value %q", raw)
	}
	return value
}

func loadConfig() proxyConfig {
	targetPort := parsePort(getenv("CMUX_CDP_TARGET_PORT", "39382"), 39382)
	return proxyConfig{
		listenPort: parsePort(getenv("CMUX_CDP_PROXY_PORT", "39381"), 39381),
		targetPort: targetPort,
		targetHost: getenv("CMUX_CDP_TARGET_HOST", "127.0.0.1"),
		hostHeader: getenv("CMUX_CDP_TARGET_HOST_HEADER", fmt.Sprintf("localhost:%d", targetPort)),
	}
}

func main() {
	log.SetFlags(log.LstdFlags | log.LUTC)
	cfg := loadConfig()

	targetURL := &url.URL{
		Scheme: "http",
		Host:   net.JoinHostPort(cfg.targetHost, strconv.Itoa(cfg.targetPort)),
	}

	proxy := httputil.NewSingleHostReverseProxy(targetURL)
	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		req.Host = cfg.hostHeader
		req.Header.Set("Host", cfg.hostHeader)
		req.Header.Del("Proxy-Connection")
	}

	proxy.ErrorHandler = func(rw http.ResponseWriter, req *http.Request, err error) {
		log.Printf("proxy error: %v", err)
		rw.Header().Set("Content-Type", "text/plain")
		rw.WriteHeader(http.StatusBadGateway)
		_, _ = rw.Write([]byte("Bad Gateway"))
	}

	proxy.FlushInterval = 100 * time.Millisecond

	server := &http.Server{
		Addr:              net.JoinHostPort("0.0.0.0", strconv.Itoa(cfg.listenPort)),
		Handler:           proxy,
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf(
		"cmux CDP proxy listening on %d, forwarding to %s (Host header: %s)",
		cfg.listenPort,
		targetURL.Host,
		cfg.hostHeader,
	)

	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server exited: %v", err)
	}
}

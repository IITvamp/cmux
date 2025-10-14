package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"nhooyr.io/websocket"
)

const (
	defaultListenAddr  = "0.0.0.0:39380"
	defaultTargetHost  = "127.0.0.1"
	defaultTargetPort  = "5901"
	defaultWebRoot     = "/usr/share/novnc"
	defaultDialTimeout = 5 * time.Second
	defaultIdleTimeout = 4 * time.Minute
	defaultReadLimit   = 1 << 24 // 16 MiB per message
)

type proxyConfig struct {
	listenAddr string
	targetAddr string
	webRoot    string

	dialTimeout time.Duration
	idleTimeout time.Duration
	readLimit   int64
}

func getenv(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func loadConfig() (proxyConfig, error) {
	listenAddr := getenv("CMUX_VNC_PROXY_LISTEN_ADDR", defaultListenAddr)

	targetAddr := strings.TrimSpace(os.Getenv("CMUX_VNC_PROXY_TARGET_ADDR"))
	if targetAddr == "" {
		targetHost := getenv("CMUX_VNC_PROXY_TARGET_HOST", defaultTargetHost)
		targetPort := getenv("CMUX_VNC_PROXY_TARGET_PORT", defaultTargetPort)
		if _, err := net.LookupPort("tcp", targetPort); err != nil {
			return proxyConfig{}, fmt.Errorf("invalid CMUX_VNC_PROXY_TARGET_PORT %q: %w", targetPort, err)
		}
		targetAddr = net.JoinHostPort(targetHost, targetPort)
	}

	webRoot := getenv("CMUX_VNC_PROXY_WEBROOT", defaultWebRoot)
	if v := strings.TrimSpace(os.Getenv("CMUX_VNC_PROXY_WEB_ROOT")); v != "" {
		webRoot = v
	}

	dialTimeout := defaultDialTimeout
	if v := strings.TrimSpace(os.Getenv("CMUX_VNC_PROXY_DIAL_TIMEOUT")); v != "" {
		parsed, err := time.ParseDuration(v)
		if err != nil {
			return proxyConfig{}, fmt.Errorf("invalid CMUX_VNC_PROXY_DIAL_TIMEOUT %q: %w", v, err)
		}
		if parsed <= 0 {
			return proxyConfig{}, fmt.Errorf("CMUX_VNC_PROXY_DIAL_TIMEOUT must be > 0")
		}
		dialTimeout = parsed
	}

	idleTimeout := defaultIdleTimeout
	if v := strings.TrimSpace(os.Getenv("CMUX_VNC_PROXY_IDLE_TIMEOUT")); v != "" {
		parsed, err := time.ParseDuration(v)
		if err != nil {
			return proxyConfig{}, fmt.Errorf("invalid CMUX_VNC_PROXY_IDLE_TIMEOUT %q: %w", v, err)
		}
		if parsed <= 0 {
			return proxyConfig{}, fmt.Errorf("CMUX_VNC_PROXY_IDLE_TIMEOUT must be > 0")
		}
		idleTimeout = parsed
	}

	readLimit := int64(defaultReadLimit)
	if v := strings.TrimSpace(os.Getenv("CMUX_VNC_PROXY_READ_LIMIT")); v != "" {
		parsed, err := parsePositiveInt64(v)
		if err != nil {
			return proxyConfig{}, fmt.Errorf("invalid CMUX_VNC_PROXY_READ_LIMIT %q: %w", v, err)
		}
		if parsed < 1024 {
			return proxyConfig{}, fmt.Errorf("CMUX_VNC_PROXY_READ_LIMIT must be >= 1024")
		}
		readLimit = parsed
	}

	if _, err := net.ResolveTCPAddr("tcp", listenAddr); err != nil {
		return proxyConfig{}, fmt.Errorf("invalid CMUX_VNC_PROXY_LISTEN_ADDR %q: %w", listenAddr, err)
	}
	if _, err := net.ResolveTCPAddr("tcp", targetAddr); err != nil {
		return proxyConfig{}, fmt.Errorf("invalid proxy target address %q: %w", targetAddr, err)
	}

	return proxyConfig{
		listenAddr:  listenAddr,
		targetAddr:  targetAddr,
		webRoot:     webRoot,
		dialTimeout: dialTimeout,
		idleTimeout: idleTimeout,
		readLimit:   readLimit,
	}, nil
}

func parsePositiveInt64(raw string) (int64, error) {
	var total int64
	for _, r := range raw {
		if r < '0' || r > '9' {
			return 0, fmt.Errorf("contains non-digit")
		}
		total = total*10 + int64(r-'0')
		if total < 0 {
			return 0, fmt.Errorf("value overflow")
		}
	}
	if total == 0 {
		return 0, fmt.Errorf("value must be > 0")
	}
	return total, nil
}

type vncProxy struct {
	cfg           proxyConfig
	staticHandler http.Handler
}

func newVNCProxy(cfg proxyConfig) (*vncProxy, error) {
	var staticHandler http.Handler
	if cfg.webRoot != "" {
		staticHandler = http.FileServer(http.Dir(cfg.webRoot))
	}
	return &vncProxy{cfg: cfg, staticHandler: staticHandler}, nil
}

func (p *vncProxy) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch {
	case strings.EqualFold(r.URL.Path, "/healthz"):
		w.Header().Set("Cache-Control", "no-store")
		_, _ = w.Write([]byte("ok"))
		return
	case isWebSocketRequest(r):
		p.handleWebSocket(w, r)
		return
	default:
		p.serveStatic(w, r)
	}
}

func (p *vncProxy) serveStatic(w http.ResponseWriter, r *http.Request) {
	if p.staticHandler == nil {
		http.NotFound(w, r)
		return
	}

	if r.URL.Path == "/" {
		candidate := filepath.Join(p.cfg.webRoot, "vnc.html")
		if _, err := os.Stat(candidate); err == nil {
			http.ServeFile(w, r, candidate)
			return
		}
	}

	p.staticHandler.ServeHTTP(w, r)
}

func (p *vncProxy) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		CompressionMode: websocket.CompressionDisabled,
		OriginPatterns:  nil, // allow all origins
	})
	if err != nil {
		log.Printf("websocket accept failed: %v", err)
		return
	}

	closeStatus := websocket.StatusInternalError
	closeReason := "internal error"
	defer func() {
		if err := conn.Close(closeStatus, closeReason); err != nil && !isNormalClosure(err) {
			log.Printf("websocket close failed: %v", err)
		}
	}()

	conn.SetReadLimit(p.cfg.readLimit)

	dialer := net.Dialer{Timeout: p.cfg.dialTimeout}
	backend, err := dialer.DialContext(ctx, "tcp", p.cfg.targetAddr)
	if err != nil {
		log.Printf("failed to connect to VNC target %s: %v", p.cfg.targetAddr, err)
		closeStatus = websocket.StatusPolicyViolation
		closeReason = "failed to connect upstream"
		return
	}
	defer backend.Close()

	log.Printf("accepted VNC websocket from %s (path=%s)", r.RemoteAddr, r.URL.Path)

	bridgeCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	errCh := make(chan error, 2)

	go func() {
		errCh <- copyWebSocketToTCP(bridgeCtx, conn, backend)
	}()

	go func() {
		errCh <- copyTCPToWebSocket(bridgeCtx, backend, conn)
	}()

	var firstErr error
	for i := 0; i < 2; i++ {
		if err := <-errCh; err != nil && !isNormalClosure(err) {
			if firstErr == nil {
				firstErr = err
			}
		}
		cancel()
		_ = backend.Close()
	}

	if firstErr != nil {
		log.Printf("proxy connection terminated with error: %v", firstErr)
		closeStatus = websocket.StatusAbnormalClosure
		closeReason = "proxy connection closed"
		return
	}

	closeStatus = websocket.StatusNormalClosure
	closeReason = ""
}

func copyWebSocketToTCP(ctx context.Context, ws *websocket.Conn, dst net.Conn) error {
	for {
		msgType, reader, err := ws.Reader(ctx)
		if err != nil {
			return err
		}
		if msgType != websocket.MessageBinary {
			// Ignore non-binary frames to match websockify behaviour
			if err := drainReader(reader); err != nil {
				return err
			}
			continue
		}
		if _, err := io.Copy(dst, reader); err != nil {
			return err
		}
	}
}

func copyTCPToWebSocket(ctx context.Context, src net.Conn, ws *websocket.Conn) error {
	buf := make([]byte, 32*1024)
	for {
		if err := ctx.Err(); err != nil {
			return err
		}
		_ = src.SetReadDeadline(time.Now().Add(5 * time.Second))
		n, err := src.Read(buf)
		if n > 0 {
			writeCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
			errWrite := ws.Write(writeCtx, websocket.MessageBinary, buf[:n])
			cancel()
			if errWrite != nil {
				return errWrite
			}
		}
		if err != nil {
			if ne, ok := err.(net.Error); ok && ne.Timeout() {
				continue
			}
			return err
		}
	}
}

func drainReader(r io.Reader) error {
	_, err := io.Copy(io.Discard, r)
	return err
}

func isWebSocketRequest(r *http.Request) bool {
	if !strings.EqualFold(r.Header.Get("Upgrade"), "websocket") {
		return false
	}
	connection := strings.ToLower(r.Header.Get("Connection"))
	return strings.Contains(connection, "upgrade")
}

func isNormalClosure(err error) bool {
	if err == nil {
		return true
	}
	if errors.Is(err, context.Canceled) || errors.Is(err, io.EOF) || errors.Is(err, net.ErrClosed) {
		return true
	}
	if ne, ok := err.(net.Error); ok {
		if ne.Timeout() {
			return false
		}
		return !ne.Temporary()
	}
	if websocket.CloseStatus(err) != -1 {
		return true
	}
	return false
}

func main() {
	log.SetFlags(log.LstdFlags | log.LUTC)

	cfg, err := loadConfig()
	if err != nil {
		log.Fatalf("configuration error: %v", err)
	}

	proxy, err := newVNCProxy(cfg)
	if err != nil {
		log.Fatalf("failed to initialise proxy: %v", err)
	}

	server := &http.Server{
		Addr:              cfg.listenAddr,
		Handler:           proxy,
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       cfg.idleTimeout,
		ReadTimeout:       0,
		WriteTimeout:      0,
	}

	log.Printf("cmux VNC proxy listening on %s, forwarding to %s (web root: %s)", cfg.listenAddr, cfg.targetAddr, cfg.webRoot)

	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("server exited: %v", err)
	}
}

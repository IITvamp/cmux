package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

type config struct {
	listenAddr string
	targetAddr string
	webRoot    string
}

func parseConfig() (config, error) {
	var cfg config
	flag.StringVar(&cfg.listenAddr, "listen", "0.0.0.0:39380", "address to bind for incoming HTTP/WebSocket requests")
	flag.StringVar(&cfg.targetAddr, "target", "127.0.0.1:5901", "VNC server address to proxy to")
	flag.StringVar(&cfg.webRoot, "web", "/usr/share/novnc", "directory containing noVNC static assets")
	flag.Parse()

	if cfg.listenAddr == "" {
		return config{}, errors.New("listen address must be provided")
	}
	if cfg.targetAddr == "" {
		return config{}, errors.New("target address must be provided")
	}

	if cfg.webRoot != "" {
		if info, err := os.Stat(cfg.webRoot); err != nil {
			return config{}, fmt.Errorf("web root %q not accessible: %w", cfg.webRoot, err)
		} else if !info.IsDir() {
			return config{}, fmt.Errorf("web root %q is not a directory", cfg.webRoot)
		}
	}

	return cfg, nil
}

func main() {
	log.SetFlags(log.LstdFlags | log.LUTC)

	cfg, err := parseConfig()
	if err != nil {
		log.Fatalf("failed to parse config: %v", err)
	}

	proxy, err := newProxyServer(serverConfig{
		targetAddr:  cfg.targetAddr,
		webRoot:     cfg.webRoot,
		dialTimeout: 5 * time.Second,
		logger:      log.Default(),
	})
	if err != nil {
		log.Fatalf("failed to construct proxy: %v", err)
	}

	srv := &http.Server{
		Addr:              cfg.listenAddr,
		Handler:           proxy,
		ReadHeaderTimeout: 5 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer stop()

	errCh := make(chan error, 1)
	go func() {
		log.Printf("noVNC proxy listening on %s forwarding to %s", cfg.listenAddr, cfg.targetAddr)
		err := srv.ListenAndServe()
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
	}()

	select {
	case err := <-errCh:
		log.Fatalf("server error: %v", err)
	case <-ctx.Done():
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil && !errors.Is(err, context.Canceled) {
		log.Fatalf("graceful shutdown failed: %v", err)
	}

	log.Println("noVNC proxy stopped")
}

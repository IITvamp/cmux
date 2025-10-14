package main

import (
	"errors"
	"flag"
	"log"
	"net/http"
	"os"
	"time"
)

func main() {
	log.SetFlags(log.LstdFlags | log.LUTC)

	listen := flag.String("listen", "0.0.0.0:39380", "address to listen on (host:port)")
	target := flag.String("target", "127.0.0.1:5901", "upstream VNC server address (host:port)")
	webDir := flag.String("web-dir", "/usr/share/novnc", "optional directory to serve static noVNC assets from")
	dialTimeout := flag.Duration("dial-timeout", 5*time.Second, "timeout for establishing upstream TCP connections")

	flag.Parse()

	if *target == "" {
		log.Fatal("target address must be provided")
	}
	if *listen == "" {
		log.Fatal("listen address must be provided")
	}

	cfg := proxyConfig{
		targetAddr:  *target,
		dialTimeout: *dialTimeout,
		webDir:      *webDir,
	}

	handler, err := newRootHandler(cfg)
	if err != nil {
		log.Fatalf("failed to initialize handler: %v", err)
	}

	server := &http.Server{
		Addr:              *listen,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	server.ErrorLog = log.New(os.Stderr, "vnc-proxy http: ", log.LstdFlags|log.LUTC)

	log.Printf(
		"cmux VNC proxy listening on %s, forwarding to %s (web dir: %s)",
		*listen,
		cfg.targetAddr,
		emptyIfZero(cfg.webDir, "<disabled>"),
	)

	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("server exited: %v", err)
	}
}

func emptyIfZero(value string, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}

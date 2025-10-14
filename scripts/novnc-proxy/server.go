package main

import (
	"errors"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type serverConfig struct {
	targetAddr  string
	webRoot     string
	dialTimeout time.Duration
	logger      *log.Logger
}

type proxyServer struct {
	targetAddr  string
	dialTimeout time.Duration
	static      http.Handler
	logger      *log.Logger
}

func newProxyServer(cfg serverConfig) (*proxyServer, error) {
	if cfg.targetAddr == "" {
		return nil, errors.New("target address must be specified")
	}

	logger := cfg.logger
	if logger == nil {
		logger = log.New(os.Stderr, "", log.LstdFlags|log.LUTC)
	}

	var staticHandler http.Handler
	if cfg.webRoot != "" {
		abs, err := filepath.Abs(cfg.webRoot)
		if err != nil {
			return nil, err
		}
		staticHandler = http.FileServer(http.Dir(abs))
	}

	if cfg.dialTimeout <= 0 {
		cfg.dialTimeout = 5 * time.Second
	}

	return &proxyServer{
		targetAddr:  cfg.targetAddr,
		dialTimeout: cfg.dialTimeout,
		static:      staticHandler,
		logger:      logger,
	}, nil
}

func (p *proxyServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch {
	case r.URL.Path == "/websockify" || strings.HasPrefix(r.URL.Path, "/websockify/"):
		p.serveWebsocket(w, r)
		return
	case p.static != nil:
		p.static.ServeHTTP(w, r)
		return
	default:
		http.NotFound(w, r)
	}
}

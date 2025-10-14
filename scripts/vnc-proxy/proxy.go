package main

import (
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type proxyConfig struct {
	targetAddr  string
	dialTimeout time.Duration
	webDir      string
}

func newRootHandler(cfg proxyConfig) (http.Handler, error) {
	proxy := newProxyHandler(cfg.targetAddr, cfg.dialTimeout)

	var staticHandler http.Handler
	if cfg.webDir != "" {
		info, err := os.Stat(cfg.webDir)
		if err != nil {
			return nil, fmt.Errorf("stat web directory: %w", err)
		}
		if !info.IsDir() {
			return nil, fmt.Errorf("web directory is not a directory: %s", cfg.webDir)
		}
		// Ensure we serve files relative to the directory root.
		staticHandler = http.FileServer(http.Dir(cfg.webDir))
	} else {
		staticHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, "not found", http.StatusNotFound)
		})
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if isWebsocketRequest(r) {
			proxy.ServeHTTP(w, r)
			return
		}

		// Prevent path traversal attempts when serving static files.
		if cfg.webDir != "" {
			cleaned := filepath.Clean(r.URL.Path)
			if strings.HasPrefix(cleaned, "..") {
				http.Error(w, "forbidden", http.StatusForbidden)
				return
			}
		}

		staticHandler.ServeHTTP(w, r)
	}), nil
}

func isWebsocketRequest(r *http.Request) bool {
	if !strings.EqualFold(r.Header.Get("Upgrade"), "websocket") {
		return false
	}
	connectionValues := r.Header.Values("Connection")
	for _, v := range connectionValues {
		if hasToken(v, "upgrade") {
			return true
		}
	}
	return false
}

func hasToken(headerVal string, token string) bool {
	for _, part := range strings.Split(headerVal, ",") {
		if strings.EqualFold(strings.TrimSpace(part), token) {
			return true
		}
	}
	return false
}

type proxyHandler struct {
	targetAddr string
	dialer     *net.Dialer
	upgrader   websocket.Upgrader
}

func newProxyHandler(target string, dialTimeout time.Duration) *proxyHandler {
	return &proxyHandler{
		targetAddr: target,
		dialer: &net.Dialer{
			Timeout:   dialTimeout,
			KeepAlive: 30 * time.Second,
		},
		upgrader: websocket.Upgrader{
			ReadBufferSize:  32 * 1024,
			WriteBufferSize: 32 * 1024,
			CheckOrigin: func(r *http.Request) bool {
				// noVNC handles CSRF, allow any origin comparable to websockify defaults
				return true
			},
			EnableCompression: false,
		},
	}
}

func (p *proxyHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	backendConn, err := p.dialer.DialContext(r.Context(), "tcp", p.targetAddr)
	if err != nil {
		log.Printf("vnc-proxy: failed to connect to %s: %v", p.targetAddr, err)
		http.Error(w, "failed to connect to upstream", http.StatusBadGateway)
		return
	}
	defer backendConn.Close()

	if tcpConn, ok := backendConn.(*net.TCPConn); ok {
		_ = tcpConn.SetKeepAlive(true)
		_ = tcpConn.SetKeepAlivePeriod(30 * time.Second)
		_ = tcpConn.SetNoDelay(true)
	}

	wsConn, err := p.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("vnc-proxy: failed websocket upgrade from %s: %v", r.RemoteAddr, err)
		return
	}
	defer wsConn.Close()

	log.Printf("vnc-proxy: connected %s → %s", r.RemoteAddr, p.targetAddr)

	errCh := make(chan error, 1)
	var once sync.Once
	signalErr := func(e error) {
		once.Do(func() {
			errCh <- e
		})
	}

	go func() {
		buffer := make([]byte, 32*1024)
		for {
			messageType, reader, err := wsConn.NextReader()
			if err != nil {
				signalErr(err)
				return
			}
			if messageType != websocket.BinaryMessage && messageType != websocket.TextMessage {
				continue
			}
			if _, err = io.CopyBuffer(backendConn, reader, buffer); err != nil {
				signalErr(err)
				return
			}
		}
	}()

	go func() {
		buffer := make([]byte, 32*1024)
		for {
			n, err := backendConn.Read(buffer)
			if n > 0 {
				writer, wErr := wsConn.NextWriter(websocket.BinaryMessage)
				if wErr != nil {
					signalErr(wErr)
					return
				}
				if _, wErr = writer.Write(buffer[:n]); wErr != nil {
					signalErr(wErr)
					_ = writer.Close()
					return
				}
				if wErr = writer.Close(); wErr != nil {
					signalErr(wErr)
					return
				}
			}
			if err != nil {
				signalErr(err)
				return
			}
		}
	}()

	err = <-errCh
	if !isNormalClosure(err) {
		log.Printf("vnc-proxy: connection %s → %s closed with error: %v", r.RemoteAddr, p.targetAddr, err)
	}
}

func isNormalClosure(err error) bool {
	if err == nil {
		return true
	}
	if errors.Is(err, io.EOF) {
		return true
	}
	if errors.Is(err, net.ErrClosed) {
		return true
	}

	var closeErr *websocket.CloseError
	if errors.As(err, &closeErr) {
		switch closeErr.Code {
		case websocket.CloseNormalClosure, websocket.CloseGoingAway:
			return true
		}
	}

	var opErr *net.OpError
	if errors.As(err, &opErr) {
		if opErr.Timeout() {
			return true
		}
	}

	return false
}

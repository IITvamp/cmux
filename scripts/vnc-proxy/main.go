package main

import (
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"strconv"
	"time"

	"golang.org/x/net/websocket"
)

type proxyConfig struct {
	listenAddr string
	vncAddr    string
	webRoot    string
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
	listenPort := parsePort(getenv("VNC_PROXY_PORT", "39380"), 39380)
	vncHost := getenv("VNC_HOST", "127.0.0.1")
	vncPort := parsePort(getenv("VNC_PORT", "5901"), 5901)
	webRoot := getenv("WEB_ROOT", "/usr/share/novnc")

	return proxyConfig{
		listenAddr: fmt.Sprintf("0.0.0.0:%d", listenPort),
		vncAddr:    fmt.Sprintf("%s:%d", vncHost, vncPort),
		webRoot:    webRoot,
	}
}

// WebSocket handler that proxies binary data to VNC server
func handleWebSocket(ws *websocket.Conn) {
	defer ws.Close()

	cfg := loadConfig()

	// Connect to VNC server
	vncConn, err := net.DialTimeout("tcp", cfg.vncAddr, 10*time.Second)
	if err != nil {
		log.Printf("failed to connect to VNC server at %s: %v", cfg.vncAddr, err)
		return
	}
	defer vncConn.Close()

	log.Printf("WebSocket connection established, proxying to %s", cfg.vncAddr)

	// Create channels for error handling
	errChan := make(chan error, 2)

	// Copy from WebSocket to VNC
	go func() {
		for {
			var data []byte
			err := websocket.Message.Receive(ws, &data)
			if err != nil {
				if err != io.EOF {
					errChan <- fmt.Errorf("websocket read error: %w", err)
				} else {
					errChan <- nil
				}
				return
			}

			_, err = vncConn.Write(data)
			if err != nil {
				errChan <- fmt.Errorf("vnc write error: %w", err)
				return
			}
		}
	}()

	// Copy from VNC to WebSocket
	go func() {
		buf := make([]byte, 32768)
		for {
			n, err := vncConn.Read(buf)
			if err != nil {
				if err != io.EOF {
					errChan <- fmt.Errorf("vnc read error: %w", err)
				} else {
					errChan <- nil
				}
				return
			}

			if n > 0 {
				err = websocket.Message.Send(ws, buf[:n])
				if err != nil {
					errChan <- fmt.Errorf("websocket write error: %w", err)
					return
				}
			}
		}
	}()

	// Wait for first error or completion
	err = <-errChan
	if err != nil {
		log.Printf("proxy connection closed: %v", err)
	} else {
		log.Printf("proxy connection closed gracefully")
	}
}

func main() {
	log.SetFlags(log.LstdFlags | log.LUTC)
	cfg := loadConfig()

	mux := http.NewServeMux()

	// WebSocket endpoint for VNC traffic
	mux.Handle("/websockify", websocket.Handler(handleWebSocket))

	// Serve noVNC static files if webRoot is provided and exists
	if cfg.webRoot != "" {
		if info, err := os.Stat(cfg.webRoot); err == nil && info.IsDir() {
			log.Printf("Serving noVNC static files from %s", cfg.webRoot)
			fs := http.FileServer(http.Dir(cfg.webRoot))
			mux.Handle("/", fs)
		} else {
			log.Printf("Warning: web root %s not found or not a directory, static files will not be served", cfg.webRoot)
		}
	}

	server := &http.Server{
		Addr:              cfg.listenAddr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       0, // No timeout for WebSocket connections
		WriteTimeout:      0, // No timeout for WebSocket connections
	}

	log.Printf(
		"VNC WebSocket proxy listening on %s, forwarding to %s, serving files from %s",
		cfg.listenAddr,
		cfg.vncAddr,
		cfg.webRoot,
	)

	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server exited: %v", err)
	}
}

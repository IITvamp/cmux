package main

import (
	"embed"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/gorilla/websocket"
)

//go:embed novnc/*
var novncFS embed.FS

type proxyConfig struct {
	listenPort int
	targetPort int
	targetHost string
	webDir     string
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
	return proxyConfig{
		listenPort: parsePort(getenv("CMUX_VNC_PROXY_PORT", "39380"), 39380),
		targetPort: parsePort(getenv("CMUX_VNC_TARGET_PORT", "5901"), 5901),
		targetHost: getenv("CMUX_VNC_TARGET_HOST", "127.0.0.1"),
		webDir:     getenv("CMUX_VNC_WEB_DIR", "/usr/share/novnc"),
	}
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func handleWebSocket(cfg proxyConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Upgrade HTTP connection to WebSocket
		wsConn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("websocket upgrade failed: %v", err)
			return
		}
		defer wsConn.Close()

		// Connect to VNC server
		vncAddr := net.JoinHostPort(cfg.targetHost, strconv.Itoa(cfg.targetPort))
		vncConn, err := net.DialTimeout("tcp", vncAddr, 10*time.Second)
		if err != nil {
			log.Printf("failed to connect to VNC server at %s: %v", vncAddr, err)
			wsConn.WriteMessage(websocket.CloseMessage,
				websocket.FormatCloseMessage(websocket.CloseInternalServerErr, "Failed to connect to VNC server"))
			return
		}
		defer vncConn.Close()

		log.Printf("websocket connection established, proxying to %s", vncAddr)

		// Channel to signal completion
		done := make(chan struct{})

		// WebSocket -> VNC
		go func() {
			defer close(done)
			for {
				msgType, message, err := wsConn.ReadMessage()
				if err != nil {
					if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
						log.Printf("websocket read error: %v", err)
					}
					return
				}
				if msgType == websocket.BinaryMessage {
					if _, err := vncConn.Write(message); err != nil {
						log.Printf("vnc write error: %v", err)
						return
					}
				}
			}
		}()

		// VNC -> WebSocket
		go func() {
			buffer := make([]byte, 4096)
			for {
				n, err := vncConn.Read(buffer)
				if err != nil {
					if err != io.EOF {
						log.Printf("vnc read error: %v", err)
					}
					wsConn.WriteMessage(websocket.CloseMessage,
						websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
					return
				}
				if err := wsConn.WriteMessage(websocket.BinaryMessage, buffer[:n]); err != nil {
					log.Printf("websocket write error: %v", err)
					return
				}
			}
		}()

		// Wait for either direction to complete
		<-done
		log.Printf("websocket connection closed")
	}
}

func main() {
	log.SetFlags(log.LstdFlags | log.LUTC)
	cfg := loadConfig()

	mux := http.NewServeMux()

	// WebSocket endpoint
	mux.HandleFunc("/websockify", handleWebSocket(cfg))

	// Static file server for noVNC
	// Try embedded files first, fallback to filesystem
	if _, err := novncFS.Open("novnc"); err == nil {
		log.Printf("serving embedded noVNC files")
		mux.Handle("/", http.FileServer(http.FS(novncFS)))
	} else if _, err := os.Stat(cfg.webDir); err == nil {
		log.Printf("serving noVNC files from %s", cfg.webDir)
		mux.Handle("/", http.FileServer(http.Dir(cfg.webDir)))
	} else {
		log.Printf("warning: noVNC directory not found, static files will not be served")
	}

	server := &http.Server{
		Addr:              net.JoinHostPort("0.0.0.0", strconv.Itoa(cfg.listenPort)),
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf(
		"VNC WebSocket proxy listening on %d, forwarding to %s:%d",
		cfg.listenPort,
		cfg.targetHost,
		cfg.targetPort,
	)

	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server exited: %v", err)
	}
}

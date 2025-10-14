package main

import (
	"bytes"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"golang.org/x/net/websocket"
)

// Mock VNC server for testing
type mockVNCServer struct {
	listener net.Listener
	addr     string
	messages [][]byte
	received [][]byte
}

func newMockVNCServer(t *testing.T) *mockVNCServer {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("failed to create mock VNC server: %v", err)
	}

	srv := &mockVNCServer{
		listener: listener,
		addr:     listener.Addr().String(),
		messages: [][]byte{},
		received: [][]byte{},
	}

	go srv.serve(t)
	return srv
}

func (s *mockVNCServer) serve(t *testing.T) {
	for {
		conn, err := s.listener.Accept()
		if err != nil {
			return // Server closed
		}
		go s.handleConnection(t, conn)
	}
}

func (s *mockVNCServer) handleConnection(t *testing.T, conn net.Conn) {
	defer conn.Close()

	// Echo server: read and write back
	buf := make([]byte, 4096)
	for {
		n, err := conn.Read(buf)
		if err != nil {
			if err != io.EOF {
				t.Logf("mock VNC read error: %v", err)
			}
			return
		}

		if n > 0 {
			data := make([]byte, n)
			copy(data, buf[:n])
			s.received = append(s.received, data)

			// Echo back
			_, err = conn.Write(data)
			if err != nil {
				t.Logf("mock VNC write error: %v", err)
				return
			}
		}
	}
}

func (s *mockVNCServer) close() {
	s.listener.Close()
}

func TestGetenv(t *testing.T) {
	tests := []struct {
		name     string
		key      string
		fallback string
		envValue string
		want     string
	}{
		{
			name:     "uses fallback when env not set",
			key:      "TEST_VAR_NOT_SET",
			fallback: "default",
			envValue: "",
			want:     "default",
		},
		{
			name:     "uses env value when set",
			key:      "TEST_VAR_SET",
			fallback: "default",
			envValue: "custom",
			want:     "custom",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.envValue != "" {
				os.Setenv(tt.key, tt.envValue)
				defer os.Unsetenv(tt.key)
			}

			got := getenv(tt.key, tt.fallback)
			if got != tt.want {
				t.Errorf("getenv() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestParsePort(t *testing.T) {
	tests := []struct {
		name      string
		raw       string
		fallback  int
		want      int
		wantPanic bool
	}{
		{
			name:     "valid port",
			raw:      "8080",
			fallback: 3000,
			want:     8080,
		},
		{
			name:     "empty uses fallback",
			raw:      "",
			fallback: 3000,
			want:     3000,
		},
		{
			name:     "minimum valid port",
			raw:      "1",
			fallback: 3000,
			want:     1,
		},
		{
			name:     "maximum valid port",
			raw:      "65535",
			fallback: 3000,
			want:     65535,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.wantPanic {
				defer func() {
					if r := recover(); r == nil {
						t.Errorf("parsePort() did not panic as expected")
					}
				}()
			}

			got := parsePort(tt.raw, tt.fallback)
			if !tt.wantPanic && got != tt.want {
				t.Errorf("parsePort() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestLoadConfig(t *testing.T) {
	// Save original env
	origPort := os.Getenv("VNC_PROXY_PORT")
	origHost := os.Getenv("VNC_HOST")
	origVNCPort := os.Getenv("VNC_PORT")
	origWebRoot := os.Getenv("WEB_ROOT")

	defer func() {
		os.Setenv("VNC_PROXY_PORT", origPort)
		os.Setenv("VNC_HOST", origHost)
		os.Setenv("VNC_PORT", origVNCPort)
		os.Setenv("WEB_ROOT", origWebRoot)
	}()

	t.Run("default config", func(t *testing.T) {
		os.Unsetenv("VNC_PROXY_PORT")
		os.Unsetenv("VNC_HOST")
		os.Unsetenv("VNC_PORT")
		os.Unsetenv("WEB_ROOT")

		cfg := loadConfig()

		if cfg.listenAddr != "0.0.0.0:39380" {
			t.Errorf("listenAddr = %v, want 0.0.0.0:39380", cfg.listenAddr)
		}
		if cfg.vncAddr != "127.0.0.1:5901" {
			t.Errorf("vncAddr = %v, want 127.0.0.1:5901", cfg.vncAddr)
		}
		if cfg.webRoot != "/usr/share/novnc" {
			t.Errorf("webRoot = %v, want /usr/share/novnc", cfg.webRoot)
		}
	})

	t.Run("custom config", func(t *testing.T) {
		os.Setenv("VNC_PROXY_PORT", "9999")
		os.Setenv("VNC_HOST", "192.168.1.1")
		os.Setenv("VNC_PORT", "5902")
		os.Setenv("WEB_ROOT", "/custom/path")

		cfg := loadConfig()

		if cfg.listenAddr != "0.0.0.0:9999" {
			t.Errorf("listenAddr = %v, want 0.0.0.0:9999", cfg.listenAddr)
		}
		if cfg.vncAddr != "192.168.1.1:5902" {
			t.Errorf("vncAddr = %v, want 192.168.1.1:5902", cfg.vncAddr)
		}
		if cfg.webRoot != "/custom/path" {
			t.Errorf("webRoot = %v, want /custom/path", cfg.webRoot)
		}
	})
}

func TestWebSocketProxy(t *testing.T) {
	// Create mock VNC server
	mockVNC := newMockVNCServer(t)
	defer mockVNC.close()

	// Parse VNC address
	_, vncPortStr, err := net.SplitHostPort(mockVNC.addr)
	if err != nil {
		t.Fatalf("failed to parse mock VNC address: %v", err)
	}

	// Set environment for the proxy
	os.Setenv("VNC_HOST", "127.0.0.1")
	os.Setenv("VNC_PORT", vncPortStr)
	defer os.Unsetenv("VNC_HOST")
	defer os.Unsetenv("VNC_PORT")

	// Create test server
	mux := http.NewServeMux()
	mux.Handle("/websockify", websocket.Handler(handleWebSocket))
	server := httptest.NewServer(mux)
	defer server.Close()

	// Connect WebSocket client
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/websockify"
	ws, err := websocket.Dial(wsURL, "", server.URL)
	if err != nil {
		t.Fatalf("failed to connect WebSocket: %v", err)
	}
	defer ws.Close()

	// Test data exchange
	testMessage := []byte("Hello VNC Server!")

	// Send message through WebSocket
	err = websocket.Message.Send(ws, testMessage)
	if err != nil {
		t.Fatalf("failed to send WebSocket message: %v", err)
	}

	// Receive echoed message
	var received []byte
	err = websocket.Message.Receive(ws, &received)
	if err != nil {
		t.Fatalf("failed to receive WebSocket message: %v", err)
	}

	if !bytes.Equal(received, testMessage) {
		t.Errorf("received = %v, want %v", received, testMessage)
	}
}

func TestWebSocketProxyMultipleMessages(t *testing.T) {
	// Create mock VNC server
	mockVNC := newMockVNCServer(t)
	defer mockVNC.close()

	// Parse VNC address
	_, vncPortStr, err := net.SplitHostPort(mockVNC.addr)
	if err != nil {
		t.Fatalf("failed to parse mock VNC address: %v", err)
	}

	// Set environment for the proxy
	os.Setenv("VNC_HOST", "127.0.0.1")
	os.Setenv("VNC_PORT", vncPortStr)
	defer os.Unsetenv("VNC_HOST")
	defer os.Unsetenv("VNC_PORT")

	// Create test server
	mux := http.NewServeMux()
	mux.Handle("/websockify", websocket.Handler(handleWebSocket))
	server := httptest.NewServer(mux)
	defer server.Close()

	// Connect WebSocket client
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/websockify"
	ws, err := websocket.Dial(wsURL, "", server.URL)
	if err != nil {
		t.Fatalf("failed to connect WebSocket: %v", err)
	}
	defer ws.Close()

	// Send multiple messages
	messages := [][]byte{
		[]byte("Message 1"),
		[]byte("Message 2"),
		[]byte("Message 3"),
	}

	for i, msg := range messages {
		err = websocket.Message.Send(ws, msg)
		if err != nil {
			t.Fatalf("failed to send message %d: %v", i, err)
		}

		var received []byte
		err = websocket.Message.Receive(ws, &received)
		if err != nil {
			t.Fatalf("failed to receive message %d: %v", i, err)
		}

		if !bytes.Equal(received, msg) {
			t.Errorf("message %d: received = %v, want %v", i, received, msg)
		}
	}
}

func TestWebSocketProxyBinaryData(t *testing.T) {
	// Create mock VNC server
	mockVNC := newMockVNCServer(t)
	defer mockVNC.close()

	// Parse VNC address
	_, vncPortStr, err := net.SplitHostPort(mockVNC.addr)
	if err != nil {
		t.Fatalf("failed to parse mock VNC address: %v", err)
	}

	// Set environment for the proxy
	os.Setenv("VNC_HOST", "127.0.0.1")
	os.Setenv("VNC_PORT", vncPortStr)
	defer os.Unsetenv("VNC_HOST")
	defer os.Unsetenv("VNC_PORT")

	// Create test server
	mux := http.NewServeMux()
	mux.Handle("/websockify", websocket.Handler(handleWebSocket))
	server := httptest.NewServer(mux)
	defer server.Close()

	// Connect WebSocket client
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/websockify"
	ws, err := websocket.Dial(wsURL, "", server.URL)
	if err != nil {
		t.Fatalf("failed to connect WebSocket: %v", err)
	}
	defer ws.Close()

	// Test with binary data
	binaryData := make([]byte, 1024)
	for i := range binaryData {
		binaryData[i] = byte(i % 256)
	}

	err = websocket.Message.Send(ws, binaryData)
	if err != nil {
		t.Fatalf("failed to send binary data: %v", err)
	}

	var received []byte
	err = websocket.Message.Receive(ws, &received)
	if err != nil {
		t.Fatalf("failed to receive binary data: %v", err)
	}

	if !bytes.Equal(received, binaryData) {
		t.Errorf("binary data mismatch: got %d bytes, want %d bytes", len(received), len(binaryData))
	}
}

func TestWebSocketProxyConnectionFailure(t *testing.T) {
	// Don't create a VNC server - test connection failure

	// Set environment to non-existent VNC server
	os.Setenv("VNC_HOST", "127.0.0.1")
	os.Setenv("VNC_PORT", "59999") // Port that should not be in use
	defer os.Unsetenv("VNC_HOST")
	defer os.Unsetenv("VNC_PORT")

	// Create test server
	mux := http.NewServeMux()
	mux.Handle("/websockify", websocket.Handler(handleWebSocket))
	server := httptest.NewServer(mux)
	defer server.Close()

	// Connect WebSocket client
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/websockify"
	ws, err := websocket.Dial(wsURL, "", server.URL)
	if err != nil {
		t.Fatalf("failed to connect WebSocket: %v", err)
	}
	defer ws.Close()

	// Try to send a message - should fail or connection should close
	testMessage := []byte("Hello")
	err = websocket.Message.Send(ws, testMessage)

	// Give some time for connection to close
	time.Sleep(100 * time.Millisecond)

	// Try to receive - should fail
	var received []byte
	err = websocket.Message.Receive(ws, &received)
	if err == nil {
		t.Error("expected error when VNC server is not available, got nil")
	}
}

func BenchmarkWebSocketProxy(b *testing.B) {
	// Create mock VNC server
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		b.Fatalf("failed to create mock VNC server: %v", err)
	}
	defer listener.Close()

	go func() {
		for {
			conn, err := listener.Accept()
			if err != nil {
				return
			}
			go func(c net.Conn) {
				defer c.Close()
				io.Copy(c, c) // Echo
			}(conn)
		}
	}()

	_, vncPortStr, _ := net.SplitHostPort(listener.Addr().String())
	os.Setenv("VNC_HOST", "127.0.0.1")
	os.Setenv("VNC_PORT", vncPortStr)
	defer os.Unsetenv("VNC_HOST")
	defer os.Unsetenv("VNC_PORT")

	mux := http.NewServeMux()
	mux.Handle("/websockify", websocket.Handler(handleWebSocket))
	server := httptest.NewServer(mux)
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/websockify"
	ws, err := websocket.Dial(wsURL, "", server.URL)
	if err != nil {
		b.Fatalf("failed to connect WebSocket: %v", err)
	}
	defer ws.Close()

	testData := []byte("benchmark test data")

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		websocket.Message.Send(ws, testData)
		var received []byte
		websocket.Message.Receive(ws, &received)
	}
}

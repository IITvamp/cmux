package main

import (
	"bytes"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

// mockVNCServer simulates a VNC server that echoes back data
type mockVNCServer struct {
	listener net.Listener
	addr     string
	wg       sync.WaitGroup
}

func newMockVNCServer(t *testing.T) *mockVNCServer {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("failed to create mock VNC server: %v", err)
	}

	server := &mockVNCServer{
		listener: listener,
		addr:     listener.Addr().String(),
	}

	server.wg.Add(1)
	go server.serve(t)

	return server
}

func (s *mockVNCServer) serve(t *testing.T) {
	defer s.wg.Done()

	for {
		conn, err := s.listener.Accept()
		if err != nil {
			return
		}

		go s.handleConnection(t, conn)
	}
}

func (s *mockVNCServer) handleConnection(t *testing.T, conn net.Conn) {
	defer conn.Close()

	// Echo server: read and write back
	buffer := make([]byte, 4096)
	for {
		n, err := conn.Read(buffer)
		if err != nil {
			if err != io.EOF {
				t.Logf("mock VNC read error: %v", err)
			}
			return
		}

		_, err = conn.Write(buffer[:n])
		if err != nil {
			t.Logf("mock VNC write error: %v", err)
			return
		}
	}
}

func (s *mockVNCServer) close() {
	s.listener.Close()
	s.wg.Wait()
}

func (s *mockVNCServer) port() int {
	_, portStr, _ := net.SplitHostPort(s.addr)
	port := 0
	fmt.Sscanf(portStr, "%d", &port)
	return port
}

func TestWebSocketProxyEcho(t *testing.T) {
	// Start mock VNC server
	vncServer := newMockVNCServer(t)
	defer vncServer.close()

	// Create proxy config
	cfg := proxyConfig{
		targetHost: "127.0.0.1",
		targetPort: vncServer.port(),
	}

	// Create test HTTP server with WebSocket handler
	server := httptest.NewServer(handleWebSocket(cfg))
	defer server.Close()

	// Convert http:// to ws://
	wsURL := "ws" + server.URL[4:] + "/"

	// Connect WebSocket client
	wsConn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("failed to connect websocket: %v", err)
	}
	defer wsConn.Close()

	// Test data
	testData := []byte("Hello VNC Server!")

	// Send data through WebSocket
	err = wsConn.WriteMessage(websocket.BinaryMessage, testData)
	if err != nil {
		t.Fatalf("failed to write message: %v", err)
	}

	// Read echoed data
	msgType, message, err := wsConn.ReadMessage()
	if err != nil {
		t.Fatalf("failed to read message: %v", err)
	}

	if msgType != websocket.BinaryMessage {
		t.Errorf("expected binary message, got %d", msgType)
	}

	if !bytes.Equal(message, testData) {
		t.Errorf("expected %q, got %q", testData, message)
	}
}

func TestWebSocketProxyMultipleMessages(t *testing.T) {
	vncServer := newMockVNCServer(t)
	defer vncServer.close()

	cfg := proxyConfig{
		targetHost: "127.0.0.1",
		targetPort: vncServer.port(),
	}

	server := httptest.NewServer(handleWebSocket(cfg))
	defer server.Close()

	wsURL := "ws" + server.URL[4:] + "/"

	wsConn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("failed to connect websocket: %v", err)
	}
	defer wsConn.Close()

	// Send multiple messages
	testMessages := [][]byte{
		[]byte("Message 1"),
		[]byte("Message 2"),
		[]byte("Message 3"),
	}

	for i, testData := range testMessages {
		err = wsConn.WriteMessage(websocket.BinaryMessage, testData)
		if err != nil {
			t.Fatalf("failed to write message %d: %v", i, err)
		}

		msgType, message, err := wsConn.ReadMessage()
		if err != nil {
			t.Fatalf("failed to read message %d: %v", i, err)
		}

		if msgType != websocket.BinaryMessage {
			t.Errorf("message %d: expected binary message, got %d", i, msgType)
		}

		if !bytes.Equal(message, testData) {
			t.Errorf("message %d: expected %q, got %q", i, testData, message)
		}
	}
}

func TestWebSocketProxyLargeData(t *testing.T) {
	vncServer := newMockVNCServer(t)
	defer vncServer.close()

	cfg := proxyConfig{
		targetHost: "127.0.0.1",
		targetPort: vncServer.port(),
	}

	server := httptest.NewServer(handleWebSocket(cfg))
	defer server.Close()

	wsURL := "ws" + server.URL[4:] + "/"

	wsConn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("failed to connect websocket: %v", err)
	}
	defer wsConn.Close()

	// Create large test data (32KB)
	testData := make([]byte, 32*1024)
	for i := range testData {
		testData[i] = byte(i % 256)
	}

	err = wsConn.WriteMessage(websocket.BinaryMessage, testData)
	if err != nil {
		t.Fatalf("failed to write large message: %v", err)
	}

	// Read all echoed data (might come in multiple chunks)
	received := make([]byte, 0, len(testData))
	deadline := time.Now().Add(5 * time.Second)

	for len(received) < len(testData) && time.Now().Before(deadline) {
		wsConn.SetReadDeadline(time.Now().Add(1 * time.Second))
		_, message, err := wsConn.ReadMessage()
		if err != nil {
			t.Fatalf("failed to read message: %v", err)
		}
		received = append(received, message...)
	}

	if !bytes.Equal(received, testData) {
		t.Errorf("large data mismatch: sent %d bytes, received %d bytes", len(testData), len(received))
	}
}

func TestWebSocketProxyInvalidVNCServer(t *testing.T) {
	// Use a port that doesn't have a server
	cfg := proxyConfig{
		targetHost: "127.0.0.1",
		targetPort: 55555,
	}

	server := httptest.NewServer(handleWebSocket(cfg))
	defer server.Close()

	wsURL := "ws" + server.URL[4:] + "/"

	wsConn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("failed to connect websocket: %v", err)
	}
	defer wsConn.Close()

	// Try to read - should get a close message
	wsConn.SetReadDeadline(time.Now().Add(5 * time.Second))
	msgType, _, err := wsConn.ReadMessage()
	if err == nil {
		if msgType != websocket.CloseMessage {
			t.Errorf("expected close message when VNC server unavailable")
		}
	}
}

func TestConfigLoading(t *testing.T) {
	tests := []struct {
		name     string
		envVars  map[string]string
		expected proxyConfig
	}{
		{
			name:    "default values",
			envVars: map[string]string{},
			expected: proxyConfig{
				listenPort: 39380,
				targetPort: 5901,
				targetHost: "127.0.0.1",
				webDir:     "/usr/share/novnc",
			},
		},
		{
			name: "custom values",
			envVars: map[string]string{
				"CMUX_VNC_PROXY_PORT":  "8080",
				"CMUX_VNC_TARGET_PORT": "5900",
				"CMUX_VNC_TARGET_HOST": "192.168.1.100",
				"CMUX_VNC_WEB_DIR":     "/custom/novnc",
			},
			expected: proxyConfig{
				listenPort: 8080,
				targetPort: 5900,
				targetHost: "192.168.1.100",
				webDir:     "/custom/novnc",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Set environment variables
			for key, value := range tt.envVars {
				t.Setenv(key, value)
			}

			cfg := loadConfig()

			if cfg.listenPort != tt.expected.listenPort {
				t.Errorf("listenPort: expected %d, got %d", tt.expected.listenPort, cfg.listenPort)
			}
			if cfg.targetPort != tt.expected.targetPort {
				t.Errorf("targetPort: expected %d, got %d", tt.expected.targetPort, cfg.targetPort)
			}
			if cfg.targetHost != tt.expected.targetHost {
				t.Errorf("targetHost: expected %s, got %s", tt.expected.targetHost, cfg.targetHost)
			}
			if cfg.webDir != tt.expected.webDir {
				t.Errorf("webDir: expected %s, got %s", tt.expected.webDir, cfg.webDir)
			}
		})
	}
}

func TestStaticFileServer(t *testing.T) {
	cfg := proxyConfig{
		listenPort: 39380,
		targetPort: 5901,
		targetHost: "127.0.0.1",
		webDir:     "/nonexistent",
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/websockify", handleWebSocket(cfg))

	// Try embedded files (will fail gracefully if not present)
	if _, err := novncFS.Open("novnc"); err == nil {
		mux.Handle("/", http.FileServer(http.FS(novncFS)))
	}

	server := httptest.NewServer(mux)
	defer server.Close()

	// Test that the server responds (even if files aren't served)
	resp, err := http.Get(server.URL + "/")
	if err != nil {
		t.Fatalf("failed to make request: %v", err)
	}
	defer resp.Body.Close()

	// Should get some response (either 404 or 200)
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNotFound {
		t.Errorf("unexpected status code: %d", resp.StatusCode)
	}
}

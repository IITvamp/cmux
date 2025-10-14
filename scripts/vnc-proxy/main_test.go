package main

import (
	"bytes"
	"context"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"nhooyr.io/websocket"
)

func TestProxyWebsocketRoundTrip(t *testing.T) {
	t.Parallel()

	payload := []byte("client->server")
	backendResponse := []byte("server->client")

	backendListener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("failed to listen for backend: %v", err)
	}
	defer backendListener.Close()

	received := make(chan []byte, 1)
	backendErr := make(chan error, 1)

	go func() {
		conn, err := backendListener.Accept()
		if err != nil {
			backendErr <- err
			return
		}
		defer conn.Close()

		buf := make([]byte, len(payload))
		if _, err := io.ReadFull(conn, buf); err != nil {
			backendErr <- err
			return
		}
		received <- append([]byte(nil), buf...)

		if _, err := conn.Write(backendResponse); err != nil {
			backendErr <- err
			return
		}

		backendErr <- nil
	}()

	cfg := proxyConfig{
		listenAddr:  "127.0.0.1:0",
		targetAddr:  backendListener.Addr().String(),
		webRoot:     "",
		dialTimeout: time.Second,
		idleTimeout: 2 * time.Second,
		readLimit:   defaultReadLimit,
	}

	proxy, err := newVNCProxy(cfg)
	if err != nil {
		t.Fatalf("failed to create proxy: %v", err)
	}

	server := httptest.NewServer(proxy)
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	conn, _, err := websocket.Dial(ctx, wsURL, nil)
	if err != nil {
		t.Fatalf("failed to dial websocket: %v", err)
	}
	defer conn.Close(websocket.StatusNormalClosure, "")

	if err := conn.Write(ctx, websocket.MessageBinary, payload); err != nil {
		t.Fatalf("failed to write message: %v", err)
	}

	select {
	case got := <-received:
		if !bytes.Equal(got, payload) {
			t.Fatalf("backend received %q, want %q", got, payload)
		}
	case err := <-backendErr:
		if err != nil {
			t.Fatalf("backend error: %v", err)
		}
	case <-ctx.Done():
		t.Fatalf("timeout waiting for backend data: %v", ctx.Err())
	}

	msgType, msg, err := conn.Read(ctx)
	if err != nil {
		t.Fatalf("failed to read response: %v", err)
	}
	if msgType != websocket.MessageBinary {
		t.Fatalf("expected binary message, got %v", msgType)
	}
	if !bytes.Equal(msg, backendResponse) {
		t.Fatalf("client received %q, want %q", msg, backendResponse)
	}

	if err := <-backendErr; err != nil {
		t.Fatalf("backend returned error: %v", err)
	}
}

func TestProxyStaticServing(t *testing.T) {
	t.Parallel()

	tmp := t.TempDir()
	vncPath := filepath.Join(tmp, "vnc.html")
	content := []byte("<html><body>ok</body></html>")
	if err := os.WriteFile(vncPath, content, 0o644); err != nil {
		t.Fatalf("failed to write test file: %v", err)
	}

	cfg := proxyConfig{
		listenAddr:  "127.0.0.1:0",
		targetAddr:  "127.0.0.1:5901",
		webRoot:     tmp,
		dialTimeout: time.Second,
		idleTimeout: time.Second,
		readLimit:   defaultReadLimit,
	}

	proxy, err := newVNCProxy(cfg)
	if err != nil {
		t.Fatalf("failed to create proxy: %v", err)
	}

	server := httptest.NewServer(proxy)
	defer server.Close()

	resp, err := http.Get(server.URL + "/")
	if err != nil {
		t.Fatalf("failed to GET /: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status for /: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("failed to read response body: %v", err)
	}
	if !bytes.Equal(body, content) {
		t.Fatalf("unexpected body for /: %q", body)
	}

	healthResp, err := http.Get(server.URL + "/healthz")
	if err != nil {
		t.Fatalf("failed to GET /healthz: %v", err)
	}
	defer healthResp.Body.Close()

	if healthResp.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status for /healthz: %d", healthResp.StatusCode)
	}
}

package main

import (
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestProxyForwardsBinaryData(t *testing.T) {
	backend, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("failed to listen: %v", err)
	}
	defer backend.Close()

	received := make(chan []byte, 1)

	go func() {
		conn, err := backend.Accept()
		if err != nil {
			return
		}
		defer conn.Close()
		_ = conn.SetDeadline(time.Now().Add(2 * time.Second))
		buf := make([]byte, 1024)
		n, err := conn.Read(buf)
		if n > 0 {
			payload := make([]byte, n)
			copy(payload, buf[:n])
			received <- payload
			_, _ = conn.Write([]byte{0x9, 0x8, 0x7})
		}
		_ = err
	}()

	handler, err := newRootHandler(proxyConfig{
		targetAddr:  backend.Addr().String(),
		dialTimeout: time.Second,
	})
	if err != nil {
		t.Fatalf("failed to create handler: %v", err)
	}

	server := httptest.NewServer(handler)
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/"
	conn, resp, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("failed to dial websocket (status %v): %v", respStatus(resp), err)
	}
	defer conn.Close()

	want := []byte{0x1, 0x2, 0x3}
	if err := conn.WriteMessage(websocket.BinaryMessage, want); err != nil {
		t.Fatalf("failed to write message: %v", err)
	}

	select {
	case got := <-received:
		if string(got) != string(want) {
			t.Fatalf("backend received %v, want %v", got, want)
		}
	case <-time.After(2 * time.Second):
		t.Fatalf("backend did not receive payload")
	}

	msgType, data, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("failed to read response: %v", err)
	}
	if msgType != websocket.BinaryMessage {
		t.Fatalf("unexpected message type %d", msgType)
	}
	expected := []byte{0x9, 0x8, 0x7}
	if string(data) != string(expected) {
		t.Fatalf("client received %v, want %v", data, expected)
	}
}

func TestStaticFilesServed(t *testing.T) {
	dir := t.TempDir()
	content := []byte("hello vnc")
	if err := os.WriteFile(filepath.Join(dir, "vnc.html"), content, 0o644); err != nil {
		t.Fatalf("write file: %v", err)
	}

	handler, err := newRootHandler(proxyConfig{
		targetAddr:  "127.0.0.1:65535",
		dialTimeout: time.Second,
		webDir:      dir,
	})
	if err != nil {
		t.Fatalf("failed to create handler: %v", err)
	}

	server := httptest.NewServer(handler)
	defer server.Close()

	resp, err := http.Get(server.URL + "/vnc.html")
	if err != nil {
		t.Fatalf("http get: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status %d", resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read body: %v", err)
	}
	if string(data) != string(content) {
		t.Fatalf("unexpected body %q", data)
	}
}

func TestBadGatewayWhenBackendUnavailable(t *testing.T) {
	addrListener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen temp: %v", err)
	}
	addr := addrListener.Addr().String()
	addrListener.Close()

	handler, err := newRootHandler(proxyConfig{
		targetAddr:  addr,
		dialTimeout: 200 * time.Millisecond,
	})
	if err != nil {
		t.Fatalf("failed to create handler: %v", err)
	}

	server := httptest.NewServer(handler)
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/"
	conn, resp, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err == nil {
		conn.Close()
		t.Fatalf("expected dial error")
	}
	if resp == nil {
		t.Fatalf("expected HTTP response")
	}
	if resp.StatusCode != http.StatusBadGateway {
		t.Fatalf("got status %d, want %d", resp.StatusCode, http.StatusBadGateway)
	}
}

func respStatus(resp *http.Response) interface{} {
	if resp == nil {
		return "<nil>"
	}
	return resp.Status
}

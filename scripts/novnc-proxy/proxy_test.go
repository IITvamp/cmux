package main

import (
	"bufio"
	"bytes"
	"encoding/base64"
	"encoding/binary"
	"fmt"
	"io"
	"log"
	"net"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"
)

func TestProxyBinaryRoundTrip(t *testing.T) {
	backend := newFakeBackend(t)
	t.Cleanup(backend.Close)

	proxy, err := newProxyServer(serverConfig{
		targetAddr: backend.Addr(),
		logger:     log.New(io.Discard, "", 0),
	})
	if err != nil {
		t.Fatalf("newProxyServer: %v", err)
	}

	ts := httptest.NewServer(proxy)
	t.Cleanup(ts.Close)

	client := newTestWSClient(t, ts.URL+"/websockify", []string{"binary"})
	t.Cleanup(func() { _ = client.Close() })

	backendConn := backend.Accept()
	defer backendConn.Close()
	if err := backendConn.SetReadDeadline(time.Now().Add(2 * time.Second)); err != nil {
		t.Fatalf("SetReadDeadline: %v", err)
	}

	payload := []byte{0x01, 0x02, 0x03, 0x04}
	clientMustWriteFrame(t, client, opcodeBinary, payload)

	buf := make([]byte, len(payload))
	if _, err := io.ReadFull(backendConn, buf); err != nil {
		t.Fatalf("backend ReadFull: %v", err)
	}
	if !bytes.Equal(buf, payload) {
		t.Fatalf("backend received %x, want %x", buf, payload)
	}

	response := []byte{0xAA, 0xBB, 0xCC, 0xDD}
	if _, err := backendConn.Write(response); err != nil {
		t.Fatalf("backend Write: %v", err)
	}

	frame := clientMustReadFrame(t, client)
	if frame.opcode != opcodeBinary {
		t.Fatalf("expected binary opcode, got %d", frame.opcode)
	}
	if !bytes.Equal(frame.payload, response) {
		t.Fatalf("client received %x, want %x", frame.payload, response)
	}
}

func TestProxyBase64RoundTrip(t *testing.T) {
	backend := newFakeBackend(t)
	t.Cleanup(backend.Close)

	proxy, err := newProxyServer(serverConfig{
		targetAddr: backend.Addr(),
		logger:     log.New(io.Discard, "", 0),
	})
	if err != nil {
		t.Fatalf("newProxyServer: %v", err)
	}

	ts := httptest.NewServer(proxy)
	t.Cleanup(ts.Close)

	client := newTestWSClient(t, ts.URL+"/websockify", []string{"base64"})
	t.Cleanup(func() { _ = client.Close() })

	backendConn := backend.Accept()
	defer backendConn.Close()
	if err := backendConn.SetReadDeadline(time.Now().Add(2 * time.Second)); err != nil {
		t.Fatalf("SetReadDeadline: %v", err)
	}

	sendData := []byte{0xDE, 0xAD, 0xBE, 0xEF, 0x00}
	encoded := []byte(base64.StdEncoding.EncodeToString(sendData))
	clientMustWriteFrame(t, client, opcodeText, encoded)

	buf := make([]byte, len(sendData))
	if _, err := io.ReadFull(backendConn, buf); err != nil {
		t.Fatalf("backend ReadFull: %v", err)
	}
	if !bytes.Equal(buf, sendData) {
		t.Fatalf("backend received %x, want %x", buf, sendData)
	}

	response := []byte{0x10, 0x20, 0x30}
	if _, err := backendConn.Write(response); err != nil {
		t.Fatalf("backend Write: %v", err)
	}

	frame := clientMustReadFrame(t, client)
	if frame.opcode != opcodeText {
		t.Fatalf("expected text opcode, got %d", frame.opcode)
	}
	expected := base64.StdEncoding.EncodeToString(response)
	if string(frame.payload) != expected {
		t.Fatalf("client received %q, want %q", frame.payload, expected)
	}
}

func TestSelectProtocol(t *testing.T) {
	tests := []struct {
		name     string
		values   []string
		wantProt string
		wantMode messageMode
		ok       bool
	}{
		{"none", nil, "", modeBinary, true},
		{"binary-first", []string{"binary"}, "binary", modeBinary, true},
		{"base64-only", []string{"base64"}, "base64", modeBase64, true},
		{"mixed", []string{"base64, binary"}, "binary", modeBinary, true},
		{"unsupported", []string{"json"}, "", modeBinary, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotProt, gotMode, ok := selectProtocol(tt.values)
			if gotProt != tt.wantProt || gotMode != tt.wantMode || ok != tt.ok {
				t.Fatalf("selectProtocol(%v) = %q, %v, %v; want %q, %v, %v", tt.values, gotProt, gotMode, ok, tt.wantProt, tt.wantMode, tt.ok)
			}
		})
	}
}

// --- Test helpers ---

type testWSClient struct {
	conn   net.Conn
	reader *bufio.Reader
}

func newTestWSClient(t *testing.T, rawURL string, protocols []string) *testWSClient {
	t.Helper()

	u, err := url.Parse(rawURL)
	if err != nil {
		t.Fatalf("url.Parse: %v", err)
	}

	conn, err := net.Dial("tcp", u.Host)
	if err != nil {
		t.Fatalf("net.Dial: %v", err)
	}

	key := base64.StdEncoding.EncodeToString([]byte("0123456789abcdef"))

	var req strings.Builder
	req.WriteString(fmt.Sprintf("GET %s HTTP/1.1\r\n", makeRequestPath(u)))
	req.WriteString(fmt.Sprintf("Host: %s\r\n", u.Host))
	req.WriteString("Upgrade: websocket\r\n")
	req.WriteString("Connection: Upgrade\r\n")
	req.WriteString("Sec-WebSocket-Version: 13\r\n")
	req.WriteString(fmt.Sprintf("Sec-WebSocket-Key: %s\r\n", key))
	req.WriteString(fmt.Sprintf("Origin: http://%s\r\n", u.Host))
	if len(protocols) > 0 {
		req.WriteString(fmt.Sprintf("Sec-WebSocket-Protocol: %s\r\n", strings.Join(protocols, ", ")))
	}
	req.WriteString("\r\n")

	if _, err := conn.Write([]byte(req.String())); err != nil {
		conn.Close()
		t.Fatalf("conn.Write: %v", err)
	}

	reader := bufio.NewReader(conn)
	status, err := reader.ReadString('\n')
	if err != nil {
		conn.Close()
		t.Fatalf("reading status: %v", err)
	}
	if !strings.Contains(status, "101") {
		conn.Close()
		t.Fatalf("unexpected status line %q", status)
	}

	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			conn.Close()
			t.Fatalf("reading headers: %v", err)
		}
		if line == "\r\n" {
			break
		}
	}

	return &testWSClient{conn: conn, reader: reader}
}

func makeRequestPath(u *url.URL) string {
	path := u.Path
	if path == "" {
		path = "/"
	}
	if u.RawQuery != "" {
		path += "?" + u.RawQuery
	}
	if u.Fragment != "" {
		path += "#" + u.Fragment
	}
	return path
}

func (c *testWSClient) Close() error {
	return c.conn.Close()
}

func clientMustWriteFrame(t *testing.T, c *testWSClient, opcode byte, payload []byte) {
	t.Helper()
	if err := writeClientFrame(c.conn, opcode, payload); err != nil {
		t.Fatalf("writeClientFrame: %v", err)
	}
}

func clientMustReadFrame(t *testing.T, c *testWSClient) wsFrame {
	t.Helper()
	frame, err := readFrame(c.reader, false)
	if err != nil {
		t.Fatalf("readFrame: %v", err)
	}
	return frame
}

func writeClientFrame(conn net.Conn, opcode byte, payload []byte) error {
	head := make([]byte, 10)
	head[0] = 0x80 | (opcode & 0x0F)

	payloadLen := len(payload)
	maskBit := byte(0x80)
	switch {
	case payloadLen <= 125:
		head[1] = maskBit | byte(payloadLen)
		if _, err := conn.Write(head[:2]); err != nil {
			return err
		}
	case payloadLen <= 0xFFFF:
		head[1] = maskBit | 126
		binaryLen := make([]byte, 2)
		binary.BigEndian.PutUint16(binaryLen, uint16(payloadLen))
		if _, err := conn.Write(append(head[:2], binaryLen...)); err != nil {
			return err
		}
	default:
		head[1] = maskBit | 127
		binaryLen := make([]byte, 8)
		binary.BigEndian.PutUint64(binaryLen, uint64(payloadLen))
		if _, err := conn.Write(append(head[:2], binaryLen...)); err != nil {
			return err
		}
	}

	mask := [4]byte{0x12, 0x34, 0x56, 0x78}
	if _, err := conn.Write(mask[:]); err != nil {
		return err
	}

	masked := make([]byte, payloadLen)
	for i := range payload {
		masked[i] = payload[i] ^ mask[i%4]
	}
	if payloadLen > 0 {
		if _, err := conn.Write(masked); err != nil {
			return err
		}
	}
	return nil
}

// fakeBackend is a helper that listens on a random localhost port and allows tests to accept a single connection.
type fakeBackend struct {
	ln net.Listener
	ch chan net.Conn
	t  *testing.T
}

func newFakeBackend(t *testing.T) *fakeBackend {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("net.Listen: %v", err)
	}
	fb := &fakeBackend{ln: ln, ch: make(chan net.Conn, 1), t: t}
	go func() {
		conn, err := ln.Accept()
		if err != nil {
			return
		}
		fb.ch <- conn
	}()
	return fb
}

func (f *fakeBackend) Addr() string {
	return f.ln.Addr().String()
}

func (f *fakeBackend) Accept() net.Conn {
	select {
	case conn := <-f.ch:
		return conn
	case <-time.After(2 * time.Second):
		f.t.Fatalf("timed out waiting for backend connection")
	}
	return nil
}

func (f *fakeBackend) Close() {
	f.ln.Close()
}

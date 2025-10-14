package main

import (
	"bufio"
	"bytes"
	"context"
	"crypto/sha1"
	"encoding/base64"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"sync"
)

const (
	opcodeContinuation = 0x0
	opcodeText         = 0x1
	opcodeBinary       = 0x2
	opcodeClose        = 0x8
	opcodePing         = 0x9
	opcodePong         = 0xA

	websocketGUID      = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
	maxFramePayloadLen = 1 << 24 // 16 MiB per frame cap to prevent abuse
)

type messageMode int

const (
	modeBinary messageMode = iota
	modeBase64
)

type wsWriter struct {
	conn net.Conn
	mu   sync.Mutex
}

func (w *wsWriter) writeFrame(opcode byte, payload []byte) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	return writeFrame(w.conn, opcode, payload)
}

func (p *proxyServer) serveWebsocket(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if !headerContainsToken(r.Header, "Connection", "Upgrade") || !strings.EqualFold(r.Header.Get("Upgrade"), "websocket") {
		http.Error(w, "upgrade required", http.StatusBadRequest)
		return
	}

	key := strings.TrimSpace(r.Header.Get("Sec-WebSocket-Key"))
	if key == "" {
		http.Error(w, "missing Sec-WebSocket-Key", http.StatusBadRequest)
		return
	}

	selectedProto, mode, ok := selectProtocol(r.Header.Values("Sec-WebSocket-Protocol"))
	if !ok {
		http.Error(w, "unsupported Sec-WebSocket-Protocol", http.StatusBadRequest)
		return
	}

	dialer := net.Dialer{Timeout: p.dialTimeout}
	backendConn, err := dialer.DialContext(r.Context(), "tcp", p.targetAddr)
	if err != nil {
		http.Error(w, "could not reach VNC backend", http.StatusBadGateway)
		return
	}

	hj, okHijacker := w.(http.Hijacker)
	if !okHijacker {
		backendConn.Close()
		http.Error(w, "websocket hijacking not supported", http.StatusInternalServerError)
		return
	}

	clientConn, rw, err := hj.Hijack()
	if err != nil {
		backendConn.Close()
		p.logger.Printf("failed to hijack connection: %v", err)
		return
	}

	if err := sendHandshakeResponse(rw.Writer, key, selectedProto); err != nil {
		backendConn.Close()
		clientConn.Close()
		p.logger.Printf("failed to write handshake response: %v", err)
		return
	}
	if err := rw.Flush(); err != nil {
		backendConn.Close()
		clientConn.Close()
		p.logger.Printf("failed to flush handshake response: %v", err)
		return
	}

	p.logger.Printf("accepted websocket from %s path=%s protocol=%s", clientConn.RemoteAddr(), r.URL.Path, selectedProto)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	clientWriter := &wsWriter{conn: clientConn}
	errCh := make(chan error, 2)

	go func() {
		errCh <- pumpClientToBackend(ctx, clientConn, backendConn, clientWriter, mode)
	}()
	go func() {
		errCh <- pumpBackendToClient(ctx, backendConn, clientWriter, mode)
	}()

	err1 := <-errCh
	cancel()
	if err1 != nil && !errors.Is(err1, io.EOF) {
		p.logger.Printf("client->backend stream ended: %v", err1)
	}
	backendConn.Close()
	clientConn.Close()

	err2 := <-errCh
	if err2 != nil && !errors.Is(err2, io.EOF) {
		p.logger.Printf("backend->client stream ended: %v", err2)
	}
}

func sendHandshakeResponse(w *bufio.Writer, key, protocol string) error {
	accept := computeAcceptKey(key)
	if _, err := fmt.Fprintf(w, "HTTP/1.1 101 Switching Protocols\r\n"); err != nil {
		return err
	}
	if _, err := fmt.Fprintf(w, "Upgrade: websocket\r\n"); err != nil {
		return err
	}
	if _, err := fmt.Fprintf(w, "Connection: Upgrade\r\n"); err != nil {
		return err
	}
	if _, err := fmt.Fprintf(w, "Sec-WebSocket-Accept: %s\r\n", accept); err != nil {
		return err
	}
	if protocol != "" {
		if _, err := fmt.Fprintf(w, "Sec-WebSocket-Protocol: %s\r\n", protocol); err != nil {
			return err
		}
	}
	if _, err := fmt.Fprintf(w, "\r\n"); err != nil {
		return err
	}
	return nil
}

func computeAcceptKey(key string) string {
	h := sha1.New()
	h.Write([]byte(key))
	h.Write([]byte(websocketGUID))
	return base64.StdEncoding.EncodeToString(h.Sum(nil))
}

func headerContainsToken(h http.Header, name, token string) bool {
	token = strings.ToLower(token)
	for _, value := range h.Values(name) {
		for _, part := range strings.Split(value, ",") {
			if strings.TrimSpace(strings.ToLower(part)) == token {
				return true
			}
		}
	}
	return false
}

func selectProtocol(values []string) (string, messageMode, bool) {
	var options []string
	for _, raw := range values {
		for _, part := range strings.Split(raw, ",") {
			part = strings.TrimSpace(strings.ToLower(part))
			if part != "" {
				options = append(options, part)
			}
		}
	}
	if len(options) == 0 {
		return "", modeBinary, true
	}
	for _, proto := range options {
		if proto == "binary" {
			return "binary", modeBinary, true
		}
	}
	for _, proto := range options {
		if proto == "base64" {
			return "base64", modeBase64, true
		}
	}
	return "", modeBinary, false
}

func pumpClientToBackend(ctx context.Context, clientConn net.Conn, backendConn net.Conn, clientWriter *wsWriter, mode messageMode) error {
	reader := bufio.NewReader(clientConn)
	var (
		aggregator       bytes.Buffer
		aggregatorActive bool
		aggregatorType   byte
	)

	for {
		if err := ctx.Err(); err != nil {
			return err
		}

		frame, err := readFrame(reader, true)
		if err != nil {
			return err
		}

		switch frame.opcode {
		case opcodeBinary, opcodeText:
			if aggregatorActive {
				return fmt.Errorf("received new data frame before prior message completed")
			}
			aggregator.Reset()
			aggregator.Write(frame.payload)
			aggregatorType = frame.opcode
			aggregatorActive = !frame.fin
			if !aggregatorActive {
				if err := forwardToBackend(backendConn, aggregator.Bytes(), aggregatorType, mode); err != nil {
					return err
				}
			}
		case opcodeContinuation:
			if !aggregatorActive {
				return fmt.Errorf("unexpected continuation frame")
			}
			aggregator.Write(frame.payload)
			aggregatorActive = !frame.fin
			if !aggregatorActive {
				if err := forwardToBackend(backendConn, aggregator.Bytes(), aggregatorType, mode); err != nil {
					return err
				}
			}
		case opcodePing:
			if err := clientWriter.writeFrame(opcodePong, frame.payload); err != nil {
				return err
			}
		case opcodePong:
			// ignore unsolicited pong
		case opcodeClose:
			_ = clientWriter.writeFrame(opcodeClose, frame.payload)
			return io.EOF
		default:
			return fmt.Errorf("unsupported websocket opcode: %d", frame.opcode)
		}
	}
}

func forwardToBackend(backend net.Conn, payload []byte, opcode byte, mode messageMode) error {
	switch mode {
	case modeBinary:
		if opcode != opcodeBinary && opcode != opcodeContinuation {
			return fmt.Errorf("unexpected frame type %d for binary mode", opcode)
		}
		if len(payload) == 0 {
			return nil
		}
		_, err := backend.Write(payload)
		return err
	case modeBase64:
		if opcode != opcodeText && opcode != opcodeContinuation {
			return fmt.Errorf("unexpected frame type %d for base64 mode", opcode)
		}
		if len(payload) == 0 {
			return nil
		}
		decoded := make([]byte, base64.StdEncoding.DecodedLen(len(payload)))
		n, err := base64.StdEncoding.Decode(decoded, payload)
		if err != nil {
			return fmt.Errorf("base64 decode failed: %w", err)
		}
		if n == 0 {
			return nil
		}
		_, err = backend.Write(decoded[:n])
		return err
	default:
		return fmt.Errorf("unknown message mode %d", mode)
	}
}

func pumpBackendToClient(ctx context.Context, backendConn net.Conn, clientWriter *wsWriter, mode messageMode) error {
	buf := make([]byte, 64*1024)
	for {
		if err := ctx.Err(); err != nil {
			return err
		}

		n, err := backendConn.Read(buf)
		if n > 0 {
			var writeErr error
			switch mode {
			case modeBinary:
				writeErr = clientWriter.writeFrame(opcodeBinary, buf[:n])
			case modeBase64:
				encoded := make([]byte, base64.StdEncoding.EncodedLen(n))
				base64.StdEncoding.Encode(encoded, buf[:n])
				writeErr = clientWriter.writeFrame(opcodeText, encoded)
			default:
				writeErr = fmt.Errorf("unknown message mode %d", mode)
			}
			if writeErr != nil {
				return writeErr
			}
		}

		if err != nil {
			if errors.Is(err, io.EOF) {
				_ = clientWriter.writeFrame(opcodeClose, []byte{0x03, 0xE8})
				return io.EOF
			}
			return err
		}
	}
}

type wsFrame struct {
	fin     bool
	opcode  byte
	payload []byte
}

func readFrame(r *bufio.Reader, expectMask bool) (wsFrame, error) {
	var frame wsFrame

	headerByte, err := r.ReadByte()
	if err != nil {
		return frame, err
	}

	frame.fin = headerByte&0x80 != 0
	if headerByte&0x70 != 0 {
		return frame, fmt.Errorf("reserved bits set in frame header: 0x%02x", headerByte)
	}
	frame.opcode = headerByte & 0x0F

	lenByte, err := r.ReadByte()
	if err != nil {
		return frame, err
	}

	masked := lenByte&0x80 != 0
	lengthIndicator := int(lenByte & 0x7F)

	if expectMask && !masked {
		return frame, errors.New("received unmasked frame from client")
	}
	if !expectMask && masked {
		return frame, errors.New("received masked frame from server")
	}

	payloadLen, err := readPayloadLength(r, lengthIndicator)
	if err != nil {
		return frame, err
	}
	if payloadLen > maxFramePayloadLen {
		return frame, fmt.Errorf("frame payload too large (%d bytes)", payloadLen)
	}

	var maskKey [4]byte
	if masked {
		if _, err := io.ReadFull(r, maskKey[:]); err != nil {
			return frame, err
		}
	}

	if payloadLen > 0 {
		frame.payload = make([]byte, payloadLen)
		if _, err := io.ReadFull(r, frame.payload); err != nil {
			return frame, err
		}
		if masked {
			for i := range frame.payload {
				frame.payload[i] ^= maskKey[i%4]
			}
		}
	} else {
		frame.payload = nil
	}

	return frame, nil
}

func readPayloadLength(r *bufio.Reader, indicator int) (int, error) {
	switch indicator {
	case 126:
		var extended uint16
		if err := binary.Read(r, binary.BigEndian, &extended); err != nil {
			return 0, err
		}
		return int(extended), nil
	case 127:
		var extended uint64
		if err := binary.Read(r, binary.BigEndian, &extended); err != nil {
			return 0, err
		}
		if extended > 1<<63-1 {
			return 0, fmt.Errorf("frame length too large: %d", extended)
		}
		return int(extended), nil
	default:
		return indicator, nil
	}
}

func writeFrame(w net.Conn, opcode byte, payload []byte) error {
	head := make([]byte, 10)
	head[0] = 0x80 | (opcode & 0x0F)

	payloadLen := len(payload)
	switch {
	case payloadLen <= 125:
		head[1] = byte(payloadLen)
		if _, err := w.Write(head[:2]); err != nil {
			return err
		}
	case payloadLen <= 0xFFFF:
		head[1] = 126
		binary.BigEndian.PutUint16(head[2:], uint16(payloadLen))
		if _, err := w.Write(head[:4]); err != nil {
			return err
		}
	default:
		head[1] = 127
		binary.BigEndian.PutUint64(head[2:], uint64(payloadLen))
		if _, err := w.Write(head[:10]); err != nil {
			return err
		}
	}

	if payloadLen > 0 {
		if _, err := w.Write(payload); err != nil {
			return err
		}
	}

	return nil
}

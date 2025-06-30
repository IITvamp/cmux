import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Socket } from 'socket.io-client';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  terminalId: string;
  socket: Socket | null;
  isActive: boolean;
}

export function Terminal({ terminalId, socket, isActive }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (!terminalRef.current || !socket || isInitializedRef.current) return;
    
    isInitializedRef.current = true;

    const terminal = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#aeafad',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5'
      },
      allowProposedApi: true,
      scrollback: 10000
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    
    terminal.open(terminalRef.current);
    
    fitAddon.fit();
    fitAddonRef.current = fitAddon;
    xtermRef.current = terminal;

    const handleOutput = ({ terminalId: id, data }: { terminalId: string; data: string }) => {
      if (id === terminalId) {
        terminal.write(data);
      }
    };

    const handleExit = ({ terminalId: id, exitCode }: { terminalId: string; exitCode: number }) => {
      if (id === terminalId) {
        terminal.write(`\r\n[Process exited with code ${exitCode}]\r\n`);
      }
    };

    socket.on('terminal-output', handleOutput);
    socket.on('terminal-exit', handleExit);

    terminal.onData((data) => {
      socket.emit('terminal-input', { terminalId, data });
    });

    terminal.onResize(({ cols, rows }) => {
      socket.emit('resize', { terminalId, cols, rows });
    });

    const handleResize = () => {
      if (fitAddonRef.current && xtermRef.current) {
        fitAddonRef.current.fit();
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      socket.off('terminal-output', handleOutput);
      socket.off('terminal-exit', handleExit);
      terminal.dispose();
      isInitializedRef.current = false;
    };
  }, [terminalId, socket]);

  useEffect(() => {
    if (isActive && fitAddonRef.current) {
      fitAddonRef.current.fit();
    }
  }, [isActive]);

  return (
    <div 
      ref={terminalRef} 
      style={{ 
        width: '100%', 
        height: '100%',
        backgroundColor: '#1e1e1e'
      }} 
    />
  );
}
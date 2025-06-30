import { useState, useEffect, useRef } from 'react';
import { Terminal } from './Terminal';
import { io, Socket } from 'socket.io-client';

interface TerminalInstance {
  id: string;
  name: string;
}

export function TerminalManager() {
  const [terminals, setTerminals] = useState<TerminalInstance[]>([]);
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const terminalCountRef = useRef(0);

  useEffect(() => {
    const socket = io('http://localhost:3001');
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to terminal server');
      createNewTerminal();
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from terminal server');
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const createNewTerminal = () => {
    if (!socketRef.current) return;
    
    terminalCountRef.current += 1;
    const newTerminal: TerminalInstance = {
      id: '', // Will be set by server
      name: `Terminal ${terminalCountRef.current}`
    };

    socketRef.current.emit('create-terminal', { cols: 80, rows: 24 });
    
    socketRef.current.once('terminal-created', ({ terminalId }: { terminalId: string }) => {
      newTerminal.id = terminalId;
      setTerminals(prev => [...prev, newTerminal]);
      setActiveTerminalId(terminalId);
    });
  };

  const closeTerminal = (terminalId: string) => {
    if (!socketRef.current) return;
    
    socketRef.current.emit('close-terminal', { terminalId });
    
    setTerminals(prev => {
      const newTerminals = prev.filter(t => t.id !== terminalId);
      
      if (activeTerminalId === terminalId && newTerminals.length > 0) {
        setActiveTerminalId(newTerminals[newTerminals.length - 1].id);
      } else if (newTerminals.length === 0) {
        setActiveTerminalId(null);
      }
      
      return newTerminals;
    });
  };

  return (
    <div className="terminal-manager">
      <div className="terminal-tabs">
        {terminals.map(terminal => (
          <div
            key={terminal.id}
            className={`terminal-tab ${activeTerminalId === terminal.id ? 'active' : ''}`}
            onClick={() => setActiveTerminalId(terminal.id)}
          >
            <span className="tab-name">{terminal.name}</span>
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                closeTerminal(terminal.id);
              }}
              aria-label="Close terminal"
            >
              ×
            </button>
          </div>
        ))}
        <button
          className="new-terminal-btn"
          onClick={createNewTerminal}
          aria-label="New terminal"
        >
          +
        </button>
      </div>
      <div className="terminal-content">
        {terminals.map(terminal => (
          <div
            key={terminal.id}
            className={`terminal-pane ${activeTerminalId === terminal.id ? 'active' : ''}`}
          >
            <Terminal
              terminalId={terminal.id}
              socket={socketRef.current}
              isActive={activeTerminalId === terminal.id}
            />
          </div>
        ))}
        {terminals.length === 0 && (
          <div className="no-terminals">
            <p>No terminals open</p>
            <button onClick={createNewTerminal}>Create Terminal</button>
          </div>
        )}
      </div>
    </div>
  );
}
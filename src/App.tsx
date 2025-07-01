import { TerminalManager } from './components/TerminalManager';
import { TerminalContextProvider } from './contexts/TerminalContextProvider';
import './App.css';

function App() {
  return (
    <TerminalContextProvider>
      <div className="app">
        <header className="app-header">
          <h1>Terminal</h1>
        </header>
        <main className="app-main">
          <TerminalManager />
        </main>
      </div>
    </TerminalContextProvider>
  );
}

export default App

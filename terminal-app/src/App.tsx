import { TerminalManager } from './components/TerminalManager';
import './App.css';

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Terminal</h1>
      </header>
      <main className="app-main">
        <TerminalManager />
      </main>
    </div>
  );
}

export default App

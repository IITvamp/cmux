import { Terminal } from './components/Terminal';
import './App.css';

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Terminal</h1>
      </header>
      <main className="app-main">
        <Terminal />
      </main>
    </div>
  );
}

export default App

import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useWebContentsView } from "../hooks/useWebContentsView";
import { isElectron } from "../lib/electron";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { ArrowLeft, ArrowRight, RefreshCw, X, Globe, Wrench } from "lucide-react";

export const Route = createFileRoute("/debug-wcv")({  
  component: DebugWebContentsView,
});

function DebugWebContentsView() {
  const [url, setUrl] = useState("https://www.google.com");
  const [inputUrl, setInputUrl] = useState(url);
  const containerRef = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState({ x: 0, y: 100, width: 800, height: 600 });
  
  const { state, actions } = useWebContentsView({
    url,
    bounds,
    visible: true,
    backgroundColor: "#ffffff",
  });

  // Update bounds when container size changes
  useEffect(() => {
    if (!containerRef.current || !isElectron) return;

    const updateBounds = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const newBounds = {
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
        setBounds(newBounds);
        actions.setBounds(newBounds);
      }
    };

    // Initial update
    updateBounds();

    // Update on window resize
    const resizeObserver = new ResizeObserver(updateBounds);
    resizeObserver.observe(containerRef.current);

    window.addEventListener("resize", updateBounds);
    
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateBounds);
    };
  }, [actions]);

  const handleNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    let urlToLoad = inputUrl;
    
    // Add protocol if missing
    if (!urlToLoad.match(/^https?:\/\//)) {
      urlToLoad = `https://${urlToLoad}`;
    }
    
    setUrl(urlToLoad);
    actions.loadURL(urlToLoad);
  };

  // Update input when navigation occurs
  useEffect(() => {
    if (state.url && state.url !== inputUrl && !state.loading) {
      setInputUrl(state.url);
    }
  }, [state.url, state.loading]);

  if (!isElectron) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <Globe className="mx-auto h-12 w-12 text-neutral-400 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Electron Only Feature</h2>
          <p className="text-neutral-600 dark:text-neutral-400">
            WebContentsView demo is only available in the Electron app.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Browser toolbar */}
      <div className="flex items-center gap-2 p-2 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => actions.goBack()}
          disabled={!state.canGoBack}
          className="h-8 w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => actions.goForward()}
          disabled={!state.canGoForward}
          className="h-8 w-8"
        >
          <ArrowRight className="h-4 w-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => actions.reload()}
          className="h-8 w-8"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
        
        {state.loading && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => actions.stop()}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        
        <form onSubmit={handleNavigate} className="flex-1 flex gap-2">
          <Input
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="Enter URL..."
            className="flex-1"
          />
          <Button type="submit" size="sm">
            Go
          </Button>
        </form>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => actions.openDevTools()}
          className="h-8 w-8"
        >
          <Wrench className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-neutral-100 dark:bg-neutral-900 text-xs text-neutral-600 dark:text-neutral-400">
        <div className="flex items-center gap-4">
          {state.loading && <span className="text-blue-600 dark:text-blue-400">Loading...</span>}
          {state.error && <span className="text-red-600 dark:text-red-400">Error: {state.error}</span>}
          {!state.loading && !state.error && state.title && (
            <span className="font-medium">{state.title}</span>
          )}
        </div>
        <span className="truncate max-w-md">{state.url}</span>
      </div>
      
      {/* WebContentsView container */}
      <div 
        ref={containerRef} 
        className="flex-1 relative bg-white dark:bg-neutral-900"
        style={{ minHeight: 0 }}
      >
        {/* The WebContentsView will be rendered here by Electron */}
        {state.id === null && (
          <div className="absolute inset-0 flex items-center justify-center text-neutral-500">
            Initializing WebContentsView...
          </div>
        )}
      </div>
    </div>
  );
}
import React, { useEffect, useMemo, useRef, useState } from 'react';

export type CommentPayload = {
  id: string;
  nodeId: string; // CSS selectors, may be comma-separated fallbacks
  x: number; // 0..1 within node rect width
  y: number; // 0..1 within node rect height
  page: string;
  pageTitle: string;
  userAgent: string;
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
};

type CommentRecord = CommentPayload & { createdAt: string };

export type PreviewCommentsProps = {
  serverUrl?: string; // e.g. http://localhost:9779
};

// Minimal Tailwind v4 preflight + a handful of utilities used by the widget.
// This is embedded and injected into the shadow root so host apps need no CSS.
const TAILWIND_CSS = `
/* Tailwind Preflight (trimmed) */
*,::before,::after{box-sizing:border-box;border-width:0;border-style:solid;border-color:#e5e7eb}
::before,::after{--tw-content:''}
html{line-height:1.5;-webkit-text-size-adjust:100%;tab-size:4;font-feature-settings:normal}
body{margin:0;line-height:inherit}
h1,h2,h3,h4,h5,h6{font-size:inherit;font-weight:inherit}
a{color:inherit;text-decoration:inherit}
button,input,select,textarea{font:inherit;margin:0}
button{background-color:transparent;background-image:none}
img,svg,video,canvas{display:block;max-width:100%;height:auto}
/* Utilities used by the widget */
.fixed{position:fixed}
.absolute{position:absolute}
.relative{position:relative}
.inset-0{inset:0}
.top-0{top:0}
.left-0{left:0}
.right-0{right:0}
.bottom-0{bottom:0}
.z-50{z-index:50}
.z-40{z-index:40}
.m-0{margin:0}
.p-2{padding:.5rem}
.p-3{padding:.75rem}
.p-4{padding:1rem}
.px-2{padding-left:.5rem;padding-right:.5rem}
.py-1{padding-top:.25rem;padding-bottom:.25rem}
.py-2{padding-top:.5rem;padding-bottom:.5rem}
.gap-2{gap:.5rem}
.rounded-md{border-radius:.375rem}
.rounded-full{border-radius:9999px}
.border{border-width:1px}
.border-neutral-300{--tw-border-opacity:1;border-color:rgb(212 212 216 / var(--tw-border-opacity))}
.bg-white{--tw-bg-opacity:1;background-color:rgb(255 255 255 / var(--tw-bg-opacity))}
.bg-neutral-50{--tw-bg-opacity:1;background-color:rgb(250 250 250 / var(--tw-bg-opacity))}
.bg-neutral-100{--tw-bg-opacity:1;background-color:rgb(245 245 245 / var(--tw-bg-opacity))}
.bg-neutral-800{--tw-bg-opacity:1;background-color:rgb(38 38 38 / var(--tw-bg-opacity))}
.bg-neutral-900{--tw-bg-opacity:1;background-color:rgb(23 23 23 / var(--tw-bg-opacity))}
.text-neutral-900{--tw-text-opacity:1;color:rgb(23 23 23 / var(--tw-text-opacity))}
.text-neutral-50{--tw-text-opacity:1;color:rgb(250 250 250 / var(--tw-text-opacity))}
.text-neutral-600{--tw-text-opacity:1;color:rgb(82 82 82 / var(--tw-text-opacity))}
.shadow{--tw-shadow:0 1px 3px 0 rgb(0 0 0 / .1),0 1px 2px -1px rgb(0 0 0 / .1);--tw-shadow-colored:0 1px 3px 0 var(--tw-shadow-color),0 1px 2px -1px var(--tw-shadow-color);box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}
.shadow-lg{--tw-shadow:0 10px 15px -3px rgb(0 0 0 / .1),0 4px 6px -4px rgb(0 0 0 / .1);--tw-shadow-colored:0 10px 15px -3px var(--tw-shadow-color),0 4px 6px -4px var(--tw-shadow-color);box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}
.backdrop-blur{--tw-backdrop-blur:blur(8px);-webkit-backdrop-filter:var(--tw-backdrop-blur);backdrop-filter:var(--tw-backdrop-blur)}
.backdrop-saturate-150{--tw-backdrop-saturate:saturate(1.5);-webkit-backdrop-filter:var(--tw-backdrop-saturate);backdrop-filter:var(--tw-backdrop-saturate)}
.flex{display:flex}
.inline-flex{display:inline-flex}
.items-center{align-items:center}
.justify-between{justify-content:space-between}
.text-sm{font-size:.875rem;line-height:1.25rem}
.text-xs{font-size:.75rem;line-height:1rem}
.font-medium{font-weight:500}
.cursor-move{cursor:move}
.cursor-pointer{cursor:pointer}
.select-none{-webkit-user-select:none;-moz-user-select:none;user-select:none}
.w-64{width:16rem}
.h-8{height:2rem}
.min-w-6{min-width:1.5rem}
.min-h-6{min-height:1.5rem}
.opacity-80{opacity:.8}
.hover\:opacity-100:hover{opacity:1}
.ring-1{--tw-ring-offset-shadow:var(--tw-ring-inset) 0 0 0 calc(0px + var(--tw-ring-offset-width)) var(--tw-ring-offset-color);--tw-ring-shadow:var(--tw-ring-inset) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color);box-shadow:var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow,0 0 #0000)}
.ring-neutral-300{--tw-ring-opacity:1;--tw-ring-color:rgb(212 212 216 / var(--tw-ring-opacity))}
.hover\:ring-neutral-400:hover{--tw-ring-opacity:1;--tw-ring-color:rgb(163 163 163 / var(--tw-ring-opacity))}
.transition{transition-property:color,background-color,border-color,text-decoration-color,fill,stroke,opacity,box-shadow,transform,filter,backdrop-filter;transition-duration:150ms;transition-timing-function:cubic-bezier(.4,0,.2,1)}
.translate-x-1{--tw-translate-x:0.25rem;transform:translate(var(--tw-translate-x,0),var(--tw-translate-y,0))}
.translate-y-1{--tw-translate-y:0.25rem;transform:translate(var(--tw-translate-x,0),var(--tw-translate-y,0))}
@media (prefers-color-scheme: dark){
  .dark\:bg-neutral-900{--tw-bg-opacity:1;background-color:rgb(23 23 23 / var(--tw-bg-opacity))}
  .dark\:text-neutral-50{--tw-text-opacity:1;color:rgb(250 250 250 / var(--tw-text-opacity))}
  .dark\:border-neutral-700{--tw-border-opacity:1;border-color:rgb(64 64 64 / var(--tw-border-opacity))}
}
`;

function randomId(): string {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}

function getBestSelector(node: Element | null): string {
  if (!node) return '';
  // Simple CSS path builder with nth-of-type to be stable.
  const parts: string[] = [];
  let el: Element | null = node;
  while (el && el.nodeType === 1 && parts.length < 8) {
    const tag = el.tagName.toLowerCase();
    let sel = tag;
    if (el.id) {
      sel = `#${CSS.escape(el.id)}`;
      parts.unshift(sel);
      break;
    }
    if (el.classList.length > 0 && el.classList.length <= 2) {
      sel += '.' + Array.from(el.classList).map((c) => CSS.escape(c)).join('.');
    }
    const parent = el.parentElement;
    if (parent) {
      const tagSiblings = Array.from(parent.children).filter((ch) => (ch as Element).tagName === el!.tagName);
      const index = tagSiblings.indexOf(el) + 1;
      sel += `:nth-of-type(${index})`;
    }
    parts.unshift(sel);
    el = parent;
  }
  return parts.join('>');
}

function findTarget(nodeId: string): Element | null {
  const selectors = nodeId.split(',').map((s) => s.trim()).filter(Boolean);
  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel);
      if (el) return el;
    } catch {
      // ignore invalid selector
    }
  }
  return null;
}

export function PreviewCommentsWidget({ serverUrl }: PreviewCommentsProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const shadowRootRef = useRef<ShadowRoot | null>(null);
  const [mounted, setMounted] = useState(false);
  const [drag, setDrag] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 24, y: 24 });
  const [isOpen, setIsOpen] = useState(true);
  const [isPlacing, setIsPlacing] = useState(false);
  const [comments, setComments] = useState<CommentRecord[]>([]);

  const baseUrl = useMemo(() => {
    return serverUrl ?? (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:9779');
  }, [serverUrl]);

  // Setup shadow root once on mount
  useEffect(() => {
    if (!containerRef.current) return;
    if (!shadowRootRef.current) {
      shadowRootRef.current = containerRef.current.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = TAILWIND_CSS;
      shadowRootRef.current.appendChild(style);
      const appRoot = document.createElement('div');
      appRoot.setAttribute('id', 'app');
      shadowRootRef.current.appendChild(appRoot);
    }
    setMounted(true);
  }, []);

  // Fetch comments for this page
  useEffect(() => {
    if (!mounted) return;
    const page = typeof window !== 'undefined' ? window.location.pathname : '/';
    fetch(`${baseUrl}/api/comments?page=${encodeURIComponent(page)}`)
      .then((r) => r.ok ? r.json() : Promise.reject(new Error('Failed to load comments')))
      .then((data: { comments: CommentRecord[] }) => setComments(data.comments))
      .catch(() => {});
  }, [mounted, baseUrl]);

  // Reposition markers on scroll/resize
  useEffect(() => {
    const onReflow = () => setComments((c) => [...c]);
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, []);

  // Drag logic
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      setPosition({ x: e.clientX - drag.dx, y: e.clientY - drag.dy });
    };
    const onUp = () => setDrag(null);
    if (drag) {
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp, { once: true });
    }
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [drag]);

  const startPlacing = () => setIsPlacing(true);

  useEffect(() => {
    if (!isPlacing) return;
    const onClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const target = e.target as Element | null;
      if (!target) return;
      const el = target instanceof Element ? target : null;
      const rect = el?.getBoundingClientRect();
      if (!el || !rect) return;
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      const payload: CommentPayload = {
        id: randomId(),
        nodeId: getBestSelector(el),
        x,
        y,
        page: window.location.pathname,
        pageTitle: document.title,
        userAgent: navigator.userAgent,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        devicePixelRatio: window.devicePixelRatio || 1,
      };
      fetch(`${baseUrl}/api/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then((r) => r.ok ? r.json() : Promise.reject(new Error('Failed to create')))
        .then((created: { comment: CommentRecord }) => {
          setComments((prev) => [...prev, created.comment]);
        })
        .catch(() => {})
        .finally(() => setIsPlacing(false));
    };
    // Capture phase so we intercept before page handlers
    window.addEventListener('click', onClick, true);
    return () => window.removeEventListener('click', onClick, true);
  }, [isPlacing, baseUrl]);

  // Render into shadow root
  const appHost = shadowRootRef.current?.getElementById('app');
  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    top: position.y,
    left: position.x,
  };

  const markerNodes = comments.map((c) => {
    const el = findTarget(c.nodeId);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cx = r.left + c.x * r.width;
    const cy = r.top + c.y * r.height;
    const style: React.CSSProperties = {
      position: 'fixed',
      top: cy,
      left: cx,
      transform: 'translate(-50%, -50%)',
    };
    return (
      <div key={c.id} className="absolute" style={style} part="marker">
        <div className="inline-flex min-w-6 min-h-6 items-center justify-center rounded-full bg-neutral-900 text-neutral-50 text-xs shadow ring-1 ring-neutral-300">
          •
        </div>
      </div>
    );
  });

  return (
    <div ref={containerRef} className="fixed inset-0 pointer-events-none z-40">
      {appHost && (
        <>
          {/* Markers overlay */}
          <div className="fixed inset-0 pointer-events-none z-40 select-none">
            {markerNodes}
          </div>
          {/* Control panel */}
          <div className="fixed z-50" style={panelStyle}>
            <div
              className="w-64 rounded-md border border-neutral-300 bg-white dark:bg-neutral-900 shadow-lg backdrop-blur backdrop-saturate-150 pointer-events-auto"
              part="panel"
            >
              <div
                className="flex items-center justify-between p-2 cursor-move select-none"
                onPointerDown={(e) => {
                  const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                  setDrag({ x: rect.left, y: rect.top, dx: e.clientX - rect.left, dy: e.clientY - rect.top });
                }}
              >
                <div className="text-sm font-medium text-neutral-900 dark:text-neutral-50">Comments</div>
                <button
                  className="text-xs text-neutral-600 hover:opacity-100 opacity-80 transition"
                  onClick={() => setIsOpen((v) => !v)}
                >
                  {isOpen ? '–' : '+'}
                </button>
              </div>
              {isOpen && (
                <div className="p-3">
                  <div className="flex items-center gap-2">
                    <button
                      className="px-2 py-1 rounded-md border border-neutral-300 ring-1 ring-neutral-300 hover:ring-neutral-400 transition"
                      onClick={startPlacing}
                    >
                      Add comment
                    </button>
                    {isPlacing && (
                      <span className="text-xs text-neutral-600">Click anywhere to place…</span>
                    )}
                  </div>
                  <div className="mt-2 text-xs text-neutral-600">
                    {comments.length} comment{comments.length === 1 ? '' : 's'} on this page
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default PreviewCommentsWidget;


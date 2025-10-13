"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

type CodeBlockProps = {
  code: string;
  language?: string;
  title?: string;
};

export function CodeBlock({ code, language = "bash", title }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950 overflow-hidden">
      {title && (
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-2 bg-neutral-900/50">
          <span className="text-xs font-medium text-neutral-400">{title}</span>
          <span className="text-xs text-neutral-500">{language}</span>
        </div>
      )}
      <div className="relative">
        <pre className="p-4 overflow-x-auto text-sm">
          <code className="text-neutral-300">{code}</code>
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 p-2 rounded-md bg-neutral-800 hover:bg-neutral-700 transition-colors"
          aria-label="Copy code"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-400" />
          ) : (
            <Copy className="h-4 w-4 text-neutral-400" />
          )}
        </button>
      </div>
    </div>
  );
}

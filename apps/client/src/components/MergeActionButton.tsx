import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export type MergeStrategy = "squash" | "rebase" | "merge";

export function MergeActionButton(props: {
  mode: "pr" | "merge";
  onOpenPr?: () => void | Promise<void>;
  onMerge?: (strategy: MergeStrategy) => void | Promise<void>;
  defaultStrategy?: MergeStrategy;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}) {
  const {
    mode,
    onOpenPr,
    onMerge,
    defaultStrategy = "squash",
    disabled,
    loading,
    className,
  } = props;

  const [open, setOpen] = useState(false);
  const [strategy, setStrategy] = useState<MergeStrategy>(defaultStrategy);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const baseGreen = "#2ea44f"; // GitHub merge green
  const hoverGreen = "#2c974b";

  if (mode === "pr") {
    return (
      <Button
        className={className}
        style={{ backgroundColor: baseGreen, color: "#fff" }}
        onClick={() => onOpenPr?.()}
        disabled={disabled || loading}
      >
        {loading ? "Opening PR…" : "Open PR"}
      </Button>
    );
  }

  return (
    <div className={`inline-flex items-stretch ${className ?? ""}`} ref={menuRef}>
      <Button
        className="rounded-r-none"
        style={{
          backgroundColor: baseGreen,
          color: "#fff",
          borderRight: `1px solid ${hoverGreen}`,
        }}
        onClick={() => onMerge?.(strategy)}
        disabled={disabled || loading}
        title={
          strategy === "squash"
            ? "Squash and merge"
            : strategy === "rebase"
            ? "Rebase and merge"
            : "Create a merge commit"
        }
      >
        {loading
          ? "Merging…"
          : strategy === "squash"
          ? "Squash and merge"
          : strategy === "rebase"
          ? "Rebase and merge"
          : "Merge commit"}
      </Button>
      <Button
        className="rounded-l-none px-2"
        style={{ backgroundColor: baseGreen, color: "#fff" }}
        onClick={() => setOpen((v) => !v)}
        disabled={disabled || loading}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <ChevronDown className="w-4 h-4" />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute mt-10 z-10 min-w-48 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-md"
        >
          {(
            [
              { key: "squash", label: "Squash and merge" },
              { key: "rebase", label: "Rebase and merge" },
              { key: "merge", label: "Create a merge commit" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              role="menuitemradio"
              aria-checked={strategy === opt.key}
              onClick={() => {
                setStrategy(opt.key);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                strategy === opt.key
                  ? "text-neutral-900 dark:text-neutral-100"
                  : "text-neutral-600 dark:text-neutral-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


import * as Popover from "@radix-ui/react-popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import clsx from "clsx";
import { Check, ChevronDown, Loader2, AlertTriangle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export interface BaseOption {
  label: string;
  value: string;
  isUnavailable?: boolean;
}

export interface CommandMultiSelectProps {
  options: Array<string | BaseOption>;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  singleSelect?: boolean;
  className?: string;
  loading?: boolean;
  maxTagCount?: number;
  showSearch?: boolean;
}

function normalizeOptions(options: Array<string | BaseOption>): BaseOption[] {
  return options.map((o) =>
    typeof o === "string" ? { label: o, value: o } : o
  );
}

export default function CommandMultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select",
  singleSelect = false,
  className,
  loading = false,
  maxTagCount,
  showSearch = true,
}: CommandMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const normalized = useMemo(() => normalizeOptions(options), [options]);
  const selectedSet = useMemo(() => new Set(value), [value]);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // Close on single-select choose
  const handleSelect = (val: string): void => {
    if (singleSelect) {
      onChange([val]);
      setOpen(false);
      // return focus to trigger for accessibility
      requestAnimationFrame(() => triggerRef.current?.focus());
    } else {
      const next = new Set(selectedSet);
      if (next.has(val)) next.delete(val);
      else next.add(val);
      onChange(Array.from(next));
    }
  };

  // Reset search each time we open
  useEffect(() => {
    if (open) setSearch("");
  }, [open]);

  const selectedLabels = useMemo(() => {
    const map = new Map(normalized.map((o) => [o.value, o.label] as const));
    return value.map((v) => map.get(v) || v);
  }, [normalized, value]);

  const renderTriggerContent = () => {
    if (loading) {
      return (
        <span className="inline-flex items-center gap-2 truncate">
          <Loader2 className="h-4 w-4 animate-spin text-neutral-500" />
          <span className="text-neutral-500">Loading…</span>
        </span>
      );
    }
    if (singleSelect) {
      const label = selectedLabels[0];
      return (
        <span className="truncate text-left">
          {label ? (
            <span className="text-neutral-900 dark:text-neutral-100">{label}</span>
          ) : (
            <span className="text-neutral-500">{placeholder}</span>
          )}
        </span>
      );
    }
    // Multi-select summary with optional maxTagCount
    if (selectedLabels.length === 0) {
      return <span className="text-neutral-500">{placeholder}</span>;
    }
    const limit = typeof maxTagCount === "number" ? Math.max(0, maxTagCount) : selectedLabels.length;
    const shown = selectedLabels.slice(0, limit || selectedLabels.length);
    const omitted = Math.max(0, selectedLabels.length - shown.length);
    return (
      <span className="flex items-center gap-1.5 flex-wrap">
        {shown.map((l, i) => (
          <span
            key={`${l}-${i}`}
            className="inline-flex items-center rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 px-2 py-0.5 text-xs"
          >
            {l}
          </span>
        ))}
        {omitted > 0 ? (
          <span className="text-xs text-neutral-500 dark:text-neutral-400">+{omitted}</span>
        ) : null}
      </span>
    );
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          ref={triggerRef}
          type="button"
          className={clsx(
            "inline-flex w-full items-center justify-between gap-2 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 h-9 text-sm",
            "text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-900",
            "transition-colors",
            className
          )}
        >
          <span className="min-w-0 grow truncate text-left">{renderTriggerContent()}</span>
          <ChevronDown className="w-4 h-4 shrink-0 text-neutral-500" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className={clsx(
            "z-50 w-[var(--popover-w,220px)] rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-0 shadow-md outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out"
          )}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div style={{ width: "var(--popover-w, 260px)" }}>
            <Command>
              {showSearch ? (
                <CommandInput
                  autoFocus
                  value={search}
                  onValueChange={setSearch}
                  placeholder="Search…"
                />
              ) : null}
              <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>
                <CommandGroup>
                  {normalized.map((opt) => {
                    const isSelected = selectedSet.has(opt.value);
                    return (
                      <CommandItem
                        key={opt.value}
                        value={`${opt.label} ${opt.value}`}
                        onSelect={() => handleSelect(opt.value)}
                        className="justify-between"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={clsx(
                              "mr-1 h-4 w-4 rounded-sm border grid place-items-center shrink-0",
                              isSelected
                                ? "border-neutral-700 bg-neutral-800"
                                : "border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                            )}
                          >
                            <Check
                              className={clsx(
                                "w-3 h-3 text-white transition-opacity",
                                isSelected ? "opacity-100" : "opacity-0"
                              )}
                            />
                          </div>
                          <span className="truncate">{opt.label}</span>
                        </div>
                        {opt.isUnavailable ? (
                          <AlertTriangle className="w-3 h-3 text-amber-500" />
                        ) : null}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

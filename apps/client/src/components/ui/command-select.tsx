import * as Popover from "@radix-ui/react-popover";
import { Command } from "cmdk";
import clsx from "clsx";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

export type CommandSelectOption = {
  label: string;
  value: string;
  isUnavailable?: boolean;
  disabled?: boolean;
};

export interface CommandSelectProps {
  options: Array<string | CommandSelectOption>;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  singleSelect?: boolean;
  className?: string;
  loading?: boolean;
  maxTagCount?: number;
  showSearch?: boolean;
}

const toOption = (opt: string | CommandSelectOption): CommandSelectOption =>
  typeof opt === "string" ? { label: opt, value: opt } : opt;

export function CommandSelect({
  options,
  value,
  onChange,
  placeholder,
  singleSelect = false,
  className,
  loading = false,
  maxTagCount,
  showSearch = true,
}: CommandSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const normalizedOptions = useMemo(
    () => options.map(toOption),
    [options]
  );

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return normalizedOptions;
    return normalizedOptions.filter((o) =>
      `${o.label} ${o.value}`.toLowerCase().includes(s)
    );
  }, [normalizedOptions, search]);

  const listRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 36,
    overscan: 8,
  });

  const handleToggle = useCallback(
    (val: string) => {
      if (singleSelect) {
        onChange([val]);
        setOpen(false);
        return;
      }

      const set = new Set(value);
      if (set.has(val)) set.delete(val);
      else set.add(val);
      onChange(Array.from(set));
    },
    [onChange, singleSelect, value]
  );

  // Keep selected option in view when the popover opens
  useEffect(() => {
    if (!open) return;
    if (!value.length) return;
    const firstIndex = filtered.findIndex((o) => o.value === value[0]);
    if (firstIndex >= 0) rowVirtualizer.scrollToIndex(firstIndex, { align: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const selectedOptions = useMemo(
    () => normalizedOptions.filter((o) => value.includes(o.value)),
    [normalizedOptions, value]
  );

  const renderTriggerLabel = useMemo(() => {
    if (selectedOptions.length === 0) return (
      <span className="text-neutral-500 dark:text-neutral-400">{placeholder || "Select"}</span>
    );
    if (singleSelect) return selectedOptions[0]?.label ?? placeholder ?? "Select";
    const showCount = maxTagCount ?? Infinity;
    const shown = selectedOptions.slice(0, showCount);
    const omitted = selectedOptions.length - shown.length;
    return (
      <div className="flex items-center gap-1.5">
        {shown.map((opt) => (
          <span
            key={opt.value}
            className="px-1.5 py-0.5 rounded-md text-xs bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-600"
          >
            {opt.label}
          </span>
        ))}
        {omitted > 0 && (
          <span className="px-1.5 py-0.5 rounded-md text-xs bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-600">+{omitted}</span>
        )}
      </div>
    );
  }, [maxTagCount, placeholder, selectedOptions, singleSelect]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={clsx(
            "inline-flex items-center justify-between gap-2 px-3 h-9 rounded-2xl",
            "bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-600",
            "text-sm text-neutral-900 dark:text-neutral-100 w-full",
            "hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors",
            className
          )}
          disabled={loading}
        >
          <div className="flex-1 min-w-0 text-left truncate">{renderTriggerLabel}</div>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-neutral-500" />
          ) : (
            <ChevronsUpDown className="h-4 w-4 text-neutral-500" />
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={8}
          align="start"
          className={clsx(
            "z-50 w-[var(--radix-popover-trigger-width)] max-w-[420px]",
            "rounded-xl border bg-white dark:bg-neutral-900",
            "border-neutral-200 dark:border-neutral-700 shadow-lg"
          )}
        >
          <div className="flex flex-col">
            {showSearch && (
              <Command className="w-full">
                <Command.Input
                  value={search}
                  onValueChange={setSearch}
                  autoFocus
                  placeholder={placeholder || "Search..."}
                  className="w-full px-3 py-2 text-sm bg-transparent outline-none border-b border-neutral-200 dark:border-neutral-700 placeholder:text-neutral-500 dark:placeholder:text-neutral-400"
                />
              </Command>
            )}

            <div
              ref={listRef}
              className="max-h-60 overflow-auto py-1"
              style={{
                // prevent layout shift from virtual row heights
                contain: "content",
              }}
            >
              {filtered.length === 0 ? (
                <div className="px-3 py-6 text-sm text-neutral-500 dark:text-neutral-400">No options</div>
              ) : (
                <div
                  style={{ height: rowVirtualizer.getTotalSize() }}
                  className="relative"
                >
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const opt = filtered[virtualRow.index]!;
                    const selected = value.includes(opt.value);
                    return (
                      <div
                        key={opt.value}
                        data-index={virtualRow.index}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: virtualRow.size,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <Command.Item
                          // cmdk still gives us roving focus & kbd nav
                          value={opt.value}
                          onSelect={() => handleToggle(opt.value)}
                          disabled={opt.disabled}
                          className={clsx(
                            "flex items-center gap-2 px-3 h-9 cursor-pointer",
                            "text-sm text-neutral-900 dark:text-neutral-100",
                            "data-[selected=true]:bg-neutral-100 dark:data-[selected=true]:bg-neutral-800",
                            opt.disabled
                              ? "opacity-50 cursor-not-allowed"
                              : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
                          )}
                        >
                          <span className="flex-1 truncate">
                            {opt.label}
                            {opt.isUnavailable && (
                              <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">unavailable</span>
                            )}
                          </span>
                          {selected && (
                            <Check className="h-4 w-4 text-neutral-700 dark:text-neutral-300" />
                          )}
                        </Command.Item>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export default CommandSelect;

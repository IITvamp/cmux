import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import * as Popover from "@radix-ui/react-popover";
import { useVirtualizer } from "@tanstack/react-virtual";
import clsx from "clsx";
import { AlertTriangle, Check, ChevronDown, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export interface SelectOptionObject {
  label: string;
  value: string;
  isUnavailable?: boolean;
}

export type SelectOption = string | SelectOptionObject;

export interface SearchableSelectProps {
  options: SelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  singleSelect?: boolean;
  className?: string;
  loading?: boolean;
  maxTagCount?: number;
  showSearch?: boolean;
  disabled?: boolean;
}

function normalizeOptions(options: SelectOption[]): SelectOptionObject[] {
  return options.map((o) =>
    typeof o === "string" ? { label: o, value: o } : o
  );
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select",
  singleSelect = false,
  className,
  loading = false,
  maxTagCount,
  showSearch = true,
  disabled = false,
}: SearchableSelectProps) {
  const normOptions = useMemo(() => normalizeOptions(options), [options]);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [search, setSearch] = useState("");
  const [_recalcTick, setRecalcTick] = useState(0);
  // Popover width is fixed; no need to track trigger width

  const selectedSet = useMemo(() => new Set(value), [value]);
  const selectedLabels = useMemo(() => {
    const byValue = new Map(
      normOptions.map((o) => [o.value, o.label] as const)
    );
    return value.map((v) => byValue.get(v) ?? v);
  }, [normOptions, value]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const displayContent = useMemo(() => {
    if (value.length === 0) {
      return <span className="text-neutral-400 truncate">{placeholder}</span>;
    }
    if (singleSelect) {
      return <span className="truncate">{selectedLabels[0]}</span>;
    }
    const n = value.length;
    const cap = Math.max(0, maxTagCount ?? 0);
    const shown = cap > 0 ? selectedLabels.slice(0, cap) : selectedLabels;
    return (
      <span className="flex items-center gap-1.5 flex-nowrap overflow-hidden">
        {shown.map((l, idx) => (
          <span
            key={`${l}-${idx}`}
            className="inline-flex items-center gap-1 rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 px-2 py-0.5 text-[13.5px] max-w-[9rem] truncate"
          >
            {l}
          </span>
        ))}
        {cap > 0 && n > cap ? (
          <span className="text-[13.5px] text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
            +{n - cap}
          </span>
        ) : null}
      </span>
    );
  }, [maxTagCount, placeholder, selectedLabels, singleSelect, value.length]);

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return normOptions;
    return normOptions.filter((o) =>
      `${o.label} ${o.value}`.toLowerCase().includes(q)
    );
  }, [normOptions, search]);

  const listRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredOptions.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 32,
    overscan: 20,
    // Use an initial rect so the first open has a viewport size
    // even before ResizeObserver kicks in.
    initialRect: { width: 300, height: 300 },
  });

  // Debug logs to investigate empty-first-open issue
  useEffect(() => {
    console.log(
      `[SearchableSelect] render open=${open} filtered=${filteredOptions.length} virtual=${rowVirtualizer.getVirtualItems().length} hasListRef=${!!listRef.current} clientH=${listRef.current?.clientHeight ?? 0} scrollH=${listRef.current?.scrollHeight ?? 0} tick=${_recalcTick}`
    );
  });

  useEffect(() => {
    if (open) {
      // Force a recompute on open after layout.
      requestAnimationFrame(() => {
        try {
          rowVirtualizer.scrollToIndex(0, { align: "start", behavior: "auto" });
        } catch {
          /* noop */
        }
        console.log(
          `[SearchableSelect] opened hasListRef=${!!listRef.current} clientH=${listRef.current?.clientHeight ?? 0}`
        );
        // Nudge a re-render so getVirtualItems() reflects latest measurements
        setRecalcTick((n) => n + 1);
      });
    }
  }, [open, rowVirtualizer]);

  useEffect(() => {
    console.log(
      `[SearchableSelect] search change q="${search}" filtered=${filteredOptions.length}`
    );
  }, [search, filteredOptions.length]);

  const onSelectValue = (val: string): void => {
    if (singleSelect) {
      onChange([val]);
      setOpen(false);
      return;
    }
    const next = new Set(value);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    onChange(Array.from(next));
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <div className={clsx("relative inline-flex items-center")}>
        <Popover.Trigger asChild>
          <button
            ref={triggerRef}
            type="button"
            disabled={disabled}
            className={clsx(
              "inline-flex h-8 items-center rounded-md border",
              "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950",
              "px-2.5 pr-6 text-sm text-neutral-900 dark:text-neutral-100",
              "focus:outline-none",
              "disabled:cursor-not-allowed disabled:opacity-60",
              "w-auto",
              className
            )}
          >
            <span className="flex-1 min-w-0 text-left text-sm">
              {displayContent}
            </span>
          </button>
        </Popover.Trigger>
        {value.length > 0 && !singleSelect ? (
          <button
            type="button"
            aria-label="Clear selection"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onChange([]);
            }}
            className="absolute right-12 top-1/2 -translate-y-1/2 rounded p-0.5 hover:bg-neutral-100 dark:hover:bg-neutral-900"
          >
            <X className="h-3 w-3 text-neutral-500" />
          </button>
        ) : null}
        {loading ? (
          <Loader2 className="absolute right-7 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-neutral-400" />
        ) : null}
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
      </div>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={2}
          className={clsx(
            "z-50 rounded-md border",
            "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950",
            "p-0 shadow-md outline-none"
          )}
          style={{ width: 300 }}
        >
          <Command loop shouldFilter={false} className="text-[13.5px]">
            {showSearch ? (
              <CommandInput
                showIcon={false}
                placeholder="Search..."
                value={search}
                onValueChange={setSearch}
                className="text-[13.5px] py-2"
              />
            ) : null}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
              </div>
            ) : (
              <CommandList
                ref={listRef}
                className="max-h-[300px] overflow-y-auto"
              >
                {filteredOptions.length === 0 ? (
                  <CommandEmpty>No options</CommandEmpty>
                ) : (
                  <CommandGroup>
                    {(() => {
                      const vItems = rowVirtualizer.getVirtualItems();
                      if (vItems.length === 0 && filteredOptions.length > 0) {
                        console.log(
                          `[SearchableSelect] fallback render filtered=${filteredOptions.length}`
                        );
                        const fallback = filteredOptions.slice(0, 12);
                        return (
                          <div>
                            {fallback.map((opt) => {
                              const isSelected = selectedSet.has(opt.value);
                              return (
                                <CommandItem
                                  key={`fallback-${opt.value}`}
                                  value={`${opt.label} ${opt.value}`}
                                  className="flex items-center justify-between gap-2 text-[13.5px] py-1.5"
                                  onSelect={() => onSelectValue(opt.value)}
                                >
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <span className="truncate">
                                      {opt.label}
                                    </span>
                                    {opt.isUnavailable ? (
                                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                    ) : null}
                                  </div>
                                  <Check
                                    className={clsx(
                                      "h-4 w-4 shrink-0 transition-opacity",
                                      isSelected
                                        ? "opacity-100 text-neutral-700 dark:text-neutral-300"
                                        : "opacity-0"
                                    )}
                                  />
                                </CommandItem>
                              );
                            })}
                          </div>
                        );
                      }
                      return (
                        <div
                          style={{
                            height: rowVirtualizer.getTotalSize(),
                            position: "relative",
                          }}
                        >
                          {vItems.map((vr) => {
                            const opt = filteredOptions[vr.index]!;
                            const isSelected = selectedSet.has(opt.value);
                            return (
                              <div
                                key={opt.value}
                                data-index={vr.index}
                                ref={rowVirtualizer.measureElement}
                                style={{
                                  position: "absolute",
                                  top: 0,
                                  left: 0,
                                  width: "100%",
                                  transform: `translateY(${vr.start}px)`,
                                }}
                              >
                                <CommandItem
                                  value={`${opt.label} ${opt.value}`}
                                  className="flex items-center justify-between gap-2 text-[13.5px] py-1.5"
                                  onSelect={() => onSelectValue(opt.value)}
                                >
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <span className="truncate">
                                      {opt.label}
                                    </span>
                                    {opt.isUnavailable ? (
                                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                    ) : null}
                                  </div>
                                  <Check
                                    className={clsx(
                                      "h-4 w-4 shrink-0 transition-opacity",
                                      isSelected
                                        ? "opacity-100 text-neutral-700 dark:text-neutral-300"
                                        : "opacity-0"
                                    )}
                                  />
                                </CommandItem>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </CommandGroup>
                )}
              </CommandList>
            )}
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export default SearchableSelect;

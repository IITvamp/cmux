import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Skeleton } from "@heroui/react";
import * as Popover from "@radix-ui/react-popover";
import { useVirtualizer } from "@tanstack/react-virtual";
import clsx from "clsx";
import { AlertTriangle, Check, ChevronDown, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export interface SelectOptionObject {
  label: string;
  value: string;
  isUnavailable?: boolean;
  // Optional icon element to render before the label
  icon?: React.ReactNode;
  // Stable key for the icon, used for de-duplication in stacked view
  iconKey?: string;
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
  // Label shown in multi-select trigger as "N <countLabel>"
  countLabel?: string;
  // Optional icon rendered at the start of the trigger (outside option labels)
  leftIcon?: React.ReactNode;
}

function normalizeOptions(options: SelectOption[]): SelectOptionObject[] {
  return options.map((o) =>
    typeof o === "string" ? { label: o, value: o } : o
  );
}

interface OptionItemProps {
  opt: SelectOptionObject;
  isSelected: boolean;
  onSelectValue: (val: string) => void;
}

function OptionItem({ opt, isSelected, onSelectValue }: OptionItemProps) {
  return (
    <CommandItem
      value={`${opt.label} ${opt.value}`}
      className="flex items-center justify-between gap-2 text-[13.5px] py-1.5 h-[32px]"
      onSelect={() => onSelectValue(opt.value)}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {opt.icon ? (
          <span className="shrink-0 inline-flex items-center justify-center">
            {opt.icon}
          </span>
        ) : null}
        <span className="truncate">{opt.label}</span>
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
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select",
  singleSelect = false,
  className,
  loading = false,
  maxTagCount: _maxTagCount,
  showSearch = true,
  disabled = false,
  countLabel = "selected",
  leftIcon,
}: SearchableSelectProps) {
  const normOptions = useMemo(() => normalizeOptions(options), [options]);
  const valueToOption = useMemo(
    () => new Map(normOptions.map((o) => [o.value, o])),
    [normOptions]
  );
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
    if (loading) {
      return <Skeleton className="h-4 w-18 rounded-lg" />;
    }
    if (value.length === 0) {
      return <span className="text-neutral-400 truncate">{placeholder}</span>;
    }
    // If exactly one is selected (single or multi), show icon (if any) + label
    if (value.length === 1) {
      const selectedVal = value[0];
      const selectedOpt = normOptions.find((o) => o.value === selectedVal);
      const label = selectedLabels[0];
      return (
        <span className="inline-flex items-center gap-2">
          {selectedOpt?.icon ? (
            <span className="shrink-0 inline-flex items-center justify-center">
              {selectedOpt.icon}
            </span>
          ) : null}
          <span className="truncate">{label}</span>
        </span>
      );
    }
    // Multi-select with multiple items: if icons exist, show stacked icons + count
    const selectedWithIcons = value
      .map((v) => {
        const o = valueToOption.get(v);
        if (!o || !o.icon) return null;
        return { key: o.iconKey ?? o.value, icon: o.icon };
      })
      .filter(Boolean) as Array<{ key: string; icon: React.ReactNode }>;
    // Deduplicate by icon key (e.g., vendor) while preserving order
    const seen = new Set<string>();
    const uniqueIcons: React.ReactNode[] = [];
    for (const it of selectedWithIcons) {
      if (seen.has(it.key)) continue;
      seen.add(it.key);
      uniqueIcons.push(it.icon);
    }
    if (uniqueIcons.length >= 2) {
      const maxIcons = 5;
      return (
        <span className="inline-flex items-center gap-2">
          <span className="flex space-x-[2px]">
            {uniqueIcons.slice(0, maxIcons).map((ico, i) => (
              <span
                key={i}
                className={clsx(
                  "inline-flex h-4 w-4 items-center justify-center overflow-hidden"
                )}
              >
                {ico}
              </span>
            ))}
          </span>
          <span className="truncate">{`${value.length} ${countLabel}`}</span>
        </span>
      );
    }
    // Fallback: show count only
    return <span className="truncate">{`${value.length} ${countLabel}`}</span>;
  }, [
    countLabel,
    loading,
    normOptions,
    placeholder,
    selectedLabels,
    value,
    valueToOption,
  ]);

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

  useEffect(() => {
    if (open) {
      // Force a recompute on open after layout.
      requestAnimationFrame(() => {
        try {
          rowVirtualizer.scrollToIndex(0, { align: "start", behavior: "auto" });
        } catch {
          /* noop */
        }
        // Nudge a re-render so getVirtualItems() reflects latest measurements
        setRecalcTick((n) => n + 1);
      });
    }
  }, [open, rowVirtualizer]);

  const onSelectValue = (val: string): void => {
    // Clear search input upon selecting a value (covers mouse and keyboard selection)
    setSearch("");
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
              "inline-flex h-7 items-center rounded-md border",
              "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950",
              // Dim background when popover is open via aria-expanded
              "aria-expanded:bg-neutral-50 dark:aria-expanded:bg-neutral-900",
              // Smooth color change on hover/open
              "transition-colors",
              "px-2.5 pr-6 text-sm text-neutral-900 dark:text-neutral-100",
              // Focus-visible ring for accessibility
              "outline-none focus:outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
              "disabled:cursor-not-allowed disabled:opacity-60",
              "w-auto",
              className
            )}
          >
            <span className="flex-1 min-w-0 text-left text-[13.5px] inline-flex items-center gap-1.5">
              {leftIcon ? (
                <span className="shrink-0 inline-flex items-center justify-center">
                  {leftIcon}
                </span>
              ) : null}
              {displayContent}
            </span>
          </button>
        </Popover.Trigger>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
      </div>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={2}
          className={clsx(
            "z-50 rounded-md border",
            "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950",
            // Fade out on close; open remains instant
            "p-0 shadow-md outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
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
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    // Clear the search box when pressing Enter
                    setSearch("");
                  }
                }}
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
                        const fallback = filteredOptions.slice(0, 12);
                        return (
                          <div>
                            {fallback.map((opt) => {
                              const isSelected = selectedSet.has(opt.value);
                              return (
                                <OptionItem
                                  key={`fallback-${opt.value}`}
                                  opt={opt}
                                  isSelected={isSelected}
                                  onSelectValue={onSelectValue}
                                />
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
                                <OptionItem
                                  opt={opt}
                                  isSelected={isSelected}
                                  onSelectValue={onSelectValue}
                                />
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

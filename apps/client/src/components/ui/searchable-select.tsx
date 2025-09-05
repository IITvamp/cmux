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
import { Check, ChevronDown, Loader2, X, AlertTriangle } from "lucide-react";
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

  const selectedSet = useMemo(() => new Set(value), [value]);
  const selectedLabels = useMemo(() => {
    const byValue = new Map(normOptions.map((o) => [o.value, o.label] as const));
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
      return (
        <span className="text-neutral-400 truncate">{placeholder}</span>
      );
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
            className="inline-flex items-center gap-1 rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 px-2 py-0.5 text-xs max-w-[9rem] truncate"
          >
            {l}
          </span>
        ))}
        {cap > 0 && n > cap ? (
          <span className="text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap">+{n - cap}</span>
        ) : null}
      </span>
    );
  }, [maxTagCount, placeholder, selectedLabels, singleSelect, value.length]);

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
      <Popover.Trigger asChild>
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          className={clsx(
            "inline-flex h-9 items-center justify-between gap-2 rounded-md border",
            "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950",
            "px-3 text-sm text-neutral-900 dark:text-neutral-100",
            "focus:outline-none focus:ring-2 focus:ring-neutral-300 dark:focus:ring-neutral-700",
            "disabled:cursor-not-allowed disabled:opacity-60",
            "min-w-[160px]",
            className
          )}
        >
          <span className="flex-1 min-w-0 text-left">{displayContent}</span>
          <div className="flex items-center gap-1">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
            ) : null}
            {value.length > 0 && !singleSelect ? (
              <button
                type="button"
                aria-label="Clear selection"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange([]);
                }}
                className="-mr-1 rounded p-1 hover:bg-neutral-100 dark:hover:bg-neutral-900"
              >
                <X className="h-3.5 w-3.5 text-neutral-500" />
              </button>
            ) : null}
            <ChevronDown className="h-4 w-4 text-neutral-500" />
          </div>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className={clsx(
            "z-50 w-[--radix-popover-trigger-width] rounded-md border",
            "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950",
            "p-0 shadow-md outline-none"
          )}
        >
          <Command loop>
            {showSearch ? (
              <CommandInput placeholder="Search..." />
            ) : null}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
              </div>
            ) : normOptions.length === 0 ? (
              <CommandEmpty>No options</CommandEmpty>
            ) : (
              <CommandList>
                <CommandGroup>
                  {normOptions.map((opt) => {
                    const isSelected = selectedSet.has(opt.value);
                    return (
                      <CommandItem
                        key={opt.value}
                        value={`${opt.label} ${opt.value}`}
                        className="flex items-center justify-between gap-2"
                        onSelect={() => onSelectValue(opt.value)}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
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
                  })}
                </CommandGroup>
              </CommandList>
            )}
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export default SearchableSelect;

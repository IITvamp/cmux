import * as Popover from "@radix-ui/react-popover";
import { useVirtualizer } from "@tanstack/react-virtual";
import clsx from "clsx";
import { Command as CommandPrimitive } from "cmdk";
import { AlertTriangle, Check, ChevronsUpDown, Loader2, X } from "lucide-react";
import * as React from "react";

export interface ComboboxOption {
  value: string;
  label: string;
  isUnavailable?: boolean;
}

interface ComboboxDropdownProps {
  options: string[] | ComboboxOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  multiple?: boolean;
  className?: string;
  loading?: boolean;
  maxTagCount?: number;
  showSearch?: boolean;
  minWidth?: string;
  maxWidth?: string;
}

export function ComboboxDropdown({
  options,
  value,
  onChange,
  placeholder = "Select...",
  multiple = false,
  className,
  loading = false,
  maxTagCount,
  showSearch = true,
  minWidth = "120px",
  maxWidth = "500px",
}: ComboboxDropdownProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Normalize options to ComboboxOption format
  const normalizedOptions = React.useMemo<ComboboxOption[]>(
    () =>
      options.map((opt) =>
        typeof opt === "string" ? { value: opt, label: opt } : opt
      ),
    [options]
  );

  // Filter options based on search
  const filteredOptions = React.useMemo(() => {
    if (!search) return normalizedOptions;
    const searchLower = search.toLowerCase();
    return normalizedOptions.filter((opt) =>
      opt.label.toLowerCase().includes(searchLower)
    );
  }, [normalizedOptions, search]);

  // Set up virtualizer for large lists
  const virtualizer = useVirtualizer({
    count: filteredOptions.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 32,
    overscan: 5,
  });

  const handleSelect = React.useCallback(
    (optionValue: string) => {
      if (multiple) {
        const newValue = value.includes(optionValue)
          ? value.filter((v) => v !== optionValue)
          : [...value, optionValue];
        onChange(newValue);
      } else {
        onChange([optionValue]);
        setOpen(false);
      }
    },
    [multiple, value, onChange]
  );

  const handleClear = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange([]);
    },
    [onChange]
  );

  // Get display label
  const getDisplayLabel = React.useCallback(() => {
    if (value.length === 0) return placeholder;
    
    if (multiple) {
      if (maxTagCount && value.length > maxTagCount) {
        const visibleOptions = value.slice(0, maxTagCount);
        const hiddenCount = value.length - maxTagCount;
        return (
          <span className="flex items-center gap-1">
            {visibleOptions.map((v) => {
              const opt = normalizedOptions.find((o) => o.value === v);
              return (
                <span
                  key={v}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-neutral-100 dark:bg-neutral-800"
                >
                  {opt?.label || v}
                </span>
              );
            })}
            <span className="text-xs text-neutral-500">+{hiddenCount}</span>
          </span>
        );
      }
      return (
        <span className="flex items-center gap-1 flex-wrap">
          {value.map((v) => {
            const opt = normalizedOptions.find((o) => o.value === v);
            return (
              <span
                key={v}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-neutral-100 dark:bg-neutral-800"
              >
                {opt?.label || v}
              </span>
            );
          })}
        </span>
      );
    }
    
    const selectedOption = normalizedOptions.find((o) => o.value === value[0]);
    return selectedOption?.label || value[0];
  }, [value, placeholder, multiple, maxTagCount, normalizedOptions]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          ref={triggerRef}
          className={clsx(
            "relative flex items-center justify-between px-3 py-1.5 text-sm",
            "bg-white dark:bg-neutral-700/50",
            "border border-neutral-200 dark:border-neutral-600",
            "rounded-2xl",
            "hover:bg-neutral-50 dark:hover:bg-neutral-700",
            "focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-950",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-colors",
            className
          )}
          style={{
            minWidth,
            maxWidth,
          }}
          disabled={loading}
        >
          <span className={clsx(
            "flex-1 text-left truncate",
            value.length === 0 && "text-neutral-500 dark:text-neutral-400"
          )}>
            {getDisplayLabel()}
          </span>
          <div className="flex items-center gap-1 ml-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin text-neutral-500" />}
            {!loading && value.length > 0 && !multiple && (
              <X
                className="h-4 w-4 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                onClick={handleClear}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 text-neutral-500" />
          </div>
        </button>
      </Popover.Trigger>
      
      <Popover.Portal>
        <Popover.Content
          className={clsx(
            "z-50 w-full p-0",
            "bg-white dark:bg-neutral-950",
            "border border-neutral-200 dark:border-neutral-800",
            "rounded-lg shadow-lg",
            "animate-in fade-in-0 zoom-in-95"
          )}
          align="start"
          sideOffset={4}
          style={{
            width: triggerRef.current?.offsetWidth,
            minWidth: "200px",
          }}
        >
          <CommandPrimitive>
            {showSearch && (
              <div className="flex items-center border-b border-neutral-200 dark:border-neutral-800 px-3">
                <CommandPrimitive.Input
                  value={search}
                  onValueChange={setSearch}
                  placeholder="Search..."
                  className="flex h-9 w-full bg-transparent py-2 text-sm outline-none placeholder:text-neutral-500 dark:placeholder:text-neutral-400"
                />
              </div>
            )}
            
            <CommandPrimitive.List
              ref={listRef}
              className="max-h-[300px] overflow-y-auto overflow-x-hidden p-1"
            >
              {filteredOptions.length === 0 && (
                <div className="py-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
                  No results found
                </div>
              )}
              
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  position: "relative",
                }}
              >
                {virtualizer.getVirtualItems().map((virtualItem) => {
                  const option = filteredOptions[virtualItem.index];
                  const isSelected = value.includes(option.value);
                  
                  return (
                    <CommandPrimitive.Item
                      key={option.value}
                      value={option.value}
                      onSelect={() => handleSelect(option.value)}
                      className={clsx(
                        "absolute top-0 left-0 w-full",
                        "flex cursor-pointer select-none items-center justify-between rounded-sm px-2 py-1.5 text-sm outline-none",
                        "hover:bg-neutral-100 dark:hover:bg-neutral-800",
                        "data-[selected]:bg-neutral-100 dark:data-[selected]:bg-neutral-800",
                        isSelected && "bg-neutral-100 dark:bg-neutral-800"
                      )}
                      style={{
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span>{option.label}</span>
                        {option.isUnavailable && (
                          <AlertTriangle className="h-3 w-3 text-amber-500" />
                        )}
                      </div>
                      {isSelected && (
                        <Check className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
                      )}
                    </CommandPrimitive.Item>
                  );
                })}
              </div>
            </CommandPrimitive.List>
          </CommandPrimitive>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
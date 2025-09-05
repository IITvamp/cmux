import * as Popover from "@radix-ui/react-popover";
import clsx from "clsx";
import { AlertTriangle, Check, ChevronDown, Loader2 } from "lucide-react";
import * as React from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command";

export interface DropdownOption {
  label: string;
  value: string;
  isUnavailable?: boolean;
}

interface SearchableDropdownProps {
  options: string[] | DropdownOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  singleSelect?: boolean;
  className?: string;
  loading?: boolean;
  maxTagCount?: number;
  showSearch?: boolean;
  disabled?: boolean;
  minWidth?: string;
  maxWidth?: string;
}

export function SearchableDropdown({
  options,
  value,
  onChange,
  placeholder = "Select...",
  singleSelect = false,
  className,
  loading = false,
  maxTagCount,
  showSearch = true,
  disabled = false,
  minWidth = "120px",
  maxWidth,
}: SearchableDropdownProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const formattedOptions = React.useMemo(() => {
    return options.map((option) => {
      if (typeof option === "string") {
        return { label: option, value: option };
      }
      return option;
    });
  }, [options]);

  const filteredOptions = React.useMemo(() => {
    if (!search) return formattedOptions;
    const searchLower = search.toLowerCase();
    return formattedOptions.filter((option) =>
      option.label.toLowerCase().includes(searchLower)
    );
  }, [formattedOptions, search]);

  const selectedOptions = React.useMemo(() => {
    return formattedOptions.filter((option) => value.includes(option.value));
  }, [formattedOptions, value]);

  const displayValue = React.useMemo(() => {
    if (selectedOptions.length === 0) return placeholder;
    if (singleSelect) return selectedOptions[0]?.label;
    if (maxTagCount && selectedOptions.length > maxTagCount) {
      return `${selectedOptions
        .slice(0, maxTagCount)
        .map((o) => o.label)
        .join(", ")} +${selectedOptions.length - maxTagCount}`;
    }
    return selectedOptions.map((o) => o.label).join(", ");
  }, [selectedOptions, placeholder, singleSelect, maxTagCount]);

  const handleSelect = React.useCallback(
    (optionValue: string) => {
      if (singleSelect) {
        onChange([optionValue]);
        setOpen(false);
      } else {
        const newValue = value.includes(optionValue)
          ? value.filter((v) => v !== optionValue)
          : [...value, optionValue];
        onChange(newValue);
      }
    },
    [singleSelect, value, onChange]
  );


  const buttonStyles = clsx(
    "flex items-center justify-between gap-2 rounded-2xl px-3 h-9",
    "border border-neutral-200 dark:border-neutral-800",
    "bg-white dark:bg-neutral-950",
    "text-sm text-neutral-900 dark:text-neutral-100",
    "hover:bg-neutral-50 dark:hover:bg-neutral-900",
    "transition-colors",
    disabled && "opacity-50 cursor-not-allowed",
    className
  );

  const buttonContentStyles = clsx(
    "flex items-center gap-2 flex-1 min-w-0",
    value.length === 0 && "text-neutral-500 dark:text-neutral-400"
  );

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={buttonStyles}
          style={{
            minWidth,
            maxWidth,
          }}
        >
          <span className={buttonContentStyles}>
            <span className="truncate">{displayValue}</span>
          </span>
          {loading ? (
            <Loader2 className="h-4 w-4 text-neutral-500 animate-spin" />
          ) : (
            <ChevronDown className="h-4 w-4 text-neutral-500 shrink-0" />
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-50 min-w-[200px] rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-md outline-none"
          align="start"
          sideOffset={4}
          style={{
            width: "var(--radix-popover-trigger-width)",
            minWidth: "200px",
          }}
        >
          <Command shouldFilter={false}>
            {showSearch && (
              <CommandInput
                placeholder="Search..."
                value={search}
                onValueChange={setSearch}
              />
            )}
            <CommandList>
              {loading ? (
                <div className="px-3 py-2 text-sm text-neutral-500">
                  Loading...
                </div>
              ) : filteredOptions.length === 0 ? (
                <CommandEmpty>No options found</CommandEmpty>
              ) : (
                <CommandGroup>
                  {filteredOptions.map((option) => {
                    const isSelected = value.includes(option.value);
                    return (
                      <CommandItem
                        key={option.value}
                        value={option.value}
                        onSelect={() => handleSelect(option.value)}
                        className="flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="truncate">{option.label}</span>
                          {option.isUnavailable && (
                            <AlertTriangle className="h-3 w-3 text-amber-500" />
                          )}
                        </div>
                        {isSelected && (
                          <Check className="h-4 w-4 text-neutral-600 dark:text-neutral-300" />
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

interface MultiSelectDropdownProps extends SearchableDropdownProps {
  singleSelect?: false;
}

interface SingleSelectDropdownProps extends SearchableDropdownProps {
  singleSelect: true;
}

export function MultiSelectDropdown(props: MultiSelectDropdownProps) {
  return <SearchableDropdown {...props} singleSelect={false} />;
}

export function SingleSelectDropdown(props: SingleSelectDropdownProps) {
  return <SearchableDropdown {...props} singleSelect={true} />;
}
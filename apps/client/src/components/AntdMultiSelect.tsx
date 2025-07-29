import type { SelectProps } from "antd";
import { Select } from "antd";
import { AlertTriangle } from "lucide-react";

interface AgentOption {
  label: string;
  value: string;
  isUnavailable?: boolean;
}

interface AntdMultiSelectProps {
  options: string[] | AgentOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  singleSelect?: boolean;
  className?: string;
  loading?: boolean;
  maxTagCount?: number;
  showSearch?: boolean;
}

export default function AntdMultiSelect({
  options,
  value,
  onChange,
  placeholder,
  singleSelect,
  className,
  loading,
  maxTagCount,
  showSearch,
}: AntdMultiSelectProps) {
  
  const selectOptions = options.map((option) => {
    if (typeof option === 'string') {
      return { label: option, value: option };
    } else {
      return {
        label: (
          <div className="flex items-center gap-2">
            <span>{option.label}</span>
            {option.isUnavailable && (
              <AlertTriangle className="w-3 h-3 text-amber-500" />
            )}
          </div>
        ),
        value: option.value
      };
    }
  });

  const selectProps: SelectProps = {
    mode: singleSelect ? undefined : "multiple",
    options: selectOptions,
    value,
    onChange: (val) => {
      if (Array.isArray(val)) {
        onChange(val as string[]);
      } else {
        onChange([val as string]);
      }
    },
    placeholder,
    showSearch,
    className: `antd-select-custom ${className || ""}`,
    classNames: {
      // option: "antd-select-option",
      popup: {
        root: "min-w-[200px]",
      },
      root: "tabular-nums",
    },
    style: {
      minWidth: singleSelect ? undefined : 200,
    },
    loading,
    // Apply maxTagCount settings for multi-select
    ...(singleSelect
      ? {}
      : {
          ...(maxTagCount !== undefined
            ? {
                maxTagCount,
                maxTagPlaceholder: (omitted) =>
                  omitted.length ? `+${omitted.length}` : null,
              }
            : {}),
        }),
  };

  return <Select {...selectProps} />;
}

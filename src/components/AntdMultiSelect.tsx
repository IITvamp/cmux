import type { SelectProps } from "antd";
import { Select } from "antd";

interface AntdMultiSelectProps {
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  singleSelect?: boolean;
  className?: string;
  loading?: boolean;
}

export default function AntdMultiSelect({
  options,
  value,
  onChange,
  placeholder,
  singleSelect,
  className,
  loading,
}: AntdMultiSelectProps) {
  const selectProps: SelectProps = {
    mode: singleSelect ? undefined : "multiple",
    options: options.map((o) => ({ label: o, value: o })),
    value,
    onChange: (val) => {
      if (Array.isArray(val)) {
        onChange(val as string[]);
      } else {
        onChange([val as string]);
      }
    },
    placeholder,
    className: `antd-select-custom ${className || ""}`,
    classNames: {
      // option: "antd-select-option",
      popup: {
        root: "min-w-[200px]",
      },
    },
    style: {
      minWidth: singleSelect ? undefined : 200,
    },
    loading,
  };

  return <Select {...selectProps} />;
}

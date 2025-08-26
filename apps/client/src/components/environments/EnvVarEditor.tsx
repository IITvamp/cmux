import { parseEnvText, type ParsedEnvEntry } from "@/lib/parseEnv";
import { useCallback, useMemo, useRef, useState } from "react";

export type EnvVar = { key: string; value: string };

export function EnvVarEditor({
  initial,
  onChange,
}: {
  initial?: EnvVar[];
  onChange?: (vars: EnvVar[]) => void;
}) {
  const [rows, setRows] = useState<EnvVar[]>(() => initial ?? []);
  const pasteAreaRef = useRef<HTMLTextAreaElement | null>(null);

  const handleRowsChange = useCallback(
    (next: EnvVar[]) => {
      setRows(next);
      onChange?.(next);
    },
    [onChange]
  );

  const addRow = useCallback(() => {
    handleRowsChange([...rows, { key: "", value: "" }]);
  }, [rows, handleRowsChange]);

  const onPaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const text = e.clipboardData.getData("text/plain");
      if (text && /\n|=/.test(text)) {
        e.preventDefault();
        const entries = parseEnvText(text);
        if (entries.length > 0) {
          const map = new Map<string, string>();
          for (const r of rows) map.set(r.key, r.value);
          for (const { key, value } of entries) map.set(key, value);
          handleRowsChange(Array.from(map.entries()).map(([key, value]) => ({ key, value })));
        }
      }
    },
    [rows, handleRowsChange]
  );

  const hasRows = rows.length > 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Environment Variables
        </div>
        <button
          type="button"
          onClick={addRow}
          className="px-2 py-1 text-xs rounded-md border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-700 dark:text-neutral-300"
        >
          Add
        </button>
      </div>

      {/* Paste area */}
      <textarea
        ref={pasteAreaRef}
        onPaste={onPaste}
        placeholder="Paste your .env here (Cmd+V)"
        className="w-full h-20 text-sm rounded-md border border-dashed border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 p-2 outline-none"
      />

      <div className="flex flex-col gap-2">
        {hasRows ? (
          rows.map((row, i) => (
            <div key={i} className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="KEY"
                value={row.key}
                onChange={(e) => {
                  const next = rows.slice();
                  next[i] = { ...next[i], key: e.target.value.toUpperCase() };
                  handleRowsChange(next);
                }}
                className="w-full px-2 py-1 text-sm rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 outline-none"
              />
              <input
                type="password"
                placeholder="Value"
                value={row.value}
                onChange={(e) => {
                  const next = rows.slice();
                  next[i] = { ...next[i], value: e.target.value };
                  handleRowsChange(next);
                }}
                className="w-full px-2 py-1 text-sm rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 outline-none"
              />
            </div>
          ))
        ) : (
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            No variables yet. Add rows or paste a .env file.
          </div>
        )}
      </div>
    </div>
  );
}


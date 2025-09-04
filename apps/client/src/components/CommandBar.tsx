import { useTheme } from "@/components/theme/use-theme";
import { api } from "@cmux/convex/api";
import { useNavigate } from "@tanstack/react-router";
import { Command } from "cmdk";
import { useQuery } from "convex/react";
import { Moon, Search, Sun } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface CommandBarProps {
  teamSlugOrId: string;
}

export function CommandBar({ teamSlugOrId }: CommandBarProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { setTheme } = useTheme();

  const allTasks = useQuery(api.tasks.get, { teamSlugOrId });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = useCallback(
    (value: string) => {
      if (value === "theme-light") {
        setTheme("light");
      } else if (value === "theme-dark") {
        setTheme("dark");
      } else if (value === "theme-system") {
        setTheme("system");
      } else if (value.startsWith("task:")) {
        const taskId = value.slice(5);
        navigate({
          to: "/$teamSlugOrId/task/$taskId",
          // @ts-expect-error - taskId extracted from string
          params: { teamSlugOrId, taskId },
          search: { runId: undefined },
        });
      }
      setOpen(false);
    },
    [navigate, teamSlugOrId, setTheme]
  );

  if (!open) return null;

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command Menu"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setOpen(false);
        }
      }}
    >
      <div className="w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
        <Command.Input
          value={search}
          onValueChange={setSearch}
          placeholder="Type a command or search..."
          className="w-full px-4 py-3 text-base bg-transparent border-b border-neutral-200 dark:border-neutral-700 outline-none placeholder:text-neutral-500 dark:placeholder:text-neutral-400"
        />
        <Command.List className="max-h-[400px] overflow-y-auto px-1 pb-2 flex flex-col gap-2">
          <Command.Empty className="py-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
            No results found.
          </Command.Empty>

          <Command.Group>
            <div className="px-2 py-1.5 text-[13px] text-neutral-500 dark:text-neutral-400">
              Theme
            </div>
            <Command.Item
              value="theme-light"
              onSelect={() => handleSelect("theme-light")}
              className="flex items-center gap-2 px-3 py-2.5 mx-1 rounded-md cursor-pointer                 hover:bg-neutral-100 dark:hover:bg-neutral-800 
                data-[selected=true]:bg-neutral-100 dark:data-[selected=true]:bg-neutral-800
                data-[selected=true]:text-neutral-900 dark:data-[selected=true]:text-neutral-100"
            >
              <Sun className="h-4 w-4 text-amber-500" />
              <span>Light Mode</span>
            </Command.Item>
            <Command.Item
              value="theme-dark"
              onSelect={() => handleSelect("theme-dark")}
              className="flex items-center gap-2 px-3 py-2.5 mx-1 rounded-md cursor-pointer                 hover:bg-neutral-100 dark:hover:bg-neutral-800 
                data-[selected=true]:bg-neutral-100 dark:data-[selected=true]:bg-neutral-800
                data-[selected=true]:text-neutral-900 dark:data-[selected=true]:text-neutral-100"
            >
              <Moon className="h-4 w-4 text-blue-500" />
              <span>Dark Mode</span>
            </Command.Item>
            <Command.Item
              value="theme-system"
              onSelect={() => handleSelect("theme-system")}
              className="flex items-center gap-2 px-3 py-2.5 mx-1 rounded-md cursor-pointer                 hover:bg-neutral-100 dark:hover:bg-neutral-800 
                data-[selected=true]:bg-neutral-100 dark:data-[selected=true]:bg-neutral-800
                data-[selected=true]:text-neutral-900 dark:data-[selected=true]:text-neutral-100"
            >
              <span className="h-4 w-4 flex items-center justify-center">
                🖥️
              </span>
              <span>System Theme</span>
            </Command.Item>
          </Command.Group>

          {allTasks && allTasks.length > 0 && (
            <Command.Group>
              <div className="px-2 py-1.5 text-[13px] text-neutral-500 dark:text-neutral-400">
                Tasks
              </div>
              {allTasks.slice(0, 9).map((task, index) => (
                <Command.Item
                  key={task._id}
                  value={`${index + 1}:task:${task._id}`}
                  onSelect={() => handleSelect(`task:${task._id}`)}
                  data-value={`task:${task._id}`}
                  className="flex items-center gap-3 px-3 py-2.5 mx-1 rounded-md cursor-pointer                     hover:bg-neutral-100 dark:hover:bg-neutral-800 
                    data-[selected=true]:bg-neutral-100 dark:data-[selected=true]:bg-neutral-800
                    data-[selected=true]:text-neutral-900 dark:data-[selected=true]:text-neutral-100
                    group"
                >
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded text-xs font-semibold
                    bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300
                    group-data-[selected=true]:bg-neutral-300 dark:group-data-[selected=true]:bg-neutral-600"
                  >
                    {index + 1}
                  </span>
                  <Search className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
                  <span className="flex-1 truncate">
                    {task.pullRequestTitle || task.text}
                  </span>
                  {task.isCompleted ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                      completed
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                      in progress
                    </span>
                  )}
                </Command.Item>
              ))}
            </Command.Group>
          )}
        </Command.List>
      </div>
    </Command.Dialog>
  );
}

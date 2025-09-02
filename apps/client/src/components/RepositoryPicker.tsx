import { env } from "@/client-env";
import { GitHubIcon } from "@/components/icons/github";
import { GitLabIcon } from "@/components/icons/gitlab";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { api } from "@cmux/convex/api";
import { getApiIntegrationsGithubReposOptions } from "@cmux/www-openapi-client/react-query";
import * as Popover from "@radix-ui/react-popover";
import { useQuery as useRQ } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Check, ChevronDown, Loader2, Settings, X } from "lucide-react";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";

function ConnectionIcon({ type }: { type?: string }) {
  if (type && type.includes("gitlab")) {
    return (
      <GitLabIcon className="h-4 w-4 text-neutral-600 dark:text-neutral-300" />
    );
  }
  return (
    <GitHubIcon className="h-4 w-4 text-neutral-700 dark:text-neutral-200" />
  );
}

function formatTimeAgo(input?: string | number): string {
  if (!input) return "";
  const ts = typeof input === "number" ? input : Date.parse(input);
  if (Number.isNaN(ts)) return "";
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  const yr = Math.floor(mo / 12);
  return `${yr}y ago`;
}

export interface RepositoryPickerProps {
  teamSlugOrId: string;
  onContinue?: (selectedRepos: string[]) => void;
  onSelectionChange?: (selectedRepos: string[]) => void;
  onStateChange?: (
    connectionLogin: string | null,
    repoSearch: string,
    selectedRepos: string[]
  ) => void;
  initialSelectedRepos?: string[];
  initialConnectionLogin?: string;
  initialRepoSearch?: string;
  showHeader?: boolean;
  showContinueButton?: boolean;
  showManualConfigOption?: boolean;
  continueButtonText?: string;
  manualConfigButtonText?: string;
  headerTitle?: string;
  headerDescription?: string;
  className?: string;
}

export function RepositoryPicker({
  teamSlugOrId,
  onContinue,
  onSelectionChange,
  initialSelectedRepos = [],
  initialConnectionLogin,
  initialRepoSearch = "",
  onStateChange,
  showHeader = true,
  showContinueButton = true,
  showManualConfigOption = true,
  continueButtonText = "Continue",
  manualConfigButtonText = "Configure manually",
  headerTitle = "Select Repositories",
  headerDescription = "Choose repositories to include in your environment.",
  className = "",
}: RepositoryPickerProps) {
  const connections = useQuery(api.github.listProviderConnections, {
    teamSlugOrId,
  });
  const mintState = useMutation(api.github_app.mintInstallState);
  const router = useRouter();
  const [selectedConnectionLogin, setSelectedConnectionLogin] = useState<
    string | null
  >(initialConnectionLogin ?? null);
  const [connectionDropdownOpen, setConnectionDropdownOpen] = useState(false);
  const [connectionSearch, setConnectionSearch] = useState("");
  const [search, setSearch] = useState(initialRepoSearch);
  const [selectedRepos, setSelectedRepos] = useState(
    new Set<string>(initialSelectedRepos)
  );

  // Notify parent of state changes
  useEffect(() => {
    onStateChange?.(selectedConnectionLogin, search, Array.from(selectedRepos));
    onSelectionChange?.(Array.from(selectedRepos));
  }, [
    selectedConnectionLogin,
    search,
    selectedRepos,
    onStateChange,
    onSelectionChange,
  ]);

  const watchPopupClosed = (win: Window | null, onClose: () => void): void => {
    if (!win) return;
    const timer = window.setInterval(() => {
      try {
        if (win.closed) {
          window.clearInterval(timer);
          onClose();
        }
      } catch (_e) {
        void 0;
      }
    }, 600);
  };

  const handlePopupClosedRefetch = useCallback((): void => {
    const qc = router.options.context?.queryClient;
    if (qc) {
      qc.invalidateQueries();
    }
    window.focus?.();
  }, [router]);

  // Listen for postMessage from the popup to refresh immediately
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const data = e.data as unknown;
      if (
        data &&
        typeof data === "object" &&
        (data as { type?: string }).type === "cmux/github-install-complete"
      ) {
        handlePopupClosedRefetch();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [handlePopupClosedRefetch]);

  const openCenteredPopup = (
    url: string,
    opts?: { name?: string; width?: number; height?: number },
    onClose?: () => void
  ): Window | null => {
    const name = opts?.name ?? "cmux-popup";
    const width = Math.floor(opts?.width ?? 980);
    const height = Math.floor(opts?.height ?? 780);
    const dualScreenLeft = window.screenLeft ?? window.screenX ?? 0;
    const dualScreenTop = window.screenTop ?? window.screenY ?? 0;
    const outerWidth = window.outerWidth || window.innerWidth || width;
    const outerHeight = window.outerHeight || window.innerHeight || height;
    const left = Math.max(0, dualScreenLeft + (outerWidth - width) / 2);
    const top = Math.max(0, dualScreenTop + (outerHeight - height) / 2);
    const features = [
      `width=${width}`,
      `height=${height}`,
      `left=${Math.floor(left)}`,
      `top=${Math.floor(top)}`,
      "resizable=yes",
      "scrollbars=yes",
      "toolbar=no",
      "location=no",
      "status=no",
      "menubar=no",
    ].join(",");

    const win = window.open("about:blank", name, features);
    if (win) {
      try {
        (win as Window & { opener: null | Window }).opener = null;
      } catch (_e) {
        void 0;
      }
      try {
        win.location.href = url;
      } catch (_e) {
        window.open(url, "_blank");
      }
      win.focus?.();
      if (onClose) watchPopupClosed(win, onClose);
      return win;
    } else {
      window.open(url, "_blank");
      return null;
    }
  };

  const activeConnections = useMemo(
    () => (connections || []).filter((c) => c.isActive !== false),
    [connections]
  );

  const filteredConnections = useMemo(() => {
    if (!connectionSearch.trim()) return activeConnections;
    const searchLower = connectionSearch.toLowerCase();
    return activeConnections.filter((c) => {
      const name = c.accountLogin || `installation-${c.installationId}`;
      return name.toLowerCase().includes(searchLower);
    });
  }, [activeConnections, connectionSearch]);

  const currentOrg = useMemo(() => {
    if (selectedConnectionLogin) return selectedConnectionLogin;
    if (activeConnections.length > 0)
      return activeConnections[0]?.accountLogin ?? null;
    return null;
  }, [selectedConnectionLogin, activeConnections]);

  const selectedInstallationId = useMemo(() => {
    const match = activeConnections.find((c) => c.accountLogin === currentOrg);
    return match?.installationId ?? activeConnections[0]?.installationId;
  }, [activeConnections, currentOrg]);

  const debouncedSearch = useDebouncedValue(search, 300);
  const githubReposQuery = useRQ({
    ...getApiIntegrationsGithubReposOptions({
      query: {
        team: teamSlugOrId,
        installationId: selectedInstallationId,
        search: debouncedSearch.trim() || undefined,
      },
    }),
    enabled: !!selectedInstallationId,
  });

  const deferredSearch = useDeferredValue(search);
  const filteredRepos = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    const repos = githubReposQuery.data?.repos ?? [];
    const withTs = repos.map((r) => ({
      ...r,
      _ts: Date.parse(r.pushed_at ?? r.updated_at ?? "") || 0,
    }));
    let list = withTs.sort((a, b) => b._ts - a._ts);
    if (q) {
      list = list.filter(
        (r) =>
          r.full_name.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q)
      );
    }
    return list;
  }, [githubReposQuery.data, deferredSearch]);

  const isSearchStale = search.trim() !== debouncedSearch.trim();
  const showReposLoading =
    !!selectedInstallationId &&
    (githubReposQuery.isPending ||
      isSearchStale ||
      (githubReposQuery.isFetching && filteredRepos.length === 0));
  const showSpinner = isSearchStale || githubReposQuery.isFetching;

  const configureUrl = useMemo(() => {
    if (!connections || !currentOrg) return null;
    const match = connections.find(
      (c) => c.accountLogin === currentOrg && c.isActive
    );
    if (!match) return null;
    if (match.accountType === "Organization") {
      return `https://github.com/organizations/${match.accountLogin}/settings/installations/${match.installationId}`;
    }
    return `https://github.com/settings/installations/${match.installationId}`;
  }, [connections, currentOrg]);

  const installNewUrl = env.NEXT_PUBLIC_GITHUB_APP_SLUG
    ? `https://github.com/apps/${env.NEXT_PUBLIC_GITHUB_APP_SLUG}/installations/new`
    : null;

  return (
    <div className={className}>
      {showHeader && (
        <>
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            {headerTitle}
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {headerDescription}
          </p>
        </>
      )}

      <div className="space-y-2 mt-6">
        <label className="block text-sm font-medium text-neutral-800 dark:text-neutral-200">
          Connection
        </label>
        <Popover.Root
          open={connectionDropdownOpen}
          onOpenChange={setConnectionDropdownOpen}
        >
          <Popover.Trigger asChild>
            <button className="w-full rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 h-9 flex items-center justify-between text-sm text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                {currentOrg ? (
                  <>
                    <ConnectionIcon type="github" />
                    <span className="truncate">{currentOrg}</span>
                  </>
                ) : (
                  <span className="truncate text-neutral-500">
                    Select connection
                  </span>
                )}
              </div>
              <ChevronDown className="w-4 h-4 text-neutral-500" />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              className="w-[320px] rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-md outline-none z-[10001]"
              align="start"
              sideOffset={4}
            >
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="Search connections..."
                  value={connectionSearch}
                  onValueChange={setConnectionSearch}
                />
                <CommandList>
                  {connections === undefined ? (
                    <div className="px-3 py-2 text-sm text-neutral-500">
                      Loading...
                    </div>
                  ) : activeConnections.length > 0 ? (
                    <>
                      {filteredConnections.length > 0 ? (
                        <CommandGroup>
                          {filteredConnections.map((c) => {
                            const name =
                              c.accountLogin ||
                              `installation-${c.installationId}`;
                            const cfgUrl =
                              c.accountLogin && c.accountType
                                ? c.accountType === "Organization"
                                  ? `https://github.com/organizations/${c.accountLogin}/settings/installations/${c.installationId}`
                                  : `https://github.com/settings/installations/${c.installationId}`
                                : null;
                            const isSelected = currentOrg === c.accountLogin;
                            return (
                              <CommandItem
                                key={`${c.accountLogin}:${c.installationId}`}
                                value={name}
                                onSelect={() => {
                                  setSelectedConnectionLogin(
                                    c.accountLogin ?? null
                                  );
                                  setConnectionDropdownOpen(false);
                                }}
                                className="flex items-center justify-between gap-2"
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <ConnectionIcon type={c.type} />
                                  <span className="truncate">{name}</span>
                                  {isSelected && (
                                    <Check className="ml-auto h-4 w-4 text-neutral-600 dark:text-neutral-300" />
                                  )}
                                </div>
                                {cfgUrl ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 relative z-[10010]"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          openCenteredPopup(
                                            cfgUrl,
                                            { name: "github-config" },
                                            handlePopupClosedRefetch
                                          );
                                        }}
                                      >
                                        <Settings className="w-3 h-3 text-neutral-600 dark:text-neutral-300" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent className="z-[10020]">
                                      Add Repos
                                    </TooltipContent>
                                  </Tooltip>
                                ) : null}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      ) : connectionSearch.trim() ? (
                        <div className="px-3 py-2 text-sm text-neutral-500">
                          No connections match your search
                        </div>
                      ) : null}
                      {installNewUrl ? (
                        <>
                          <div className="h-px bg-neutral-200 dark:bg-neutral-800" />
                          <CommandGroup forceMount>
                            <CommandItem
                              value="add-github-account"
                              forceMount
                              onSelect={async () => {
                                try {
                                  const { state } = await mintState({
                                    teamSlugOrId,
                                  });
                                  const sep = installNewUrl!.includes("?")
                                    ? "&"
                                    : "?";
                                  const url = `${installNewUrl}${sep}state=${encodeURIComponent(state)}`;
                                  openCenteredPopup(
                                    url,
                                    { name: "github-install" },
                                    handlePopupClosedRefetch
                                  );
                                  setConnectionDropdownOpen(false);
                                } catch (e) {
                                  console.error(
                                    "Failed to mint install state:",
                                    e
                                  );
                                  alert(
                                    "Failed to start installation. Please try again."
                                  );
                                }
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <ConnectionIcon type="github" />
                                <span>Add GitHub Account</span>
                              </div>
                            </CommandItem>
                          </CommandGroup>
                        </>
                      ) : null}
                    </>
                  ) : (
                    <CommandEmpty>No connections found</CommandEmpty>
                  )}
                </CommandList>
              </Command>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>

      <div className="space-y-2 mt-4">
        <label className="block text-sm font-medium text-neutral-800 dark:text-neutral-200">
          Repositories
        </label>
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search recent repositories"
            aria-busy={showSpinner}
            className="w-full rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 pr-8 h-9 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300 dark:focus:ring-neutral-700"
          />
          {showSpinner ? (
            <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 animate-spin" />
          ) : null}
        </div>

        <div className="mt-2 rounded-md border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          {showReposLoading ? (
            <div className="divide-y divide-neutral-200 dark:divide-neutral-900">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="px-3 h-9 flex items-center justify-between bg-white dark:bg-neutral-950"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Skeleton className="h-4 w-4 rounded-sm" />
                    <Skeleton className="h-4 w-56 rounded" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-16 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredRepos.length > 0 ? (
            <div className="divide-y divide-neutral-200 dark:divide-neutral-900">
              {filteredRepos.map((r) => {
                const isSelected = selectedRepos.has(r.full_name);
                const last = r.pushed_at ?? r.updated_at ?? null;
                const when = last ? formatTimeAgo(last) : "";
                return (
                  <div
                    key={r.full_name}
                    role="option"
                    aria-selected={isSelected}
                    className="px-3 h-9 flex items-center justify-between bg-white dark:bg-neutral-950 cursor-default select-none"
                    onClick={() => {
                      setSelectedRepos((prev) => {
                        const next = new Set(prev);
                        if (next.has(r.full_name)) next.delete(r.full_name);
                        else next.add(r.full_name);
                        return next;
                      });
                    }}
                  >
                    <div className="text-sm flex items-center gap-2 min-w-0 flex-1">
                      <div
                        className={`mr-1 h-4 w-4 rounded-sm border grid place-items-center shrink-0 ${
                          isSelected
                            ? "border-neutral-700 bg-neutral-800"
                            : "border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                        }`}
                      >
                        <Check
                          className={`w-3 h-3 text-white transition-opacity ${
                            isSelected ? "opacity-100" : "opacity-0"
                          }`}
                        />
                      </div>
                      <GitHubIcon className="h-4 w-4 shrink-0 text-neutral-700 dark:text-neutral-200" />
                      <span className="truncate">{r.full_name}</span>
                    </div>
                    <div className="ml-3 flex items-center gap-2">
                      {when && (
                        <span className="text-[10px] text-neutral-500 dark:text-neutral-500">
                          {when}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-3 py-10 h-[180px] text-sm text-neutral-500 dark:text-neutral-400 bg-white dark:bg-neutral-950 flex flex-col items-center justify-center text-center gap-2">
              {search ? (
                <>
                  <div>No recent repositories match your search.</div>
                  {configureUrl ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        openCenteredPopup(
                          configureUrl,
                          { name: "github-config" },
                          handlePopupClosedRefetch
                        );
                      }}
                      className="inline-flex items-center gap-1 text-neutral-800 dark:text-neutral-200 hover:underline"
                    >
                      <GitHubIcon className="h-4 w-4 text-neutral-700 dark:text-neutral-300" />
                      <span>Reconfigure GitHub access</span>
                    </button>
                  ) : installNewUrl ? (
                    <a
                      href={installNewUrl}
                      onClick={(e) => {
                        e.preventDefault();
                        openCenteredPopup(
                          installNewUrl,
                          { name: "github-install" },
                          handlePopupClosedRefetch
                        );
                      }}
                      className="inline-flex items-center gap-1 text-neutral-800 dark:text-neutral-200 hover:underline"
                    >
                      <GitHubIcon className="h-4 w-4 text-neutral-700 dark:text-neutral-300" />
                      <span>Install GitHub App</span>
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setConnectionDropdownOpen(true);
                    }}
                    className="inline-flex items-center gap-1 text-neutral-800 dark:text-neutral-200 hover:underline"
                  >
                    <ChevronDown className="h-4 w-4 text-neutral-700 dark:text-neutral-300" />
                    <span>Switch organization</span>
                  </button>
                </>
              ) : (
                <>
                  <div>No recent repositories available.</div>
                  {configureUrl ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        openCenteredPopup(
                          configureUrl,
                          { name: "github-config" },
                          handlePopupClosedRefetch
                        );
                      }}
                      className="inline-flex items-center gap-1 text-neutral-800 dark:text-neutral-200 hover:underline"
                    >
                      <GitHubIcon className="h-4 w-4 text-neutral-700 dark:text-neutral-300" />
                      <span>Reconfigure GitHub access</span>
                    </button>
                  ) : installNewUrl ? (
                    <a
                      href={installNewUrl}
                      onClick={(e) => {
                        e.preventDefault();
                        openCenteredPopup(
                          installNewUrl,
                          { name: "github-install" },
                          handlePopupClosedRefetch
                        );
                      }}
                      className="inline-flex items-center gap-1 text-neutral-800 dark:text-neutral-200 hover:underline"
                    >
                      <GitHubIcon className="h-4 w-4 text-neutral-700 dark:text-neutral-300" />
                      <span>Install GitHub App</span>
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setConnectionDropdownOpen(true);
                    }}
                    className="inline-flex items-center gap-1 text-neutral-800 dark:text-neutral-200 hover:underline"
                  >
                    <ChevronDown className="h-4 w-4 text-neutral-700 dark:text-neutral-300" />
                    <span>Switch organization</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {selectedRepos.size > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {Array.from(selectedRepos).map((fullName) => (
              <span
                key={fullName}
                className="inline-flex items-center gap-1 rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 px-2 py-1 text-xs"
              >
                <button
                  type="button"
                  aria-label={`Remove ${fullName}`}
                  onClick={() =>
                    setSelectedRepos((prev) => {
                      const next = new Set(prev);
                      next.delete(fullName);
                      return next;
                    })
                  }
                  className="-ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900"
                >
                  <X className="h-3 w-3" />
                </button>
                <GitHubIcon className="h-3 w-3 shrink-0 text-neutral-700 dark:text-neutral-300" />
                {fullName}
              </span>
            ))}
          </div>
        ) : null}

        {showContinueButton && (
          <>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={selectedRepos.size === 0}
                onClick={() => onContinue?.(Array.from(selectedRepos))}
                className="inline-flex items-center rounded-md bg-neutral-900 text-white disabled:bg-neutral-300 dark:disabled:bg-neutral-700 disabled:cursor-not-allowed px-3 py-2 text-sm hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
              >
                {continueButtonText}
              </button>
              {showManualConfigOption && (
                <button
                  type="button"
                  onClick={() => onContinue?.([])}
                  className="inline-flex items-center rounded-md border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-sm text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-900"
                >
                  {manualConfigButtonText}
                </button>
              )}
            </div>
            {showManualConfigOption && (
              <p className="text-xs text-neutral-500 dark:text-neutral-500">
                You can also manually configure an environment from a bare VM.
                We'll capture your changes as a reusable base snapshot.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

import { env } from "@/client-env";
import { FloatingPane } from "@/components/floating-pane";
import { GitHubIcon } from "@/components/icons/github";
import { GitLabIcon } from "@/components/icons/gitlab";
import { ResizableColumns } from "@/components/ResizableColumns";
import { TitleBar } from "@/components/TitleBar";
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
import { api, api as convexApi } from "@cmux/convex/api";
import {
  getApiIntegrationsGithubReposOptions,
  postApiMorphProvisionInstanceMutation,
} from "@cmux/www-openapi-client/react-query";
import * as Popover from "@radix-ui/react-popover";
import {
  useQuery as useRQ,
  useMutation as useRQMutation,
} from "@tanstack/react-query";
import {
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import clsx from "clsx";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Loader2,
  Minus,
  Plus,
  Settings,
  X,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import z from "zod";

export const Route = createFileRoute("/_layout/$teamSlugOrId/environments")({
  component: EnvironmentsPage,
  validateSearch: (search: Record<string, unknown>) => {
    const step = z.enum(["select", "configure"]).optional().parse(search.step);
    const selectedRepos = z
      .array(z.string())
      .optional()
      .parse(search.selectedRepos);
    const connectionLogin = z.string().optional().parse(search.connectionLogin);
    const repoSearch = z.string().optional().parse(search.repoSearch);
    const sessionId = z.string().optional().parse(search.sessionId);
    return {
      step,
      selectedRepos,
      connectionLogin,
      repoSearch,
      sessionId,
    };
  },
});

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

// Repository Picker Component
function RepositoryPicker({
  teamSlugOrId,
  onContinue,
  initialSelectedRepos = [],
  initialConnectionLogin,
  initialRepoSearch = "",
  onStateChange,
}: {
  teamSlugOrId: string;
  onContinue: (selectedRepos: string[]) => void;
  initialSelectedRepos?: string[];
  initialConnectionLogin?: string;
  initialRepoSearch?: string;
  onStateChange: (
    connectionLogin: string | null,
    repoSearch: string,
    selectedRepos: string[]
  ) => void;
}) {
  const connections = useQuery(api.github.listProviderConnections, {
    teamSlugOrId,
  });
  const mintState = useMutation(convexApi.github_app.mintInstallState);
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
    onStateChange(selectedConnectionLogin, search, Array.from(selectedRepos));
  }, [selectedConnectionLogin, search, selectedRepos, onStateChange]);

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

  const handlePopupClosedRefetch = (): void => {
    const qc = router.options.context?.queryClient;
    if (qc) {
      qc.invalidateQueries();
    }
    window.focus?.();
  };

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

  return (
    <>
      <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
        Select Repositories
      </h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Choose repositories to include in your environment.
      </p>

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
            className="w-full rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 pr-8 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300 dark:focus:ring-neutral-700"
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

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            disabled={selectedRepos.size === 0}
            onClick={() => onContinue(Array.from(selectedRepos))}
            className="inline-flex items-center rounded-md bg-neutral-900 text-white disabled:bg-neutral-300 dark:disabled:bg-neutral-700 disabled:cursor-not-allowed px-3 py-2 text-sm hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Continue
          </button>
          <button
            type="button"
            onClick={() => onContinue([])}
            className="inline-flex items-center rounded-md border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-sm text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-900"
          >
            Configure manually
          </button>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-500">
          You can also manually configure an environment from a bare VM. We'll
          capture your changes as a reusable base snapshot.
        </p>
      </div>
    </>
  );
}

// Environment Configuration Component
function EnvironmentConfiguration({
  selectedRepos,
  onBack,
  sessionId,
  vscodeUrl,
  isProvisioning,
}: {
  selectedRepos: string[];
  onBack: () => void;
  sessionId?: string;
  vscodeUrl?: string;
  isProvisioning: boolean;
}) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [envName, setEnvName] = useState("");
  const [envVars, setEnvVars] = useState<
    Array<{ name: string; value: string; isSecret: boolean }>
  >([{ name: "", value: "", isSecret: true }]);
  const [envPanelOpen, setEnvPanelOpen] = useState(true);
  const keyInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [pendingFocusIndex, setPendingFocusIndex] = useState<number | null>(
    null
  );

  const parseEnvBlock = (
    text: string
  ): Array<{ name: string; value: string }> => {
    const lines = text.split(/\r?\n/);
    const parsed: Array<{ name: string; value: string }> = [];
    for (const raw of lines) {
      const line = raw.trim();
      if (line.length === 0) continue;
      if (line.startsWith("#") || line.startsWith("//")) continue;

      const noPrefix = line.replace(/^export\s+/, "").replace(/^set\s+/, "");

      let key = "";
      let value = "";
      if (noPrefix.includes("=")) {
        const idx = noPrefix.indexOf("=");
        key = noPrefix.slice(0, idx).trim();
        value = noPrefix.slice(idx + 1).trim();
      } else if (noPrefix.includes(":")) {
        const idx = noPrefix.indexOf(":");
        key = noPrefix.slice(0, idx).trim();
        value = noPrefix.slice(idx + 1).trim();
      } else {
        const m = noPrefix.match(/^(\S+)\s+(.*)$/);
        if (m) {
          key = m[1] || "";
          value = (m[2] || "").trim();
        } else {
          key = noPrefix;
          value = "";
        }
      }

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!key || /\s/.test(key)) continue;
      parsed.push({ name: key, value });
    }
    return parsed;
  };

  useEffect(() => {
    if (pendingFocusIndex !== null) {
      const el = keyInputRefs.current[pendingFocusIndex];
      if (el) {
        setTimeout(() => {
          el.focus();
          try {
            el.scrollIntoView({ block: "nearest" });
          } catch (_e) {
            void 0;
          }
        }, 0);
        setPendingFocusIndex(null);
      }
    }
  }, [pendingFocusIndex, envVars]);

  // Reset iframe loading state when URL changes
  useEffect(() => {
    setIframeLoaded(false);
  }, [vscodeUrl]);

  const handleCreateEnvironment = () => {
    // Snapshot current environment state (instance already provisioned)
    // TODO: Implement actual environment snapshot/creation logic
    console.log("Snapshot environment with:", {
      name: envName,
      repos: selectedRepos,
      envVars,
      sessionId,
      vscodeUrl,
    });
  };

  const leftPane = (
    <div className="h-full p-6 overflow-y-auto">
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to repository selection
        </button>
      </div>

      <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
        Configure Environment
      </h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Set up your environment name and variables.
      </p>

      <div className="mt-6 space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-neutral-800 dark:text-neutral-200">
            Environment name
          </label>
          <input
            type="text"
            value={envName}
            onChange={(e) => setEnvName(e.target.value)}
            placeholder="e.g. Production, Staging, Sandbox"
            className="w-full rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300 dark:focus:ring-neutral-700"
          />
        </div>

        {selectedRepos.length > 0 ? (
          <div>
            <div className="text-xs text-neutral-500 dark:text-neutral-500 mb-1">
              Selected repositories
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedRepos.map((fullName) => (
                <span
                  key={fullName}
                  className="inline-flex items-center gap-1 rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 px-2 py-1 text-xs"
                >
                  <GitHubIcon className="h-3 w-3 shrink-0 text-neutral-700 dark:text-neutral-300" />
                  {fullName}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="bg-white dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <div
            role="button"
            aria-expanded={envPanelOpen}
            onClick={() => setEnvPanelOpen((v) => !v)}
            className="px-4 py-3 flex items-center gap-2 cursor-pointer select-none border-b border-neutral-200 dark:border-neutral-800"
          >
            <ChevronDown
              className={`w-4 h-4 text-neutral-600 dark:text-neutral-300 transition-transform ${
                envPanelOpen ? "rotate-0" : "-rotate-90"
              }`}
            />
            <h2 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              Environment Variables
            </h2>
          </div>

          {envPanelOpen ? (
            <div
              className="p-4 space-y-2"
              onPasteCapture={(e) => {
                const text = e.clipboardData?.getData("text") ?? "";
                if (text && (/\n/.test(text) || /(=|:)\s*\S/.test(text))) {
                  e.preventDefault();
                  const items = parseEnvBlock(text);
                  if (items.length > 0) {
                    setEnvVars((prev) => {
                      const map = new Map(
                        prev
                          .filter(
                            (r) =>
                              r.name.trim().length > 0 ||
                              r.value.trim().length > 0
                          )
                          .map((r) => [r.name, r] as const)
                      );
                      for (const it of items) {
                        if (!it.name) continue;
                        const existing = map.get(it.name);
                        if (existing) {
                          map.set(it.name, {
                            ...existing,
                            value: it.value,
                          });
                        } else {
                          map.set(it.name, {
                            name: it.name,
                            value: it.value,
                            isSecret: true,
                          });
                        }
                      }
                      const next = Array.from(map.values());
                      next.push({
                        name: "",
                        value: "",
                        isSecret: true,
                      });
                      setPendingFocusIndex(next.length - 1);
                      return next;
                    });
                  }
                }
              }}
            >
              <div
                className="grid gap-3 text-xs text-neutral-500 dark:text-neutral-500 pb-1 items-center"
                style={{
                  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.4fr) 44px",
                }}
              >
                <span>Key</span>
                <span>Value</span>
                <span className="w-[44px]" />
              </div>

              <div className="space-y-2">
                {envVars.map((row, idx) => (
                  <div
                    key={idx}
                    className="grid gap-3 items-center"
                    style={{
                      gridTemplateColumns:
                        "minmax(0, 1fr) minmax(0, 1.4fr) 44px",
                    }}
                  >
                    <input
                      type="text"
                      value={row.name}
                      ref={(el) => {
                        keyInputRefs.current[idx] = el;
                      }}
                      onChange={(e) => {
                        const v = e.target.value;
                        setEnvVars((prev) => {
                          const next = [...prev];
                          next[idx] = { ...next[idx]!, name: v };
                          return next;
                        });
                      }}
                      placeholder="EXAMPLE_NAME"
                      className="w-full min-w-0 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300 dark:focus:ring-neutral-700"
                    />
                    <input
                      type="text"
                      value={row.value}
                      onChange={(e) => {
                        const v = e.target.value;
                        setEnvVars((prev) => {
                          const next = [...prev];
                          next[idx] = { ...next[idx]!, value: v };
                          return next;
                        });
                      }}
                      placeholder="I9JU23NF394R6HH"
                      className="w-full min-w-0 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300 dark:focus:ring-neutral-700"
                    />
                    <div className="flex items-center justify-end w-[44px]">
                      <button
                        type="button"
                        onClick={() => {
                          setEnvVars((prev) => {
                            const next = prev.filter((_, i) => i !== idx);
                            return next.length > 0
                              ? next
                              : [
                                  {
                                    name: "",
                                    value: "",
                                    isSecret: true,
                                  },
                                ];
                          });
                        }}
                        className="h-10 w-[44px] rounded-md border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 grid place-items-center hover:bg-neutral-50 dark:hover:bg-neutral-900"
                        aria-label="Remove variable"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setEnvVars((prev) => [
                      ...prev,
                      { name: "", value: "", isSecret: true },
                    ])
                  }
                  className="inline-flex items-center gap-2 rounded-md border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-sm text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-900"
                >
                  <Plus className="w-4 h-4" /> Add More
                </button>
              </div>

              <p className="text-xs text-neutral-500 dark:text-neutral-500 pt-2">
                Tip: Paste an .env above to populate the form. Values are
                encrypted at rest.
              </p>
            </div>
          ) : null}
        </div>

        <div className="pt-4">
          <p className="mb-3 text-sm text-neutral-600 dark:text-neutral-400">
            Configure your environment by interacting with the VS Code instance
            on the right. You can run{" "}
            <code className="mx-1 rounded bg-neutral-100 dark:bg-neutral-900 px-1 py-0.5">
              git pull
            </code>
            , clone repositories, run commands, and install dependencies before
            taking a snapshot.
          </p>
          <button
            type="button"
            onClick={handleCreateEnvironment}
            disabled={isProvisioning}
            className="inline-flex items-center rounded-md bg-neutral-900 text-white disabled:bg-neutral-300 dark:disabled:bg-neutral-700 disabled:cursor-not-allowed px-4 py-2 text-sm hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {isProvisioning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Launching...
              </>
            ) : (
              "Snapshot"
            )}
          </button>
        </div>
      </div>
    </div>
  );

  const rightPane = (
    <div className="h-full bg-neutral-50 dark:bg-neutral-950">
      {isProvisioning ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center max-w-md px-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-lg bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center">
              <Settings className="w-8 h-8 text-neutral-500 dark:text-neutral-400" />
            </div>
            <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
              Launching Environment
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
              Your development environment is launching. Once ready, VS Code
              will appear here so you can configure and test your setup.
            </p>
            <div className="text-xs text-neutral-500 dark:text-neutral-500">
              The environment will be available for 2 hours
            </div>
          </div>
        </div>
      ) : vscodeUrl ? (
        <div className="relative h-full">
          <div
            aria-hidden={iframeLoaded}
            className={clsx(
              "absolute inset-0 z-10 flex items-center justify-center backdrop-blur-sm transition-opacity duration-300",
              "bg-white/60 dark:bg-neutral-950/60",
              iframeLoaded
                ? "opacity-0 pointer-events-none"
                : "opacity-100 pointer-events-auto"
            )}
          >
            <div className="text-center">
              <Loader2 className="w-6 h-6 mx-auto mb-3 animate-spin text-neutral-500 dark:text-neutral-400" />
              <p className="text-sm text-neutral-700 dark:text-neutral-300">
                Loading VS Code...
              </p>
            </div>
          </div>
          <iframe
            src={vscodeUrl}
            className="w-full h-full border-0"
            title="VSCode Environment"
            allow="clipboard-read; clipboard-write"
            onLoad={() => setIframeLoaded(true)}
          />
        </div>
      ) : (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <X className="w-8 h-8 mx-auto mb-4 text-red-500" />
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Waiting for environment URL...
            </p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <ResizableColumns
      storageKey="envConfigWidth"
      defaultLeftWidth={360}
      minLeft={220}
      maxLeft={700}
      left={leftPane}
      right={rightPane}
    />
  );
}

// Main Page Component
function EnvironmentsPage() {
  const searchParams = Route.useSearch();
  const step = (searchParams.step ?? "select") as "select" | "configure";
  const urlSelectedRepos = searchParams.selectedRepos ?? [];
  const urlConnectionLogin = searchParams.connectionLogin;
  const urlRepoSearch = searchParams.repoSearch ?? "";
  const urlSessionId = searchParams.sessionId;
  const navigate = useNavigate();
  const { teamSlugOrId } = Route.useParams();
  const provisionInstanceMutation = useRQMutation(
    postApiMorphProvisionInstanceMutation()
  );

  // Derive VSCode URL from sessionId (always port-39378)
  const derivedVscodeUrl = useMemo(() => {
    if (!urlSessionId) return undefined;
    const hostId = urlSessionId.replace(/_/g, "-");
    return `https://port-39378-${hostId}.http.cloud.morph.so/?folder=/root/workspace`;
  }, [urlSessionId]);

  const goToStep = (
    newStep: "select" | "configure",
    selectedRepos?: string[],
    connectionLogin?: string | null,
    repoSearch?: string
  ): void => {
    navigate({
      to: "/$teamSlugOrId/environments",
      params: { teamSlugOrId },
      search: (prev) => ({
        ...prev,
        // Explicitly persist session fields to satisfy type
        sessionId: prev.sessionId,
        step: newStep,
        selectedRepos: selectedRepos ?? prev.selectedRepos,
        connectionLogin:
          connectionLogin !== undefined
            ? (connectionLogin ?? undefined)
            : prev.connectionLogin,
        repoSearch: repoSearch !== undefined ? repoSearch : prev.repoSearch,
      }),
    });
  };

  const handleContinue = (repos: string[]) => {
    goToStep("configure", repos);

    // Reuse existing session if present
    if (urlSessionId) return;

    // Provision a new Morph instance and persist it in the URL
    provisionInstanceMutation.mutate(
      {
        body: {
          ttlSeconds: 60 * 60 * 2, // 2 hours
        },
      },
      {
        onSuccess: (data) => {
          navigate({
            to: "/$teamSlugOrId/environments",
            params: { teamSlugOrId },
            search: (prev) => ({
              ...prev,
              // Ensure required keys are present
              step: prev.step,
              selectedRepos: prev.selectedRepos,
              connectionLogin: prev.connectionLogin,
              repoSearch: prev.repoSearch,
              sessionId: data.instanceId,
            }),
            replace: true,
          });
        },
        onError: (error) => {
          console.error("Failed to provision Morph instance:", error);
        },
      }
    );
  };

  const handleBack = () => {
    goToStep("select");
  };

  const handleStateChange = (
    connectionLogin: string | null,
    repoSearch: string,
    selectedRepos: string[]
  ) => {
    // Update URL without changing step
    navigate({
      to: "/$teamSlugOrId/environments",
      params: { teamSlugOrId },
      search: (prev) => ({
        ...prev,
        step: prev.step,
        selectedRepos: selectedRepos.length > 0 ? selectedRepos : undefined,
        connectionLogin: connectionLogin ?? undefined,
        repoSearch: repoSearch || undefined,
        sessionId: prev.sessionId,
      }),
      replace: true,
    });
  };

  return (
    <FloatingPane header={<TitleBar title="Environments" />}>
      <div className="flex flex-col grow select-none relative h-full overflow-hidden">
        {step === "select" ? (
          <div className="p-6 max-w-3xl w-full mx-auto overflow-auto">
            <RepositoryPicker
              teamSlugOrId={teamSlugOrId}
              onContinue={handleContinue}
              initialSelectedRepos={urlSelectedRepos}
              initialConnectionLogin={urlConnectionLogin}
              initialRepoSearch={urlRepoSearch}
              onStateChange={handleStateChange}
            />
          </div>
        ) : (
          <EnvironmentConfiguration
            selectedRepos={urlSelectedRepos}
            onBack={handleBack}
            sessionId={urlSessionId}
            vscodeUrl={derivedVscodeUrl}
            isProvisioning={
              provisionInstanceMutation.isPending && !urlSessionId
            }
          />
        )}
      </div>
    </FloatingPane>
  );
}

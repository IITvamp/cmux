import { env } from "@/client-env";
import { FloatingPane } from "@/components/floating-pane";
import { GitHubIcon } from "@/components/icons/github";
import { GitLabIcon } from "@/components/icons/gitlab";
import { TitleBar } from "@/components/TitleBar";
import { Skeleton } from "@/components/ui/skeleton";
import { api, api as convexApi } from "@cmux/convex/api";
import { getApiIntegrationsGithubReposOptions } from "@cmux/www-openapi-client/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery as useRQ } from "@tanstack/react-query";
import { useMutation, useQuery } from "convex/react";
import { Check, ChevronDown, Minus, Plus, Settings } from "lucide-react";
import { Dropdown } from "@/components/ui/dropdown";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { Selection } from "react-aria-components";

export const Route = createFileRoute("/_layout/$teamSlugOrId/environments")({
  component: EnvironmentsPage,
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

// no ProviderIcon inline; use icon components

function EnvironmentsPage() {
  const router = useRouter();
  const { teamSlugOrId } = Route.useParams();
  const connections = useQuery(api.github.listProviderConnections, {
    teamSlugOrId,
  });
  // Mint signed state for GitHub install
  const mintState = useMutation(convexApi.github_app.mintInstallState);
  const [selectedConnectionLogin, setSelectedConnectionLogin] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [envName, setEnvName] = useState("");
  const [envVars, setEnvVars] = useState<
    Array<{ name: string; value: string; isSecret: boolean }>
  >([{ name: "", value: "", isSecret: true }]);
  const [envPanelOpen, setEnvPanelOpen] = useState(true);
  const keyInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [pendingFocusIndex, setPendingFocusIndex] = useState<number | null>(
    null
  );

  // Helper to open a centered popup window for GitHub flows
  const watchPopupClosed = (
    win: Window | null,
    onClose: () => void
  ): void => {
    if (!win) return;
    const timer = window.setInterval(() => {
      try {
        if (win.closed) {
          window.clearInterval(timer);
          onClose();
        }
      } catch (_e) {
        // Cross-origin or race; if we can't access, assume still open
      }
    }, 600);
  };

  const handlePopupClosedRefetch = (): void => {
    // Invalidate React Query cache (convex-query integrated)
    const qc = router.options.context?.queryClient;
    if (qc) {
      qc.invalidateQueries();
    }
    // Focus back to app
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
    // Account for outer window chrome for better centering
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
        // Ensure no access to opener for safety
        (win as Window & { opener: null | Window }) .opener = null;
      } catch (_e) {
        // ignore
      }
      try {
        win.location.href = url;
      } catch (_e) {
        // Fallback: if blocked, try plain open
        window.open(url, "_blank");
      }
      win.focus?.();
      if (onClose) watchPopupClosed(win, onClose);
      return win;
    } else {
      // Popup blocked, fallback
      window.open(url, "_blank");
      return null;
    }
  };

  const parseEnvBlock = (
    text: string
  ): Array<{ name: string; value: string }> => {
    const lines = text.split(/\r?\n/);
    const parsed: Array<{ name: string; value: string }> = [];
    for (const raw of lines) {
      const line = raw.trim();
      if (line.length === 0) continue;
      if (line.startsWith("#") || line.startsWith("//")) continue;

      // Remove optional leading export or set
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
        // Fallback: split on first whitespace
        const m = noPrefix.match(/^(\S+)\s+(.*)$/);
        if (m) {
          key = m[1] || "";
          value = (m[2] || "").trim();
        } else {
          key = noPrefix;
          value = "";
        }
      }

      // Strip surrounding quotes if present
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      // Skip invalid keys
      if (!key || /\s/.test(key)) continue;
      parsed.push({ name: key, value });
    }
    return parsed;
  };

  const activeConnections = useMemo(
    () => (connections || []).filter((c) => c.isActive !== false),
    [connections]
  );

  const currentOrg = useMemo(() => {
    if (selectedConnectionLogin) return selectedConnectionLogin;
    if (activeConnections.length > 0)
      return activeConnections[0]?.accountLogin ?? null;
    return null;
  }, [selectedConnectionLogin, activeConnections]);

  type RepoLite = {
    fullName: string;
    name: string;
    provider?: string;
    connectionId?: unknown;
    lastSyncedAt?: unknown;
    fullNameLower: string;
    nameLower: string;
  };
  // Fetch repos via OpenAPI client (server queries GitHub directly)
  const githubReposQuery = useRQ(
    getApiIntegrationsGithubReposOptions({ query: { team: teamSlugOrId } })
  );

  type ApiRepo = {
    name: string;
    full_name: string;
    private: boolean;
    updated_at?: string;
    pushed_at?: string;
  };

  const allRepos = useMemo<RepoLite[]>(() => {
    const payload = githubReposQuery.data;
    if (!payload?.connections) return [];
    const repos: RepoLite[] = [];
    for (const conn of payload.connections) {
      for (const r of (conn.repos || []) as ApiRepo[]) {
        const full = r.full_name;
        const name = r.name;
        if (!full || !name) continue;
        repos.push({
          fullName: full,
          name,
          provider: "github",
          connectionId: conn.installationId,
          lastSyncedAt: r.pushed_at || r.updated_at || undefined,
          fullNameLower: full.toLowerCase(),
          nameLower: name.toLowerCase(),
        });
      }
    }
    return repos;
  }, [githubReposQuery.data]);

  const deferredSearch = useDeferredValue(search);
  const filteredRepos = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    const withTs = allRepos.map((r) => ({
      ...r,
      _ts: r.lastSyncedAt ? new Date(r.lastSyncedAt as string).getTime() : 0,
    }));
    let list = withTs.sort((a, b) => b._ts - a._ts);
    if (q) {
      list = list.filter(
        (r) => r.fullNameLower.includes(q) || r.nameLower.includes(q)
      );
    }
    return list.slice(0, 5);
  }, [allRepos, deferredSearch]);

  const [selectedRepos, setSelectedRepos] = useState<Selection>(new Set());
  const [step, setStep] = useState<1 | 2>(1);

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

  const installNewUrl = env.VITE_GITHUB_APP_SLUG
    ? `https://github.com/apps/${env.VITE_GITHUB_APP_SLUG}/installations/new`
    : null;

  useEffect(() => {
    if (pendingFocusIndex !== null) {
      const el = keyInputRefs.current[pendingFocusIndex];
      if (el) {
        // Delay to ensure DOM is updated
        setTimeout(() => {
          el.focus();
          try {
            el.scrollIntoView({ block: "nearest" });
          } catch (_e) {
            // pass
          }
        }, 0);
        setPendingFocusIndex(null);
      }
    }
  }, [pendingFocusIndex, envVars]);

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
    <FloatingPane header={<TitleBar title="Environments" />}>
      <div className="flex flex-col grow overflow-auto select-none relative">
        <div className="p-6 max-w-3xl w-full mx-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
              Environments
            </h1>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Create an environment by selecting repositories and optionally providing a base snapshot with environment variables.
            </p>
          </div>

          {/* Step 1: Select repositories - Connections dropdown */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-neutral-800 dark:text-neutral-200">
              Connections
            </label>
            <Dropdown.Root>
              <Dropdown.Trigger className="w-full">
                <div className="w-full rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 h-9 flex items-center justify-between text-sm text-neutral-800 dark:text-neutral-200">
                  <div className="flex items-center gap-2 min-w-0">
                    {currentOrg ? (
                      <>
                        <ConnectionIcon type="github" />
                        <span className="truncate">{currentOrg}</span>
                      </>
                    ) : (
                      <span className="truncate text-neutral-500">Select connection</span>
                    )}
                  </div>
                  <ChevronDown className="w-4 h-4 text-neutral-500" />
                </div>
              </Dropdown.Trigger>
              <Dropdown.Portal>
                <Dropdown.Positioner>
                  <Dropdown.Popup className="min-w-[240px]">
                    <Dropdown.Arrow />
                    {connections === undefined ? (
                      <div className="px-3 py-2 text-sm text-neutral-500">Loading...</div>
                    ) : activeConnections.length > 0 ? (
                      <div className="py-1">
                        {activeConnections.map((c) => {
                          const name = c.accountLogin || `installation-${c.installationId}`;
                          const cfgUrl = c.accountLogin && c.accountType
                            ? c.accountType === "Organization"
                              ? `https://github.com/organizations/${c.accountLogin}/settings/installations/${c.installationId}`
                              : `https://github.com/settings/installations/${c.installationId}`
                            : null;
                          const isSelected = currentOrg === c.accountLogin;
                          return (
                            <Dropdown.Item
                              key={`${c.accountLogin}:${c.installationId}`}
                              onClick={() => setSelectedConnectionLogin(c.accountLogin ?? null)}
                              className="flex items-center justify-between gap-2 text-sm"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <ConnectionIcon type={c.type} />
                                <span className="truncate">{name}</span>
                                {isSelected && (
                                  <span className="ml-1 text-[10px] text-neutral-500">(selected)</span>
                                )}
                              </div>
                              {cfgUrl ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-900"
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
                                      <Settings className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>Add Repos</TooltipContent>
                                </Tooltip>
                              ) : null}
                            </Dropdown.Item>
                          );
                        })}
                        {installNewUrl ? (
                          <div className="mt-1 border-t border-neutral-200 dark:border-neutral-800" />
                        ) : null}
                        {installNewUrl ? (
                          <Dropdown.Item
                            onClick={async () => {
                              try {
                                const { state } = await mintState({ teamSlugOrId });
                                const sep = installNewUrl!.includes("?") ? "&" : "?";
                                const url = `${installNewUrl}${sep}state=${encodeURIComponent(state)}`;
                                openCenteredPopup(
                                  url,
                                  { name: "github-install" },
                                  handlePopupClosedRefetch
                                );
                              } catch (e) {
                                console.error("Failed to mint install state:", e);
                                alert("Failed to start installation. Please try again.");
                              }
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <ConnectionIcon type="github" />
                              <span>Add GitHub Account</span>
                            </div>
                          </Dropdown.Item>
                        ) : null}
                      </div>
                    ) : (
                      <div className="px-3 py-2 text-sm text-neutral-500">No connections</div>
                    )}
                  </Dropdown.Popup>
                </Dropdown.Positioner>
              </Dropdown.Portal>
            </Dropdown.Root>
          </div>

          {/* Step 1: Recent repositories (always top 5, filter by search) */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-neutral-800 dark:text-neutral-200">
              Repositories
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search recent repositories"
              className="w-full rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300 dark:focus:ring-neutral-700"
            />

            <div className="mt-2 rounded-md border border-neutral-200 dark:border-neutral-800 overflow-hidden">
              {githubReposQuery.isPending ? (
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
                    const isSelected = (selectedRepos as Set<string>).has(r.fullName);
                    const when = r.lastSyncedAt ? formatTimeAgo(r.lastSyncedAt as string) : "";
                    return (
                      <div
                        key={r.fullName}
                        role="option"
                        aria-selected={isSelected}
                        className="px-3 h-9 flex items-center justify-between bg-white dark:bg-neutral-950 cursor-default select-none"
                        onClick={() => {
                          setSelectedRepos((prev) => {
                            const next = new Set(prev as Set<string>);
                            if (next.has(r.fullName)) next.delete(r.fullName);
                            else next.add(r.fullName);
                            return next as unknown as Selection;
                          });
                        }}
                      >
                        <div className="font-medium flex items-center gap-2 min-w-0 flex-1">
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
                          <span className="truncate">{r.fullName}</span>
                        </div>
                        <div className="ml-3 flex items-center gap-2">
                          {when && (
                            <span className="text-[10px] text-neutral-500 dark:text-neutral-500">{when}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="px-3 py-6 text-sm text-neutral-500 dark:text-neutral-400 bg-white dark:bg-neutral-950">
                  {search ? "No recent repositories match your search." : "No recent repositories available."}
                </div>
              )}
            </div>

            <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-500">
              Only the 5 most recently updated repositories are shown.
              {" "}
              Missing a repo?{" "}
              {configureUrl ? (
                <a
                  href={configureUrl}
                  onClick={(e) => {
                    e.preventDefault();
                    openCenteredPopup(
                      configureUrl,
                      { name: "github-config" },
                      handlePopupClosedRefetch
                    );
                  }}
                  className="underline hover:text-neutral-700 dark:hover:text-neutral-300"
                >
                  Configure repository access
                </a>
              ) : (
                <span>Configure repository access</span>
              )}
              .
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={(selectedRepos as Set<string>).size === 0}
                onClick={() => setStep(2)}
                className="inline-flex items-center rounded-md bg-neutral-900 text-white disabled:bg-neutral-300 dark:disabled:bg-neutral-700 disabled:cursor-not-allowed px-3 py-2 text-sm hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
              >
                Select repositories
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center rounded-md border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-sm text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-900"
              >
                Configure manually
              </button>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-500">
              Prefer to start from scratch? Configure everything by interacting with a VM through a VS Code UI. We’ll capture your changes as a reusable base snapshot.
            </p>
            {/* Step 2: Name and environment variables */}
            {step === 2 ? (
              <>
                <div className="space-y-2 mb-2">
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

                {/* Environment variables */}
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
                          next.push({ name: "", value: "", isSecret: true });
                          setPendingFocusIndex(next.length - 1);
                          return next;
                        });
                      }
                    }
                  }}
                >
                  {/* Labels */}
                  <div
                    className="grid gap-3 text-xs text-neutral-500 dark:text-neutral-500 pb-1 items-center"
                    style={{
                      gridTemplateColumns:
                        "minmax(0, 1fr) minmax(0, 1.4fr) 44px",
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
                                  : [{ name: "", value: "", isSecret: true }];
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
              </>
            ) : null}
          </div>
        </div>
      </div>
    </FloatingPane>
  );
}

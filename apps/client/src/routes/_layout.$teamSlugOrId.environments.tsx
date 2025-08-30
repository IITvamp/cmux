import { env } from "@/client-env";
import { FloatingPane } from "@/components/floating-pane";
import { GitHubIcon } from "@/components/icons/github";
import { GitLabIcon } from "@/components/icons/gitlab";
import { TitleBar } from "@/components/TitleBar";
import { Skeleton } from "@/components/ui/skeleton";
import { api, api as convexApi } from "@cmux/convex/api";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMutation, useQuery } from "convex/react";
import { Check, ChevronDown, Minus, Plus, Trash2 } from "lucide-react";
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
  const reposByOrg = useQuery(api.github.getReposByOrg, { teamSlugOrId });
  const connections = useQuery(api.github.listProviderConnections, {
    teamSlugOrId,
  });
  // Mint signed state for GitHub install
  const mintState = useMutation(convexApi.github_app.mintInstallState);
  const removeConnection = useMutation(api.github.removeProviderConnection);

  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
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
    if (selectedOrg) return selectedOrg;
    if (activeConnections.length > 0)
      return activeConnections[0]?.accountLogin ?? null;
    const keys = reposByOrg ? Object.keys(reposByOrg) : [];
    return keys.length > 0 ? keys[0]! : null;
  }, [selectedOrg, activeConnections, reposByOrg]);

  type RepoLite = {
    fullName: string;
    name: string;
    provider?: string;
    connectionId?: unknown;
    lastSyncedAt?: unknown;
    fullNameLower: string;
    nameLower: string;
  };
  const allRepos = useMemo<RepoLite[]>(() => {
    if (!reposByOrg) return [];
    const groups = Object.values(reposByOrg) as Array<
      Array<{
        fullName: string;
        name: string;
        provider?: string;
        connectionId?: unknown;
        lastSyncedAt?: unknown;
      }>
    >;
    return groups
      .flat()
      .filter(
        (r) => typeof r.fullName === "string" && typeof r.name === "string"
      )
      .map((r) => ({
        fullName: r.fullName,
        name: r.name,
        provider: r.provider,
        connectionId: r.connectionId,
        lastSyncedAt: r.lastSyncedAt,
        fullNameLower: r.fullName.toLowerCase(),
        nameLower: r.name.toLowerCase(),
      }));
  }, [reposByOrg]);

  const deferredSearch = useDeferredValue(search);
  const filteredRepos = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    const list = allRepos;
    if (!q) return list;
    return list.filter(
      (r) => r.fullNameLower.includes(q) || r.nameLower.includes(q)
    );
  }, [allRepos, deferredSearch]);

  const [selectedRepos, setSelectedRepos] = useState<Selection>(new Set());
  const parentRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredRepos.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 12,
  });

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
              Configure an environment by selecting a GitHub organization and
              repository.
            </p>
          </div>

          {/* Environment name */}
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

          {/* Connections list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-neutral-800 dark:text-neutral-200">
                Connections
              </label>
              {installNewUrl ? (
                <button
                  type="button"
                  className="text-xs underline text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100"
                  onClick={async () => {
                    try {
                      const { state } = await mintState({ teamSlugOrId });
                      const sep = installNewUrl.includes("?") ? "&" : "?";
                      const url = `${installNewUrl}${sep}state=${encodeURIComponent(state)}`;
                      openCenteredPopup(url, { name: "github-install" }, handlePopupClosedRefetch);
                    } catch (e) {
                      console.error("Failed to mint install state:", e);
                      alert("Failed to start installation. Please try again.");
                    }
                  }}
                >
                  Add organization
                </button>
              ) : null}
            </div>

            {connections === undefined ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 h-9 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-4 rounded-full" />
                      <Skeleton className="h-4 w-32 rounded-full" />
                      <Skeleton className="h-3 w-14 rounded-full" />
                    </div>
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-3 w-16 rounded-full" />
                      <Skeleton className="h-3 w-12 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activeConnections.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {activeConnections.map((c) => {
                  const name =
                    c.accountLogin || `installation-${c.installationId}`;
                  const cfgUrl =
                    c.accountLogin && c.accountType
                      ? c.accountType === "Organization"
                        ? `https://github.com/organizations/${c.accountLogin}/settings/installations/${c.installationId}`
                        : `https://github.com/settings/installations/${c.installationId}`
                      : null;
                  return (
                    <div
                      key={`${c.accountLogin}:${c.installationId}`}
                      className={`rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 h-9 flex items-center justify-between`}
                    >
                      <div className="text-sm text-left text-neutral-800 dark:text-neutral-200 flex items-center gap-2 min-w-0 flex-1">
                        <ConnectionIcon type={c.type} />
                        <span className="truncate">{name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {cfgUrl ? (
                          <a
                            href={cfgUrl}
                            onClick={(e) => {
                              e.preventDefault();
                              openCenteredPopup(
                                cfgUrl,
                                { name: "github-config" },
                                handlePopupClosedRefetch
                              );
                            }}
                            className="text-xs underline text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100"
                          >
                            Add repos
                          </a>
                        ) : null}
                        <button
                          type="button"
                          aria-label="Remove connection"
                          className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                          onClick={async () => {
                            try {
                              await removeConnection({
                                teamSlugOrId,
                                installationId: c.installationId,
                              });
                              setSelectedOrg(null);
                            } catch (e) {
                              console.error("Failed to remove connection:", e);
                              alert("Failed to remove connection");
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-neutral-500 dark:text-neutral-400">
                No provider connections found for this team.
                {installNewUrl ? (
                  <>
                    {" "}
                    You can{" "}
                    <button
                      type="button"
                      className="underline text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100"
                      onClick={async () => {
                        try {
                          const { state } = await mintState({ teamSlugOrId });
                          const sep = installNewUrl.includes("?") ? "&" : "?";
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
                      add a GitHub organization
                    </button>
                    .
                  </>
                ) : null}
              </div>
            )}
          </div>

          {/* Repo search */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-neutral-800 dark:text-neutral-200">
              Repositories
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search repositories"
              className="w-full rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300 dark:focus:ring-neutral-700"
            />

            {/* Repo list as checkmark ListBox */}
            <div className="mt-2 rounded-md border border-neutral-200 dark:border-neutral-800 overflow-hidden">
              {reposByOrg === undefined ? (
                <div className="divide-y divide-neutral-200 dark:divide-neutral-900">
                  {[...Array(8)].map((_, i) => (
                    <div
                      key={i}
                      className="px-3 h-9 flex items-center justify-between bg-white dark:bg-neutral-950"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Skeleton className="h-4 w-4 rounded-sm" />
                        <Skeleton className="h-4 w-56 rounded" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-8 rounded-full" />
                        <Skeleton className="h-3 w-28 rounded-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredRepos.length > 0 ? (
                <div
                  ref={parentRef}
                  role="listbox"
                  aria-multiselectable="true"
                  className="max-h-[40vh] overflow-auto relative outline-none"
                >
                  <div
                    className="relative w-full"
                    style={{ height: rowVirtualizer.getTotalSize() }}
                  >
                    {rowVirtualizer.getVirtualItems().map((vi) => {
                      const r = filteredRepos[vi.index]!;
                      const isSelected = (selectedRepos as Set<string>).has(
                        r.fullName
                      );
                      return (
                        <div
                          key={r.fullName}
                          role="option"
                          aria-selected={isSelected}
                          className={
                            "absolute top-0 left-0 right-0 group px-3 h-9 flex items-center justify-between text-sm text-neutral-800 dark:text-neutral-200 bg-white dark:bg-neutral-950 hover:bg-neutral-50 dark:hover:bg-neutral-900"
                          }
                          style={{ transform: `translateY(${vi.start}px)` }}
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
                            {r.provider === "gitlab" ? (
                              <GitLabIcon className="h-4 w-4 shrink-0 text-neutral-600 dark:text-neutral-300" />
                            ) : (
                              <GitHubIcon className="h-4 w-4 shrink-0 text-neutral-700 dark:text-neutral-200" />
                            )}
                            <span className="truncate">{r.fullName}</span>
                          </div>
                          <div className="ml-3 flex items-center gap-2">
                            {r.connectionId ? (
                              <span className="inline-flex items-center rounded-full bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 px-2 py-0.5 text-[10px]">
                                App
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-neutral-100 dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 px-2 py-0.5 text-[10px]">
                                Local
                              </span>
                            )}
                            {r.lastSyncedAt ? (
                              <span className="text-[10px] text-neutral-500 dark:text-neutral-500">
                                {new Date(
                                  r.lastSyncedAt as number
                                ).toLocaleString()}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="px-3 py-6 text-sm text-neutral-500 dark:text-neutral-400 bg-white dark:bg-neutral-950">
                  {search
                    ? "No repositories match your search."
                    : "No repositories in this organization."}
                </div>
              )}
            </div>

            <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-500">
              This list only includes repositories that you have access to in
              GitHub and can use with cmux.
              <br />
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
          </div>
        </div>
      </div>
    </FloatingPane>
  );
}

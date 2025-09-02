import { FloatingPane } from "@/components/floating-pane";
import { GitHubIcon } from "@/components/icons/github";
import { RepositoryPicker } from "@/components/RepositoryPicker";
import { ResizableColumns } from "@/components/ResizableColumns";
import { TitleBar } from "@/components/TitleBar";
import { postApiMorphProvisionInstanceMutation } from "@cmux/www-openapi-client/react-query";
import { useMutation as useRQMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import clsx from "clsx";
import {
  ArrowLeft,
  ChevronDown,
  Loader2,
  Minus,
  Plus,
  Settings,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
export const Route = createFileRoute("/_layout/$teamSlugOrId/environments/new")(
  {
    component: EnvironmentsPage,
  }
);

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
      to: "/$teamSlugOrId/environments/new",
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
            to: "/$teamSlugOrId/environments/new",
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
      to: "/$teamSlugOrId/environments/new",
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
              showHeader={true}
              showContinueButton={true}
              showManualConfigOption={true}
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

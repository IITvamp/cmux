import { ContainerSettings } from "@/components/ContainerSettings";
import { FloatingPane } from "@/components/floating-pane";
import { ProviderStatusSettings } from "@/components/provider-status-settings";
import { useTheme } from "@/components/theme/use-theme";
import { TitleBar } from "@/components/TitleBar";
import { api } from "@cmux/convex/api";
import type { Doc } from "@cmux/convex/dataModel";
import { AGENT_CONFIGS, type AgentConfig } from "@cmux/shared/agentConfig";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useConvex } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_layout/settings")({
  component: SettingsComponent,
});

function SettingsComponent() {
  const { theme, setTheme } = useTheme();
  const convex = useConvex();
  const [apiKeyValues, setApiKeyValues] = useState<Record<string, string>>({});
  const [originalApiKeyValues, setOriginalApiKeyValues] = useState<
    Record<string, string>
  >({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [worktreePath, setWorktreePath] = useState<string>("");
  const [originalWorktreePath, setOriginalWorktreePath] = useState<string>("");
  const [autoPrEnabled, setAutoPrEnabled] = useState<boolean>(false);
  const [originalAutoPrEnabled, setOriginalAutoPrEnabled] = useState<boolean>(false);
  const [isSaveButtonVisible, setIsSaveButtonVisible] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const saveButtonRef = useRef<HTMLDivElement>(null);
  const [containerSettingsData, setContainerSettingsData] = useState<{
    maxRunningContainers: number;
    reviewPeriodMinutes: number;
    autoCleanupEnabled: boolean;
    stopImmediatelyOnCompletion: boolean;
    minContainersToKeep: number;
  } | null>(null);
  const [originalContainerSettingsData, setOriginalContainerSettingsData] =
    useState<typeof containerSettingsData>(null);

  // Get all required API keys from agent configs
  const apiKeys = Array.from(
    new Map(
      AGENT_CONFIGS.flatMap((config: AgentConfig) => config.apiKeys || []).map(
        (key) => [key.envVar, key]
      )
    ).values()
  );

  // Query existing API keys
  const { data: existingKeys } = useQuery({
    queryKey: ["apiKeys"],
    queryFn: async () => {
      return await convex.query(api.apiKeys.getAll);
    },
  });

  // Query workspace settings
  const { data: workspaceSettings } = useQuery({
    queryKey: ["workspaceSettings"],
    queryFn: async () => {
      return await convex.query(api.workspaceSettings.get);
    },
  });

  // Initialize form values when data loads
  useEffect(() => {
    if (existingKeys) {
      const values: Record<string, string> = {};
      existingKeys.forEach((key: Doc<"apiKeys">) => {
        values[key.envVar] = key.value;
      });
      setApiKeyValues(values);
      setOriginalApiKeyValues(values);
    }
  }, [existingKeys]);

  // Initialize worktree path when data loads
  useEffect(() => {
    if (workspaceSettings !== undefined) {
      setWorktreePath(workspaceSettings?.worktreePath || "");
      setOriginalWorktreePath(workspaceSettings?.worktreePath || "");
      const enabled = (workspaceSettings as unknown as { autoPrEnabled?: boolean })?.autoPrEnabled;
      const effective = enabled === undefined ? false : Boolean(enabled);
      setAutoPrEnabled(effective);
      setOriginalAutoPrEnabled(effective);
    }
  }, [workspaceSettings]);

  // Track save button visibility
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const saveButton = saveButtonRef.current;

    if (!scrollContainer || !saveButton) return;

    const checkSaveButtonVisibility = () => {
      const containerRect = scrollContainer.getBoundingClientRect();
      const buttonRect = saveButton.getBoundingClientRect();

      // Check if button is visible within the container
      const isVisible =
        buttonRect.top < containerRect.bottom &&
        buttonRect.bottom > containerRect.top;

      setIsSaveButtonVisible(isVisible);
    };

    // Check initial visibility
    checkSaveButtonVisibility();

    // Add scroll listener
    scrollContainer.addEventListener("scroll", checkSaveButtonVisibility);

    // Also check on resize
    window.addEventListener("resize", checkSaveButtonVisibility);

    return () => {
      scrollContainer.removeEventListener("scroll", checkSaveButtonVisibility);
      window.removeEventListener("resize", checkSaveButtonVisibility);
    };
  }, []);

  // Mutation to save API keys
  const saveApiKeyMutation = useMutation({
    mutationFn: async (data: {
      envVar: string;
      value: string;
      displayName: string;
      description?: string;
    }) => {
      return await convex.mutation(api.apiKeys.upsert, data);
    },
  });

  const handleApiKeyChange = (envVar: string, value: string) => {
    setApiKeyValues((prev) => ({ ...prev, [envVar]: value }));
  };

  const toggleShowKey = (envVar: string) => {
    setShowKeys((prev) => ({ ...prev, [envVar]: !prev[envVar] }));
  };

  const handleContainerSettingsChange = useCallback(
    (data: {
      maxRunningContainers: number;
      reviewPeriodMinutes: number;
      autoCleanupEnabled: boolean;
      stopImmediatelyOnCompletion: boolean;
      minContainersToKeep: number;
    }) => {
      setContainerSettingsData(data);
      if (!originalContainerSettingsData) {
        setOriginalContainerSettingsData(data);
      }
    },
    [originalContainerSettingsData]
  );

  // Check if there are any changes
  const hasChanges = () => {
    // Check worktree path changes
    const worktreePathChanged = worktreePath !== originalWorktreePath;

    // Check GitHub token changes
    const githubTokenChanged = 
      (apiKeyValues["GITHUB_TOKEN"] || "") !== (originalApiKeyValues["GITHUB_TOKEN"] || "");

    // Check all required API keys for changes
    const apiKeysChanged = apiKeys.some((keyConfig) => {
      const currentValue = apiKeyValues[keyConfig.envVar] || "";
      const originalValue = originalApiKeyValues[keyConfig.envVar] || "";
      return currentValue !== originalValue;
    });

    // Check container settings changes
    const containerSettingsChanged =
      containerSettingsData &&
      originalContainerSettingsData &&
      JSON.stringify(containerSettingsData) !==
        JSON.stringify(originalContainerSettingsData);

    // Auto PR toggle changes
    const autoPrChanged = autoPrEnabled !== originalAutoPrEnabled;

    return worktreePathChanged || autoPrChanged || githubTokenChanged || apiKeysChanged || containerSettingsChanged;
  };

  const saveApiKeys = async () => {
    setIsSaving(true);

    try {
      let savedCount = 0;
      let deletedCount = 0;

      // Save worktree path / auto PR if changed
      if (worktreePath !== originalWorktreePath || autoPrEnabled !== originalAutoPrEnabled) {
        await convex.mutation(api.workspaceSettings.update, {
          worktreePath: worktreePath || undefined,
          autoPrEnabled,
        });
        setOriginalWorktreePath(worktreePath);
        setOriginalAutoPrEnabled(autoPrEnabled);
      }

      // Save container settings if changed
      if (
        containerSettingsData &&
        originalContainerSettingsData &&
        JSON.stringify(containerSettingsData) !==
          JSON.stringify(originalContainerSettingsData)
      ) {
        await convex.mutation(
          api.containerSettings.update,
          containerSettingsData
        );
        setOriginalContainerSettingsData(containerSettingsData);
      }

      // Save GitHub token if changed
      const githubTokenValue = apiKeyValues["GITHUB_TOKEN"] || "";
      const originalGithubTokenValue = originalApiKeyValues["GITHUB_TOKEN"] || "";
      
      if (githubTokenValue !== originalGithubTokenValue) {
        if (githubTokenValue.trim()) {
          await saveApiKeyMutation.mutateAsync({
            envVar: "GITHUB_TOKEN",
            value: githubTokenValue.trim(),
            displayName: "GitHub Personal Access Token",
            description: "Used for creating pull requests via GitHub CLI",
          });
          savedCount++;
        } else if (originalGithubTokenValue) {
          await convex.mutation(api.apiKeys.remove, {
            envVar: "GITHUB_TOKEN",
          });
          deletedCount++;
        }
      }

      for (const key of apiKeys) {
        const value = apiKeyValues[key.envVar] || "";
        const originalValue = originalApiKeyValues[key.envVar] || "";

        // Only save if the value has changed
        if (value !== originalValue) {
          if (value.trim()) {
            // Save or update the key
            await saveApiKeyMutation.mutateAsync({
              envVar: key.envVar,
              value: value.trim(),
              displayName: key.displayName,
              description: key.description,
            });
            savedCount++;
          } else if (originalValue) {
            // Delete the key if it was cleared
            await convex.mutation(api.apiKeys.remove, {
              envVar: key.envVar,
            });
            deletedCount++;
          }
        }
      }

      // Update original values to reflect saved state
      setOriginalApiKeyValues(apiKeyValues);

      if (savedCount > 0 || deletedCount > 0) {
        const actions = [];
        if (savedCount > 0) {
          actions.push(`saved ${savedCount} key${savedCount > 1 ? "s" : ""}`);
        }
        if (deletedCount > 0) {
          actions.push(
            `removed ${deletedCount} key${deletedCount > 1 ? "s" : ""}`
          );
        }
        toast.success(`Successfully ${actions.join(" and ")}`);
      } else {
        toast.info("No changes to save");
      }
    } catch (error) {
      toast.error("Failed to save API keys. Please try again.");
      console.error("Error saving API keys:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <FloatingPane header={<TitleBar title="Settings" />}>
      <div
        ref={scrollContainerRef}
        className="flex flex-col grow overflow-auto select-none relative"
      >
        <div className="p-6 max-w-3xl">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
              Settings
            </h1>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Manage your workspace preferences and configuration
            </p>
          </div>

          {/* Settings Sections */}
          <div className="space-y-4">
            {/* Crown Evaluator */}
            <div className="bg-white dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800">
              <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
                <h2 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  Crown Evaluator
                </h2>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      Auto pull request for crown winner
                    </label>
                    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                      When enabled, cmux automatically creates a pull request for the winning model’s code diff.
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-pressed={autoPrEnabled}
                    onClick={() => setAutoPrEnabled((v) => !v)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      autoPrEnabled ? "bg-blue-600" : "bg-neutral-300 dark:bg-neutral-700"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white dark:bg-neutral-900 shadow transition-transform ${
                        autoPrEnabled ? "translate-x-5" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
            {/* Appearance */}
            <div className="bg-white dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800">
              <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
                <h2 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  Appearance
                </h2>
              </div>
              <div className="p-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Theme
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setTheme("light")}
                      className={`p-2 border-2 ${theme === "light" ? "border-blue-500 bg-neutral-50 dark:bg-neutral-800" : "border-neutral-200 dark:border-neutral-700"} rounded-lg text-sm font-medium text-neutral-700 dark:text-neutral-300 transition-colors`}
                    >
                      Light
                    </button>
                    <button
                      onClick={() => setTheme("dark")}
                      className={`p-2 border-2 ${theme === "dark" ? "border-blue-500 bg-neutral-50 dark:bg-neutral-800" : "border-neutral-200 dark:border-neutral-700"} rounded-lg text-sm font-medium text-neutral-700 dark:text-neutral-300 transition-colors`}
                    >
                      Dark
                    </button>
                    <button
                      onClick={() => setTheme("system")}
                      className={`p-2 border-2 ${theme === "system" ? "border-blue-500 bg-neutral-50 dark:bg-neutral-800" : "border-neutral-200 dark:border-neutral-700"} rounded-lg text-sm font-medium text-neutral-700 dark:text-neutral-300 transition-colors`}
                    >
                      System
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Worktree Path */}
            <div className="bg-white dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800">
              <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
                <h2 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  Worktree Location
                </h2>
              </div>
              <div className="p-4">
                <div>
                  <label
                    htmlFor="worktreePath"
                    className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2"
                  >
                    Custom Worktree Path
                  </label>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
                    Specify where to store git worktrees. Leave empty to use the
                    default location. You can use ~ for your home directory.
                  </p>
                  <input
                    type="text"
                    id="worktreePath"
                    value={worktreePath}
                    onChange={(e) => setWorktreePath(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
                    placeholder="~/my-custom-worktrees"
                    autoComplete="off"
                  />
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                    Default location: ~/cmux
                  </p>
                </div>
              </div>
            </div>

            {/* GitHub Authentication */}
            <div className="bg-white dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800">
              <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
                <h2 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  GitHub Authentication
                </h2>
              </div>
              <div className="p-4">
                <div className="space-y-1">
                  <label
                    htmlFor="GITHUB_TOKEN"
                    className="block text-sm font-medium text-neutral-700 dark:text-neutral-300"
                  >
                    GitHub Personal Access Token
                  </label>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Required for creating pull requests. Create a token at{" "}
                    <a
                      href="https://github.com/settings/tokens/new"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-600"
                    >
                      github.com/settings/tokens
                    </a>{" "}
                    with 'repo' and 'pull_request' scopes.
                  </p>
                  <div className="relative mt-2">
                    <input
                      type={showKeys["GITHUB_TOKEN"] ? "text" : "password"}
                      id="GITHUB_TOKEN"
                      value={apiKeyValues["GITHUB_TOKEN"] || ""}
                      onChange={(e) =>
                        handleApiKeyChange("GITHUB_TOKEN", e.target.value)
                      }
                      className="w-full px-3 py-2 pr-10 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowKey("GITHUB_TOKEN")}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-500"
                    >
                      {showKeys["GITHUB_TOKEN"] ? (
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Provider Authentication */}
            <div className="bg-white dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800">
              <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
                <h2 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  AI Provider Authentication
                </h2>
              </div>
              <div className="p-4">
                {/* OAuth Providers Notice */}
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        OAuth-based providers (Gemini, AMP)
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        These providers use OAuth authentication. When you first run them, they'll open a browser for you to authorize access. No API keys needed.
                      </p>
                    </div>
                  </div>
                </div>

                {/* API Keys Section */}
                <div className="space-y-3">
                  {apiKeys.length === 0 ? (
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      No API keys required for the configured agents.
                    </p>
                  ) : (
                    <>
                      <div className="mb-3">
                        <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-1">
                          API Key Authentication
                        </h3>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          The following providers require API keys. Get your keys from their respective platforms:
                        </p>
                      </div>
                      
                      {/* Group API keys by provider for better organization */}
                      {apiKeys.map((key) => {
                        const getProviderInfo = (envVar: string) => {
                          switch (envVar) {
                            case "ANTHROPIC_API_KEY":
                              return {
                                name: "Anthropic (Claude models via Opencode)",
                                url: "https://console.anthropic.com/settings/keys",
                                models: ["opus-4", "opus-4.1", "sonnet-4", "qwen3-coder"],
                                instructions: "Create an API key in your Anthropic Console"
                              };
                            case "OPENAI_API_KEY":
                              return {
                                name: "OpenAI (GPT/O-series models via Opencode/Codex)",
                                url: "https://platform.openai.com/api-keys",
                                models: ["gpt-5", "gpt-5-mini", "gpt-5-nano", "o3-pro"],
                                instructions: "Generate an API key from OpenAI Platform"
                              };
                            case "OPENROUTER_API_KEY":
                              return {
                                name: "OpenRouter (Multiple models via Opencode)",
                                url: "https://openrouter.ai/keys",
                                models: ["kimi-k2", "glm-4.5"],
                                instructions: "Get your API key from OpenRouter dashboard"
                              };
                            default:
                              return null;
                          }
                        };
                        
                        const providerInfo = getProviderInfo(key.envVar);
                        
                        return (
                          <div key={key.envVar} className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-3 space-y-2">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <label
                                  htmlFor={key.envVar}
                                  className="block text-sm font-medium text-neutral-700 dark:text-neutral-300"
                                >
                                  {providerInfo?.name || key.displayName}
                                </label>
                                {providerInfo && (
                                  <div className="mt-1 space-y-1">
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                      {providerInfo.instructions}
                                    </p>
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                      Used for models: <span className="font-medium">{providerInfo.models.join(", ")}</span>
                                    </p>
                                  </div>
                                )}
                              </div>
                              {providerInfo?.url && (
                                <a
                                  href={providerInfo.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                                >
                                  Get key
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </a>
                              )}
                            </div>
                            <div className="relative">
                              <input
                                type={showKeys[key.envVar] ? "text" : "password"}
                                id={key.envVar}
                                value={apiKeyValues[key.envVar] || ""}
                                onChange={(e) =>
                                  handleApiKeyChange(key.envVar, e.target.value)
                                }
                                className="w-full px-3 py-2 pr-10 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 font-mono text-sm"
                                placeholder={key.envVar === "ANTHROPIC_API_KEY" ? "sk-ant-api03-..." : 
                                           key.envVar === "OPENAI_API_KEY" ? "sk-proj-..." : 
                                           key.envVar === "OPENROUTER_API_KEY" ? "sk-or-v1-..." : 
                                           `Enter your ${key.displayName}`}
                              />
                              <button
                                type="button"
                                onClick={() => toggleShowKey(key.envVar)}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-500"
                              >
                                {showKeys[key.envVar] ? (
                                  <svg
                                    className="h-5 w-5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                                    />
                                  </svg>
                                ) : (
                                  <svg
                                    className="h-5 w-5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                    />
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                    />
                                  </svg>
                                )}
                              </button>
                            </div>
                            {apiKeyValues[key.envVar] && (
                              <div className="flex items-center gap-1">
                                <svg className="w-3 h-3 text-green-500 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <span className="text-xs text-green-600 dark:text-green-400">API key configured</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Provider Status */}
            <div className="bg-white dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800">
              <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
                <h2 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  Provider Status
                </h2>
              </div>
              <div className="p-4">
                <ProviderStatusSettings />
              </div>
            </div>

            {/* Container Settings */}
            <div className="bg-white dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800">
              <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
                <h2 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  Container Management
                </h2>
              </div>
              <div className="p-4">
                <ContainerSettings
                  onDataChange={handleContainerSettingsChange}
                />
              </div>
            </div>

            {/* Notifications */}
            <div className="bg-white dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 hidden">
              <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
                <h2 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  Notifications
                </h2>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      Email Notifications
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Receive updates about your workspace via email
                    </p>
                  </div>
                  <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-blue-600 dark:bg-blue-500 cursor-default">
                    <span className="translate-x-6 inline-block h-4 w-4 transform rounded-full bg-white transition"></span>
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      Desktop Notifications
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Get notified about important updates on desktop
                    </p>
                  </div>
                  <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-neutral-200 dark:bg-neutral-700 cursor-default">
                    <span className="translate-x-1 inline-block h-4 w-4 transform rounded-full bg-white dark:bg-neutral-200 transition"></span>
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      Weekly Digest
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Summary of your workspace activity
                    </p>
                  </div>
                  <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-blue-600 dark:bg-blue-500 cursor-default">
                    <span className="translate-x-6 inline-block h-4 w-4 transform rounded-full bg-white transition"></span>
                  </button>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div ref={saveButtonRef} className="flex justify-end pt-2">
              <button
                onClick={saveApiKeys}
                disabled={!hasChanges() || isSaving}
                className={`px-4 py-2 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-900 transition-all ${
                  !hasChanges() || isSaving
                    ? "bg-neutral-200 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 cursor-not-allowed opacity-50"
                    : "bg-blue-600 dark:bg-blue-500 text-white"
                }`}
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>

        {/* Floating unsaved changes notification */}
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ease-in-out ${
            hasChanges() && !isSaveButtonVisible
              ? "opacity-100 translate-y-0 pointer-events-auto"
              : "opacity-0 translate-y-4 pointer-events-none"
          }`}
        >
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg px-4 py-3 flex items-center gap-3">
            <span className="text-sm text-neutral-700 dark:text-neutral-300">
              You have unsaved changes
            </span>
            <button
              onClick={saveApiKeys}
              disabled={isSaving}
              className={`px-3 py-1.5 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-900 transition-all ${
                isSaving
                  ? "bg-neutral-200 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 cursor-not-allowed opacity-50"
                  : "bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600"
              }`}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </FloatingPane>
  );
}

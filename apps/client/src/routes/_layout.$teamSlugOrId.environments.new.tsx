import { FloatingPane } from "@/components/floating-pane";
import { RepositoryPicker } from "@/components/RepositoryPicker";
import { TitleBar } from "@/components/TitleBar";
import { EnvironmentConfiguration } from "@/components/EnvironmentConfiguration";
import { 
  postApiMorphSetupInstanceMutation
} from "@cmux/www-openapi-client/react-query";
import { useMutation as useRQMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useEffect } from "react";
export const Route = createFileRoute("/_layout/$teamSlugOrId/environments/new")({
  component: EnvironmentsPage,
});

// Main Page Component
function EnvironmentsPage() {
  const searchParams = Route.useSearch();
  const step = (searchParams.step ?? "select") as "select" | "configure";
  const urlSelectedRepos = searchParams.selectedRepos ?? [];
  const urlConnectionLogin = searchParams.connectionLogin;
  const urlRepoSearch = searchParams.repoSearch ?? "";
  const urlInstanceId = searchParams.instanceId;
  const navigate = useNavigate();
  const { teamSlugOrId } = Route.useParams();
  const setupInstanceMutation = useRQMutation(
    postApiMorphSetupInstanceMutation()
  );

  // Derive VSCode URL from instanceId or setup response
  const derivedVscodeUrl = useMemo(() => {
    // Use URL from setup mutation if available
    if (setupInstanceMutation.data?.vscodeUrl) {
      return setupInstanceMutation.data.vscodeUrl;
    }
    // Otherwise derive from instanceId
    if (!urlInstanceId) return undefined;
    const hostId = urlInstanceId.replace(/_/g, "-");
    return `https://port-39378-${hostId}.http.cloud.morph.so/?folder=/root/workspace`;
  }, [urlInstanceId, setupInstanceMutation.data]);

  // Handle repo changes when user goes back and selects different repos
  useEffect(() => {
    if (step === "configure" && urlInstanceId && urlSelectedRepos.length > 0) {
      // Check if we need to update repos (only if not currently setting up)
      if (!setupInstanceMutation.isPending) {
        const lastClonedRepos = setupInstanceMutation.data?.clonedRepos || [];
        const needsUpdate = urlSelectedRepos.some((repo: string) => !lastClonedRepos.includes(repo)) ||
                           lastClonedRepos.some((repo: string) => !urlSelectedRepos.includes(repo));
        
        // Only re-setup if repos have actually changed
        if (needsUpdate && lastClonedRepos.length > 0) {
          setupInstanceMutation.mutate({
            body: {
              teamSlugOrId,
              instanceId: urlInstanceId,
              selectedRepos: urlSelectedRepos,
              ttlSeconds: 60 * 60 * 2,
            },
          });
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, urlInstanceId, urlSelectedRepos]);

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
        // Explicitly persist instance fields to satisfy type
        instanceId: prev.instanceId,
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

    // Setup instance with repos (creates new instance if needed)
    setupInstanceMutation.mutate(
      {
        body: {
          teamSlugOrId,
          instanceId: urlInstanceId,
          selectedRepos: repos,
          ttlSeconds: 60 * 60 * 2, // 2 hours
        },
      },
      {
        onSuccess: (data) => {
          // Update URL with the instanceId if it's new
          if (!urlInstanceId && data.instanceId) {
            navigate({
              to: "/$teamSlugOrId/environments/new",
              params: { teamSlugOrId },
              search: (prev) => ({
                ...prev,
                step: prev.step,
                selectedRepos: prev.selectedRepos,
                connectionLogin: prev.connectionLogin,
                repoSearch: prev.repoSearch,
                instanceId: data.instanceId,
              }),
              replace: true,
            });
          }
          console.log("Cloned repos:", data.clonedRepos);
          console.log("Removed repos:", data.removedRepos);
        },
        onError: (error) => {
          console.error("Failed to setup instance:", error);
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
        instanceId: prev.instanceId,
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
            instanceId={urlInstanceId}
            vscodeUrl={derivedVscodeUrl}
            isProvisioning={setupInstanceMutation.isPending}
          />
        )}
      </div>
    </FloatingPane>
  );
}

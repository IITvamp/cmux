import { FloatingPane } from "@/components/floating-pane";
import { RepositoryPicker } from "@/components/RepositoryPicker";
import { TitleBar } from "@/components/TitleBar";
import { EnvironmentConfiguration } from "@/components/EnvironmentConfiguration";
import { postApiMorphProvisionInstanceMutation } from "@cmux/www-openapi-client/react-query";
import { useMutation as useRQMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
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

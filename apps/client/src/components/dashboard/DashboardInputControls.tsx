import { ComboboxDropdown, type ComboboxOption } from "@/components/ui/combobox-dropdown";
import { ModeToggleTooltip } from "@/components/ui/mode-toggle-tooltip";
import { AGENT_CONFIGS } from "@cmux/shared/agentConfig";
import clsx from "clsx";
import { Image, Mic } from "lucide-react";
import { memo, useCallback, useMemo } from "react";

interface DashboardInputControlsProps {
  projectOptions: string[];
  selectedProject: string[];
  onProjectChange: (projects: string[]) => void;
  branchOptions: string[];
  selectedBranch: string[];
  onBranchChange: (branches: string[]) => void;
  selectedAgents: string[];
  onAgentChange: (agents: string[]) => void;
  isCloudMode: boolean;
  onCloudModeToggle: () => void;
  isLoadingProjects: boolean;
  isLoadingBranches: boolean;
  teamSlugOrId: string;
}

export const DashboardInputControls = memo(function DashboardInputControls({
  projectOptions,
  selectedProject,
  onProjectChange,
  branchOptions,
  selectedBranch,
  onBranchChange,
  selectedAgents,
  onAgentChange,
  isCloudMode,
  onCloudModeToggle,
  isLoadingProjects,
  isLoadingBranches,
  teamSlugOrId,
}: DashboardInputControlsProps) {
  const agentOptions = useMemo<ComboboxOption[]>(
    () => AGENT_CONFIGS.map((agent) => ({
      value: agent.name,
      label: agent.name,
      isUnavailable: false, // You can add logic here to check availability if needed
    })),
    []
  );
  // Determine OS for potential future UI tweaks
  // const isMac = navigator.userAgent.toUpperCase().indexOf("MAC") >= 0;

  const handleImageClick = useCallback(() => {
    // Trigger the file select from ImagePlugin
    const lexicalWindow = window as Window & {
      __lexicalImageFileSelect?: () => void;
    };
    if (lexicalWindow.__lexicalImageFileSelect) {
      lexicalWindow.__lexicalImageFileSelect();
    }
  }, []);

  return (
    <div className="flex items-end gap-1 grow">
      <div className="flex items-end gap-1">
        <ComboboxDropdown
          options={projectOptions}
          value={selectedProject}
          onChange={onProjectChange}
          placeholder="Select project"
          multiple={false}
          minWidth="300px"
          maxWidth="500px"
          loading={isLoadingProjects}
          showSearch
        />

        <ComboboxDropdown
          options={branchOptions}
          value={selectedBranch}
          onChange={onBranchChange}
          placeholder="Branch"
          multiple={false}
          minWidth="120px"
          maxWidth="300px"
          loading={isLoadingBranches}
          showSearch
        />

        <ComboboxDropdown
          options={agentOptions}
          value={selectedAgents}
          onChange={onAgentChange}
          placeholder="Select agents"
          multiple={true}
          maxTagCount={1}
          minWidth="220px"
          maxWidth="220px"
          showSearch
        />
      </div>

      <div className="flex items-center justify-end gap-2.5 ml-auto mr-0 pr-1">
        {/* Cloud/Local Mode Toggle */}
        <ModeToggleTooltip
          isCloudMode={isCloudMode}
          onToggle={onCloudModeToggle}
          teamSlugOrId={teamSlugOrId}
        />

        <button
          className={clsx(
            "p-1.5 rounded-full",
            "bg-neutral-100 dark:bg-neutral-700",
            "border border-neutral-200 dark:border-0",
            "text-neutral-600 dark:text-neutral-400",
            "hover:bg-neutral-200 dark:hover:bg-neutral-600",
            "transition-colors"
          )}
          onClick={handleImageClick}
          title="Upload image"
        >
          <Image className="w-4 h-4" />
        </button>

        <button
          className={clsx(
            "p-1.5 rounded-full",
            "bg-neutral-100 dark:bg-neutral-700",
            "border border-neutral-200 dark:border-0",
            "text-neutral-600 dark:text-neutral-400",
            "hover:bg-neutral-200 dark:hover:bg-neutral-600",
            "transition-colors"
          )}
        >
          <Mic className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

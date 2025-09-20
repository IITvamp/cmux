import type { ReactNode } from "react";

export interface CommandBarItemBase {
  id: string;
  value: string;
  label: string;
  description?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  icon?: ReactNode;
  keywords?: string[];
  onHighlight?: () => void | Promise<void>;
}

export interface CommandBarActionItem extends CommandBarItemBase {
  kind: "action";
  onSelect: () => void | Promise<void>;
  closeOnSelect?: boolean;
}

export interface CommandBarStepItem extends CommandBarItemBase {
  kind: "step";
  createStep: () => CommandBarStep;
}

export type CommandBarItem = CommandBarActionItem | CommandBarStepItem;

export interface CommandBarGroup {
  id: string;
  label?: string;
  items: CommandBarItem[];
}

export interface CommandBarStep {
  id: string;
  title?: string;
  placeholder?: string;
  groups: CommandBarGroup[];
}

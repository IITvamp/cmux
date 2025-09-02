import type { DropdownExports } from "./dropdown.parts";
import { DropdownParts } from "./dropdown.parts";

// Aggregate object export only, to keep this file free of component exports
export const Dropdown: DropdownExports = {
  ...DropdownParts,
};


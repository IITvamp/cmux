import { describe, it, expect } from "vitest";
import {
  generateBranchName,
  generateRandomId,
  generateUniqueBranchNamesFromTitle,
} from "./branchNameGenerator.js";

describe("branchNameGenerator 5-digit suffix", () => {
  it("generateRandomId returns 5 digits", () => {
    const id = generateRandomId();
    expect(id).toMatch(/^\d{5}$/);
  });

  it("generateBranchName ends with -5digits", () => {
    const name = generateBranchName("Implement cool feature!");
    expect(name.startsWith("cmux/")).toBe(true);
    expect(name).toMatch(/-\d{5}$/);
  });

  it("generateUniqueBranchNamesFromTitle produces unique names with 5-digit suffix", () => {
    const count = 10;
    const names = generateUniqueBranchNamesFromTitle("Add feature", count);
    expect(names).toHaveLength(count);
    const set = new Set(names);
    expect(set.size).toBe(count);
    for (const n of names) {
      expect(n.startsWith("cmux/add-feature-")).toBe(true);
      expect(n).toMatch(/-\d{5}$/);
    }
  });
});


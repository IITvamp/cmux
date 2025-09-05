import { describe, it, expect } from "vitest";
import { selectGitIdentity } from "./gitIdentity";

describe("selectGitIdentity", () => {
  it("prefers GitHub derived noreply over real emails", () => {
    const who = { displayName: "Lawrence Chen", primaryEmail: "real@example.com" };
    const gh = {
      login: "lawrencecchen",
      derivedNoreply: "54008264+lawrencecchen@users.noreply.github.com",
      primaryEmail: "other@example.com",
    };
    const id = selectGitIdentity(who, gh);
    expect(id.name).toBe("Lawrence Chen");
    expect(id.email).toBe("54008264+lawrencecchen@users.noreply.github.com");
  });

  it("falls back to Convex primaryEmail when no GitHub noreply", () => {
    const who = { displayName: "Ada Lovelace", primaryEmail: "ada@lovelace.org" };
    const gh = { login: "ada-l", primaryEmail: null };
    const id = selectGitIdentity(who, gh);
    expect(id.name).toBe("Ada Lovelace");
    expect(id.email).toBe("ada@lovelace.org");
  });

  it("falls back to GitHub primaryEmail when no noreply and no Convex primary", () => {
    const who = { displayName: "Linus", primaryEmail: null };
    const gh = { login: "linus", primaryEmail: "linus@example.com" };
    const id = selectGitIdentity(who, gh);
    expect(id.name).toBe("Linus");
    expect(id.email).toBe("linus@example.com");
  });

  it("sanitizes name to form noreply when nothing available", () => {
    const who = { displayName: "  Crazy Name!! ", primaryEmail: null };
    const gh = { login: undefined, primaryEmail: null };
    const id = selectGitIdentity(who, gh);
    expect(id.name).toBe("Crazy Name!!".trim());
    expect(id.email).toBe("crazy-name@users.noreply.github.com");
  });
});


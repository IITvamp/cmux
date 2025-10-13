import { describe, expect, it } from "vitest";
import { inferPreferredSchemes } from "./chromePreview";

describe("inferPreferredSchemes", () => {
  it("prefers http by default", () => {
    expect(inferPreferredSchemes(null)).toEqual(["http", "https"]);
    expect(inferPreferredSchemes("npm run dev")).toEqual(["http", "https"]);
  });

  it("detects https flags", () => {
    expect(inferPreferredSchemes("next dev --https")).toEqual([
      "https",
      "http",
    ]);
    expect(inferPreferredSchemes("vite --host --https")).toEqual([
      "https",
      "http",
    ]);
    expect(inferPreferredSchemes("uvicorn app:app --ssl-keyfile key.pem")).toEqual([
      "https",
      "http",
    ]);
  });
});


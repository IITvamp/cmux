import { findUnescapedQuoteIndex } from "./findUnescapedQuoteIndex";

export type ParsedEnv = { name: string; value: string };

export function parseEnvBlock(text: string): ParsedEnv[] {
  const normalized = text.replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  const results: ParsedEnv[] = [];

  let i = 0;
  while (i < lines.length) {
    const raw = lines[i] ?? "";
    let line = raw.trim();
    i++;

    if (line.length === 0) continue;
    if (line.startsWith("#") || line.startsWith("//")) continue;

    // Strip common prefixes
    line = line.replace(/^export\s+/, "").replace(/^set\s+/, "");

    // Determine key/value split
    let key = "";
    let rest = "";
    const eqIdx = line.indexOf("=");
    const colonIdx = line.indexOf(":");
    if (eqIdx !== -1 && (colonIdx === -1 || eqIdx < colonIdx)) {
      key = line.slice(0, eqIdx).trim();
      rest = line.slice(eqIdx + 1).trim();
    } else if (colonIdx !== -1) {
      key = line.slice(0, colonIdx).trim();
      rest = line.slice(colonIdx + 1).trim();
    } else {
      // Fallback: split on first whitespace
      const m = line.match(/^(\S+)\s+(.*)$/);
      if (m) {
        key = m[1] ?? "";
        rest = (m[2] ?? "").trim();
      } else {
        key = line;
        rest = "";
      }
    }

    if (!key || /\s/.test(key)) continue;

    // Handle quoted (possibly multiline) values
    if (rest.startsWith('"') || rest.startsWith("'") || rest.startsWith("`")) {
      const quote = rest[0] as '"' | "'" | "`";
      let acc = rest.slice(1); // after opening quote
      let closedIdx = findUnescapedQuoteIndex(acc, quote);

      // If not closed on this line, keep appending subsequent lines
      while (closedIdx === -1 && i < lines.length) {
        acc += "\n" + (lines[i] ?? "");
        i++;
        closedIdx = findUnescapedQuoteIndex(acc, quote);
      }

      let value = acc;
      if (closedIdx !== -1) {
        value = acc.slice(0, closedIdx);
      }

      results.push({ name: key, value });
      continue;
    }

    // Unquoted: strip trailing inline comments beginning with # if preceded by space
    const value = rest.replace(/\s+#.*$/, "").trim();
    results.push({ name: key, value });
  }

  return results;
}


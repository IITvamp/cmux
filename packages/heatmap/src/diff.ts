export type DiffLineType = "context" | "addition";

export interface DiffLine {
  readonly lineNumber: number;
  readonly content: string;
  readonly type: DiffLineType;
}

const hunkHeaderRegex = /^@@\s+-(?<oldStart>\d+)(,(?<oldCount>\d+))?\s+\+(?<newStart>\d+)(,(?<newCount>\d+))?\s+@@/;

export function parseUnifiedDiff(diff: string): DiffLine[] {
  const result: DiffLine[] = [];
  const lines = diff.split(/\r?\n/);

  let newLineNumber = 0;
  let inHunk = false;

  for (const rawLine of lines) {
    if (rawLine === "") {
      // Trailing split artifacts do not represent actual lines in the diff
      continue;
    }
    if (rawLine.startsWith("diff --git")) {
      // Start of new file section, reset state
      inHunk = false;
      continue;
    }

    if (rawLine.startsWith("index ")) {
      continue;
    }

    if (rawLine.startsWith("--- ")) {
      continue;
    }

    if (rawLine.startsWith("+++ ")) {
      continue;
    }

    if (rawLine.startsWith("@@")) {
      const match = hunkHeaderRegex.exec(rawLine);
      if (match?.groups?.newStart) {
        newLineNumber = Number.parseInt(match.groups.newStart, 10) - 1;
        inHunk = true;
      } else {
        inHunk = false;
      }
      continue;
    }

    if (!inHunk) {
      continue;
    }

    if (rawLine.startsWith("\\ No newline at end of file")) {
      continue;
    }

    if (rawLine.startsWith("+")) {
      const content = rawLine.slice(1);
      newLineNumber += 1;
      result.push({
        lineNumber: newLineNumber,
        content,
        type: "addition",
      });
      continue;
    }

    if (rawLine.startsWith("-")) {
      // deletions do not affect the post-image line numbers
      continue;
    }

    const content = rawLine.startsWith(" ") ? rawLine.slice(1) : rawLine;
    newLineNumber += 1;
    result.push({
      lineNumber: newLineNumber,
      content,
      type: "context",
    });
  }

  return result;
}

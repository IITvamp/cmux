export function findUnescapedQuoteIndex(
  text: string,
  quote: '"' | "'" | "`"
): number {
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== quote) continue;
    let bs = 0;
    let j = i - 1;
    while (j >= 0 && text[j] === "\\") {
      bs++;
      j--;
    }
    if (bs % 2 === 0) return i;
  }
  return -1;
}


import { describe, expect, it } from "vitest";
import { splitWords } from "src/js/glossia";

describe("splitWords", () => {
  it("keeps every character and lower-cases words", () => {
    const text = "Cow pave our common half.\nThe practice is olympic.";
    const parts = splitWords(text);
    expect(parts.map((p) => p.text).join("")).toBe(text);
    expect(parts.filter((p) => p.word).map((p) => p.word)).toEqual([
      "cow",
      "pave",
      "our",
      "common",
      "half",
      "the",
      "practice",
      "is",
      "olympic",
    ]);
    expect(parts[1]).toEqual({ text: " ", word: null });
  });

  it("handles empty text", () => {
    expect(splitWords("")).toEqual([]);
  });
});

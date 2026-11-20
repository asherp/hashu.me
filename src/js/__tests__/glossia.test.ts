import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it, vi } from "vitest";

// The browser loads the module over fetch; in tests, hand it the bytes.
vi.mock("src/js/glossia/hashu_glossia", async (orig) => {
  const m: any = await orig();
  const bytes = readFileSync(
    resolve(process.cwd(), "src/js/glossia/hashu_glossia_bg.wasm")
  );
  return { ...m, default: async () => m.initSync({ module: bytes }) };
});

import { looksLikeWords, tokenFromWords, tokenToWords } from "src/js/glossia";

// A 4,096 TiH voucher from a local Hashu mint.
const TOKEN =
  "cashuBpGFtdWh0dHA6Ly8xMjcuMC4wLjE6ODA4NWF1Y3RpaGFkaUhhc2h1IFRpSGF0gaJhaUgBwB8RqmW2DmFwgaRhYRkQAGFzeEA1NDc0NDk2ZjZlNDMzNGY3NjViMzU4MDg4OTQ3NTEyMDRjM2I3YTFhYWJjY2E3ZTRmMjFlNmFhZjViMWZhNDNmYWNYIQKa6pO6pQH4AHGZ8jIUFsQlRwJcn3lk8SqR-UoC-inpd2Fko2FlWCB0TvCwx7YWoTbDs3L3ylvLaIS7ljigyzazYiSNpHJr-mFzWCAAU_nwuGSH7C3Ydh8AHAb3v_9CR8hBllm6aYFw4Plbv2FyWCCnp-dkGOMpc_B-Wb3vk3AbsrG0xqCN4mVCicX36j5FfA==";

describe("glossia words", () => {
  it("round-trips a voucher, with text around the paragraph", async () => {
    const words = await tokenToWords(TOKEN);
    expect(words).toBeTruthy();
    expect(looksLikeWords(words!)).toBe(true);
    const back = await tokenFromWords(
      "Here you go:\n\n" + words + "\n\nCheers"
    );
    expect(back?.repaired).toBe(0);
    // DLEQ proofs are dropped, so compare the decoded words again.
    expect(await tokenToWords(back!.token)).toBe(words);
  });

  it("repairs a mistyped word", async () => {
    const words = (await tokenToWords(TOKEN))!;
    const typo = words.replace(/^(\S+ \S+ )(\S+)/, "$1zebra");
    const back = await tokenFromWords(typo);
    expect(back?.repaired).toBe(1);
    expect(await tokenToWords(back!.token)).toBe(words);
  });

  it("leaves tokens, invoices and short text alone", async () => {
    expect(looksLikeWords(TOKEN)).toBe(false);
    expect(looksLikeWords("lnbc1somethinginvoice")).toBe(false);
    expect(looksLikeWords("send me some hashrate please")).toBe(false);
    expect(await tokenFromWords("hello there")).toBeNull();
    expect(await tokenToWords("cashuAeyJ0b2tlbiI6W119")).toBeNull();
  });

  it("does not read random prose as a voucher", async () => {
    const prose = Array(12)
      .fill("The quick brown fox jumps over the lazy dog today.")
      .join(" ");
    expect(looksLikeWords(prose)).toBe(true);
    expect(await tokenFromWords(prose)).toBeNull();
  });
});

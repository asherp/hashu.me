import { describe, it, expect } from "vitest";
import { getEncodedToken } from "@cashu/cashu-ts";
import { splitTokens } from "src/js/message-tokens";

const tok = getEncodedToken({
  mint: "https://mint.example",
  unit: "tih",
  proofs: [
    {
      id: "00ad268c4d1f5826",
      amount: 1024,
      secret: "a".repeat(64),
      C: "02" + "b".repeat(64),
    },
  ],
} as any);

describe("splitTokens", () => {
  it("finds a token on its own line after a note", () => {
    const parts = splitTokens(`1 PiH of hashes from the mint.\n\n${tok}`);
    expect(parts).toHaveLength(2);
    expect(parts[0].text).toContain("1 PiH of hashes");
    expect(parts[1].text).toBe(tok);
    expect(parts[1].token).toEqual({
      amount: 1024,
      unit: "tih",
      mint: "https://mint.example",
    });
    expect(parts[1].label).toBe("1024 tih");
  });
  it("reads a NUT-18 payment payload as the memo and its hashes", () => {
    const payload = JSON.stringify({
      mint: "https://mint.example",
      unit: "tih",
      memo: "Welcome to Hashu!",
      proofs: [
        {
          id: "00ad268c4d1f5826",
          amount: 1024,
          secret: "a".repeat(64),
          C: "02" + "b".repeat(64),
        },
        {
          id: "00ad268c4d1f5826",
          amount: 512,
          secret: "c".repeat(64),
          C: "02" + "d".repeat(64),
        },
      ],
    });
    const parts = splitTokens(payload);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toEqual({ text: "Welcome to Hashu!" });
    expect(parts[1].token).toEqual({
      amount: 1536,
      unit: "tih",
      mint: "https://mint.example",
    });
    expect(parts[1].text.startsWith("cashuB")).toBe(true);
    expect(splitTokens(parts[1].text)[0].token?.amount).toBe(1536);
  });
  it("leaves plain text and broken tokens alone", () => {
    expect(splitTokens("hello")).toEqual([{ text: "hello" }]);
    const broken = "see cashuBnotarealtokenatallxxxxxxxxxx ok";
    expect(splitTokens(broken)).toEqual([{ text: broken }]);
  });
});

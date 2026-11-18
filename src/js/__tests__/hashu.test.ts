import { describe, expect, it } from "vitest";
import { formatBigIntCurrency } from "src/js/format-currency";
import {
  DEFAULT_MINT_URL,
  TIH_PER_PHH,
  TIH_PER_THH,
  formatTih,
  hashuInfoUrl,
  isDisplayUnit,
  tihToDisplay,
  tihToSats,
  UNIT_TIH,
} from "src/js/hashu";

describe("hashu.me defaults", () => {
  it("formats TiH amounts with the TiH label", () => {
    expect(formatTih(4096, "en-US")).toBe("4,096 TiH");
    expect(formatBigIntCurrency(1024n, UNIT_TIH, "en-US")).toBe("1,024 TiH");
  });

  it("suggests Hashu's own mint", () => {
    expect(DEFAULT_MINT_URL).toBe("https://mint.hashu.io");
  });
});

describe("display units", () => {
  it("converts TiH to PiH, EiH and THH", () => {
    expect(tihToDisplay(4096, "PiH")).toBe(4);
    expect(tihToDisplay(2 ** 20, "EiH")).toBe(1);
    // 1 THH = 3.6e15 hashes = 3,274.2 TiH
    expect(TIH_PER_THH).toBeCloseTo(3274.2, 1);
    expect(tihToDisplay(3274, "THH")).toBeCloseTo(1, 3);
    expect(TIH_PER_PHH).toBeCloseTo(3_274_200, -2);
    expect(tihToDisplay(TIH_PER_PHH, "PHH")).toBe(1);
  });

  it("formats each display unit", () => {
    expect(formatTih(4096, "en-US", "PiH")).toBe("4 PiH");
    expect(formatTih(1536, "en-US", "PiH")).toBe("1.5 PiH");
    expect(formatTih(4096, "en-US", "THH")).toBe("1.251 THH");
    expect(formatTih(1024, "en-US", "EiH")).toBe("0.000977 EiH");
    expect(formatTih(0, "en-US", "PiH")).toBe("0 PiH");
    expect(formatTih(3_274_200, "en-US", "PHH")).toBe("1 PHH");
    expect(formatTih(4096n, "en-US", "TiH")).toBe("4,096 TiH");
  });

  it("only accepts known display units", () => {
    expect(isDisplayUnit("PiH")).toBe(true);
    expect(isDisplayUnit("sat")).toBe(false);
    expect(isDisplayUnit(undefined)).toBe(false);
  });
});

describe("price", () => {
  it("values TiH in sats at msat per PiH", () => {
    // 4,096 TiH = 4 PiH at 600 msat/PiH = 2.4 sat
    expect(tihToSats(4096, 600)).toBeCloseTo(2.4, 9);
  });

  it("builds the info URL without doubling slashes", () => {
    expect(hashuInfoUrl("https://mint.hashu.io/")).toBe(
      "https://mint.hashu.io/checkout/api/info"
    );
  });
});

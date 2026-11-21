import { describe, expect, it } from "vitest";
import { formatBigIntCurrency } from "src/js/format-currency";
import {
  DEFAULT_MINT_URL,
  TIH_PER_PHH,
  TIH_PER_THD,
  TIH_PER_PHD,
  satsPerThd,
  formatHashprice,
  unitName,
  displayUnitLabel,
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
    expect(formatTih(4096, "en-US", "THH")).toBe("1.251 THh");
    expect(formatTih(1024, "en-US", "EiH")).toBe("0.000977 EiH");
    expect(formatTih(0, "en-US", "PiH")).toBe("0 PiH");
    expect(formatTih(3_274_200, "en-US", "PHH")).toBe("1 PHh");
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

describe("day units", () => {
  it("converts TiH to THD and PHD", () => {
    // 1 THD = 24 THH = 8.64e16 hashes ≈ 78,580.3 TiH
    expect(TIH_PER_THD).toBeCloseTo(78_580.34, 1);
    expect(TIH_PER_PHD).toBeCloseTo(78_580_342, -1);
    expect(formatTih(TIH_PER_THD, "en-US", "THD")).toBe("1 THd");
    expect(formatTih(4096, "en-US", "THD")).toBe("0.0521 THd");
    expect(formatTih(TIH_PER_PHD * 2, "en-US", "PHD")).toBe("2 PHd");
  });

  it("quotes a mint's price in sats per THD", () => {
    // 600 msat per PiH: 78,580.3 / 1,024 PiH × 0.6 sat ≈ 46 sats
    expect(satsPerThd(600)).toBeCloseTo(46.04, 2);
    expect(satsPerThd(0)).toBe(0);
  });
});

describe("hashprice", () => {
  it("quotes in the display unit when one costs at least a sat", () => {
    expect(formatHashprice(600, "THD", "en-US")).toBe("46 sats/THd");
    expect(formatHashprice(600, "PHD", "en-US")).toBe("46,043 sats/PHd");
    expect(formatHashprice(600, "THH", "en-US")).toBe("1.92 sats/THh");
    expect(formatHashprice(600, "EiH", "en-US")).toBe("614 sats/EiH");
  });

  it("uses msat for units worth under a sat, in the same unit", () => {
    expect(formatHashprice(600, "PiH", "en-US")).toBe("600 msat/PiH");
    expect(formatHashprice(600, "TiH", "en-US")).toBe("0.586 msat/TiH");
  });
});

describe("unitName", () => {
  it("writes TiH with a lower-case i", () => {
    expect(unitName("tih")).toBe("TiH");
    expect(unitName("TIH")).toBe("TiH");
    expect(unitName("msat")).toBe("mSAT");
    expect(unitName("usd")).toBe("USD");
  });
});

describe("displayUnitLabel", () => {
  it("writes hour and day units SI-style", () => {
    expect(displayUnitLabel("THH")).toBe("THh");
    expect(displayUnitLabel("PHD")).toBe("PHd");
    expect(displayUnitLabel("TiH")).toBe("TiH");
  });
});

describe("market-style day units", () => {
  it("formats amounts and hashprice in PH/s/Day", () => {
    expect(formatTih(TIH_PER_PHD, "en-US", "PHSD")).toBe("1 PH/s/Day");
    expect(formatHashprice(600, "PHSD", "en-US")).toBe("46,043 sats/PH/s/Day");
    expect(formatHashprice(600, "THSD", "en-US")).toBe("46 sats/TH/s/Day");
  });
});

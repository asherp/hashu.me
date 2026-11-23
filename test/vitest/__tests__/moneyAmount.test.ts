import { describe, expect, it } from "vitest";
import { formatMsatAmount } from "src/js/money";

describe("formatMsatAmount", () => {
  it("shows msat below a sat for sat and ₿", () => {
    expect(formatMsatAmount(117.2, "sat", "en-US")).toBe("118 msat");
    expect(formatMsatAmount(600, "bip177", "en-US")).toBe("600 msat");
  });
  it("shows sats from one sat up", () => {
    expect(formatMsatAmount(1500, "sat", "en-US")).toBe("1.5 sat");
    expect(formatMsatAmount(614_400, "sat", "en-US")).toBe("614 sat");
    expect(formatMsatAmount(2000, "bip177", "en-US")).toBe("₿2");
  });
  it("keeps msat, BTC and USD units", () => {
    expect(formatMsatAmount(1500, "msat", "en-US")).toBe("1,500 msat");
    expect(formatMsatAmount(100_000, "btc", "en-US")).toBe("0.000001 BTC");
    expect(
      formatMsatAmount(1e5, { unit: "usd", usdPerBtc: 100_000 }, "en-US")
    ).toBe("$0.10");
    expect(formatMsatAmount(600, "usd", "en-US")).toBe("600 msat");
  });
});

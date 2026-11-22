import { describe, expect, it } from "vitest";
import { formatBigIntCurrency } from "src/js/format-currency";

describe("exact integer currency formatting", () => {
  it.each([
    [1000n, "usd", "$10.00"],
    [113n, "eur", "€1.13"],
    [18446744073709551615n, "usd", "$184,467,440,737,095,516.15"],
    [18446744073709551615n, "sat", "18,446,744,073,709,551,615 sat"],
    [18446744073709551615n, "msat", "18,446,744,073,709,551,615 msat"],
    [42n, "unit", "42 unit"],
    [-1n, "usd", "-$0.01"],
    [-113n, "eur", "-€1.13"],
  ] as const)(
    "formats %s %s without losing precision",
    (amount, unit, expected) => {
      expect(formatBigIntCurrency(amount, unit)).toBe(expected);
    }
  );

  it("preserves the locale's separators and currency placement", () => {
    expect(formatBigIntCurrency(18446744073709551615n, "eur", "de-DE")).toBe(
      "184.467.440.737.095.516,15\u00a0€"
    );
  });

  it("follows the monetary unit", () => {
    expect(formatBigIntCurrency(-21n, "sat", "en", "bip177")).toBe("-₿21");
    expect(formatBigIntCurrency(123456789n, "sat", "en", "btc")).toBe(
      "1.23456789 BTC"
    );
    expect(formatBigIntCurrency(100000000n, "sat", "en", "btc")).toBe("1 BTC");
    expect(formatBigIntCurrency(1234n, "sat", "en", "btc")).toBe(
      "0.00001234 BTC"
    );
    expect(formatBigIntCurrency(1234n, "sat", "en", "msat")).toBe(
      "1,234,000 msat"
    );
  });

  it("still accepts the old Bitcoin symbol boolean", () => {
    expect(formatBigIntCurrency(18446744073709551615n, "sat", "en", true)).toBe(
      "₿18,446,744,073,709,551,615"
    );
  });
});

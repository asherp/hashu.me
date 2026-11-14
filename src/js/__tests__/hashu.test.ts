import { describe, expect, it } from "vitest";
import { formatBigIntCurrency } from "src/js/format-currency";
import { DEFAULT_MINT_URL, formatTih, UNIT_TIH } from "src/js/hashu";

describe("hashu.me defaults", () => {
  it("formats TiH amounts with the TiH label", () => {
    expect(formatTih(4096, "en-US")).toBe("4,096 TiH");
    expect(formatBigIntCurrency(1024n, UNIT_TIH, "en-US")).toBe("1,024 TiH");
  });

  it("suggests Hashu's own mint", () => {
    expect(DEFAULT_MINT_URL).toBe("https://mint.hashu.io");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import { useUiStore } from "src/stores/ui";
import { useSettingsStore } from "src/stores/settings";
import { usePriceStore } from "src/stores/price";

afterEach(() => {
  vi.restoreAllMocks();
  useSettingsStore().hashuDisplayUnit = "TiH";
});

describe("hashu display unit", () => {
  it("formats tih amounts in the chosen display unit", () => {
    const ui = useUiStore();
    const settings = useSettingsStore();
    expect(ui.formatCurrency(4096, "tih")).toMatch(/^4.096 TiH$/);
    settings.hashuDisplayUnit = "PiH";
    expect(ui.formatCurrency(4096, "tih")).toBe("4 PiH");
    expect(ui.formatCurrency(4096n, "tih")).toBe("4 PiH");
  });

  it("falls back to TiH for an unknown stored unit", () => {
    const settings = useSettingsStore();
    (settings as any).hashuDisplayUnit = "bogus";
    expect(useUiStore().formatCurrency(1024, "tih")).toMatch(/TiH$/);
  });
});

describe("hashu price", () => {
  it("stores msat per PiH from a Hashu mint", async () => {
    const get = vi
      .spyOn(axios, "get")
      .mockResolvedValue({ data: { msat_per_pih: 600 } } as any);
    const price = usePriceStore();
    await price.fetchHashuPrice("https://mint.example");
    expect(get).toHaveBeenCalledWith(
      "https://mint.example/checkout/api/info",
      expect.anything()
    );
    expect(price.msatPerPihForMint("https://mint.example")).toBe(600);
  });

  it("ignores mints without a Hashu price", async () => {
    vi.spyOn(axios, "get").mockRejectedValue(new Error("404"));
    const price = usePriceStore();
    await price.fetchHashuPrice("https://sat.example");
    expect(price.msatPerPihForMint("https://sat.example")).toBe(0);
  });
});

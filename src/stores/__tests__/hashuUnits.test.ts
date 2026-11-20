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

  it("keeps the mint's hashrate and queue for estimates", async () => {
    vi.spyOn(axios, "get").mockResolvedValue({
      data: {
        msat_per_pih: 600,
        capacity_ends_ms: 1_900_000_000_000,
        delivery: { hashrate_hs: 5e11, queue_tih: 12.5, open_redemptions: 2 },
      },
    } as any);
    const price = usePriceStore();
    await price.fetchHashuInfo("https://eta.example");
    expect(price.hashuDelivery["https://eta.example"]).toMatchObject({
      hashrate_hs: 5e11,
      queue_tih: 12.5,
      open_redemptions: 2,
      capacityEndsMs: 1_900_000_000_000,
    });
  });

  it("ignores mints without a Hashu price", async () => {
    vi.spyOn(axios, "get").mockRejectedValue(new Error("404"));
    const price = usePriceStore();
    await price.fetchHashuPrice("https://sat.example");
    expect(price.msatPerPihForMint("https://sat.example")).toBe(0);
  });
});

describe("retired units", () => {
  const mint = {
    url: "https://mint.example",
    keys: [],
    keysets: [
      { id: "00tih", unit: "tih", active: true, input_fee_ppk: 0 },
      { id: "00thh", unit: "thh", active: false, input_fee_ppk: 0 },
    ],
  } as any;

  it("hides a unit whose keysets are all retired when nothing is held in it", async () => {
    const { MintClass } = await import("src/stores/mints");
    const { useProofsStore } = await import("src/stores/proofs");
    useProofsStore().proofs = [];
    expect(new MintClass(mint).units).toEqual(["tih"]);
  });

  it("keeps a retired unit while the wallet still holds proofs in it", async () => {
    const { MintClass } = await import("src/stores/mints");
    const { useProofsStore } = await import("src/stores/proofs");
    useProofsStore().proofs = [
      { id: "00thh", amount: 2, secret: "s", C: "c", reserved: false },
    ] as any;
    expect(new MintClass(mint).units).toEqual(["tih", "thh"]);
    useProofsStore().proofs = [];
  });

  it("hides an active keyset's unit the mint no longer mints or melts", async () => {
    const { MintClass } = await import("src/stores/mints");
    const { useProofsStore } = await import("src/stores/proofs");
    useProofsStore().proofs = [];
    const live = {
      ...mint,
      keysets: mint.keysets.map((k: any) => ({ ...k, active: true })),
      info: {
        nuts: {
          4: { methods: [{ method: "bolt11", unit: "tih" }] },
          5: { methods: [{ method: "hashrate", unit: "tih" }] },
        },
      },
    };
    expect(new MintClass(live).units).toEqual(["tih"]);
  });
});

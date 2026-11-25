import { describe, expect, it } from "vitest";
import {
  buyableEpochs,
  convertRequest,
  effectiveEpoch,
  epochBalances,
  epochPixels,
  epochStatus,
  lockedKeysetIds,
  type HashuEpochIndex,
} from "src/js/hashu-epochs";

const NOW = 1_800_000_000;

// Shaped like a Hashu mint's GET /v1/hashu/epochs in epoch 470.
const index: HashuEpochIndex = {
  tip_height: 470 * 2016 + 1500,
  epoch: 470,
  blocks_left: 516,
  ends_at: NOW + 516 * 600,
  horizon_hours: 336,
  epochs: [
    {
      epoch: 470,
      start_height: 470 * 2016,
      end_height: 471 * 2016,
      starts_at: NOW - 1500 * 600,
      keyset_id: "k470",
      current: true,
      free_tih: 1000,
    },
    {
      epoch: 471,
      start_height: 471 * 2016,
      end_height: 472 * 2016,
      starts_at: NOW + 516 * 600,
      keyset_id: "k471",
      current: false,
      free_tih: 5000,
    },
    {
      epoch: 472,
      start_height: 472 * 2016,
      end_height: 473 * 2016,
      starts_at: NOW + (516 + 2016) * 600,
      keyset_id: "k472",
      current: false,
      free_tih: 0,
    },
  ],
  keysets: {
    k470: { epoch: 470, perpetual: false, active: true },
    k469: { epoch: 469, perpetual: false, active: false },
    kperp: { epoch: null, perpetual: true, active: false },
  },
};

describe("hashu epochs", () => {
  it("classifies keysets against the current epoch", () => {
    expect(epochStatus(index, "k470", NOW)).toBe("current");
    expect(epochStatus(index, "k471", NOW)).toBe("future");
    expect(epochStatus(index, "k469", NOW)).toBe("expired");
    expect(epochStatus(index, "kperp", NOW)).toBe("perpetual");
    expect(epochStatus(index, "other", NOW)).toBeUndefined();
  });

  it("locks only future-epoch keysets", () => {
    expect(lockedKeysetIds(index, NOW).sort()).toEqual(["k471", "k472"]);
  });

  it("moves on when a later epoch's estimated start has passed", () => {
    const later = NOW + 600 * 600;
    expect(effectiveEpoch(index, later)).toBe(471);
    expect(epochStatus(index, "k471", later)).toBe("current");
    expect(epochStatus(index, "k470", later)).toBe("expired");
    expect(lockedKeysetIds(index, later)).toEqual(["k472"]);
  });

  it("groups balances by epoch in display order", () => {
    const rows = epochBalances(
      index,
      [
        { id: "kperp", amount: 7 },
        { id: "k469", amount: 4 },
        { id: "k471", amount: 2 },
        { id: "k470", amount: 1 },
        { id: "k470", amount: 8 },
      ],
      NOW
    );
    expect(rows.map((r) => [r.status, r.epoch, r.amount])).toEqual([
      ["current", 470, 9],
      ["future", 471, 2],
      ["expired", 469, 4],
      ["perpetual", null, 7],
    ]);
    expect(rows[0].at).toBe(index.ends_at);
    expect(rows[1].at).toBe(index.epochs[1].starts_at);
  });

  it("offers future epochs with room", () => {
    expect(buyableEpochs(index).map((e) => e.epoch)).toEqual([471]);
  });

  it("builds the epoch melt request", () => {
    expect(JSON.parse(convertRequest("auto", 1024, "ab"))).toEqual({
      epoch: "auto",
      amount_tih: 1024,
      nonce: "ab",
    });
  });
});

describe("epochPixels", () => {
  it("is the block's place in its epoch, 11 bits, least significant first", () => {
    expect(epochPixels(975744)).toEqual(Array(11).fill(0)); // epoch 484 start
    expect(epochPixels(975745)).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    // 977578 % 2016 = 1834 = 0b11100101010
    expect(epochPixels(977578)).toEqual([0, 1, 0, 1, 0, 1, 0, 0, 1, 1, 1]);
    expect(epochPixels(975743)).toEqual([1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1]); // 2015
  });
});

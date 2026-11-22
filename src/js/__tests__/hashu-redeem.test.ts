import { describe, expect, it } from "vitest";
import {
  balanceRedeemEta,
  POOL_PRESETS,
  fallbackPoolsFor,
  hashrateRequest,
  isStratumUrl,
  parseHashrateRequest,
  redemptionId,
  redemptionUrl,
  redemptionEntries,
  poolLabel,
} from "src/js/hashu-redeem";

describe("hashrate melt request", () => {
  it("serializes pool, worker, amount and nonce in the mint's field order", () => {
    const r = hashrateRequest(
      " stratum+tcp://mine.ocean.xyz:3334 ",
      " bc1qxyz.hashu ",
      4096,
      "",
      "00ff"
    );
    expect(r).toBe(
      '{"pool_url":"stratum+tcp://mine.ocean.xyz:3334","worker_name":"bc1qxyz.hashu","amount_tih":4096,"nonce":"00ff"}'
    );
    expect(parseHashrateRequest(r)?.worker_name).toBe("bc1qxyz.hashu");
  });

  it("includes a password only when given", () => {
    const r = JSON.parse(
      hashrateRequest("stratum+tcp://h:1", "w", 1024, " x ", "n")
    );
    expect(r.worker_password).toBe("x");
  });

  it("uses a fresh nonce each time", () => {
    const a = hashrateRequest("stratum+tcp://h:1", "w", 1024);
    const b = hashrateRequest("stratum+tcp://h:1", "w", 1024);
    expect(a).not.toBe(b);
  });

  it("rejects non-JSON requests", () => {
    expect(parseHashrateRequest("lnbc1...")).toBeNull();
    expect(parseHashrateRequest(undefined)).toBeNull();
  });
});

describe("backup pools", () => {
  it("adds fallback_pools after the nonce, only when there are some", () => {
    const r = hashrateRequest("stratum+tcp://h:1", "w", 1024, "", "n", [
      { pool_url: "stratum+tcp://b:2", worker_name: "w2" },
    ]);
    expect(r).toBe(
      '{"pool_url":"stratum+tcp://h:1","worker_name":"w","amount_tih":1024,"nonce":"n","fallback_pools":[{"pool_url":"stratum+tcp://b:2","worker_name":"w2"}]}'
    );
    expect(
      hashrateRequest("stratum+tcp://h:1", "w", 1, "", "n", [])
    ).not.toContain("fallback");
  });

  it("sends only complete saved backups, presets resolved, at most max", () => {
    const ocean = POOL_PRESETS.find((p) => p.id === "ocean")!;
    const out = fallbackPoolsFor(
      [
        {
          poolId: "ocean",
          poolUrl: "",
          workerName: " bc1q.b ",
          workerPassword: "",
        },
        {
          poolId: "other",
          poolUrl: "stratum+tcp://half",
          workerName: "w",
          workerPassword: "",
        },
        {
          poolId: "other",
          poolUrl: "stratum+ssl://b:443",
          workerName: "",
          workerPassword: "",
        },
        {
          poolId: "other",
          poolUrl: " stratum+ssl://c:443 ",
          workerName: "w3",
          workerPassword: " pw ",
        },
        {
          poolId: "other",
          poolUrl: "stratum+tcp://d:1",
          workerName: "w4",
          workerPassword: "",
        },
      ],
      2
    );
    expect(out).toEqual([
      { pool_url: ocean.url, worker_name: "bc1q.b" },
      {
        pool_url: "stratum+ssl://c:443",
        worker_name: "w3",
        worker_password: "pw",
      },
    ]);
    expect(fallbackPoolsFor(undefined)).toEqual([]);
  });
});

describe("pool URLs", () => {
  it("accepts stratum URLs only", () => {
    expect(isStratumUrl("stratum+tcp://btc.f2pool.com:1314")).toBe(true);
    expect(isStratumUrl("stratum+ssl://pool.example:443")).toBe(true);
    expect(isStratumUrl("https://pool.example")).toBe(false);
    expect(isStratumUrl("stratum+tcp://pool.example")).toBe(false);
  });

  it("accepts Stratum V2 URLs with an authority key", () => {
    const key = "9auqWEzQDVyd2oe1JVGFLMLHZtCo2FFqZwtKA5gd9xbuEu7PH72";
    expect(isStratumUrl(`stratum2+tcp://v2.stratum.braiins.com/${key}`)).toBe(
      true
    );
    expect(isStratumUrl(`stratum2+tcp://pool.example:3336/${key}`)).toBe(true);
    expect(isStratumUrl("stratum2+tcp://pool.example:3336")).toBe(false);
    expect(isStratumUrl("stratum2+tcp://pool.example:3336/0OIl")).toBe(false);
  });

  it("presets are all valid stratum URLs", () => {
    for (const p of POOL_PRESETS) expect(isStratumUrl(p.url)).toBe(true);
  });
});

describe("redemption id", () => {
  it("is the first 16 bytes of SHA-256(request), hex", async () => {
    // sha256("abc") = ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
    expect(await redemptionId("abc")).toBe("ba7816bf8f01cfea414140de5dae2223");
    expect(redemptionUrl("https://mint.hashu.io/", "ab")).toBe(
      "https://mint.hashu.io/checkout/api/redemption/ab"
    );
  });
});

describe("resolvePoolUrl", () => {
  it("uses the preset's URL, else the custom one", async () => {
    const { resolvePoolUrl, POOL_PRESETS, OTHER_POOL_ID } = await import(
      "src/js/hashu-redeem"
    );
    expect(resolvePoolUrl("ocean", "ignored")).toBe(POOL_PRESETS[0].url);
    expect(
      resolvePoolUrl(OTHER_POOL_ID, " stratum+tcp://pool.example:3333 ")
    ).toBe("stratum+tcp://pool.example:3333");
  });
});

describe("redemption time estimates", () => {
  it("counts the queue ahead at the mint's hashrate", async () => {
    const { estimateRedeemSeconds } = await import("src/js/hashu-redeem");
    const d = { hashrate_hs: 2 ** 40, queue_tih: 100, open_redemptions: 1 };
    expect(estimateRedeemSeconds(1024, d)).toBe(1124);
    expect(estimateRedeemSeconds(1024, { ...d, hashrate_hs: 0 })).toBeNull();
  });

  it("takes a redemption's rate over its last minute", async () => {
    const { trackRate, secondsLeft } = await import("src/js/hashu-redeem");
    const T = 2 ** 40;
    const track = {
      opened_ms: 0,
      points: [
        [0, 0],
        [60_000, 30 * T],
        [120_000, 90 * T],
      ] as [number, number][],
    };
    expect(trackRate(track, 120_000)).toBe(T);
    expect(
      secondsLeft({
        state: "active",
        amount_tih: 1114,
        filled_tih: 90,
        track,
        now_ms: 120_000,
      })
    ).toBe(1024);
    expect(
      secondsLeft({ state: "completed", amount_tih: 1, filled_tih: 1, track })
    ).toBeNull();
  });

  it("formats rates and durations", async () => {
    const { formatHashrate, formatDuration } = await import(
      "src/js/hashu-redeem"
    );
    expect(formatHashrate(1.2e12)).toBe("1.2 TH/s");
    expect(formatHashrate(0)).toBe("0 H/s");
    expect(formatDuration(45)).toBe("45 s");
    expect(formatDuration(720)).toBe("12 min");
    expect(formatDuration(12_000)).toBe("3 h 20 min");
    expect(formatDuration(2 * 86400 + 5 * 3600)).toBe("2 d 5 h");
  });
});

describe("balanceRedeemEta", () => {
  const delivery = {
    hashrate_hs: 1.1e12,
    window_s: 120,
    queue_tih: 0,
    open_redemptions: 0,
  } as any;
  it("estimates the whole balance at the current hashrate", () => {
    const r = balanceRedeemEta(4096, delivery, 1024);
    expect(r.kind).toBe("eta");
    expect((r as any).seconds).toBeCloseTo((4096 * 2 ** 40) / 1.1e12);
  });
  it("says when there is nothing to redeem, too little, or no hashrate", () => {
    expect(balanceRedeemEta(0, delivery, 1024)).toEqual({ kind: "empty" });
    expect(balanceRedeemEta(512, delivery, 1024)).toEqual({
      kind: "below_min",
      minTih: 1024,
    });
    expect(
      balanceRedeemEta(4096, { ...delivery, hashrate_hs: 0 }, 1024)
    ).toEqual({ kind: "no_hashrate" });
  });
});

describe("redemptions list", () => {
  const req = (n: string) =>
    hashrateRequest(
      "stratum+tcp://mine.ocean.xyz:3334",
      "bc1q.rig",
      4096,
      "",
      n
    );
  const history = [
    {
      quote: "ln",
      type: "bolt11",
      amount: -10,
      status: "paid",
      date: "2026-11-20 10:00:00",
      mint: "https://m",
    },
    {
      quote: "old",
      type: "hashrate",
      request: req("01"),
      amount: -3000,
      status: "paid",
      date: "2026-11-20 10:00:00",
      paidDate: "2026-11-20 12:00:00",
      mint: "https://mint.hashu.io",
      meltQuote: { amount: 1024, fee_reserve: 3072 },
    },
    {
      quote: "open",
      type: "hashrate",
      request: req("02"),
      amount: -4096,
      status: "pending",
      date: "2026-11-21 09:00:00",
      mint: "https://mint.hashu.io",
      meltQuote: { amount: 1024, fee_reserve: 3072 },
    },
  ];

  it("keeps only hashrate melts, newest first, with charge and change", () => {
    const e = redemptionEntries(history);
    expect(e.map((x) => x.quote)).toEqual(["open", "old"]);
    expect(e[0]).toMatchObject({
      active: true,
      amountTih: 4096,
      chargedTih: null,
      workerName: "bc1q.rig",
      poolUrl: "stratum+tcp://mine.ocean.xyz:3334",
    });
    expect(e[1]).toMatchObject({
      active: false,
      chargedTih: 3000,
      changeTih: 1096,
    });
  });

  it("labels pools by host and port", () => {
    expect(poolLabel("stratum+tcp://mine.ocean.xyz:3334")).toBe(
      "mine.ocean.xyz:3334"
    );
    expect(poolLabel("stratum2+tcp://pool.example/9abc")).toBe("pool.example");
  });
});

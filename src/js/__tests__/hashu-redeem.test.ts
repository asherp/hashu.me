import { describe, expect, it } from "vitest";
import {
  POOL_PRESETS,
  fallbackPoolsFor,
  hashrateRequest,
  isStratumUrl,
  parseHashrateRequest,
  redemptionId,
  redemptionUrl,
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

import { describe, expect, it } from "vitest";
import {
  POOL_PRESETS,
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

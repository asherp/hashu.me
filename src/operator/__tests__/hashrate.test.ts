import { describe, expect, it } from "vitest";
import { slotRates, type WorkSample } from "src/operator/hashrate";

// 1 s samples; a share of `d` hashes accepted at each time in `shares`.
function series(fromS: number, toS: number, shares: [number, number][]) {
  const out: WorkSample[] = [];
  let w = 0;
  for (let t = fromS; t <= toS; t++) {
    for (const [ts, d] of shares) if (ts === t) w += d;
    out.push({ t_ms: t * 1000, total_hashes: w });
  }
  return out;
}

describe("slotRates", () => {
  const shares: [number, number][] = [];
  for (let t = 7; t < 3000; t += 23) shares.push([t, 15e12]);

  it("never changes points already drawn when new samples arrive", () => {
    const before = slotRates(series(0, 1200, shares), 15_000, 60_000);
    for (const end of [1201, 1207, 1213, 1230, 1300]) {
      const after = slotRates(series(0, end, shares), 15_000, 60_000);
      expect(after.slice(0, before.length)).toEqual(before);
    }
  });

  it("is unchanged when old samples are dropped from the front", () => {
    const all = slotRates(series(0, 2000, shares), 15_000, 60_000, 1000_000);
    const kept = slotRates(series(600, 2000, shares), 15_000, 60_000, 1000_000);
    expect(kept).toEqual(all);
  });

  it("only returns closed wall-clock slots", () => {
    const pts = slotRates(series(3, 100, shares), 15_000, 15_000);
    expect(pts.map(([t]) => t)).toEqual([
      30_000, 45_000, 60_000, 75_000, 90_000,
    ]);
  });

  it("adds up to the shares' work", () => {
    const s = series(0, 900, shares);
    const pts = slotRates(s, 15_000, 15_000);
    const work = pts.reduce((a, [, r]) => a + r * 15, 0);
    expect(work).toBe(s[s.length - 1].total_hashes);
  });
});

import { describe, it, expect } from "vitest";
import {
  tihAtPosition,
  positionOfTih,
} from "src/components/HashuAmountSlider.vue";

describe("HashuAmountSlider mapping", () => {
  const min = 1024;
  const max = 284781;

  it("ends are exact", () => {
    expect(tihAtPosition(0, min, max)).toBe(min);
    expect(tihAtPosition(1000, min, max)).toBe(max);
  });

  it("is monotonic and stays in range, in whole TiH", () => {
    let last = 0;
    for (let p = 0; p <= 1000; p += 7) {
      const t = tihAtPosition(p, min, max, 1024);
      expect(Number.isInteger(t)).toBe(true);
      expect(t).toBeGreaterThanOrEqual(min);
      expect(t).toBeLessThanOrEqual(max);
      expect(t).toBeGreaterThanOrEqual(last);
      last = t;
    }
  });

  it("snaps to three significant figures in the display unit", () => {
    const t = tihAtPosition(500, min, max, 1024);
    const pih = t / 1024;
    // Within half a TiH of a three-figure PiH value (amounts are whole TiH).
    expect(Math.abs(Number(pih.toPrecision(3)) * 1024 - t)).toBeLessThanOrEqual(
      0.5
    );
  });

  it("round-trips position for a typed amount", () => {
    expect(positionOfTih(min, min, max)).toBe(0);
    expect(positionOfTih(max, min, max)).toBe(1000);
    expect(positionOfTih(10 * max, min, max)).toBe(1000);
    const p = positionOfTih(32768, min, max);
    expect(Math.abs(tihAtPosition(p, min, max) - 32768) / 32768).toBeLessThan(
      0.02
    );
  });

  it("sits at the start when the range is empty (balance under the minimum)", () => {
    expect(positionOfTih(500, 1024, 500)).toBe(0);
    expect(positionOfTih(1024, 1024, 1024)).toBe(0);
  });
});

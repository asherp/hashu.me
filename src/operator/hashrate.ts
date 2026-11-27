// Hashrate chart points from the mint's cumulative-work samples.

export type WorkSample = { t_ms: number; total_hashes: number };

/**
 * Rate per closed wall-clock slot, then a trailing moving average.
 *
 * Slots are fixed: [k·slotMs, (k+1)·slotMs). A slot's work is the
 * cumulative work at its end minus at its start, each read from the last
 * sample at or before that edge (shares count when they were accepted).
 * Only slots that have ended by the newest sample are returned, and the
 * average looks back only, so once a point is drawn it never changes:
 * a new share lands in the current (still open) slot, not in old ones.
 * Returns [t, H/s] with t at the slot's end, for slots ending after
 * `fromMs`.
 */
export function slotRates(
  samples: WorkSample[],
  slotMs: number,
  avgMs: number,
  fromMs = -Infinity
): [number, number][] {
  if (samples.length < 2) return [];
  const last = samples[samples.length - 1].t_ms;
  const k0 = Math.ceil(samples[0].t_ms / slotMs);
  const kN = Math.floor(last / slotMs); // edges k0..kN are all known
  if (kN <= k0) return [];
  // Cumulative work at each slot edge (step function, backward looking).
  const edge: number[] = [];
  let i = 0;
  for (let k = k0; k <= kN; k++) {
    const t = k * slotMs;
    while (i + 1 < samples.length && samples[i + 1].t_ms <= t) i++;
    edge.push(samples[i].total_hashes);
  }
  const rate: number[] = [];
  for (let j = 1; j < edge.length; j++) {
    // A drop means the counter was reset: count from zero.
    const dw = edge[j] >= edge[j - 1] ? edge[j] - edge[j - 1] : edge[j];
    rate.push(dw / (slotMs / 1000));
  }
  const n = Math.max(1, Math.round(avgMs / slotMs));
  const out: [number, number][] = [];
  for (let j = 0; j < rate.length; j++) {
    const t = (k0 + j + 1) * slotMs;
    if (t <= fromMs) continue;
    // Summed afresh per point, so dropping old samples can't nudge it.
    const w = rate.slice(Math.max(0, j - n + 1), j + 1);
    out.push([t, w.reduce((a, r) => a + r, 0) / w.length]);
  }
  return out;
}

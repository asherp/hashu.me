/**
 * Epoch-dated vouchers on a Hashu mint (hashu #126).
 *
 * With epochs on, a Hashu mint rotates its TiH keyset at every Bitcoin
 * difficulty epoch (2,016 blocks, about two weeks), so each voucher carries
 * the epoch it was sold for in its keyset id. The mint publishes the map at
 * `GET /v1/hashu/epochs`:
 *
 * - the current epoch's keyset is the active one. It is what the standard
 *   NUT-04 Lightning flow mints, and stock Cashu wallets treat it as normal.
 * - future epochs inside the seller's horizon have keysets listed as
 *   inactive. They are bought through Hashu's own quote API and can't be
 *   swapped, sent or redeemed until their epoch starts.
 * - past epochs' vouchers have expired but stay valid. The `epoch` melt
 *   converts them 1:1 to the current epoch (or the next with room).
 * - keysets from before epochs were turned on are perpetual.
 */

/** NUT-05 melt method that converts vouchers between epochs. */
export const EPOCH_METHOD = "epoch";

/** Blocks in a Bitcoin difficulty epoch. */
export const EPOCH_SIZE = 2016;
/** Pixels in the block-height indicator: 2^11 = 2048 covers 2,016. */
export const EPOCH_PIXELS = 11;

/**
 * The tiny block-height indicator: how far into its epoch a block is, as
 * 11 bits, least significant first (pixel i = bit i).
 */
export function epochPixels(blockHeight: number): number[] {
  const n = ((blockHeight % EPOCH_SIZE) + EPOCH_SIZE) % EPOCH_SIZE;
  return Array.from({ length: EPOCH_PIXELS }, (_, i) => (n >> i) & 1);
}

/** One epoch the mint sells, from `GET /v1/hashu/epochs`. */
export type HashuEpochRow = {
  epoch: number;
  start_height: number;
  end_height: number;
  /** Estimated unix seconds (from block count, so a guess). */
  starts_at: number;
  keyset_id: string | null;
  current: boolean;
  hours_in_window?: number | null;
  capacity_tih?: number | null;
  owed_tih?: number | null;
  free_tih?: number | null;
};

export type HashuEpochIndex = {
  tip_height: number;
  epoch: number;
  blocks_left: number;
  /** Estimated unix seconds when the current epoch ends. */
  ends_at: number;
  horizon_hours?: number;
  epochs: HashuEpochRow[];
  keysets: Record<
    string,
    { epoch: number | null; perpetual: boolean; active: boolean }
  >;
};

/** What a keyset's vouchers are, relative to the mint's current epoch. */
export type EpochStatus = "perpetual" | "current" | "future" | "expired";

export type EpochBalanceRow = {
  status: EpochStatus;
  /** null for perpetual vouchers. */
  epoch: number | null;
  keysetIds: string[];
  amount: number;
  /** Estimated unix seconds: start for future epochs, end for current. */
  at?: number;
};

export function epochsUrl(mintUrl: string): string {
  return `${mintUrl.replace(/\/+$/, "")}/v1/hashu/epochs`;
}

/** Fetch a mint's epoch index; null when the mint has no epochs. */
export async function fetchEpochIndex(
  mintUrl: string,
  fetcher: typeof fetch = fetch
): Promise<HashuEpochIndex | null> {
  let res: Response;
  try {
    res = await fetcher(epochsUrl(mintUrl), {
      headers: { Accept: "application/json" },
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  try {
    const body = await res.json();
    if (typeof body?.epoch !== "number" || !Array.isArray(body?.epochs)) {
      return null;
    }
    return body as HashuEpochIndex;
  } catch {
    return null;
  }
}

/** Epoch of a keyset per the index; undefined if the index doesn't know it. */
export function keysetEpoch(
  index: HashuEpochIndex,
  keysetId: string
): number | null | undefined {
  const k = index.keysets?.[keysetId];
  if (k) return k.perpetual ? null : k.epoch;
  const row = index.epochs.find((e) => e.keyset_id === keysetId);
  return row ? row.epoch : undefined;
}

/** Estimated unix seconds when `epoch` starts (index gives a few). */
export function epochStartsAt(
  index: HashuEpochIndex,
  epoch: number
): number | undefined {
  const row = index.epochs.find((e) => e.epoch === epoch);
  if (row) return row.starts_at;
  if (epoch === index.epoch + 1) return index.ends_at;
  return undefined;
}

/**
 * The mint's current epoch, moved forward if the index is old and the
 * estimated start of a later epoch has passed. The mint is the judge:
 * this only decides what the wallet tries to spend.
 */
export function effectiveEpoch(
  index: HashuEpochIndex,
  nowS: number = Date.now() / 1000
): number {
  let current = index.epoch;
  for (const row of index.epochs) {
    if (row.epoch > current && row.starts_at <= nowS) current = row.epoch;
  }
  if (current === index.epoch && index.ends_at <= nowS) current += 1;
  return current;
}

export function epochStatus(
  index: HashuEpochIndex,
  keysetId: string,
  nowS: number = Date.now() / 1000
): EpochStatus | undefined {
  const epoch = keysetEpoch(index, keysetId);
  if (epoch === undefined) return undefined;
  if (epoch === null) return "perpetual";
  const current = effectiveEpoch(index, nowS);
  if (epoch > current) return "future";
  if (epoch < current) return "expired";
  return "current";
}

/** Keyset ids whose vouchers can't be spent yet (future epochs). */
export function lockedKeysetIds(
  index: HashuEpochIndex,
  nowS: number = Date.now() / 1000
): string[] {
  const ids = new Set<string>([
    ...Object.keys(index.keysets ?? {}),
    ...index.epochs.map((e) => e.keyset_id).filter((k): k is string => !!k),
  ]);
  return [...ids].filter((id) => epochStatus(index, id, nowS) === "future");
}

/**
 * Group proofs by epoch, in display order: current, future (soonest
 * first), expired (newest first), perpetual. Proofs whose keyset the
 * index doesn't know count as perpetual.
 */
export function epochBalances(
  index: HashuEpochIndex,
  proofs: { id: string; amount: number }[],
  nowS: number = Date.now() / 1000
): EpochBalanceRow[] {
  const rows = new Map<string, EpochBalanceRow>();
  const current = effectiveEpoch(index, nowS);
  for (const p of proofs) {
    const status = epochStatus(index, p.id, nowS) ?? "perpetual";
    const epoch = status === "perpetual" ? null : keysetEpoch(index, p.id)!;
    const key = `${status}:${epoch}`;
    let row = rows.get(key);
    if (!row) {
      row = { status, epoch, keysetIds: [], amount: 0 };
      if (status === "future" && epoch !== null) {
        row.at = epochStartsAt(index, epoch);
      } else if (status === "current") {
        row.at =
          current === index.epoch
            ? index.ends_at
            : epochStartsAt(index, current + 1);
      }
      rows.set(key, row);
    }
    if (!row.keysetIds.includes(p.id)) row.keysetIds.push(p.id);
    row.amount += p.amount;
  }
  const order: Record<EpochStatus, number> = {
    current: 0,
    future: 1,
    expired: 2,
    perpetual: 3,
  };
  return [...rows.values()].sort((a, b) => {
    if (a.status !== b.status) return order[a.status] - order[b.status];
    if (a.status === "future") return (a.epoch ?? 0) - (b.epoch ?? 0);
    return (b.epoch ?? 0) - (a.epoch ?? 0);
  });
}

/** Future epochs the mint will sell now, with room left. */
export function buyableEpochs(index: HashuEpochIndex): HashuEpochRow[] {
  return index.epochs.filter(
    (e) => !e.current && !!e.keyset_id && (e.free_tih ?? 0) > 0
  );
}

/** Request string of an `epoch` melt. */
export function convertRequest(
  epoch: "auto" | number,
  amountTih: number,
  nonce: string
): string {
  return JSON.stringify({ epoch, amount_tih: amountTih, nonce });
}

/** Short date for an estimated epoch boundary, e.g. "Dec 3". */
export function formatEpochDate(
  unixS: number | undefined,
  locale?: string
): string {
  if (!unixS) return "";
  return new Date(unixS * 1000).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  });
}

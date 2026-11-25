import {
  HASHES_PER_TIH,
  isDisplayUnit,
  type DisplayUnit,
  type MintDelivery,
} from "src/js/hashu";

/**
 * Redeeming TiH vouchers as hashrate on a Hashu mint.
 *
 * A Hashu mint offers the NUT-05 melt method `hashrate` for its `tih`
 * unit. The melt quote's `request` is a JSON string naming the pool and
 * worker that should receive the hashrate. The quote's `amount` is the
 * floor the redeemer pays however little is delivered; its `fee_reserve`
 * is the rest, refunded as NUT-08 change for whatever goes undelivered.
 * So the wallet's normal melt flow (blank outputs for the fee reserve,
 * change on settle) handles redemption with change back.
 *
 * The melt stays PENDING while shares go to the pool, typically minutes
 * to hours, then turns PAID when the redemption completes or is stopped.
 */

/** NUT-05 method name for hashrate redemption. */
export const HASHRATE_METHOD = "hashrate";

/** Pools the Hashu checkout offers, with a worker name hint for each. */
export type PoolPreset = {
  id: string;
  name: string;
  url: string;
  worker: string;
  hint: string;
};

/**
 * Mirrors the checkout page's pool list (hashu-cli/src/checkout.html,
 * guides at /redeem/<id>.html on the mint).
 */
export const POOL_PRESETS: PoolPreset[] = [
  {
    id: "ocean",
    name: "OCEAN",
    url: "stratum+tcp://mine.ocean.xyz:3334",
    worker: "bc1q….hashu",
    hint: "Your BTC address, plus an optional .label. No account needed.",
  },
  {
    id: "braiins",
    name: "Braiins Pool",
    url: "stratum+tcp://stratum.braiins.com:3333",
    worker: "username.hashu",
    hint: "Your Braiins account username, then .hashu (any label).",
  },
  {
    id: "viabtc",
    name: "ViaBTC",
    url: "stratum+tcp://btc.viabtc.io:3333",
    worker: "subaccount.hashu",
    hint: "Your ViaBTC sub-account, then .hashu. Check the spelling: ViaBTC accepts unknown names.",
  },
  {
    id: "f2pool",
    name: "F2Pool",
    url: "stratum+tcp://btc.f2pool.com:1314",
    worker: "account.hashu",
    hint: "Your F2Pool account name, then .hashu. Check the spelling: F2Pool accepts unknown names.",
  },
  {
    id: "foundry",
    name: "Foundry USA",
    url: "stratum+tcp://btc.foundryusapool.com:3333",
    worker: "account.hashu",
    hint: "Your Foundry account, then .hashu. Take the exact URL from your Foundry portal.",
  },
  {
    id: "ckpool-solo",
    name: "solo.ckpool.org (solo, lottery)",
    url: "stratum+tcp://solo.ckpool.org:3333",
    worker: "bc1q….hashu",
    hint: "Your BTC address, plus an optional .label. Pays only if a block is found.",
  },
  {
    id: "public-pool",
    name: "public-pool.io (solo, lottery)",
    url: "stratum+tcp://public-pool.io:21496",
    worker: "bc1q….hashu",
    hint: "Your BTC address, plus an optional .label. Pays only if a block is found.",
  },
];

/** A backup pool in a melt request (`fallback_pools`). */
export type FallbackPoolRequest = {
  pool_url: string;
  worker_name: string;
  worker_password?: string;
};

export type HashrateRequest = {
  pool_url: string;
  worker_name: string;
  worker_password?: string;
  amount_tih: number;
  nonce?: string;
  fallback_pools?: FallbackPoolRequest[];
  stop_hash?: string;
};

/** Most backup pools a Hashu mint takes after the main one. */
export const MAX_FALLBACK_POOLS = 3;

/** A backup pool as saved in settings (same shape as the main pool). */
export type SavedPool = {
  poolId: string;
  poolUrl: string;
  workerName: string;
  workerPassword: string;
};

/** A blank backup pool entry for settings. */
export function emptySavedPool(): SavedPool {
  return {
    poolId: OTHER_POOL_ID,
    poolUrl: "",
    workerName: "",
    workerPassword: "",
  };
}

/**
 * The saved backup pools that are filled in well enough to send: a
 * stratum URL the proxy can dial and a worker name. Half-filled entries
 * are skipped rather than failing the redemption. At most `max`.
 */
export function fallbackPoolsFor(
  saved: SavedPool[] | undefined,
  max: number = MAX_FALLBACK_POOLS,
): FallbackPoolRequest[] {
  const out: FallbackPoolRequest[] = [];
  for (const p of saved ?? []) {
    const url = resolvePoolUrl(p.poolId, p.poolUrl ?? "");
    const worker = (p.workerName ?? "").trim();
    if (!isStratumUrl(url) || !worker) continue;
    const f: FallbackPoolRequest = {
      pool_url: url.trim(),
      worker_name: worker,
    };
    const pw = p.workerPassword?.trim();
    if (pw) f.worker_password = pw;
    out.push(f);
    if (out.length >= max) break;
  }
  return out;
}

/** Pool choice id for a pool that isn't in POOL_PRESETS. */
export const OTHER_POOL_ID = "other";

export function poolPreset(poolId: string): PoolPreset | undefined {
  return POOL_PRESETS.find((p) => p.id === poolId);
}

/** The stratum URL for a saved pool choice: the preset's, else the custom one. */
export function resolvePoolUrl(poolId: string, customUrl: string): string {
  return poolPreset(poolId)?.url ?? customUrl.trim();
}

/**
 * A stratum URL the mint's proxy can dial: Stratum V1 over TCP or TLS
 * with a port, or Stratum V2 with the pool's authority key as the path
 * (`stratum2+tcp://host[:port]/<key>`, port optional as Braiins publishes
 * it). The mint checks the key's checksum.
 */
export function isStratumUrl(url: string): boolean {
  const u = url.trim();
  return (
    /^stratum\+(tcp|ssl):\/\/[^\s/:]+:\d{1,5}\/?$/.test(u) ||
    /^stratum2\+tcp:\/\/[^\s/:]+(:\d{1,5})?\/[1-9A-HJ-NP-Za-km-z]{40,60}\/?$/.test(
      u,
    )
  );
}

/**
 * The melt request string. Field order and a fresh nonce matter: the mint
 * derives the redemption id from this exact string, and refuses a second
 * melt of an identical one.
 */
export function hashrateRequest(
  poolUrl: string,
  workerName: string,
  amountTih: number,
  workerPassword?: string,
  nonce: string = randomNonce(),
  fallbackPools: FallbackPoolRequest[] = [],
  stopHash?: string,
): string {
  const req: HashrateRequest = {
    pool_url: poolUrl.trim(),
    worker_name: workerName.trim(),
    amount_tih: amountTih,
  };
  const pw = workerPassword?.trim();
  if (pw) req.worker_password = pw;
  req.nonce = nonce;
  // Only when there are some: older mints refuse unknown fields.
  if (fallbackPools.length) req.fallback_pools = fallbackPools;
  if (stopHash) req.stop_hash = stopHash;
  return JSON.stringify(req);
}

export function parseHashrateRequest(
  request: string | undefined,
): HashrateRequest | null {
  if (!request) return null;
  try {
    const r = JSON.parse(request);
    return typeof r?.pool_url === "string" && typeof r?.worker_name === "string"
      ? (r as HashrateRequest)
      : null;
  } catch {
    return null;
  }
}

/** A fresh request nonce: 16 hex characters. */
export function randomNonce(): string {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

/**
 * Redemption id the mint uses for a melt request: hex of the first 16
 * bytes of SHA-256(request). Holds for a mint's own redemptions; supplier
 * mints (name.mint.example) hash their name in too, so their progress
 * isn't readable this way.
 */
export async function redemptionId(request: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(request),
  );
  return Array.from(new Uint8Array(digest).slice(0, 16), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
}

function toHex(b: ArrayBuffer | Uint8Array): string {
  return Array.from(new Uint8Array(b), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
}

/**
 * The secret that stops, pauses and resumes one redemption: HMAC-SHA256
 * of the request's nonce under the wallet seed. Nothing extra is stored:
 * the wallet derives it again from its seed and the request in its
 * history. The mint only ever sees its SHA-256 ([`stopHashFor`]) in the
 * request, and the secret itself when the redeemer uses it.
 */
export async function stopSecretFor(
  seed: Uint8Array,
  nonce: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    seed,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`hashu-stop:${nonce}`),
  );
  return toHex(mac);
}

/** The request's `stop_hash` for a stop secret: hex SHA-256 of its bytes. */
export async function stopHashFor(secretHex: string): Promise<string> {
  const bytes = new Uint8Array(
    (secretHex.match(/../g) ?? []).map((h) => parseInt(h, 16)),
  );
  return toHex(await crypto.subtle.digest("SHA-256", bytes));
}

/** What the redeemer can do to an open redemption. */
export type RedeemerAction = "stop" | "pause" | "resume" | "pool";

/** `POST` target for a redeemer action, next to the progress URL. */
export function redemptionActionUrl(
  progressUrl: string,
  action: RedeemerAction,
): string {
  return `${progressUrl.replace(/\/+$/, "")}/${action}`;
}

/** A redemption's delivered work over time, as the mint's meter saw it. */
export type RedemptionTrack = {
  opened_ms: number;
  completed_ms?: number | null;
  /** `[Unix ms, accumulated hashes]`, oldest first. */
  points: [number, number][];
};

/** Progress as `GET /checkout/api/redemption/{id}` reports it. */
export type RedemptionProgress = {
  state: string;
  amount_tih: number;
  filled_tih: number;
  floor_tih?: number;
  spent_tih?: number;
  change_tih?: number;
  /** Where its hashes go now (changes if the redeemer changes pools). */
  pool_url?: string;
  worker_name?: string;
  /** Backup pools the redemption listed (no passwords). */
  fallback_pools?: { pool_url: string; worker_name: string }[];
  /** Which pool is getting the hashrate: 0 = the main pool, then the
   * backups in order; null while no rig is on it. */
  serving_pool?: number | null;
  serving_pool_url?: string | null;
  /** True when the wallet that opened it holds a stop key. */
  can_stop?: boolean;
  /** Delivery is paused. */
  paused?: boolean;
  /** Who paused it: the wallet ("redeemer") or the mint ("operator"). */
  paused_by?: "redeemer" | "operator" | null;
  /** Set while a stop would be refused (below the floor, or it would
   * return nothing); null when a stop would go through. */
  stop_refusal?: string | null;
  /** What a stop right now would charge and return. */
  stop_charge_tih?: number | null;
  stop_change_tih?: number | null;
  track?: RedemptionTrack | null;
  now_ms?: number;
};

/** Seconds a new redemption of `amountTih` should take at the mint's
 * current hashrate, counting what earlier redemptions are still owed.
 * Null when the mint has no hashrate right now. */
export function estimateRedeemSeconds(
  amountTih: number,
  delivery: MintDelivery,
): number | null {
  const hs = Number(delivery.hashrate_hs) || 0;
  if (!(hs > 0)) return null;
  const queue = Math.max(0, Number(delivery.queue_tih) || 0);
  return ((queue + amountTih) * HASHES_PER_TIH) / hs;
}

/** Hashes per second a redemption is getting, over its last minute (the
 * checkout page's rule). 0 before there are two points to compare. */
export function trackRate(track: RedemptionTrack, endMs: number): number {
  const pts = track.points;
  if (!pts.length) return 0;
  let base = pts[0];
  for (const p of pts) if (p[0] <= endMs - 60_000) base = p;
  const last = pts[pts.length - 1];
  return endMs > base[0] ? ((last[1] - base[1]) * 1000) / (endMs - base[0]) : 0;
}

/** Seconds left on an open redemption at its recent rate; null if unknown. */
export function secondsLeft(p: RedemptionProgress): number | null {
  if (!p.track || p.state === "completed" || p.state === "settled") return null;
  const rate = trackRate(p.track, p.now_ms ?? Date.now());
  const remaining = (p.amount_tih - p.filled_tih) * HASHES_PER_TIH;
  return rate > 0 && remaining > 0 ? remaining / rate : null;
}

/** A hashrate unit: its label and hashes per second in one of it. */
export type HashrateUnit = { label: string; hs: number };

const TH_S: HashrateUnit = { label: "TH/s", hs: 1e12 };
const PH_S: HashrateUnit = { label: "PH/s", hs: 1e15 };

/**
 * The hashrate unit that goes with a display unit, so a rate reads in the
 * same scale as the amounts it delivers: THh/THd/TH/s/Day -> TH/s,
 * PHh/PHd/PH/s/Day -> PH/s, and the binary units per second (TiH -> TiH/s,
 * 2^40 H/s), so TiH/s times seconds is the TiH redeemed.
 */
export function hashrateUnitFor(unit: DisplayUnit): HashrateUnit {
  switch (unit) {
    case "TiH":
      return { label: "TiH/s", hs: 2 ** 40 };
    case "PiH":
      return { label: "PiH/s", hs: 2 ** 50 };
    case "EiH":
      return { label: "EiH/s", hs: 2 ** 60 };
    case "PHH":
    case "PHD":
    case "PHSD":
      return PH_S;
    default:
      return TH_S;
  }
}

/**
 * Format a hashrate. With a display unit it is shown in that unit's scale
 * (see hashrateUnitFor), e.g. "0.007 PH/s" or "6.4 TiH/s"; without one it
 * picks the SI prefix that fits, e.g. "1.2 TH/s".
 */
export function formatHashrate(
  hs: number,
  unit?: DisplayUnit | string,
  locale?: string,
): string {
  if (isDisplayUnit(unit)) {
    const u = hashrateUnitFor(unit);
    const v = hs > 0 ? hs / u.hs : 0;
    const options: Intl.NumberFormatOptions =
      v >= 100 || v === 0
        ? { maximumFractionDigits: 0 }
        : v >= 1
          ? { maximumFractionDigits: 1 }
          : { maximumSignificantDigits: 2 };
    return `${new Intl.NumberFormat(locale, options).format(v)} ${u.label}`;
  }
  if (!(hs > 0)) return "0 H/s";
  const units = ["H/s", "kH/s", "MH/s", "GH/s", "TH/s", "PH/s", "EH/s"];
  let i = 0;
  while (hs >= 1000 && i < units.length - 1) {
    hs /= 1000;
    i++;
  }
  return `${hs.toFixed(hs >= 100 ? 0 : 1)} ${units[i]}`;
}

/** A rough duration: "45 s", "12 min", "3 h 20 min", "2 d 5 h". */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const s = Math.round(seconds);
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 86400) {
    const h = Math.floor(s / 3600);
    const m = Math.round((s % 3600) / 60);
    return m ? `${h} h ${m} min` : `${h} h`;
  }
  const d = Math.floor(s / 86400);
  const h = Math.round((s % 86400) / 3600);
  return h ? `${d} d ${h} h` : `${d} d`;
}

export function redemptionUrl(mintUrl: string, id: string): string {
  return `${mintUrl.replace(/\/+$/, "")}/checkout/api/redemption/${id}`;
}

export type BalanceEta =
  | { kind: "eta"; seconds: number }
  | { kind: "empty" }
  | { kind: "below_min"; minTih: number }
  | { kind: "no_hashrate" };

/** How long redeeming a whole balance at a mint would take right now. */
export function balanceRedeemEta(
  balanceTih: number,
  delivery: MintDelivery,
  minRedeemTih?: number,
): BalanceEta {
  if (!(balanceTih > 0)) return { kind: "empty" };
  if (minRedeemTih && balanceTih < minRedeemTih) {
    return { kind: "below_min", minTih: minRedeemTih };
  }
  const seconds = estimateRedeemSeconds(balanceTih, delivery);
  return seconds === null ? { kind: "no_hashrate" } : { kind: "eta", seconds };
}

/** A redemption as the wallet's history records it. */
export type RedemptionEntry = {
  quote: string;
  mint: string;
  request: string;
  poolUrl: string;
  workerName: string;
  /** TiH committed to the redemption (floor plus refundable part); shown as "Committed", a record of what went in, not a hold on the change. */
  amountTih: number;
  /** What delivery cost, once finished (the locked amount less change). */
  chargedTih: number | null;
  changeTih: number | null;
  active: boolean;
  date: string;
  paidDate?: string;
};

type HistoryLike = {
  quote?: string;
  mint?: string;
  unit?: string;
  request?: string;
  amount?: number;
  status?: string;
  date?: string;
  paidDate?: string;
  type?: string;
  method?: string;
  meltQuote?: { amount?: number; fee_reserve?: number; request?: string };
};

/** "Nov 21, 14:02" this year, "Nov 21 2025" before; the input as is if
 * it isn't a "YYYY-MM-DD HH:mm:ss" date. */
export function shortDate(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(d ?? "");
  if (!m) return d ?? "";
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const mon = months[Number(m[2]) - 1];
  const day = Number(m[3]);
  return Number(m[1]) === new Date().getFullYear()
    ? `${mon} ${day}, ${m[4]}:${m[5]}`
    : `${mon} ${day} ${m[1]}`;
}

/** Pool host alone (no scheme, port or V2 key), for sentences. */
export function poolHost(poolUrl: string): string {
  return poolLabel(poolUrl).replace(/:\d+$/, "");
}

/** Pool host and port, without the stratum scheme or a V2 key. */
export function poolLabel(poolUrl: string): string {
  const m = /^[a-z0-9+]+:\/\/([^/]+)/i.exec(poolUrl.trim());
  return m ? m[1] : poolUrl;
}

/**
 * The wallet's redemptions (hashrate melts) out of its payment history,
 * newest first. Active ones are melts still PENDING at the mint.
 */
export function redemptionEntries(history: HistoryLike[]): RedemptionEntry[] {
  const out: RedemptionEntry[] = [];
  for (const h of history ?? []) {
    if ((h.method ?? h.type) !== HASHRATE_METHOD || !h.quote) continue;
    const request = h.request || h.meltQuote?.request || "";
    const req = parseHashrateRequest(request);
    const mq = h.meltQuote;
    const locked =
      mq && mq.amount != null
        ? Number(mq.amount) + Number(mq.fee_reserve ?? 0)
        : (req?.amount_tih ?? Math.abs(Number(h.amount) || 0));
    const active = h.status !== "paid";
    const charged = active ? null : Math.abs(Number(h.amount) || 0);
    out.push({
      quote: h.quote,
      mint: h.mint ?? "",
      request,
      poolUrl: req?.pool_url ?? "",
      workerName: req?.worker_name ?? "",
      amountTih: locked,
      chargedTih: charged,
      changeTih: charged == null ? null : Math.max(0, locked - charged),
      active,
      date: h.date ?? "",
      paidDate: h.paidDate,
    });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

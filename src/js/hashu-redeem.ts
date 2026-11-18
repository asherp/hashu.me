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
 * guides at /redeem/<id>/ on the mint).
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

export type HashrateRequest = {
  pool_url: string;
  worker_name: string;
  worker_password?: string;
  amount_tih: number;
  nonce?: string;
};

/** Pool choice id for a pool that isn't in POOL_PRESETS. */
export const OTHER_POOL_ID = "other";

export function poolPreset(poolId: string): PoolPreset | undefined {
  return POOL_PRESETS.find((p) => p.id === poolId);
}

/** The stratum URL for a saved pool choice: the preset's, else the custom one. */
export function resolvePoolUrl(poolId: string, customUrl: string): string {
  return poolPreset(poolId)?.url ?? customUrl.trim();
}

/** A stratum URL the mint's proxy can dial. */
export function isStratumUrl(url: string): boolean {
  return /^stratum\+(tcp|ssl):\/\/[^\s/:]+:\d{1,5}\/?$/.test(url.trim());
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
  nonce: string = randomNonce()
): string {
  const req: HashrateRequest = {
    pool_url: poolUrl.trim(),
    worker_name: workerName.trim(),
    amount_tih: amountTih,
  };
  const pw = workerPassword?.trim();
  if (pw) req.worker_password = pw;
  req.nonce = nonce;
  return JSON.stringify(req);
}

export function parseHashrateRequest(
  request: string | undefined
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

function randomNonce(): string {
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
    new TextEncoder().encode(request)
  );
  return Array.from(new Uint8Array(digest).slice(0, 16), (x) =>
    x.toString(16).padStart(2, "0")
  ).join("");
}

/** Progress as `GET /checkout/api/redemption/{id}` reports it. */
export type RedemptionProgress = {
  state: string;
  amount_tih: number;
  filled_tih: number;
  floor_tih?: number;
  spent_tih?: number;
  change_tih?: number;
};

export function redemptionUrl(mintUrl: string, id: string): string {
  return `${mintUrl.replace(/\/+$/, "")}/checkout/api/redemption/${id}`;
}

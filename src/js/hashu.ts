import {
  DEFAULT_MONEY_UNIT,
  formatPricePer,
  toMoney,
  type Money,
  type MoneyUnit,
} from "src/js/money";
/**
 * Hashu defaults for the hashu.me fork of Cashu.me.
 *
 * Hashu mints issue Chaumian hashrate vouchers in the `tih` unit:
 * 1 TiH (tebihash) = 2^40 hashes. Amounts stay integer TiH in proofs,
 * tokens and amount inputs; the wallet can *display* them in a larger
 * unit, the way Cashu wallets show sats as BTC.
 */

/** Hashu's own mint, suggested on first start. */
export const DEFAULT_MINT_URL = "https://mint.hashu.io";

/**
 * Cashu.me's multi-mint swaps (Settings > Mints "Swap", and the Receive
 * dialog's "Swap to a trusted mint") melt vouchers to Lightning at one mint
 * and pay a mint quote at another. Hashu mints never melt to Lightning and
 * vouchers are not fungible across suppliers, so these swaps cannot work:
 * every entry point is hidden while this is false. Flip it to restore them.
 */
export const MULTI_MINT_SWAPS_ENABLED = false;

/** Voucher unit as it appears in mint keysets and tokens. */
export const UNIT_TIH = "tih";

/** Label shown next to TiH amounts. */
export const UNIT_TIH_LABEL = "TiH";

/**
 * How to write a mint unit for people: "TiH" for tih (Cashu.me upper-cases
 * units, which would give "TIH"), "mSAT" for msat, else upper case.
 */
export function unitName(unit: string): string {
  const u = (unit || "").toLowerCase();
  if (u === UNIT_TIH) return UNIT_TIH_LABEL;
  if (u === "msat") return "mSAT";
  return unit.toUpperCase();
}

/** Hashes in one TiH (2^40). */
export const HASHES_PER_TIH = 2 ** 40;

/** TiH in one PiH (2^10). Hashu mints price vouchers in msat per PiH. */
export const TIH_PER_PIH = 1024;

/** TiH in one terahash-hour (1 TH/s for 3,600 s = 3.6e15 hashes), ≈ 3,274. */
export const TIH_PER_THH = 3.6e15 / HASHES_PER_TIH;

/** TiH in one petahash-hour (1,000 THh), ≈ 3.27 million. */
export const TIH_PER_PHH = 1000 * TIH_PER_THH;

/** TiH in one terahash-day (1 TH/s for 24 h = 24 THh), ≈ 78,580. */
export const TIH_PER_THD = 24 * TIH_PER_THH;

/** TiH in one petahash-day (1,000 THd), ≈ 78.6 million. */
export const TIH_PER_PHD = 1000 * TIH_PER_THD;

/** Units the wallet can show TiH amounts in, as TiH per display unit. */
export const DISPLAY_UNITS = {
  TiH: 1,
  PiH: TIH_PER_PIH,
  EiH: TIH_PER_PIH * TIH_PER_PIH,
  THH: TIH_PER_THH,
  PHH: TIH_PER_PHH,
  THD: TIH_PER_THD,
  PHD: TIH_PER_PHD,
  // The same day units, written the way hashrate markets quote hashprice
  // (Luxor's Hashrate Index: $/PH/s/Day).
  THSD: TIH_PER_THD,
  PHSD: TIH_PER_PHD,
} as const;

export type DisplayUnit = keyof typeof DISPLAY_UNITS;

/**
 * How each display unit is written. Ids stay as stored in settings; time
 * units read SI-style, with H for hash and lower-case h/d for hour/day.
 */
export const DISPLAY_UNIT_LABELS: Record<DisplayUnit, string> = {
  TiH: "TiH",
  PiH: "PiH",
  EiH: "EiH",
  THH: "THh",
  PHH: "PHh",
  THD: "THd",
  PHD: "PHd",
  THSD: "TH/s/Day",
  PHSD: "PH/s/Day",
};

/** The written form of a display unit, e.g. "THd" for THD. */
export function displayUnitLabel(unit: DisplayUnit): string {
  return DISPLAY_UNIT_LABELS[unit] ?? unit;
}

export const DEFAULT_DISPLAY_UNIT: DisplayUnit = "TiH";

/**
 * Display units that differ only in scale, smallest first. Auto scale moves
 * within the chosen unit's family, so a THd user sees THd or PHd and a TiH
 * user sees TiH, PiH or EiH.
 */
const DISPLAY_UNIT_FAMILIES: DisplayUnit[][] = [
  ["TiH", "PiH", "EiH"],
  ["THH", "PHH"],
  ["THD", "PHD"],
  ["THSD", "PHSD"],
];

/**
 * The unit in `unit`'s family that suits an amount of `tih`: the largest
 * one the amount holds at least one of, else the smallest. Zero keeps
 * `unit` as chosen.
 */
export function autoScaleDisplayUnit(
  unit: DisplayUnit,
  tih: number | bigint
): DisplayUnit {
  const amount = Math.abs(Number(tih));
  if (!amount) return unit;
  const family = DISPLAY_UNIT_FAMILIES.find((f) => f.includes(unit)) ?? [unit];
  let best = family[0];
  for (const candidate of family) {
    if (amount >= DISPLAY_UNITS[candidate]) best = candidate;
  }
  return best;
}

export function isDisplayUnit(unit: unknown): unit is DisplayUnit {
  return typeof unit === "string" && unit in DISPLAY_UNITS;
}

/** Convert an integer TiH amount to the display unit. */
export function tihToDisplay(
  tih: number | bigint,
  unit: DisplayUnit = DEFAULT_DISPLAY_UNIT
): number {
  return Number(tih) / DISPLAY_UNITS[unit];
}

/**
 * Format a TiH amount in the chosen display unit, e.g. "4,096 TiH",
 * "4 PiH" or "1.251 THh". TiH stays exact; larger units show up to three
 * decimals, or three significant digits below 1.
 */
export function formatTih(
  value: number | bigint,
  locale?: string,
  unit: DisplayUnit = DEFAULT_DISPLAY_UNIT
): string {
  if (unit === "TiH") {
    return `${new Intl.NumberFormat(locale).format(value)} ${UNIT_TIH_LABEL}`;
  }
  const shown = tihToDisplay(value, unit);
  const options: Intl.NumberFormatOptions =
    Math.abs(shown) >= 1 || shown === 0
      ? { maximumFractionDigits: 3 }
      : { maximumSignificantDigits: 3 };
  return `${new Intl.NumberFormat(locale, options).format(
    shown
  )} ${displayUnitLabel(unit)}`;
}

/** Value of a TiH amount in sats at a mint's msat-per-PiH price. */
export function tihToSats(tih: number | bigint, msatPerPih: number): number {
  return (Number(tih) / TIH_PER_PIH) * (msatPerPih / 1000);
}

/**
 * Sats a Hashu mint bills for a Lightning purchase of `tih` at its
 * msat-per-PiH price: rounded up to a whole sat, never zero. Same formula
 * as the mint (hashu-mint pricing.rs), so it matches the invoice while the
 * price holds.
 */
export function invoiceSats(tih: number | bigint, msatPerPih: number): number {
  const msat = (Number(tih) * msatPerPih) / TIH_PER_PIH;
  return Math.max(1, Math.ceil(msat / 1000));
}

/**
 * A mint's msat-per-PiH price as sats per terahash-day, the way miners
 * and hashrate markets usually quote it.
 */
export function satsPerThd(msatPerPih: number): number {
  return tihToSats(TIH_PER_THD, msatPerPih);
}

/**
 * A mint's hashprice per one of the wallet's display unit, so the price
 * reads as money unit / hash unit, in the same hash unit as amounts:
 * "46 sats/THd", "46,043 sats/PHd", "₿46/THd", "0.00000046 BTC/THd".
 * Below a sat per unit (TiH, PiH) sat and ₿ prices show msat: "600 msat/PiH".
 */
export function formatHashprice(
  msatPerPih: number,
  unit: DisplayUnit = DEFAULT_DISPLAY_UNIT,
  locale?: string,
  money: MoneyUnit | Money = DEFAULT_MONEY_UNIT
): string {
  const msat = tihToSats(DISPLAY_UNITS[unit], msatPerPih) * 1000;
  const { usdtPerPih } = toMoney(money);
  const usd =
    usdtPerPih && usdtPerPih > 0
      ? (DISPLAY_UNITS[unit] / TIH_PER_PIH) * usdtPerPih
      : undefined;
  return formatPricePer(msat, displayUnitLabel(unit), money, locale, usd);
}

/**
 * Price info a Hashu mint publishes at `/checkout/api/info`. Only the
 * fields the wallet reads; all optional because older mints and non-Hashu
 * mints lack them.
 */
export type HashuMintPrice = {
  msat_per_pih?: number | null;
  /** USDT per PiH when the mint sells vouchers for USDT, else null. */
  usdt_per_pih?: number | null;
  min_buy_tih?: number | null;
  /** TiH the mint can sell right now; null when capacity is not enforced. */
  available_tih?: number | null;
  /** Largest single purchase in TiH. */
  max_tih?: number | null;
  min_redeem_tih?: number | null;
  /** Backup pools a redemption may list; missing on mints without them. */
  max_fallback_pools?: number | null;
  /** True when redemptions can carry a stop key (`stop_hash`), so the
   * wallet can stop, pause and resume them. Missing on older mints. */
  redeemer_controls?: boolean | null;
  /** True when the mint tests a pool before a redemption
   * (`POST /checkout/api/pool-check`). Missing on older mints. */
  pool_check?: boolean | null;
  /** True when the mint redeems only to stratum+ssl:// or stratum2+tcp://
   * pools. */
  encrypted_pools_only?: boolean | null;
  capacity_ends_ms?: number | null;
  delivery?: MintDelivery | null;
};

/**
 * What a Hashu mint reports for delivery estimates (`delivery` in
 * `/checkout/api/info`): its hashrate over the last few minutes, and the
 * TiH still owed to open redemptions, which are served before a new one.
 */
export type MintDelivery = {
  /** null from the mint until it has seen shares; stored as 0. */
  hashrate_hs: number;
  window_s?: number;
  queue_tih: number;
  open_redemptions: number;
  /** Rigs filling the mint's redemptions now (newer mints). */
  rigs?: number | null;
  /** Seconds until a redemption opened now gets its first rig: 0 when a
   * rig is free; null when the mint has no estimate (or is older). */
  start_in_s?: number | null;
};

/** URL of a mint's Hashu price endpoint. */
export function hashuInfoUrl(mintUrl: string): string {
  return `${mintUrl.replace(/\/+$/, "")}/checkout/api/info`;
}

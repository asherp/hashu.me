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

/** Voucher unit as it appears in mint keysets and tokens. */
export const UNIT_TIH = "tih";

/** Label shown next to TiH amounts. */
export const UNIT_TIH_LABEL = "TiH";

/** Hashes in one TiH (2^40). */
export const HASHES_PER_TIH = 2 ** 40;

/** TiH in one PiH (2^10). Hashu mints price vouchers in msat per PiH. */
export const TIH_PER_PIH = 1024;

/** TiH in one terahash-hour (1 TH/s for 3,600 s = 3.6e15 hashes), ≈ 3,274. */
export const TIH_PER_THH = 3.6e15 / HASHES_PER_TIH;

/** TiH in one petahash-hour (1,000 THH), ≈ 3.27 million. */
export const TIH_PER_PHH = 1000 * TIH_PER_THH;

/** Units the wallet can show TiH amounts in, as TiH per display unit. */
export const DISPLAY_UNITS = {
  TiH: 1,
  PiH: TIH_PER_PIH,
  EiH: TIH_PER_PIH * TIH_PER_PIH,
  THH: TIH_PER_THH,
  PHH: TIH_PER_PHH,
} as const;

export type DisplayUnit = keyof typeof DISPLAY_UNITS;

export const DEFAULT_DISPLAY_UNIT: DisplayUnit = "TiH";

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
 * "4 PiH" or "1.251 THH". TiH stays exact; larger units show up to three
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
  return `${new Intl.NumberFormat(locale, options).format(shown)} ${unit}`;
}

/** Value of a TiH amount in sats at a mint's msat-per-PiH price. */
export function tihToSats(tih: number | bigint, msatPerPih: number): number {
  return (Number(tih) / TIH_PER_PIH) * (msatPerPih / 1000);
}

/**
 * Price info a Hashu mint publishes at `/checkout/api/info`. Only the
 * fields the wallet reads; all optional because older mints and non-Hashu
 * mints lack them.
 */
export type HashuMintPrice = {
  msat_per_pih?: number | null;
  min_buy_tih?: number | null;
  min_redeem_tih?: number | null;
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
};

/** URL of a mint's Hashu price endpoint. */
export function hashuInfoUrl(mintUrl: string): string {
  return `${mintUrl.replace(/\/+$/, "")}/checkout/api/info`;
}

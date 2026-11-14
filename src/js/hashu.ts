/**
 * Hashu defaults for the hashu.me fork of Cashu.me.
 *
 * Hashu mints issue Chaumian hashrate vouchers in the `tih` unit:
 * 1 TiH (tebihash) = 2^40 hashes. Amounts stay integer TiH everywhere in
 * the wallet; other display units come later.
 */

/** Hashu's own mint, suggested on first start. */
export const DEFAULT_MINT_URL = "https://mint.hashu.io";

/** Voucher unit as it appears in mint keysets and tokens. */
export const UNIT_TIH = "tih";

/** Label shown next to TiH amounts. */
export const UNIT_TIH_LABEL = "TiH";

/** Format an integer TiH amount, e.g. "4,096 TiH". */
export function formatTih(value: number | bigint, locale?: string): string {
  return `${new Intl.NumberFormat(locale).format(value)} ${UNIT_TIH_LABEL}`;
}

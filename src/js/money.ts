/**
 * hashu.me: how the wallet shows amounts of bitcoin (Lightning amounts, sat
 * balances, hashprice). Replaces Cashu.me's "Use ₿ symbol" toggle with a
 * choice of unit. Only changes how amounts are shown, never what is sent.
 *
 * - sat:    "1,234 sat"           (prices: "46 sats/THd")
 * - bip177: "₿1,234"              (BIP-177: ₿ counts sats; prices "₿46/THd")
 * - btc:    "0.00001234 BTC"      (prices: "0.00000046 BTC/THd")
 * - msat:   "1,234,000 msat"      (prices: "46,043 msat/THd")
 */
export const MONEY_UNITS = ["sat", "bip177", "btc", "msat"] as const;
export type MoneyUnit = (typeof MONEY_UNITS)[number];
export const DEFAULT_MONEY_UNIT: MoneyUnit = "sat";

export function isMoneyUnit(value: unknown): value is MoneyUnit {
  return (MONEY_UNITS as readonly unknown[]).includes(value);
}

/** Accepts the old boolean ₿ toggle too: true is BIP-177, false is sat. */
export function toMoneyUnit(value: unknown): MoneyUnit {
  if (value === true) return "bip177";
  if (value === false || value == null) return DEFAULT_MONEY_UNIT;
  return isMoneyUnit(value) ? value : DEFAULT_MONEY_UNIT;
}

/** Short label of a money unit for amount fields and unit chips. */
export function moneyUnitTicker(unit: MoneyUnit): string {
  return unit === "bip177" ? "₿" : "sats";
}

const SATS_PER_BTC = 100_000_000n;

function formatBtc(sats: bigint, locale?: string): string {
  const negative = sats < 0n;
  const abs = negative ? -sats : sats;
  const whole = new Intl.NumberFormat(locale).format(abs / SATS_PER_BTC);
  const fraction = (abs % SATS_PER_BTC)
    .toString()
    .padStart(8, "0")
    .replace(/0+$/, "");
  const decimal =
    new Intl.NumberFormat(locale)
      .formatToParts(1.5)
      .find((p) => p.type === "decimal")?.value || ".";
  return `${negative ? "-" : ""}${whole}${
    fraction ? decimal + fraction : ""
  } BTC`;
}

/** A whole number of sats in the chosen money unit. */
export function formatSats(
  value: number | bigint,
  unit: MoneyUnit = DEFAULT_MONEY_UNIT,
  locale?: string
): string {
  const sats =
    typeof value === "bigint" ? value : BigInt(Math.trunc(Number(value) || 0));
  const nf = new Intl.NumberFormat(locale);
  switch (unit) {
    case "bip177":
      return sats < 0n ? `-₿${nf.format(-sats)}` : `₿${nf.format(sats)}`;
    case "btc":
      return formatBtc(sats, locale);
    case "msat":
      return `${nf.format(sats * 1000n)} msat`;
    default:
      return `${nf.format(sats)} sat`;
  }
}

/**
 * A price in msat per one `perLabel` (a hashrate display unit such as
 * "THd"), written as money unit / hash unit. Below a sat, sat and ₿ prices
 * fall back to msat ("0.586 msat/TiH"); BTC and msat always use their unit.
 */
export function formatPricePer(
  msat: number,
  perLabel: string,
  unit: MoneyUnit = DEFAULT_MONEY_UNIT,
  locale?: string
): string {
  const sats = msat / 1000;
  const asMsat = () => {
    const options: Intl.NumberFormatOptions =
      msat >= 1000
        ? { maximumFractionDigits: 0 }
        : { maximumSignificantDigits: 3 };
    return `${new Intl.NumberFormat(locale, options).format(
      msat
    )} msat/${perLabel}`;
  };
  if (unit === "msat") return asMsat();
  if (unit === "btc") {
    const shown = new Intl.NumberFormat(locale, {
      maximumSignificantDigits: 3,
      maximumFractionDigits: 20,
    }).format(sats / 1e8);
    return `${shown} BTC/${perLabel}`;
  }
  if (sats > 0 && sats < 1) return asMsat();
  const shown = new Intl.NumberFormat(locale, {
    maximumFractionDigits: sats >= 10 ? 0 : 2,
  }).format(sats);
  if (unit === "bip177") return `₿${shown}/${perLabel}`;
  return `${shown} ${sats === 1 ? "sat" : "sats"}/${perLabel}`;
}

/**
 * hashu.me: how the wallet shows amounts of bitcoin (Lightning amounts, sat
 * balances, hashprice). Replaces Cashu.me's "Use ₿ symbol" toggle with a
 * choice of unit. Only changes how amounts are shown, never what is sent.
 *
 * - sat:    "1,234 sat"           (prices: "46 sats/THd")
 * - bip177: "₿1,234"              (BIP-177: ₿ counts sats; prices "₿46/THd")
 * - btc:    "0.00001234 BTC"      (prices: "0.00000046 BTC/THd")
 * - msat:   "1,234,000 msat"      (prices: "46,043 msat/THd")
 * - usd:    "$1.07"               (prices: "$0.041/THd")
 *
 * USD needs a rate: the wallet's BTC price feed (Coinbase), or for prices
 * the mint's own USDT price when it publishes one. Without a rate, USD
 * amounts and prices fall back to sats.
 */
export const MONEY_UNITS = ["sat", "bip177", "btc", "msat", "usd"] as const;
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

/** A money unit plus the rates it may need. */
export type Money = {
  unit: MoneyUnit;
  /** USD per BTC from the wallet's price feed; 0 or missing if unknown. */
  usdPerBtc?: number;
  /** The mint's own USDT price per PiH, if it sells vouchers for USDT. */
  usdtPerPih?: number;
};

export function toMoney(value: unknown): Money {
  if (value && typeof value === "object" && "unit" in value) {
    const m = value as Money;
    return { ...m, unit: toMoneyUnit(m.unit) };
  }
  return { unit: toMoneyUnit(value) };
}

/**
 * USD with cents, or three significant digits below `centsFrom` (a cent
 * for amounts, a dollar for prices, so "$0.046/THd" keeps its digits).
 */
export function formatUsd(
  usd: number,
  locale?: string,
  centsFrom = 0.01
): string {
  const abs = Math.abs(usd);
  const options: Intl.NumberFormatOptions =
    abs >= centsFrom || abs === 0
      ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
      : { maximumSignificantDigits: 3 };
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    ...options,
  }).format(usd);
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
  money: MoneyUnit | Money = DEFAULT_MONEY_UNIT,
  locale?: string
): string {
  const { unit, usdPerBtc } = toMoney(money);
  const sats =
    typeof value === "bigint" ? value : BigInt(Math.trunc(Number(value) || 0));
  const nf = new Intl.NumberFormat(locale);
  switch (unit) {
    case "usd":
      if (usdPerBtc && usdPerBtc > 0) {
        return formatUsd((Number(sats) / 1e8) * usdPerBtc, locale);
      }
      return `${nf.format(sats)} sat`;
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
 * USD uses `usd` when given (the mint's USDT price), else the BTC rate.
 */
export function formatPricePer(
  msat: number,
  perLabel: string,
  money: MoneyUnit | Money = DEFAULT_MONEY_UNIT,
  locale?: string,
  usd?: number
): string {
  const { usdPerBtc } = toMoney(money);
  let { unit } = toMoney(money);
  if (unit === "usd") {
    if (usd != null && usd > 0)
      return `${formatUsd(usd, locale, 1)}/${perLabel}`;
    if (usdPerBtc && usdPerBtc > 0) {
      return `${formatUsd((msat / 1e11) * usdPerBtc, locale, 1)}/${perLabel}`;
    }
    unit = "sat";
  }
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

/**
 * An amount given in msat (a TiH amount's cost, say) in the chosen money
 * unit. Below a sat, sat and ₿ amounts fall back to msat ("600 msat"),
 * like prices do; BTC and msat always use their unit. USD uses `usd` when
 * given (the mint's USDT price), else the BTC rate, else sats.
 */
export function formatMsatAmount(
  msat: number,
  money: MoneyUnit | Money = DEFAULT_MONEY_UNIT,
  locale?: string,
  usd?: number
): string {
  const { usdPerBtc } = toMoney(money);
  let { unit } = toMoney(money);
  if (unit === "usd") {
    if (usd != null && usd > 0) return formatUsd(usd, locale);
    if (usdPerBtc && usdPerBtc > 0)
      return formatUsd((msat / 1e11) * usdPerBtc, locale);
    unit = "sat";
  }
  const asMsat = () =>
    `${new Intl.NumberFormat(locale, {
      maximumFractionDigits: 0,
    }).format(Math.ceil(msat))} msat`;
  if (unit === "msat") return asMsat();
  const sats = msat / 1000;
  if (unit === "btc") {
    const shown = new Intl.NumberFormat(locale, {
      maximumSignificantDigits: 3,
      maximumFractionDigits: 20,
    }).format(sats / 1e8);
    return `${shown} BTC`;
  }
  if (sats > 0 && sats < 1) return asMsat();
  const shown = new Intl.NumberFormat(locale, {
    maximumFractionDigits: sats >= 10 ? 0 : 3,
  }).format(sats);
  if (unit === "bip177") return `₿${shown}`;
  return `${shown} sat`;
}

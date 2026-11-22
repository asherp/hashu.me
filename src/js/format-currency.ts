import { UNIT_TIH, formatTih } from "src/js/hashu";
import { formatSats, toMoneyUnit, type MoneyUnit } from "src/js/money";

/** Format integer Cashu amounts without converting large values to numbers. */
export function formatBigIntCurrency(
  value: bigint,
  currency: string,
  locale = "en",
  money: MoneyUnit | boolean = "sat"
): string {
  const numberFormat = new Intl.NumberFormat(locale);
  // hashu.me: sat amounts follow the Monetary unit setting.
  if (currency === "sat") return formatSats(value, toMoneyUnit(money), locale);
  if (currency === "msat") return `${numberFormat.format(value)} msat`;
  if (currency === UNIT_TIH) return formatTih(value, locale);

  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    });
    if (currency !== "usd" && currency !== "eur") {
      return formatter.format(value);
    }
    // Format the whole units and cents separately to preserve every digit.
    const whole = value / 100n;
    const cents = value < 0n ? -(value % 100n) : value % 100n;
    const fraction = new Intl.NumberFormat(locale, {
      minimumIntegerDigits: 2,
      useGrouping: false,
    }).format(cents);
    return formatter
      .formatToParts(value < 0n && whole === 0n ? -0 : whole)
      .map((part) => (part.type === "fraction" ? fraction : part.value))
      .join("");
  } catch {
    return `${numberFormat.format(value)} ${currency}`;
  }
}

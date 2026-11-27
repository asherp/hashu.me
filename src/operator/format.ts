// Number formatting for the operator app. Hash amounts use the wallet's
// display units (src/js/hashu.ts); rates are written TH/s, PH/s, EH/s.
import {
  autoScaleDisplayUnit,
  formatTih,
  isDisplayUnit,
  DEFAULT_DISPLAY_UNIT,
  type DisplayUnit,
} from "src/js/hashu";
import { useSettingsStore } from "src/stores/settings";

/** "93.2 TH/s", "1.25 PH/s", "980 GH/s". */
export function fmtRate(hs: number | null | undefined): string {
  if (hs == null || !isFinite(hs)) return "–";
  const units: [number, string][] = [
    [1e18, "EH/s"],
    [1e15, "PH/s"],
    [1e12, "TH/s"],
    [1e9, "GH/s"],
    [1e6, "MH/s"],
  ];
  if (hs === 0) return "0 TH/s";
  for (const [f, u] of units) {
    if (Math.abs(hs) >= f) return `${num(hs / f)} ${u}`;
  }
  return `${num(hs / 1e6)} MH/s`;
}

/** TH/s given as TH/s. */
export function fmtThs(ths: number | null | undefined): string {
  return ths == null ? "–" : fmtRate(ths * 1e12);
}

function num(v: number): string {
  const opts: Intl.NumberFormatOptions =
    Math.abs(v) >= 100
      ? { maximumFractionDigits: 0 }
      : Math.abs(v) >= 10
      ? { maximumFractionDigits: 1 }
      : { maximumFractionDigits: 2 };
  return new Intl.NumberFormat(undefined, opts).format(v);
}

/** The hash unit chosen in Settings. */
export function chosenUnit(): DisplayUnit {
  const s = useSettingsStore();
  return isDisplayUnit(s.hashuDisplayUnit)
    ? s.hashuDisplayUnit
    : DEFAULT_DISPLAY_UNIT;
}

/** A TiH amount in the chosen unit, auto scaled to the amount if on. */
export function fmtHashes(tih: number | null | undefined): string {
  if (tih == null || !isFinite(tih)) return "–";
  const s = useSettingsStore();
  const chosen = chosenUnit();
  const unit = s.hashuAutoScaleUnit
    ? autoScaleDisplayUnit(chosen, tih)
    : chosen;
  const v = unit === "TiH" ? Math.round(tih) : tih;
  return formatTih(v, undefined, unit);
}

export function fmtSats(sats: number | null | undefined): string {
  if (sats == null || !isFinite(sats)) return "–";
  return `${new Intl.NumberFormat(undefined, {
    maximumFractionDigits: sats < 10 ? 2 : 0,
  }).format(sats)} sats`;
}

/** "3 min", "2 h 5 min", "4 d". */
export function fmtDuration(s: number | null | undefined): string {
  if (s == null || !isFinite(s)) return "–";
  s = Math.max(0, Math.round(s));
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
  return `${Math.round(h / 24)} d`;
}

/** "5 min ago", "just now". */
export function fmtAgo(ms: number | null | undefined, now = Date.now()) {
  if (!ms) return "–";
  const s = (now - ms) / 1000;
  if (s < 45) return "just now";
  return `${fmtDuration(s)} ago`;
}

export function fmtTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** A rig's name: the Stratum user after its first dot. */
export function rigName(user: string): string {
  const i = user.indexOf(".");
  return i >= 0 && i < user.length - 1 ? user.slice(i + 1) : user;
}

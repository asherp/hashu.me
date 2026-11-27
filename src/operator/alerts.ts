// Alerts an operator should see: worked out from what the mint reports.
import type { OperatorMint } from "./api";
import type { MintSnapshot } from "./store";
import { fmtAgo, fmtHashes, rigName } from "./format";

export type Alert = {
  id: string;
  level: "error" | "warning" | "info";
  title: string;
  detail?: string;
  /** Tab of the mint page that deals with it. */
  tab?: string;
};

/** Smallest purchase a buyer can make: 1 PiH. */
const MIN_SALE_TIH = 1024;
/** A rig gone this long counts as offline. */
const RIG_GRACE_MS = 2 * 60_000;
/** Look this far back for rigs that went away. */
const RIG_LOOKBACK_MS = 60 * 60_000;

export type RigStatus = {
  name: string;
  online: boolean;
  since?: number;
  hs?: number;
};

/**
 * Rigs over the last hour from `/api/hashrate`: connected or not, and each
 * one's rate over the last `windowMs` from its cumulative work.
 */
export function rigStatus(
  hashrate: any,
  now = Date.now(),
  windowMs = 5 * 60_000
): RigStatus[] {
  if (!hashrate) return [];
  const byRig = new Map<string, RigStatus>();
  for (const s of hashrate.sessions || []) {
    const name = rigName(s.rig);
    const cur = byRig.get(name);
    const online = s.end_ms == null;
    if (!cur) {
      byRig.set(name, { name, online, since: online ? s.start_ms : s.end_ms });
    } else if (online && !cur.online) {
      byRig.set(name, { name, online: true, since: s.start_ms });
    } else if (!online && !cur.online && (s.end_ms ?? 0) > (cur.since ?? 0)) {
      cur.since = s.end_ms;
    }
  }
  const samples: any[] = hashrate.samples || [];
  const last = samples[samples.length - 1];
  if (last?.rigs) {
    const from = last.t_ms - windowMs;
    const first = samples.find((s) => s.t_ms >= from) || samples[0];
    const dt = (last.t_ms - first.t_ms) / 1000;
    const totals = new Map<string, number>();
    for (const [user, cum] of Object.entries<number>(last.rigs)) {
      const before = first.rigs?.[user] ?? 0;
      const name = rigName(user);
      totals.set(name, (totals.get(name) ?? 0) + Math.max(0, cum - before));
    }
    for (const [name, work] of totals) {
      const r = byRig.get(name) ?? { name, online: true };
      r.hs = dt > 0 ? work / dt : undefined;
      byRig.set(name, r);
    }
  }
  return [...byRig.values()]
    .filter((r) => r.online || (r.since ?? 0) > now - RIG_LOOKBACK_MS)
    .sort(
      (a, b) => Number(b.online) - Number(a.online) || (b.hs ?? 0) - (a.hs ?? 0)
    );
}

export function alertsFor(m: OperatorMint, s?: MintSnapshot): Alert[] {
  const out: Alert[] = [];
  if (!s) return out;
  if (s.signedOut) {
    out.push({
      id: "signed-out",
      level: "error",
      title: "Signed out",
      detail: s.error,
    });
    return out;
  }
  if (s.error) {
    out.push({
      id: "unreachable",
      level: "error",
      title: "Can't reach the mint",
      detail: s.error,
    });
    return out;
  }
  const now = Date.now();
  if (m.kind === "supplier") {
    const st = s.supplier;
    if (st && !st.selling) {
      out.push({
        id: "not-selling",
        level: "warning",
        title: "Not selling",
        detail: !st.ask_sats_per_eih
          ? "Set an ask price to sell."
          : !st.pays_by_lightning
          ? "Add a Lightning address to get paid."
          : "No stock: the rigs need to report hashrate.",
        tab: "settings",
      });
    }
    return out;
  }
  const op = s.op;
  if (!op) return out;

  const rigs = rigStatus(s.hashrate, now);
  for (const r of rigs) {
    if (!r.online && r.since && now - r.since > RIG_GRACE_MS) {
      out.push({
        id: `rig-offline:${r.name}`,
        level: "warning",
        title: `Rig ${r.name} offline`,
        detail: `Disconnected ${fmtAgo(r.since, now)}.`,
        tab: "overview",
      });
    }
  }
  const metrics = op.proxy?.metrics;
  if (
    !rigs.some((r) => r.online) &&
    (metrics?.connections_accepted ?? 0) === 0 &&
    (op.capacity?.rented_ths ?? 0) === 0
  ) {
    out.push({
      id: "no-rigs",
      level: "warning",
      title: "No rigs connected",
      detail: op.proxy?.stratum?.url
        ? `Point rigs at ${op.proxy.stratum.url}.`
        : undefined,
      tab: "overview",
    });
  }

  if (op.mint?.controls?.issuance_paused) {
    out.push({
      id: "paused",
      level: "info",
      title: "Sales paused",
      detail: "Buyers can't get new quotes.",
      tab: "controls",
    });
  } else {
    const cap = op.capacity;
    const avail = cap?.available_tih;
    if (cap?.limit && avail != null && avail < MIN_SALE_TIH) {
      out.push({
        id: "low-stock",
        level: "warning",
        title: "Out of stock",
        detail: `Only ${fmtHashes(
          avail
        )} for sale, below the 1 PiH minimum purchase.`,
        tab: "stock",
      });
    }
  }

  const open = (op.redemptions || []).filter(
    (r: any) => !["completed", "settled", "stopped", "failed"].includes(r.state)
  );
  const waiting = open.filter(
    (r: any) => !(r.rigs || []).length && !r.paused_by
  );
  if (waiting.length) {
    out.push({
      id: `queue:${waiting.length}`,
      level: "warning",
      title:
        waiting.length === 1
          ? "1 redemption waiting for a rig"
          : `${waiting.length} redemptions waiting for a rig`,
      detail: "Each rig serves one redemption at a time.",
      tab: "redemptions",
    });
  }

  const unread = s.inbox?.unread ?? 0;
  if (unread > 0) {
    out.push({
      id: `unread:${unread}`,
      level: "warning",
      title: unread === 1 ? "1 unread message" : `${unread} unread messages`,
      tab: "messages",
    });
  }
  if (op.capacity?.mrr_error) {
    out.push({
      id: "mrr",
      level: "warning",
      title: "MiningRigRentals sync failed",
      detail: op.capacity.mrr_error,
      tab: "stock",
    });
  }
  return out;
}

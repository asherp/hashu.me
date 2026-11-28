// Hashu Operator: the mints this app is signed into, and what each one
// last reported. Only this app's origin stores them (never the wallet).
import { defineStore } from "pinia";
import { useLocalStorage } from "@vueuse/core";
import {
  call,
  ApiError,
  signInOperator,
  signInSupplier,
  type OperatorMint,
} from "./api";
import { alertsFor, type Alert } from "./alerts";

/** What one poll of a mint read. Kept in memory only. */
export type MintSnapshot = {
  op?: any; // operator: GET /api/operator
  inbox?: any; // operator: GET /api/inbox
  hashrate?: any; // operator: GET /api/hashrate
  supplier?: any; // supplier: GET /api/supplier
  settings?: any; // supplier: GET /api/settings
  error?: string;
  signedOut?: boolean;
  updatedMs?: number;
};

function newId(): string {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export const useOperatorStore = defineStore("operator", {
  state: () => ({
    mints: useLocalStorage<OperatorMint[]>("hashu.operator.mints", []),
    notify: useLocalStorage<boolean>("hashu.operator.notify", false),
    /** Alert ids already notified, so each one notifies once. */
    notified: useLocalStorage<string[]>("hashu.operator.notified", []),
    snapshots: {} as Record<string, MintSnapshot>,
  }),
  getters: {
    byId: (s) => (id: string) => s.mints.find((m) => m.id === id),
    alerts(): Record<string, Alert[]> {
      const out: Record<string, Alert[]> = {};
      for (const m of this.mints) {
        out[m.id] = alertsFor(m, this.snapshots[m.id]);
      }
      return out;
    },
    alertCount(): number {
      return Object.values(this.alerts).reduce(
        (n, a) => n + a.filter((x) => x.level !== "info").length,
        0
      );
    },
  },
  actions: {
    async addOperatorMint(url: string, user: string, password: string) {
      const { api, session } = await signInOperator(url, user, password);
      const existing = this.mints.find(
        (m) => m.kind === "operator" && m.api === api
      );
      const m: OperatorMint = existing ?? {
        id: newId(),
        kind: "operator",
        label: url,
        api,
        mintUrl: api.replace(/\/operator$/, ""),
        addedMs: Date.now(),
      };
      m.token = session.token;
      m.user = session.user;
      m.tokenExpiresMs = Date.now() + session.expires_in_s * 1000;
      if (!existing) this.mints.push(m);
      else this.mints = [...this.mints];
      this.snapshots[m.id] = {};
      await this.refresh(m.id);
      return m;
    },
    async addSupplierMint(url: string, key: string) {
      const { api, status } = await signInSupplier(url, key);
      const existing = this.mints.find(
        (m) => m.kind === "supplier" && m.api === api
      );
      const m: OperatorMint = existing ?? {
        id: newId(),
        kind: "supplier",
        label: status?.name || url,
        api,
        mintUrl: status?.mint_url || api,
        addedMs: Date.now(),
      };
      m.key = key.trim();
      if (!existing) this.mints.push(m);
      else this.mints = [...this.mints];
      this.snapshots[m.id] = {};
      await this.refresh(m.id);
      return m;
    },
    async signOut(id: string) {
      const m = this.byId(id);
      if (m?.kind === "operator" && m.token) {
        // Best effort: the token ends with a mint restart anyway.
        await call(m, "/api/session", { method: "DELETE" }).catch(() => {});
      }
      this.mints = this.mints.filter((x) => x.id !== id);
      delete this.snapshots[id];
    },
    /** Poll one mint. */
    async refresh(id: string) {
      const m = this.byId(id);
      if (!m) return;
      const snap: MintSnapshot = { ...(this.snapshots[id] || {}) };
      try {
        if (m.kind === "operator") {
          if (!m.token) throw new ApiError(401, "signed out");
          const [op, inbox, hashrate] = await Promise.all([
            call(m, "/api/operator"),
            call(m, "/api/inbox").catch(() => undefined),
            // Enough for each rig's 5 min rate; the chart keeps its own.
            call(m, `/api/hashrate?since=${Date.now() - 6 * 60_000}`),
          ]);
          snap.op = op;
          snap.inbox = inbox;
          snap.hashrate = hashrate;
          const name = op?.mint?.name;
          if (name && m.label !== name) {
            m.label = name;
            this.mints = [...this.mints];
          }
        } else {
          const [supplier, settings] = await Promise.all([
            call(m, "/api/supplier"),
            call(m, "/api/settings"),
          ]);
          snap.supplier = supplier;
          snap.settings = settings;
        }
        snap.error = undefined;
        snap.signedOut = false;
        snap.updatedMs = Date.now();
      } catch (e: any) {
        if (e instanceof ApiError && e.status === 401) {
          snap.signedOut = true;
          snap.error =
            m.kind === "operator"
              ? "Signed out (the mine restarted or the sign-in expired). Sign in again."
              : "The dashboard key was refused.";
        } else {
          snap.error = e?.message || String(e);
        }
      }
      this.snapshots[id] = snap;
    },
    async refreshAll() {
      await Promise.all(this.mints.map((m) => this.refresh(m.id)));
      this.notifyNew();
    },
    /** Show a system notification for each new warning, if allowed. */
    notifyNew() {
      if (!this.notify || typeof Notification === "undefined") return;
      if (Notification.permission !== "granted") return;
      const seen = new Set(this.notified);
      const live: string[] = [];
      for (const m of this.mints) {
        for (const a of this.alerts[m.id] || []) {
          const key = `${m.id}:${a.id}`;
          live.push(key);
          if (a.level === "info" || seen.has(key)) continue;
          const title = `${m.label}: ${a.title}`;
          navigator.serviceWorker?.getRegistration().then((reg) => {
            if (reg) reg.showNotification(title, { body: a.detail, tag: key });
            else new Notification(title, { body: a.detail, tag: key });
          });
        }
      }
      // Forget alerts that cleared, so they notify again if they return.
      this.notified = live;
    },
  },
});

<template>
  <div>
    <div class="op-tiles">
      <div
        v-for="t in tiles"
        :key="t.label"
        class="op-tile op-card"
        :data-testid="`tile-${t.key}`"
      >
        <div class="op-tile-label row items-center no-wrap q-gutter-x-xs">
          <HashuLogoIcon v-if="t.hashes" :size="13" />
          <span>{{ t.label }}</span>
        </div>
        <div class="op-tile-value">{{ t.value }}</div>
        <div v-if="t.sub" class="op-tile-sub">{{ t.sub }}</div>
      </div>
    </div>

    <div class="op-section-title">Hashrate</div>
    <div class="op-card q-pa-md">
      <HashrateChart :samples="series" :span-ms="30 * 60_000" />
    </div>

    <div class="op-section-title">Rigs</div>
    <q-list class="op-card" separator>
      <q-item v-if="!rigs.length">
        <q-item-section class="op-muted">
          No rigs in the last hour.
          <span v-if="stratum"
            >Point them at <span class="op-mono">{{ stratum }}</span
            >.</span
          >
        </q-item-section>
      </q-item>
      <q-item v-for="r in rigs" :key="r.name" data-testid="rig-row">
        <q-item-section avatar style="min-width: 28px">
          <span class="op-dot" :class="r.online ? 'op-dot-on' : 'op-dot-off'" />
        </q-item-section>
        <q-item-section>
          <q-item-label class="text-weight-medium">{{ r.name }}</q-item-label>
          <q-item-label caption>
            {{
              r.online
                ? `Connected ${ago(r.since)}`
                : `Offline since ${ago(r.since)}`
            }}
            <template v-if="servingOf(r.name)">
              · mining for a redemption</template
            >
          </q-item-label>
        </q-item-section>
        <q-item-section side class="text-weight-medium">
          {{ r.online ? fmtRate(r.hs) : "–" }}
        </q-item-section>
      </q-item>
    </q-list>
    <div class="text-caption op-muted q-mt-xs">
      Rate per rig over the last 5 min, from accepted shares.
    </div>

    <div class="op-section-title">Mint</div>
    <q-list class="op-card" dense separator>
      <q-item v-for="row in facts" :key="row[0]">
        <q-item-section class="op-muted">{{ row[0] }}</q-item-section>
        <q-item-section side class="text-right" style="max-width: 65%">
          <span :class="row[2] ? 'op-mono' : ''">{{ row[1] }}</span>
        </q-item-section>
      </q-item>
    </q-list>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from "vue";
import HashuLogoIcon from "components/icons/HashuLogoIcon.vue";
import HashrateChart from "./HashrateChart.vue";
import type { OperatorMint } from "../api";
import { call } from "../api";
import type { MintSnapshot } from "../store";
import { rigStatus } from "../alerts";
import {
  fmtAgo,
  fmtDuration,
  fmtHashes,
  fmtRate,
  fmtSats,
  rigName,
} from "../format";
import { isOpen } from "../redemptions";

/** Samples the chart keeps: an hour at one a second. */
const KEEP_MS = 60 * 60_000;

export default defineComponent({
  name: "OverviewTab",
  components: { HashuLogoIcon, HashrateChart },
  props: {
    mint: { type: Object as PropType<OperatorMint>, required: true },
    snap: { type: Object as PropType<MintSnapshot>, required: true },
  },
  data() {
    return { series: [] as any[], timer: 0 as number, busy: false };
  },
  computed: {
    op(): any {
      return this.snap.op;
    },
    rigs() {
      return rigStatus(this.snap.hashrate);
    },
    stratum(): string | undefined {
      return this.op?.proxy?.stratum?.url;
    },
    open(): any[] {
      return (this.op?.redemptions || []).filter(isOpen);
    },
    tiles(): any[] {
      const op = this.op;
      const cap = op?.capacity || {};
      const price = op?.mint?.price || {};
      const online = this.rigs.filter((r) => r.online).length;
      return [
        {
          key: "hashrate",
          label: "Hashrate now",
          value: fmtRate(op?.proxy?.hashrate_hs),
          sub: `${online} rig${online === 1 ? "" : "s"} online`,
        },
        {
          key: "sale",
          hashes: true,
          label: "For sale",
          value: op?.mint?.controls?.issuance_paused
            ? "Paused"
            : fmtHashes(cap.available_tih),
          sub: cap.live?.on
            ? `Live stock, ${cap.live.horizon_hours} h horizon`
            : cap.limit
            ? "Capped by capacity"
            : "No cap",
        },
        {
          key: "owed",
          hashes: true,
          label: "Owed",
          value: fmtHashes(op?.obligations?.total_tih_owed),
          sub: `${fmtHashes(
            op?.obligations?.tih_in_circulation
          )} in circulation`,
        },
        {
          key: "redemptions",
          label: "Open redemptions",
          value: `${this.open.length}`,
          sub: this.open.length
            ? `${fmtHashes(
                this.open.reduce(
                  (a: number, r: any) => a + (r.remaining_tih || 0),
                  0
                )
              )} left to deliver`
            : "None",
        },
        {
          key: "price",
          label: "Price",
          value:
            price.sats_per_th_day != null
              ? `${fmtSats(price.sats_per_th_day)}/THd`
              : "–",
          sub:
            price.msat_per_pih != null
              ? `${new Intl.NumberFormat().format(
                  price.msat_per_pih
                )} msat per PiH`
              : undefined,
        },
        {
          key: "heat",
          label: "Heat",
          value: op?.heat ? `${(op.heat.now_kw ?? 0).toFixed(2)} kW` : "–",
          sub: op?.heat
            ? `${Math.round(op.heat.now_btu_per_h ?? 0).toLocaleString()} BTU/h`
            : undefined,
        },
      ];
    },
    facts(): [string, string, boolean?][] {
      const op = this.op;
      if (!op) return [];
      const m = op.proxy?.metrics || {};
      return [
        ["Mint URL", op.mint?.url || this.mint.mintUrl, true],
        ["Stratum", this.stratum || "–", true],
        ["Payment rails", (op.mint?.rails || []).join(", ") || "–"],
        [
          "Shares accepted",
          `${(m.shares_accepted ?? 0).toLocaleString()} (${(
            m.shares_rejected ?? 0
          ).toLocaleString()} rejected)`,
        ],
        ["Running for", fmtDuration((op.now_ms - op.started_ms) / 1000)],
        ["Signed in as", this.mint.user || "operator"],
      ];
    },
  },
  mounted() {
    this.tick();
    this.timer = window.setInterval(this.tick, 5_000);
  },
  beforeUnmount() {
    window.clearInterval(this.timer);
  },
  methods: {
    fmtRate,
    ago(ms?: number) {
      return fmtAgo(ms);
    },
    servingOf(name: string): boolean {
      return this.open.some((r: any) =>
        (r.rigs || []).some((g: any) => rigName(g.rig) === name)
      );
    },
    /** Append new samples to the chart's own series. */
    async tick() {
      if (this.busy || document.visibilityState !== "visible") return;
      this.busy = true;
      try {
        const last = this.series[this.series.length - 1];
        const since = last ? last.t_ms + 1 : Date.now() - 31 * 60_000;
        const h = await call(this.mint, `/api/hashrate?since=${since}`);
        const add = (h?.samples || []).filter(
          (s: any) => !last || s.t_ms > last.t_ms
        );
        const all = this.series.concat(add);
        const end = all.length ? all[all.length - 1].t_ms : 0;
        this.series = all.filter((s: any) => s.t_ms >= end - KEEP_MS);
      } catch {
        // The page-level poll reports errors.
      } finally {
        this.busy = false;
      }
    },
  },
});
</script>

<style lang="scss">
.op-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.op-dot-on {
  background: #43a047;
  box-shadow: 0 0 0 3px rgba(67, 160, 71, 0.2);
}
.op-dot-off {
  background: #9e9e9e;
}
</style>

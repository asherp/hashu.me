<template>
  <div>
    <div class="op-card q-pa-md">
      <q-toggle
        :model-value="paused"
        color="negative"
        label="Pause sales"
        data-testid="pause-toggle"
        :disable="busy === 'pause'"
        @update:model-value="setPaused"
      />
      <div class="text-body2 op-muted q-mt-xs">
        Paused, every payment rail refuses new quotes. Redemptions and the proxy
        keep running.
      </div>
    </div>

    <div class="op-section-title">Price</div>
    <div class="op-card q-pa-md">
      <div class="op-tiles q-mb-md">
        <div class="op-tile op-card">
          <div class="op-tile-label">Selling at</div>
          <div class="op-tile-value">
            {{
              price.sats_per_th_day != null
                ? `${fmtSats(price.sats_per_th_day)}/THd`
                : "–"
            }}
          </div>
          <div class="op-tile-sub">
            {{
              price.msat_per_pih != null
                ? `${price.msat_per_pih.toLocaleString()} msat per PiH`
                : ""
            }}
          </div>
        </div>
        <div v-if="price.usdt_per_pih != null" class="op-tile op-card">
          <div class="op-tile-label">Tether / USDC</div>
          <div class="op-tile-value">{{ price.usdt_per_pih }} per PiH</div>
        </div>
      </div>
      <div class="row q-col-gutter-md items-end">
        <div class="col-12 col-sm-6">
          <q-input
            v-model.number="markup"
            outlined
            dense
            type="number"
            step="0.1"
            min="-90"
            max="1000"
            suffix="%"
            label="Markup over the market price"
            hint="−90% to +1000%"
            data-testid="markup-input"
          />
        </div>
        <div class="col-12 col-sm-6">
          <q-input
            v-model.number="heat"
            outlined
            dense
            type="number"
            step="0.1"
            min="1"
            max="500"
            suffix="J/TH"
            label="Rig efficiency for the heat estimate"
            hint="Rigs not named after a model"
          />
        </div>
      </div>
      <q-btn
        unelevated
        no-caps
        color="primary"
        class="q-mt-md"
        label="Save"
        :disable="!dirty"
        :loading="busy === 'save'"
        @click="save"
        data-testid="controls-save"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from "vue";
import { call, type OperatorMint } from "../api";
import type { MintSnapshot } from "../store";
import { fmtSats } from "../format";

export default defineComponent({
  name: "ControlsTab",
  props: {
    mint: { type: Object as PropType<OperatorMint>, required: true },
    snap: { type: Object as PropType<MintSnapshot>, required: true },
  },
  emits: ["changed"],
  data() {
    const c = this.snap.op?.mint?.controls || {};
    return {
      markup: (c.markup_bps ?? 0) / 100,
      heat: c.heat_j_per_th ?? 30,
      busy: "",
    };
  },
  computed: {
    controls(): any {
      return this.snap.op?.mint?.controls || {};
    },
    price(): any {
      return this.snap.op?.mint?.price || {};
    },
    paused(): boolean {
      return !!this.controls.issuance_paused;
    },
    dirty(): boolean {
      return (
        Math.round(Number(this.markup) * 100) !==
          (this.controls.markup_bps ?? 0) ||
        Number(this.heat) !== this.controls.heat_j_per_th
      );
    },
  },
  methods: {
    fmtSats,
    async send(body: any, what: string, done: string) {
      this.busy = what;
      try {
        await call(this.mint, "/api/controls", { body });
        this.$q.notify({ message: done, position: "top" });
        this.$emit("changed");
      } catch (e: any) {
        this.$q.notify({
          type: "negative",
          message: e?.message || String(e),
          position: "top",
        });
      } finally {
        this.busy = "";
      }
    },
    setPaused(v: boolean) {
      const go = () =>
        this.send(
          { issuance_paused: v },
          "pause",
          v ? "Sales paused" : "Sales resumed"
        );
      if (!v) return go();
      this.$q
        .dialog({
          title: "Pause sales?",
          message: "Buyers can't get new quotes until you resume.",
          cancel: { flat: true, noCaps: true },
          ok: { label: "Pause", color: "negative", flat: true, noCaps: true },
        })
        .onOk(go);
    },
    save() {
      this.send(
        {
          markup_bps: Math.round(Number(this.markup) * 100),
          heat_j_per_th: Number(this.heat),
        },
        "save",
        "Saved"
      );
    },
  },
});
</script>

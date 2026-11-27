<template>
  <div>
    <q-tabs
      v-model="tab"
      dense
      no-caps
      align="left"
      active-color="primary"
      indicator-color="primary"
      class="q-mb-md op-tabs"
    >
      <q-tab name="overview" label="Overview" />
      <q-tab name="planner" label="Planner" />
    </q-tabs>
    <PlannerTab v-if="tab === 'planner'" :mint="mint" :snap="snap" />
    <div v-else>
      <div class="op-tiles">
        <div class="op-tile op-card">
          <div class="op-tile-label">Status</div>
          <div class="op-tile-value">
            {{ st.selling ? "Selling" : "Not selling" }}
          </div>
        </div>
        <div class="op-tile op-card">
          <div class="op-tile-label row items-center q-gutter-x-xs">
            <HashuLogoIcon :size="13" /><span>For sale</span>
          </div>
          <div class="op-tile-value">{{ fmtHashes(cap.available_tih) }}</div>
        </div>
        <div class="op-tile op-card">
          <div class="op-tile-label">Live hashrate</div>
          <div class="op-tile-value">{{ fmtThs(cap.hashrate_ths) }}</div>
          <div class="op-tile-sub">
            Average {{ fmtThs(cap.stock?.ewma_ths) }}
          </div>
        </div>
        <div class="op-tile op-card">
          <div class="op-tile-label">Ask</div>
          <div class="op-tile-value">
            {{
              st.ask_sats_per_eih != null
                ? `${st.ask_sats_per_eih.toLocaleString()} sats/EiH`
                : "–"
            }}
          </div>
          <div class="op-tile-sub" v-if="st.ask_sats_per_th_day != null">
            {{ fmtSats(st.ask_sats_per_th_day) }}/THd
          </div>
        </div>
        <div class="op-tile op-card">
          <div class="op-tile-label">Owed</div>
          <div class="op-tile-value">{{ fmtHashes(cap.owed_tih) }}</div>
        </div>
      </div>

      <div class="op-section-title">Settings</div>
      <q-form
        class="op-card q-pa-md column q-gutter-y-md"
        @submit.prevent="save"
      >
        <q-input
          v-model.number="form.ask_sats_per_eih"
          outlined
          dense
          type="number"
          min="1"
          step="1"
          label="Ask (sats per EiH)"
          :hint="askHint"
        />
        <q-input
          v-model.number="form.horizon_hours"
          outlined
          dense
          type="number"
          min="1"
          step="1"
          label="Horizon (hours)"
          hint="Stock = your rigs' average hashrate × the horizon"
        />
        <q-input
          v-model="form.lnurl"
          outlined
          dense
          label="Lightning address (you get paid here)"
          autocapitalize="off"
        />
        <q-input
          v-model="form.npub"
          outlined
          dense
          label="Your npub (messages to your mint)"
          autocapitalize="off"
        />
        <div class="row q-gutter-sm">
          <q-btn
            type="submit"
            unelevated
            no-caps
            color="primary"
            label="Save"
            :loading="busy === 'save'"
          />
          <q-btn
            outline
            no-caps
            label="Restock now"
            :loading="busy === 'restock'"
            @click="restock"
          />
        </div>
      </q-form>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from "vue";
import HashuLogoIcon from "components/icons/HashuLogoIcon.vue";
import PlannerTab from "./PlannerTab.vue";
import { call, type OperatorMint } from "../api";
import type { MintSnapshot } from "../store";
import { fmtHashes, fmtSats, fmtThs } from "../format";

/** TiH in one THd and in one EiH, for the ask hint. */
const TIH_PER_THD = (24 * 3.6e15) / 2 ** 40;
const TIH_PER_EIH = 1024 * 1024;

export default defineComponent({
  name: "SupplierDashboard",
  components: { HashuLogoIcon, PlannerTab },
  props: {
    mint: { type: Object as PropType<OperatorMint>, required: true },
    snap: { type: Object as PropType<MintSnapshot>, required: true },
  },
  emits: ["changed"],
  data() {
    const s = this.snap.settings || {};
    return {
      form: {
        ask_sats_per_eih: s.ask_sats_per_eih ?? null,
        horizon_hours: s.horizon_hours ?? 24,
        lnurl: s.lnurl ?? "",
        npub: s.npub ?? "",
      },
      busy: "",
      tab: (this.$route.query.tab === "planner" ? "planner" : "overview") as
        | "overview"
        | "planner",
    };
  },
  computed: {
    st(): any {
      return this.snap.supplier || {};
    },
    cap(): any {
      return this.st.capacity || {};
    },
    askHint(): string {
      const a = Number(this.form.ask_sats_per_eih);
      return a > 0 ? `≈ ${fmtSats((a * TIH_PER_THD) / TIH_PER_EIH)}/THd` : "";
    },
  },
  methods: {
    fmtHashes,
    fmtSats,
    fmtThs,
    async save() {
      this.busy = "save";
      try {
        await call(this.mint, "/api/settings", {
          body: {
            ask_sats_per_eih: this.form.ask_sats_per_eih
              ? Math.round(Number(this.form.ask_sats_per_eih))
              : null,
            horizon_hours: Number(this.form.horizon_hours),
            lnurl: this.form.lnurl.trim() || null,
            npub: this.form.npub.trim() || null,
          },
        });
        this.$q.notify({ message: "Saved", position: "top" });
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
    async restock() {
      this.busy = "restock";
      try {
        await call(this.mint, "/api/restock", { method: "POST" });
        this.$q.notify({ message: "Restocked", position: "top" });
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
  },
});
</script>

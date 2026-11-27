<template>
  <div>
    <div class="op-tiles">
      <div class="op-tile op-card">
        <div class="op-tile-label row items-center q-gutter-x-xs">
          <HashuLogoIcon :size="13" /><span>For sale</span>
        </div>
        <div class="op-tile-value">{{ fmtHashes(cap.available_tih) }}</div>
        <div class="op-tile-sub">
          {{ cap.limit ? "What buyers can get now" : "Not capped" }}
        </div>
      </div>
      <div class="op-tile op-card">
        <div class="op-tile-label">Capacity</div>
        <div class="op-tile-value">{{ fmtHashes(cap.capacity_tih) }}</div>
        <div class="op-tile-sub">Rentals left + live stock</div>
      </div>
      <div class="op-tile op-card">
        <div class="op-tile-label">Owed</div>
        <div class="op-tile-value">{{ fmtHashes(cap.owed_tih) }}</div>
        <div class="op-tile-sub">Vouchers out + open redemptions</div>
      </div>
      <div class="op-tile op-card">
        <div class="op-tile-label">Time-limited hashrate</div>
        <div class="op-tile-value">{{ fmtThs(cap.rented_ths) }}</div>
        <div class="op-tile-sub">
          {{ cap.ends_ms ? `Until ${fmtTime(cap.ends_ms)}` : "None" }}
        </div>
      </div>
    </div>

    <div class="op-section-title">Live stock from your rigs</div>
    <div class="op-card q-pa-md">
      <div class="text-body2 op-muted q-mb-md">
        Every hour the stock is topped up to your rigs' average hashrate × the
        horizon, less what is owed. Sales draw it down in between.
      </div>
      <div class="row q-col-gutter-md items-end">
        <div class="col-12 col-sm-6">
          <q-input
            v-model.number="horizon"
            outlined
            dense
            type="number"
            min="1"
            step="1"
            label="Horizon (hours)"
            hint="Empty turns live stock off"
            data-testid="horizon-input"
          />
        </div>
        <div class="col-12 col-sm-6 row q-gutter-sm">
          <q-btn
            unelevated
            no-caps
            color="primary"
            label="Save horizon"
            :loading="busy === 'horizon'"
            @click="saveHorizon"
            data-testid="horizon-save"
          />
          <q-btn
            outline
            no-caps
            label="Restock now"
            :disable="!live.on"
            :loading="busy === 'restock'"
            @click="restock"
          />
        </div>
      </div>
      <q-list dense class="q-mt-md">
        <q-item v-for="row in liveRows" :key="row[0]" class="q-px-none">
          <q-item-section class="op-muted">{{ row[0] }}</q-item-section>
          <q-item-section side>{{ row[1] }}</q-item-section>
        </q-item>
      </q-list>
    </div>

    <div class="op-section-title">Time-limited hashrate</div>
    <div class="op-card q-pa-md">
      <div class="text-body2 op-muted q-mb-sm">
        Hashrate you have only until a set time (borrowed rigs, rentals off
        MiningRigRentals). It sells only until it ends.
      </div>
      <q-list separator>
        <q-item v-for="(r, i) in rentals" :key="i" class="q-px-none">
          <q-item-section>
            <q-item-label
              >{{ r.label || "Hashrate" }} · {{ fmtThs(r.ths) }}</q-item-label
            >
            <q-item-label caption>
              Until {{ fmtTime(r.end_ms) }}
              <template v-if="r.source && r.source !== 'manual'">
                · {{ r.source.toUpperCase() }}</template
              >
            </q-item-label>
          </q-item-section>
          <q-item-section v-if="!r.source || r.source === 'manual'" side>
            <q-btn
              flat
              round
              dense
              icon="delete"
              aria-label="Remove"
              @click="removeRental(i)"
            />
          </q-item-section>
        </q-item>
        <q-item v-if="!rentals.length" class="q-px-none op-muted">None</q-item>
      </q-list>
      <div class="row q-col-gutter-sm q-mt-sm items-end">
        <div class="col-12 col-sm-4">
          <q-input v-model="newLabel" outlined dense label="Label" />
        </div>
        <div class="col-6 col-sm-3">
          <q-input
            v-model.number="newThs"
            outlined
            dense
            type="number"
            min="0"
            step="any"
            label="TH/s"
          />
        </div>
        <div class="col-6 col-sm-3">
          <q-input
            v-model="newEnd"
            outlined
            dense
            type="datetime-local"
            label="Ends"
            stack-label
          />
        </div>
        <div class="col-12 col-sm-2">
          <q-btn
            unelevated
            no-caps
            color="primary"
            class="full-width"
            label="Add"
            :disable="!(newThs > 0) || !newEnd"
            :loading="busy === 'rental'"
            @click="addRental"
          />
        </div>
      </div>
    </div>

    <div class="op-section-title">MiningRigRentals</div>
    <div class="op-card q-pa-md text-body2">
      <template v-if="mrr.connected">
        Connected (key …{{ mrr.key_hint
        }}<template v-if="mrr.rental_ids?.length"
          >, rentals {{ mrr.rental_ids.join(", ") }}</template
        >).
        <span v-if="cap.mrr_synced_ms" class="op-muted"
          >Synced {{ fmtAgo(cap.mrr_synced_ms) }}.</span
        >
      </template>
      <template v-else>Not connected.</template>
      <span class="op-muted"> Change the API key on the</span>
      <a :href="`${mint.api}/`" target="_blank" class="text-primary"
        >full dashboard</a
      >.
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from "vue";
import HashuLogoIcon from "components/icons/HashuLogoIcon.vue";
import { call, type OperatorMint } from "../api";
import type { MintSnapshot } from "../store";
import { fmtAgo, fmtDuration, fmtHashes, fmtThs, fmtTime } from "../format";

export default defineComponent({
  name: "StockTab",
  components: { HashuLogoIcon },
  props: {
    mint: { type: Object as PropType<OperatorMint>, required: true },
    snap: { type: Object as PropType<MintSnapshot>, required: true },
  },
  emits: ["changed"],
  data() {
    return {
      horizon: (this.snap.op?.capacity?.live?.horizon_hours ?? null) as
        | number
        | null
        | "",
      newLabel: "",
      newThs: null as number | null,
      newEnd: "",
      busy: "",
    };
  },
  computed: {
    cap(): any {
      return this.snap.op?.capacity || {};
    },
    live(): any {
      return this.cap.live || {};
    },
    mrr(): any {
      return this.snap.op?.mrr || {};
    },
    rentals(): any[] {
      return this.cap.rentals || [];
    },
    liveRows(): [string, string][] {
      const l = this.live;
      if (!l.on) return [["Live stock", "Off"]];
      const st = l.stock || {};
      const now = this.snap.op?.now_ms || Date.now();
      return [
        ["Your rigs, measured now", fmtThs(l.measured_ths)],
        ["Average (EWMA)", fmtThs(st.ewma_ths)],
        ["This batch", fmtHashes(st.batch_tih)],
        ["Left in this batch", fmtHashes(st.left_tih)],
        [
          "Next restock",
          st.next_restock_ms
            ? st.next_restock_ms > now
              ? `in ${fmtDuration((st.next_restock_ms - now) / 1000)}`
              : "due"
            : "when the rigs report hashrate",
        ],
      ];
    },
  },
  methods: {
    fmtAgo,
    fmtHashes,
    fmtThs,
    fmtTime,
    async post(body: any, what: string, done: string) {
      this.busy = what;
      try {
        await call(this.mint, "/api/capacity", { body });
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
    saveHorizon() {
      const h =
        this.horizon === "" || this.horizon == null
          ? null
          : Number(this.horizon);
      this.post(
        { live_horizon_hours: h },
        "horizon",
        h ? `Horizon set to ${h} h` : "Live stock off"
      );
    },
    restock() {
      this.post({ restock_live: true }, "restock", "Restocked");
    },
    manualRentals(): any[] {
      return this.rentals
        .filter((r) => !r.source || r.source === "manual")
        .map((r) => ({
          ths: r.ths,
          end_ms: r.end_ms,
          label: r.label,
          id: r.id,
        }));
    },
    addRental() {
      const end = new Date(this.newEnd).getTime();
      if (!(end > Date.now())) {
        this.$q.notify({
          type: "negative",
          message: "The end time must be in the future.",
          position: "top",
        });
        return;
      }
      const list = this.manualRentals();
      list.push({
        ths: Number(this.newThs),
        end_ms: end,
        label: this.newLabel.trim(),
        id: "",
      });
      this.post({ rentals: list }, "rental", "Hashrate added").then(() => {
        this.newLabel = "";
        this.newThs = null;
        this.newEnd = "";
      });
    },
    removeRental(i: number) {
      const target = this.rentals[i];
      const list = this.manualRentals().filter(
        (r) =>
          !(
            r.end_ms === target.end_ms &&
            r.ths === target.ths &&
            r.label === target.label
          )
      );
      this.post({ rentals: list }, "rental", "Hashrate removed");
    },
  },
});
</script>

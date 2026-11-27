<template>
  <div>
    <div v-if="error" class="op-card q-pa-md op-muted">{{ error }}</div>
    <div v-else-if="!plan" class="row justify-center q-py-lg">
      <q-spinner size="28px" />
    </div>
    <template v-else>
      <div class="text-body2 op-muted q-mb-md">
        Plan the hashrate you will run in each coming difficulty epoch (2,016
        blocks, about two weeks): a build-out, rigs coming online or going away.
        Future epochs sell against the plan; the current one sells on what your
        rigs measure. The plan is public next to what each epoch delivered, so
        buyers price your promise by how well you keep it. Your rigs measure
        {{ fmtThs(plan.measured_ths) }} now.
      </div>
      <q-list class="op-card" separator>
        <q-item
          v-for="e in plan.upcoming"
          :key="e.epoch"
          data-testid="plan-row"
        >
          <q-item-section>
            <q-item-label class="text-weight-medium">
              {{ e.current ? `Current epoch ${e.epoch}` : `Epoch ${e.epoch}` }}
            </q-item-label>
            <q-item-label caption>
              {{ e.current ? "Started" : "Starts" }}
              {{ fmtTime(e.starts_at * 1000) }}
              <template v-if="e.capacity_tih != null">
                · {{ fmtHashes(e.free_tih) }} free of
                {{ fmtHashes(e.capacity_tih) }}
              </template>
              <template v-if="!e.in_window">
                · beyond the sales horizon</template
              >
            </q-item-label>
          </q-item-section>
          <q-item-section side style="width: 140px">
            <div v-if="e.current" class="text-right">
              {{ fmtThs(plan.measured_ths) }}
              <div class="text-caption op-muted">measured</div>
            </div>
            <q-input
              v-else
              v-model="edits[e.epoch]"
              dense
              outlined
              type="number"
              min="0"
              step="any"
              suffix="TH/s"
              :placeholder="e.planned_ths == null ? 'live avg' : ''"
            />
          </q-item-section>
        </q-item>
      </q-list>
      <div class="row q-gutter-sm q-mt-md">
        <q-btn
          unelevated
          no-caps
          color="primary"
          label="Save plan"
          :disable="!dirty"
          :loading="busy"
          @click="save"
        />
        <q-btn
          flat
          no-caps
          label="Undo changes"
          :disable="!dirty"
          @click="reset"
        />
      </div>

      <template v-if="plan.history?.length">
        <div class="op-section-title">Planned vs delivered</div>
        <q-list class="op-card" separator dense>
          <q-item v-for="h in plan.history" :key="h.epoch">
            <q-item-section
              >Epoch {{ h.epoch
              }}{{ h.current ? " (now)" : "" }}</q-item-section
            >
            <q-item-section side>
              {{ h.planned_ths != null ? fmtThs(h.planned_ths) : "no plan" }} →
              {{ h.delivered_ths != null ? fmtThs(h.delivered_ths) : "–" }}
            </q-item-section>
          </q-item>
        </q-list>
      </template>
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from "vue";
import { call, ApiError, type OperatorMint } from "../api";
import type { MintSnapshot } from "../store";
import { fmtHashes, fmtThs, fmtTime } from "../format";

export default defineComponent({
  name: "PlannerTab",
  props: {
    mint: { type: Object as PropType<OperatorMint>, required: true },
    snap: { type: Object as PropType<MintSnapshot>, required: true },
  },
  data() {
    return {
      plan: null as any,
      error: "",
      edits: {} as Record<string, any>,
      busy: false,
    };
  },
  computed: {
    changes(): Record<string, number | null> {
      const out: Record<string, number | null> = {};
      for (const e of this.plan?.upcoming || []) {
        if (e.current) continue;
        const v = this.edits[e.epoch];
        const next = v === "" || v == null ? null : Number(v);
        if (next !== (e.planned_ths ?? null)) out[e.epoch] = next;
      }
      return out;
    },
    dirty(): boolean {
      return Object.keys(this.changes).length > 0;
    },
  },
  mounted() {
    this.load();
  },
  methods: {
    fmtHashes,
    fmtThs,
    fmtTime,
    async load() {
      try {
        this.plan = await call(this.mint, "/api/plan");
        this.error = "";
        this.reset();
      } catch (e: any) {
        this.error =
          e instanceof ApiError && e.status === 404
            ? "The hashrate planner needs epochs on (HASHU_EPOCHS=true)."
            : e?.message || String(e);
      }
    },
    reset() {
      const ed: Record<string, any> = {};
      for (const e of this.plan?.upcoming || [])
        ed[e.epoch] = e.planned_ths ?? "";
      this.edits = ed;
    },
    async save() {
      this.busy = true;
      try {
        await call(this.mint, "/api/plan", { body: { epochs: this.changes } });
        this.$q.notify({ message: "Plan saved", position: "top" });
        await this.load();
      } catch (e: any) {
        this.$q.notify({
          type: "negative",
          message: e?.message || String(e),
          position: "top",
        });
      } finally {
        this.busy = false;
      }
    },
  },
});
</script>

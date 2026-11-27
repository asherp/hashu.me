<template>
  <div>
    <div v-if="!list.length" class="op-card q-pa-lg text-center op-muted">
      <PickaxeIcon :size="28" class="q-mb-sm" />
      <div>
        No redemptions yet. When a holder redeems, their pool shows up here.
      </div>
    </div>
    <template v-for="group in groups" :key="group.title">
      <div v-if="group.items.length" class="op-section-title">
        {{ group.title }}
      </div>
      <q-list v-if="group.items.length" class="op-card" separator>
        <q-item
          v-for="r in group.items"
          :key="r.id"
          data-testid="redemption-row"
        >
          <q-item-section avatar style="min-width: 36px">
            <PickaxeIcon :size="22" :class="isOpen(r) ? '' : 'op-muted'" />
          </q-item-section>
          <q-item-section>
            <q-item-label class="row items-center no-wrap justify-between">
              <span class="col ellipsis text-weight-medium">{{
                r.worker_name || "Redeemer"
              }}</span>
              <span class="text-weight-bold q-ml-sm">{{
                fmtHashes(r.amount_tih)
              }}</span>
            </q-item-label>
            <q-item-label
              caption
              class="ellipsis op-mono"
              style="font-size: 11px"
            >
              {{ r.pool_url }}
            </q-item-label>
            <q-linear-progress
              v-if="isOpen(r)"
              :value="r.progress || 0"
              rounded
              size="6px"
              color="primary"
              class="q-mt-sm"
            />
            <q-item-label caption class="q-mt-xs">
              <span class="text-weight-medium">{{ stateLabel(r) }}</span>
              · {{ Math.round((r.progress || 0) * 100) }}% ({{
                fmtHashes(r.filled_tih)
              }})
              <template v-if="isOpen(r) && rateOf(r)">
                · {{ fmtRate(rateOf(r)) }} · ETA
                {{ fmtDuration(etaSeconds(r, rateOf(r))) }}
              </template>
              <template v-if="!isOpen(r) && r.completed_ms">
                · {{ fmtTime(r.completed_ms) }}</template
              >
              <template v-else> · opened {{ fmtAgo(r.opened_ms) }}</template>
            </q-item-label>
            <q-item-label v-if="isOpen(r) && (r.rigs || []).length" caption>
              Rigs:
              {{
                r.rigs
                  .map(
                    (g) =>
                      `${rigName(g.rig)} ${
                        g.hashrate_hs != null ? fmtRate(g.hashrate_hs) : ""
                      }`
                  )
                  .join(" · ")
              }}
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from "vue";
import { Pickaxe as PickaxeIcon } from "lucide-vue-next";
import type { OperatorMint } from "../api";
import type { MintSnapshot } from "../store";
import {
  fmtAgo,
  fmtDuration,
  fmtHashes,
  fmtRate,
  fmtTime,
  rigName,
} from "../format";
import { etaSeconds, isOpen, stateLabel } from "../redemptions";

export default defineComponent({
  name: "RedemptionsTab",
  components: { PickaxeIcon },
  props: {
    mint: { type: Object as PropType<OperatorMint>, required: true },
    snap: { type: Object as PropType<MintSnapshot>, required: true },
  },
  computed: {
    list(): any[] {
      return [...(this.snap.op?.redemptions || [])].sort(
        (a, b) => (b.opened_ms || 0) - (a.opened_ms || 0)
      );
    },
    groups() {
      return [
        { title: "Open", items: this.list.filter(isOpen) },
        {
          title: "Finished",
          items: this.list.filter((r) => !isOpen(r)).slice(0, 30),
        },
      ];
    },
  },
  methods: {
    fmtAgo,
    fmtDuration,
    fmtHashes,
    fmtRate,
    fmtTime,
    rigName,
    isOpen,
    stateLabel,
    etaSeconds,
    rateOf(r: any): number {
      return (r.rigs || []).reduce(
        (a: number, g: any) => a + (g.hashrate_hs || 0),
        0
      );
    },
  },
});
</script>

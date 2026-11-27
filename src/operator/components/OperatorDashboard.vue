<template>
  <div>
    <q-tabs
      :model-value="tab"
      dense
      no-caps
      outside-arrows
      mobile-arrows
      align="left"
      active-color="primary"
      indicator-color="primary"
      class="q-mb-md op-tabs"
      @update:model-value="(t) => $emit('update:tab', t)"
    >
      <q-tab name="overview" label="Overview" />
      <q-tab name="redemptions">
        <div class="row items-center no-wrap q-gutter-x-xs">
          <PickaxeIcon :size="16" />
          <span>Redemptions</span>
          <q-badge
            v-if="openCount"
            rounded
            color="primary"
            :label="openCount"
          />
        </div>
      </q-tab>
      <q-tab name="stock" label="Stock" />
      <q-tab v-if="planOn" name="planner" label="Planner" />
      <q-tab name="messages">
        <div class="row items-center no-wrap q-gutter-x-xs">
          <span>Messages</span>
          <q-badge v-if="unread" rounded color="orange-8" :label="unread" />
        </div>
      </q-tab>
      <q-tab name="controls" label="Prices & sales" />
    </q-tabs>

    <OverviewTab v-if="tab === 'overview'" :mint="mint" :snap="snap" />
    <RedemptionsTab
      v-else-if="tab === 'redemptions'"
      :mint="mint"
      :snap="snap"
    />
    <StockTab
      v-else-if="tab === 'stock'"
      :mint="mint"
      :snap="snap"
      @changed="$emit('changed')"
    />
    <PlannerTab v-else-if="tab === 'planner'" :mint="mint" :snap="snap" />
    <MessagesTab
      v-else-if="tab === 'messages'"
      :mint="mint"
      :snap="snap"
      @changed="$emit('changed')"
    />
    <ControlsTab
      v-else-if="tab === 'controls'"
      :mint="mint"
      :snap="snap"
      @changed="$emit('changed')"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from "vue";
import { Pickaxe as PickaxeIcon } from "lucide-vue-next";
import type { OperatorMint } from "../api";
import type { MintSnapshot } from "../store";
import OverviewTab from "./OverviewTab.vue";
import RedemptionsTab from "./RedemptionsTab.vue";
import StockTab from "./StockTab.vue";
import PlannerTab from "./PlannerTab.vue";
import MessagesTab from "./MessagesTab.vue";
import ControlsTab from "./ControlsTab.vue";
import { isOpen } from "../redemptions";

export default defineComponent({
  name: "OperatorDashboard",
  components: {
    PickaxeIcon,
    OverviewTab,
    RedemptionsTab,
    StockTab,
    PlannerTab,
    MessagesTab,
    ControlsTab,
  },
  props: {
    mint: { type: Object as PropType<OperatorMint>, required: true },
    snap: { type: Object as PropType<MintSnapshot>, required: true },
    tab: { type: String, default: "overview" },
  },
  emits: ["update:tab", "changed"],
  computed: {
    openCount(): number {
      return (this.snap.op?.redemptions || []).filter(isOpen).length;
    },
    unread(): number {
      return this.snap.inbox?.unread ?? 0;
    },
    planOn(): boolean {
      // The planner needs epochs; the mint reports them in capacity.
      return this.snap.op?.capacity?.epochs !== false;
    },
  },
});
</script>

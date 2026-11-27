<template>
  <div v-if="alerts.length" class="column q-gutter-y-sm">
    <q-banner
      v-for="a in alerts"
      :key="a.id"
      dense
      rounded
      class="op-alert"
      :class="`op-alert-${a.level}`"
      :data-testid="`alert-${a.id}`"
    >
      <template #avatar>
        <q-icon :name="icon(a.level)" size="20px" />
      </template>
      <div class="text-weight-medium">{{ a.title }}</div>
      <div v-if="a.detail" class="text-caption op-muted">{{ a.detail }}</div>
      <template v-if="a.tab && actionable" #action>
        <q-btn flat dense no-caps label="Open" @click="$emit('open', a)" />
      </template>
    </q-banner>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from "vue";
import type { Alert } from "../alerts";

export default defineComponent({
  name: "AlertList",
  props: {
    alerts: { type: Array as PropType<Alert[]>, required: true },
    actionable: { type: Boolean, default: true },
  },
  emits: ["open"],
  methods: {
    icon(level: string) {
      return level === "error"
        ? "error"
        : level === "warning"
        ? "warning"
        : "info";
    },
  },
});
</script>

<style lang="scss">
.op-alert {
  border: 1px solid rgba(128, 128, 128, 0.3);
  background: rgba(128, 128, 128, 0.08);
}
.op-alert-error {
  border-color: rgba(229, 57, 53, 0.6);
  .q-icon {
    color: #e53935;
  }
}
.op-alert-warning {
  border-color: rgba(251, 140, 0, 0.6);
  .q-icon {
    color: #fb8c00;
  }
}
</style>

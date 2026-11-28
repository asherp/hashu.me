<template>
  <q-page class="op-page" style="max-width: 560px">
    <div class="op-section-title">Hash unit</div>
    <div class="op-card q-pa-md column q-gutter-y-sm">
      <q-select
        v-model="settings.hashuDisplayUnit"
        outlined
        dense
        emit-value
        map-options
        :options="unitOptions"
        label="Show hashes in"
      />
      <q-toggle
        v-model="settings.hashuAutoScaleUnit"
        label="Auto scale (e.g. PHd instead of 1,200 THd)"
      />
      <div class="text-caption op-muted">
        1 TiH = 2⁴⁰ hashes. 1 THh = 1 TH/s for an hour ≈ 3,274 TiH.
      </div>
    </div>

    <div class="op-section-title">Alerts</div>
    <div class="op-card q-pa-md">
      <q-toggle
        :model-value="store.notify && permission === 'granted'"
        label="Notify me (rigs offline, out of stock, redemptions waiting, messages)"
        :disable="permission === 'unsupported' || permission === 'denied'"
        @update:model-value="setNotify"
      />
      <div class="text-caption op-muted q-mt-xs">
        <template v-if="permission === 'denied'"
          >Notifications are blocked for this site in your browser
          settings.</template
        >
        <template v-else-if="permission === 'unsupported'"
          >This browser can't show notifications.</template
        >
        <template v-else
          >Checked every 20 s while the app is open. Install it to your home
          screen for the best results.</template
        >
      </div>
    </div>

    <div class="op-section-title">About</div>
    <q-list class="op-card" dense>
      <q-item>
        <q-item-section class="op-muted">Version</q-item-section>
        <q-item-section side class="op-mono">{{ commit }}</q-item-section>
      </q-item>
      <q-item>
        <q-item-section class="op-muted">Signed into</q-item-section>
        <q-item-section side
          >{{ store.mints.length }} mine{{
            store.mints.length === 1 ? "" : "s"
          }}</q-item-section
        >
      </q-item>
    </q-list>
    <div class="text-caption op-muted q-mt-md">
      Hashu Operator is separate from the Hashu wallet on purpose: operator
      sign-ins stay here, vouchers stay in the wallet.
    </div>
  </q-page>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { useSettingsStore } from "src/stores/settings";
import {
  DISPLAY_UNITS,
  displayUnitLabel,
  type DisplayUnit,
} from "src/js/hashu";
import { useOperatorStore } from "../store";

declare const GIT_COMMIT: string;

export default defineComponent({
  name: "OperatorSettingsPage",
  data() {
    return {
      settings: useSettingsStore(),
      store: useOperatorStore(),
      permission: (typeof Notification === "undefined"
        ? "unsupported"
        : Notification.permission) as string,
    };
  },
  computed: {
    unitOptions() {
      return (Object.keys(DISPLAY_UNITS) as DisplayUnit[]).map((u) => ({
        label: displayUnitLabel(u),
        value: u,
      }));
    },
    commit(): string {
      return typeof GIT_COMMIT !== "undefined" ? GIT_COMMIT : "dev";
    },
  },
  methods: {
    async setNotify(on: boolean) {
      if (
        on &&
        typeof Notification !== "undefined" &&
        Notification.permission !== "granted"
      ) {
        this.permission = await Notification.requestPermission();
      }
      this.store.notify = on && this.permission === "granted";
    },
  },
});
</script>

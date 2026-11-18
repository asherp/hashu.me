<template>
  <div class="pool-settings-form q-gutter-y-md">
    <q-select
      v-model="hashuPoolId"
      :options="poolOptions"
      emit-value
      map-options
      outlined
      rounded
      :label="$t('RedeemPoolDialog.inputs.pool.label')"
      data-testid="pool-select"
    />
    <q-input
      v-if="hashuPoolId === otherPoolId"
      v-model="hashuPoolUrl"
      outlined
      rounded
      autocapitalize="off"
      autocorrect="off"
      spellcheck="false"
      :label="$t('RedeemPoolDialog.inputs.pool_url.label')"
      :hint="$t('RedeemPoolDialog.inputs.pool_url.hint')"
      :error="hashuPoolUrl.length > 0 && !poolUrlValid"
      :error-message="$t('RedeemPoolDialog.inputs.pool_url.invalid')"
      data-testid="pool-url"
    />
    <q-input
      v-model="hashuWorkerName"
      outlined
      rounded
      autocapitalize="off"
      autocorrect="off"
      spellcheck="false"
      :label="$t('RedeemPoolDialog.inputs.worker.label')"
      :placeholder="preset?.worker"
      :hint="preset?.hint"
      data-testid="pool-worker"
    />
    <q-input
      v-model="hashuWorkerPassword"
      outlined
      rounded
      autocapitalize="off"
      autocorrect="off"
      spellcheck="false"
      :label="$t('RedeemPoolDialog.inputs.password.label')"
      data-testid="pool-password"
    />
    <div v-if="guideUrl" class="text-caption">
      <a :href="guideUrl" target="_blank" rel="noopener" class="text-primary">
        {{ $t("RedeemPoolDialog.guide") }}
      </a>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { mapWritableState } from "pinia";
import { useSettingsStore } from "src/stores/settings";
import {
  OTHER_POOL_ID,
  POOL_PRESETS,
  isStratumUrl,
  poolPreset,
  resolvePoolUrl,
} from "src/js/hashu-redeem";
import { DEFAULT_MINT_URL } from "src/js/hashu";

/**
 * The pool and worker that redemptions send hashrate to. Edits save
 * straight to settings, so onboarding, Settings > Pool and the Redeem to
 * pool dialog all show the same choice.
 */
export default defineComponent({
  name: "PoolSettingsForm",
  props: {
    /** Mint whose pool guides to link; defaults to Hashu's own mint. */
    mintUrl: { type: String, default: "" },
  },
  data() {
    return { otherPoolId: OTHER_POOL_ID };
  },
  computed: {
    ...mapWritableState(useSettingsStore, [
      "hashuPoolId",
      "hashuPoolUrl",
      "hashuWorkerName",
      "hashuWorkerPassword",
    ]),
    poolOptions() {
      return [
        ...POOL_PRESETS.map((p) => ({ label: p.name, value: p.id })),
        {
          label: this.$t("RedeemPoolDialog.inputs.other_pool"),
          value: OTHER_POOL_ID,
        },
      ];
    },
    preset() {
      return poolPreset(this.hashuPoolId);
    },
    poolUrlValid(): boolean {
      return isStratumUrl(resolvePoolUrl(this.hashuPoolId, this.hashuPoolUrl));
    },
    guideUrl(): string {
      if (!this.preset) return "";
      const mint = (this.mintUrl || DEFAULT_MINT_URL).replace(/\/+$/, "");
      return `${mint}/redeem/${this.preset.id}/`;
    },
  },
});
</script>

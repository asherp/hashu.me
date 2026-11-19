<template>
  <div class="fallback-pools-form q-gutter-y-md" data-testid="fallback-pools">
    <div class="text-grey-5 text-body2">
      {{ $t("FallbackPools.text") }}
    </div>
    <div
      v-for="(pool, i) in hashuFallbackPools"
      :key="i"
      class="q-gutter-y-sm"
      :data-testid="`fallback-pool-${i}`"
    >
      <div class="row items-center no-wrap">
        <div class="col text-subtitle2">
          {{ $t("FallbackPools.item", { n: i + 1 }) }}
        </div>
        <q-btn
          flat
          dense
          no-caps
          color="primary"
          :label="$t('FallbackPools.remove')"
          :data-testid="`fallback-remove-${i}`"
          @click="remove(i)"
        />
      </div>
      <q-select
        :model-value="pool.poolId"
        :options="poolOptions"
        emit-value
        map-options
        outlined
        rounded
        dense
        :label="$t('RedeemPoolDialog.inputs.pool.label')"
        :data-testid="`fallback-select-${i}`"
        @update:model-value="(v) => update(i, { poolId: v })"
      />
      <q-input
        v-if="pool.poolId === otherPoolId"
        :model-value="pool.poolUrl"
        outlined
        rounded
        dense
        autocapitalize="off"
        autocorrect="off"
        spellcheck="false"
        :label="$t('RedeemPoolDialog.inputs.pool_url.label')"
        :hint="$t('RedeemPoolDialog.inputs.pool_url.hint')"
        :error="pool.poolUrl.length > 0 && !urlValid(pool)"
        :error-message="$t('RedeemPoolDialog.inputs.pool_url.invalid')"
        :data-testid="`fallback-url-${i}`"
        @update:model-value="(v) => update(i, { poolUrl: String(v ?? '') })"
      />
      <q-input
        :model-value="pool.workerName"
        outlined
        rounded
        dense
        autocapitalize="off"
        autocorrect="off"
        spellcheck="false"
        :label="$t('RedeemPoolDialog.inputs.worker.label')"
        :placeholder="preset(pool)?.worker"
        :hint="preset(pool)?.hint"
        :data-testid="`fallback-worker-${i}`"
        @update:model-value="(v) => update(i, { workerName: String(v ?? '') })"
      />
      <q-input
        :model-value="pool.workerPassword"
        outlined
        rounded
        dense
        autocapitalize="off"
        autocorrect="off"
        spellcheck="false"
        :label="$t('RedeemPoolDialog.inputs.password.label')"
        :data-testid="`fallback-password-${i}`"
        @update:model-value="
          (v) => update(i, { workerPassword: String(v ?? '') })
        "
      />
    </div>
    <q-btn
      v-if="hashuFallbackPools.length < max"
      outline
      rounded
      no-caps
      color="primary"
      class="full-width"
      :label="$t('FallbackPools.add')"
      data-testid="fallback-add"
      @click="add"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { mapWritableState } from "pinia";
import { useSettingsStore } from "src/stores/settings";
import {
  MAX_FALLBACK_POOLS,
  OTHER_POOL_ID,
  POOL_PRESETS,
  emptySavedPool,
  isStratumUrl,
  poolPreset,
  resolvePoolUrl,
  type SavedPool,
} from "src/js/hashu-redeem";

/**
 * Backup pools, tried in order when the main pool can't be reached or
 * refuses the work. Saved straight to settings, like PoolSettingsForm.
 */
export default defineComponent({
  name: "FallbackPoolsForm",
  data() {
    return { otherPoolId: OTHER_POOL_ID, max: MAX_FALLBACK_POOLS };
  },
  computed: {
    ...mapWritableState(useSettingsStore, ["hashuFallbackPools"]),
    poolOptions() {
      return [
        ...POOL_PRESETS.map((p) => ({ label: p.name, value: p.id })),
        {
          label: this.$t("RedeemPoolDialog.inputs.other_pool"),
          value: OTHER_POOL_ID,
        },
      ];
    },
  },
  methods: {
    preset(pool: SavedPool) {
      return poolPreset(pool.poolId);
    },
    urlValid(pool: SavedPool): boolean {
      return isStratumUrl(resolvePoolUrl(pool.poolId, pool.poolUrl));
    },
    update(i: number, patch: Partial<SavedPool>) {
      const next = [...this.hashuFallbackPools];
      next[i] = { ...next[i], ...patch };
      this.hashuFallbackPools = next;
    },
    add() {
      if (this.hashuFallbackPools.length >= MAX_FALLBACK_POOLS) return;
      this.hashuFallbackPools = [...this.hashuFallbackPools, emptySavedPool()];
    },
    remove(i: number) {
      this.hashuFallbackPools = this.hashuFallbackPools.filter(
        (_, j) => j !== i
      );
    },
  },
});
</script>

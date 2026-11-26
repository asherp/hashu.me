<template>
  <div
    v-if="index && options.length > 1"
    class="epoch-picker"
    data-testid="epoch-picker"
  >
    <q-select
      :model-value="selectValue"
      :options="options"
      option-value="key"
      emit-value
      map-options
      outlined
      dense
      options-dense
      :label="$t('Epochs.picker.label')"
      popup-content-class="epoch-picker-popup"
      data-testid="epoch-select"
      @update:model-value="onSelect"
    >
      <template #selected-item="scope">
        <div class="column full-width q-py-xs">
          <div class="row no-wrap items-baseline">
            <span class="text-weight-medium ellipsis">{{
              scope.opt.label
            }}</span>
            <q-space />
            <span class="text-caption epoch-picker-sub q-ml-sm">{{
              scope.opt.range
            }}</span>
          </div>
          <span v-if="scope.opt.left" class="text-caption epoch-picker-sub">{{
            scope.opt.left
          }}</span>
        </div>
      </template>
      <template #option="scope">
        <q-item
          v-bind="scope.itemProps"
          :data-testid="`epoch-option-${scope.opt.key}`"
        >
          <q-item-section>
            <q-item-label class="text-weight-medium">{{
              scope.opt.label
            }}</q-item-label>
            <q-item-label v-if="scope.opt.left" caption>{{
              scope.opt.left
            }}</q-item-label>
          </q-item-section>
          <q-item-section side top>
            <q-item-label caption>{{ scope.opt.range }}</q-item-label>
          </q-item-section>
        </q-item>
      </template>
    </q-select>
    <div
      v-if="modelValue !== null"
      class="text-caption text-grey-6 q-mt-xs"
      data-testid="epoch-picker-note"
    >
      {{ $t("Epochs.picker.future_note", { date: selectedDate }) }}
    </div>
  </div>
</template>
<script lang="ts">
import { defineComponent } from "vue";
import { useEpochsStore } from "src/stores/epochs";
import { useSettingsStore } from "src/stores/settings";
import { usePriceStore } from "src/stores/price";
import { formatTih } from "src/js/hashu";
import {
  buyableEpochs,
  epochStartsAt,
  formatEpochDate,
  type HashuEpochRow,
} from "src/js/hashu-epochs";

export default defineComponent({
  name: "EpochPicker",
  props: {
    modelValue: { type: Number, default: null },
    mintUrl: { type: String, required: true },
  },
  emits: ["update:modelValue"],
  computed: {
    index() {
      return useEpochsStore().index(this.mintUrl);
    },
    /**
     * Estimated start of the current epoch: the mint's row gives the start
     * of its sales window (about now), so count back from the tip instead.
     */
    currentStart(): number | undefined {
      const index = this.index;
      const row = index?.epochs.find((r) => r.epoch === index.epoch);
      if (!index || !row || !index.tip_height) return row?.starts_at;
      const blocks = Math.max(0, index.tip_height - row.start_height);
      return Math.floor(Date.now() / 1000) - blocks * 600;
    },
    selectValue(): string {
      return this.modelValue == null ? "now" : String(this.modelValue);
    },
    options(): {
      key: string;
      value: number | null;
      label: string;
      range: string;
      left: string;
    }[] {
      const index = this.index;
      if (!index) return [];
      const unit = useSettingsStore().hashuUnit;
      const fmtLeft = (tih: number | null | undefined) =>
        tih == null
          ? ""
          : this.$t("Epochs.picker.left", {
              free: formatTih(tih, navigator.language, unit),
            });
      // Estimated dates: an epoch ends when the next one starts, else after
      // its 2,016 blocks at ten minutes each.
      const range = (e: number, start: number | undefined, end?: number) => {
        const row = index.epochs.find((r) => r.epoch === e);
        const s = start ?? row?.starts_at;
        const t =
          end ??
          epochStartsAt(index, e + 1) ??
          (row ? row.starts_at + (row.end_height - row.start_height) * 600 : 0);
        return this.$t("Epochs.picker.range", {
          start: formatEpochDate(s),
          end: formatEpochDate(t),
        });
      };
      const now = {
        key: "now",
        value: null,
        label: this.$t("Epochs.picker.now", { epoch: index.epoch }),
        range: range(index.epoch, this.currentStart, index.ends_at),
        left: fmtLeft(usePriceStore().hashuStock[this.mintUrl]?.availableTih),
      };
      const future = buyableEpochs(index).map((e: HashuEpochRow) => ({
        key: String(e.epoch),
        value: e.epoch,
        label: this.$t("Epochs.epoch", { epoch: e.epoch }),
        range: range(e.epoch, e.starts_at),
        left: fmtLeft(e.free_tih ?? 0),
      }));
      return [now, ...future];
    },
    selectedDate(): string {
      const row = this.index?.epochs.find((e) => e.epoch === this.modelValue);
      return formatEpochDate(row?.starts_at);
    },
  },
  methods: {
    onSelect(key: string) {
      const opt = this.options.find((o) => o.key === key);
      this.$emit("update:modelValue", opt ? opt.value : null);
    },
  },
  watch: {
    mintUrl: {
      immediate: true,
      handler(url: string) {
        this.$emit("update:modelValue", null);
        if (url) useEpochsStore().refresh(url);
      },
    },
  },
});
</script>
<style scoped>
.epoch-picker-sub {
  opacity: 0.75;
  line-height: 1.1;
}
.epoch-picker :deep(.q-field__control),
.epoch-picker :deep(.q-field__control:before) {
  border-radius: 16px;
}
.epoch-picker :deep(.q-field__native) {
  min-height: 44px;
}
</style>

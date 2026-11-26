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
        <div class="column q-py-xs ellipsis">
          <span class="text-weight-medium">{{ scope.opt.label }}</span>
          <span class="text-caption epoch-picker-sub">{{ scope.opt.sub }}</span>
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
            <q-item-label caption>{{ scope.opt.sub }}</q-item-label>
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
    selectValue(): string {
      return this.modelValue == null ? "now" : String(this.modelValue);
    },
    options(): {
      key: string;
      value: number | null;
      label: string;
      sub: string;
    }[] {
      const index = this.index;
      if (!index) return [];
      const unit = useSettingsStore().hashuUnit;
      const fmt = (tih: number) => formatTih(tih, navigator.language, unit);
      const left = usePriceStore().hashuStock[this.mintUrl]?.availableTih;
      const ends = formatEpochDate(index.ends_at);
      const now = {
        key: "now",
        value: null,
        label: this.$t("Epochs.picker.now", { epoch: index.epoch }),
        sub:
          left == null
            ? this.$t("Epochs.picker.now_sub", { date: ends })
            : this.$t("Epochs.picker.now_sub_left", {
                date: ends,
                free: fmt(left),
              }),
      };
      const future = buyableEpochs(index).map((e: HashuEpochRow) => ({
        key: String(e.epoch),
        value: e.epoch,
        label: this.$t("Epochs.epoch", { epoch: e.epoch }),
        sub: this.$t("Epochs.picker.future_sub", {
          date: formatEpochDate(e.starts_at),
          free: fmt(e.free_tih ?? 0),
        }),
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

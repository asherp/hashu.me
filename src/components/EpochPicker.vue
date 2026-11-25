<template>
  <div
    v-if="index && options.length > 1"
    class="epoch-picker"
    data-testid="epoch-picker"
  >
    <div class="text-caption text-grey-6 q-mb-xs">
      {{ $t("Epochs.picker.label") }}
    </div>
    <div class="row q-gutter-xs">
      <q-chip
        v-for="opt in options"
        :key="String(opt.value)"
        clickable
        :outline="modelValue !== opt.value"
        :color="modelValue === opt.value ? 'primary' : undefined"
        :text-color="modelValue === opt.value ? 'black' : undefined"
        class="q-ma-none q-mr-xs q-mb-xs"
        :data-testid="`epoch-option-${opt.value ?? 'now'}`"
        @click="$emit('update:modelValue', opt.value)"
      >
        <div class="column">
          <span class="text-weight-medium">{{ opt.label }}</span>
          <span class="text-caption epoch-picker-sub">{{ opt.sub }}</span>
        </div>
      </q-chip>
    </div>
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
    options(): { value: number | null; label: string; sub: string }[] {
      const index = this.index;
      if (!index) return [];
      const unit = useSettingsStore().hashuUnit;
      const now = {
        value: null,
        label: this.$t("Epochs.picker.now"),
        sub: this.$t("Epochs.picker.now_sub", {
          epoch: index.epoch,
          date: formatEpochDate(index.ends_at),
        }),
      };
      const future = buyableEpochs(index).map((e: HashuEpochRow) => ({
        value: e.epoch,
        label: this.$t("Epochs.epoch", { epoch: e.epoch }),
        sub: this.$t("Epochs.picker.future_sub", {
          date: formatEpochDate(e.starts_at),
          free: formatTih(e.free_tih ?? 0, navigator.language, unit),
        }),
      }));
      return [now, ...future];
    },
    selectedDate(): string {
      const row = this.index?.epochs.find((e) => e.epoch === this.modelValue);
      return formatEpochDate(row?.starts_at);
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
.epoch-picker :deep(.q-chip) {
  height: auto;
  padding-top: 4px;
  padding-bottom: 4px;
}
</style>

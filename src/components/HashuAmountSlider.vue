<template>
  <div class="hashu-amount-slider" :data-testid="testid">
    <q-slider
      v-model="position"
      :disable="disable"
      :min="0"
      :max="STEPS"
      :step="1"
      color="primary"
      track-size="6px"
      thumb-size="22px"
      :aria-label="ariaText"
    />
    <div class="row justify-between text-caption text-grey-6 slider-ends">
      <span :data-testid="`${testid}-min`">{{ minLabel }}</span>
      <span :data-testid="`${testid}-max`">{{ maxLabel }}</span>
    </div>
  </div>
</template>
<script lang="ts">
import { defineComponent } from "vue";
import { useSettingsStore } from "src/stores/settings";
import {
  DISPLAY_UNITS,
  formatTih,
  isDisplayUnit,
  type DisplayUnit,
} from "src/js/hashu";

const STEPS = 1000;

/**
 * hashu.me: drag a purchase amount (whole TiH) from the mint's minimum to
 * the most it can sell now. Log scale, so small amounts stay easy to pick
 * when the stock is large; dragging snaps to three significant figures in
 * the display unit, and the ends are exact.
 */
export function tihAtPosition(
  pos: number,
  min: number,
  max: number,
  unitTih = 1
): number {
  if (pos <= 0) return min;
  if (pos >= STEPS) return max;
  const t = min * (max / min) ** (pos / STEPS);
  const snapped = Math.round(Number((t / unitTih).toPrecision(3)) * unitTih);
  return Math.min(max, Math.max(min, snapped || Math.round(t)));
}

export function positionOfTih(tih: number, min: number, max: number): number {
  if (!(max > min)) return 0;
  const t = Math.min(max, Math.max(min, Number(tih) || min));
  return Math.round((STEPS * Math.log(t / min)) / Math.log(max / min));
}

export default defineComponent({
  name: "HashuAmountSlider",
  props: {
    /** Amount in TiH. */
    modelValue: { type: Number, default: 0 },
    min: { type: Number, required: true },
    max: { type: Number, required: true },
    /** Shown but not draggable (e.g. a balance under the minimum). */
    disable: { type: Boolean, default: false },
    testid: { type: String, default: "buy-amount-slider" },
  },
  emits: ["update:modelValue"],
  data() {
    return { STEPS };
  },
  computed: {
    unit(): DisplayUnit {
      const u = useSettingsStore().hashuUnit;
      return isDisplayUnit(u) ? u : "TiH";
    },
    position: {
      get(): number {
        return positionOfTih(this.modelValue, this.min, this.max);
      },
      set(pos: number) {
        this.$emit(
          "update:modelValue",
          tihAtPosition(pos, this.min, this.max, DISPLAY_UNITS[this.unit])
        );
      },
    },
    minLabel(): string {
      return formatTih(this.min, navigator.language, this.unit);
    },
    maxLabel(): string {
      return `${formatTih(this.max, navigator.language, this.unit)} (max)`;
    },
    ariaText(): string {
      return formatTih(this.modelValue || 0, navigator.language, this.unit);
    },
  },
});
</script>
<style scoped>
.hashu-amount-slider {
  width: 100%;
}
.slider-ends {
  margin-top: -4px;
}
</style>

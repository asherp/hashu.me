<template>
  <div class="op-chart">
    <svg
      v-if="path"
      :viewBox="`0 0 ${W} ${H}`"
      preserveAspectRatio="none"
      role="img"
      :aria-label="`Hashrate over the last ${spanMin} minutes`"
    >
      <line
        v-for="g in grid"
        :key="g.y"
        x1="0"
        :x2="W"
        :y1="g.y"
        :y2="g.y"
        class="op-chart-grid"
      />
      <path :d="area" class="op-chart-area" />
      <path :d="path" class="op-chart-line" />
    </svg>
    <div v-else class="op-chart-empty op-muted text-caption">
      Collecting hashrate…
    </div>
    <div v-if="path" class="op-chart-labels">
      <span
        v-for="g in grid"
        :key="g.y"
        :style="{ top: `${(g.y / H) * 100}%` }"
      >
        {{ g.label }}
      </span>
    </div>
    <div v-if="path" class="row justify-between text-caption op-muted q-mt-xs">
      <span>{{ spanMin }} min ago</span>
      <span>now</span>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from "vue";
import { fmtRate } from "../format";
import { slotRates, type WorkSample } from "../hashrate";

type Sample = WorkSample;

export default defineComponent({
  name: "HashrateChart",
  props: {
    samples: { type: Array as PropType<Sample[]>, required: true },
    spanMs: { type: Number, default: 30 * 60_000 },
  },
  data() {
    return { W: 600, H: 160 };
  },
  computed: {
    spanMin(): number {
      return Math.round(this.spanMs / 60_000);
    },
    points(): [number, number][] {
      const last = this.samples[this.samples.length - 1];
      if (!last) return [];
      // Fixed 15 s slots with a trailing 1 min average: drawn points
      // never move when new shares come in.
      return slotRates(this.samples, 15_000, 60_000, last.t_ms - this.spanMs);
    },
    max(): number {
      const m = Math.max(0, ...this.points.map(([, r]) => r));
      if (!m) return 1;
      const mag = 10 ** Math.floor(Math.log10(m));
      return Math.ceil((m * 1.1) / mag) * mag;
    },
    xy(): [number, number][] {
      const last = this.samples[this.samples.length - 1];
      if (!last || this.points.length < 2) return [];
      const t0 = last.t_ms - this.spanMs;
      return this.points.map(([t, r]) => [
        ((t - t0) / this.spanMs) * this.W,
        this.H - (r / this.max) * (this.H - 4),
      ]);
    },
    path(): string {
      return this.xy.length
        ? "M" +
            this.xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L")
        : "";
    },
    area(): string {
      if (!this.xy.length) return "";
      const first = this.xy[0];
      const last = this.xy[this.xy.length - 1];
      return `${this.path}L${last[0].toFixed(1)},${this.H}L${first[0].toFixed(
        1
      )},${this.H}Z`;
    },
    grid(): { y: number; label: string }[] {
      return [1, 0.5].map((f) => ({
        y: this.H - f * (this.H - 4),
        label: fmtRate(this.max * f),
      }));
    },
  },
});
</script>

<style lang="scss">
.op-chart {
  position: relative;
  svg {
    width: 100%;
    height: 160px;
    display: block;
  }
  .op-chart-line {
    fill: none;
    stroke: var(--q-primary);
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
  }
  .op-chart-area {
    fill: var(--q-primary);
    opacity: 0.15;
  }
  .op-chart-grid {
    stroke: rgba(128, 128, 128, 0.3);
    stroke-dasharray: 3 4;
    vector-effect: non-scaling-stroke;
  }
  .op-chart-labels span {
    position: absolute;
    left: 4px;
    transform: translateY(2px);
    font-size: 11px;
    opacity: 0.65;
  }
  .op-chart-empty {
    height: 160px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}
</style>

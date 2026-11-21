<template>
  <q-dialog
    :model-value="modelValue"
    :maximized="$q.screen.lt.sm"
    @update:model-value="$emit('update:modelValue', $event)"
    @show="startFit"
    @hide="stopFit"
  >
    <q-card class="q-pa-lg qcard words-card">
      <div class="row items-center no-wrap q-mb-sm">
        <span class="text-h6 col">{{ title }}</span>
        <q-btn v-close-popup flat round dense icon="close" color="grey" />
      </div>
      <p class="text-grey-5 text-caption q-mb-sm">{{ description }}</p>
      <div
        ref="box"
        class="words-text"
        data-testid="token-words"
      >
        <GlossiaWords :text="words" />
      </div>
      <q-btn
        class="full-width q-mt-md"
        unelevated
        rounded
        color="primary"
        data-testid="copy-token-words"
        :label="$t('DisplayTokenComponent.words.copy')"
        @click="copyText(words)"
      />
    </q-card>
  </q-dialog>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import GlossiaWords from "src/components/GlossiaWords.vue";

declare const windowMixin: any;

const MAX_FONT_PX = 17;
const MIN_FONT_PX = 10;

/** hashu.me: something (a voucher, a payment request) as Glossia words. */
export default defineComponent({
  name: "GlossiaWordsDialog",
  mixins: [windowMixin],
  components: { GlossiaWords },
  props: {
    modelValue: { type: Boolean, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    words: { type: String, required: true },
  },
  emits: ["update:modelValue"],
  data() {
    return {
      fontPx: MAX_FONT_PX,
      observer: null as ResizeObserver | null,
    };
  },
  watch: {
    words() {
      this.fit();
    },
  },
  beforeUnmount() {
    this.stopFit();
  },
  methods: {
    startFit() {
      this.fit();
      const box = this.$refs.box as HTMLElement | undefined;
      if (box && typeof ResizeObserver !== "undefined") {
        this.observer?.disconnect();
        this.observer = new ResizeObserver(() => this.fit());
        this.observer.observe(box);
      }
    },
    stopFit() {
      this.observer?.disconnect();
      this.observer = null;
    },
    /**
     * The largest font (down to a readable minimum) at which the whole
     * paragraph fits without scrolling, so one screenshot or photo holds
     * every word. Below the minimum the box scrolls instead.
     */
    async fit() {
      await this.$nextTick();
      const box = this.$refs.box as HTMLElement | undefined;
      if (!box || !box.clientHeight) return;
      const fits = (px: number) => {
        box.style.fontSize = px + "px";
        return box.scrollHeight <= box.clientHeight + 1;
      };
      let lo = MIN_FONT_PX;
      let hi = MAX_FONT_PX;
      if (fits(hi)) {
        lo = hi;
      } else {
        while (hi - lo > 0.25) {
          const mid = (lo + hi) / 2;
          if (fits(mid)) lo = mid;
          else hi = mid;
        }
      }
      // Set directly (not through a style binding, which would not re-apply
      // an unchanged value after the measuring above).
      this.fontPx = Math.floor(lo * 4) / 4;
      box.style.fontSize = this.fontPx + "px";
    },
  },
});
</script>

<style scoped>
.words-card {
  max-width: 640px;
  display: flex;
  flex-direction: column;
  max-height: 100vh;
}

.words-text {
  font-size: 17px;
  line-height: 1.5;
  white-space: pre-wrap;
  user-select: text;
  flex: 1 1 auto;
  min-height: 0;
  max-height: 70vh;
  overflow-y: auto;
}

/* Phone (maximized dialog): the words take all the height left over. */
.q-dialog__inner--maximized .words-text {
  max-height: none;
}
</style>

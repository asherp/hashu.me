<template>
  <q-dialog
    :model-value="modelValue"
    :maximized="$q.screen.lt.sm"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <q-card class="q-pa-lg qcard words-card">
      <div class="row items-center no-wrap q-mb-sm">
        <span class="text-h6 col">{{ title }}</span>
        <q-btn v-close-popup flat round dense icon="close" color="grey" />
      </div>
      <p class="text-grey-5 text-caption q-mb-sm">{{ description }}</p>
      <div class="words-text" data-testid="token-words">
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
  font-size: 1.05rem;
  line-height: 1.6;
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

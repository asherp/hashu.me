<template>
  <span class="glossia-words"
    ><template v-for="(part, i) in parts" :key="i"
      ><u
        v-if="part.word && payload && payload.has(part.word)"
        class="payload-word"
        data-testid="payload-word"
        >{{ part.text }}</u
      ><template v-else>{{ part.text }}</template></template
    ></span
  >
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, ref } from "vue";
import { payloadWordSet, splitWords } from "src/js/glossia";

/**
 * Glossia words with the payload words (the ones that carry the voucher)
 * underlined. Cover words are left plain.
 */
export default defineComponent({
  name: "GlossiaWords",
  props: {
    text: { type: String, required: true },
  },
  setup(props) {
    const payload = ref<Set<string> | null>(null);
    const parts = computed(() => splitWords(props.text));
    onMounted(async () => {
      try {
        payload.value = await payloadWordSet();
      } catch {
        payload.value = null;
      }
    });
    return { parts, payload };
  },
});
</script>

<style scoped>
.payload-word {
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
}
</style>

<template>
  <!-- Hashu "redeem to pool": an open drop over pool water. -->
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="lucide"
    aria-hidden="true"
  >
    <path d="M12 2c-2 2.5-4 5-4 8a4 4 0 0 0 8 0c0-3-2-5.5-4-8z" />
    <path d="M3 17q2.25-2 4.5 0t4.5 0t4.5 0t4.5 0" />
    <path d="M3 21q2.25-2 4.5 0t4.5 0t4.5 0t4.5 0" />
  </svg>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  name: "PoolDropIcon",
  props: {
    size: { type: [Number, String], default: 24 },
    strokeWidth: { type: [Number, String], default: 2 },
  },
});
</script>

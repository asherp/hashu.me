<template>
  <!-- The Hashu "Hash cup" mark (a # whose two stems close into a u), as
       shipped in public/icons and on hashu.io. Used for redemptions. -->
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="size"
    :height="size"
    viewBox="0 0 32 32"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M10.5 6V20A5.5 5.5 0 0 0 21.5 20V6" stroke-width="3" />
    <path d="M5 11.5H27M5 18H27" stroke-width="2.6" />
  </svg>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  name: "HashuLogoIcon",
  props: {
    size: { type: [Number, String], default: 24 },
  },
});
</script>

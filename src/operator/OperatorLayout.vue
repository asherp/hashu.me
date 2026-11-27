<template>
  <q-layout view="hHh lpR fFf" class="operator-app">
    <q-header class="operator-header">
      <q-toolbar class="operator-toolbar">
        <q-btn
          v-if="$route.path !== '/'"
          flat
          round
          dense
          icon="arrow_back_ios_new"
          aria-label="Back"
          @click="back"
        />
        <router-link v-else to="/" class="row items-center no-wrap brand">
          <HashuLogoIcon :size="26" class="q-mr-sm" />
          <span class="text-weight-bold">Hashu Operator</span>
        </router-link>
        <q-toolbar-title class="text-subtitle1 text-weight-medium ellipsis">
          {{ $route.path !== "/" ? title : "" }}
        </q-toolbar-title>
        <q-btn
          v-if="$route.path === '/'"
          flat
          round
          dense
          icon="settings"
          aria-label="Settings"
          to="/settings"
        />
      </q-toolbar>
    </q-header>
    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import HashuLogoIcon from "components/icons/HashuLogoIcon.vue";
import { useOperatorStore } from "./store";

/** How often every signed-in mint is polled (alerts, home tiles). */
const POLL_MS = 20_000;

export default defineComponent({
  name: "OperatorLayout",
  mixins: [windowMixin],
  components: { HashuLogoIcon },
  data() {
    return { timer: 0 as number };
  },
  computed: {
    title(): string {
      const p = this.$route.path;
      if (p === "/add") return "Sign into a mint";
      if (p === "/settings") return "Settings";
      const id = this.$route.params.id as string | undefined;
      return (id && useOperatorStore().byId(id)?.label) || "";
    },
  },
  mounted() {
    document.title = "Hashu Operator";
    const store = useOperatorStore();
    store.refreshAll();
    this.timer = window.setInterval(() => store.refreshAll(), POLL_MS);
  },
  beforeUnmount() {
    window.clearInterval(this.timer);
  },
  methods: {
    back() {
      if (window.history.state?.back) this.$router.back();
      else this.$router.push("/");
    },
  },
});
</script>

<style lang="scss">
.operator-app {
  // Solid (frosted) bar so scrolled content does not show through the title.
  .operator-header {
    color: inherit;
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(128, 128, 128, 0.15);
  }
  .operator-toolbar {
    max-width: 960px;
    margin: 0 auto;
    width: 100%;
  }
  .brand {
    color: inherit;
    text-decoration: none;
  }
  .op-page {
    max-width: 960px;
    margin: 0 auto;
    padding: 8px 16px 48px;
  }
  .op-card {
    border-radius: 12px;
    border: 1px solid rgba(128, 128, 128, 0.25);
    background: rgba(128, 128, 128, 0.06);
  }
  .op-tiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 10px;
  }
  .op-tile {
    padding: 12px 14px;
    .op-tile-label {
      font-size: 12px;
      opacity: 0.7;
    }
    .op-tile-value {
      font-size: 20px;
      font-weight: 600;
      line-height: 1.3;
      word-break: break-word;
    }
    .op-tile-sub {
      font-size: 12px;
      opacity: 0.6;
    }
  }
  .op-section-title {
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    opacity: 0.7;
    margin: 22px 0 8px;
  }
  .op-muted {
    opacity: 0.65;
  }
  .op-mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    word-break: break-all;
  }
}
</style>
<style lang="scss">
body.body--dark .operator-app .operator-header {
  background: rgba(0, 0, 0, 0.8);
}
</style>

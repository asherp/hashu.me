<template>
  <q-page class="op-page">
    <div v-if="!mint" class="text-center q-py-xl">
      <div class="text-h6">Not signed into this mine</div>
      <q-btn flat no-caps label="Back to mines" to="/" class="q-mt-md" />
    </div>
    <template v-else>
      <div class="row items-center q-mb-sm q-gutter-x-sm">
        <div class="col text-caption op-muted ellipsis">
          {{ mint.kind === "operator" ? "Operator mine" : "Supplier mine" }} ·
          {{ mint.mintUrl }}
          <span v-if="snap?.updatedMs"> · updated {{ ago }}</span>
        </div>
        <q-btn
          flat
          dense
          round
          icon="refresh"
          aria-label="Refresh"
          :loading="refreshing"
          @click="refresh"
        />
        <q-btn flat dense round icon="more_vert" aria-label="More">
          <q-menu auto-close>
            <q-list style="min-width: 220px">
              <q-item clickable :href="dashboardUrl" target="_blank">
                <q-item-section>Open the full dashboard</q-item-section>
                <q-item-section side
                  ><q-icon name="open_in_new"
                /></q-item-section>
              </q-item>
              <q-item
                v-if="mint.kind === 'operator'"
                clickable
                @click="reSignIn"
              >
                <q-item-section>Sign in again</q-item-section>
              </q-item>
              <q-item clickable @click="signOut">
                <q-item-section class="text-negative"
                  >Sign out and remove</q-item-section
                >
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </div>

      <AlertList
        v-if="alerts.length"
        :alerts="alerts"
        class="q-mb-md"
        @open="(a) => (tab = a.tab || tab)"
      />
      <div v-if="snap?.signedOut" class="row justify-center q-my-md">
        <q-btn
          unelevated
          rounded
          no-caps
          color="primary"
          label="Sign in again"
          @click="reSignIn"
        />
      </div>

      <OperatorDashboard
        v-if="mint.kind === 'operator' && snap?.op"
        v-model:tab="tab"
        :mint="mint"
        :snap="snap"
        @changed="refresh"
      />
      <SupplierDashboard
        v-else-if="mint.kind === 'supplier' && snap?.supplier"
        :mint="mint"
        :snap="snap"
        @changed="refresh"
      />
      <div v-else-if="!snap?.error" class="row justify-center q-py-xl">
        <q-spinner size="32px" />
      </div>
    </template>
  </q-page>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { useOperatorStore } from "../store";
import AlertList from "../components/AlertList.vue";
import OperatorDashboard from "../components/OperatorDashboard.vue";
import SupplierDashboard from "../components/SupplierDashboard.vue";
import { fmtAgo } from "../format";

/** How often the open mint is polled. */
const POLL_MS = 5_000;

export default defineComponent({
  name: "OperatorMintPage",
  components: { AlertList, OperatorDashboard, SupplierDashboard },
  data() {
    return {
      store: useOperatorStore(),
      tab: (this.$route.query.tab as string) || "overview",
      refreshing: false,
      timer: 0 as number,
      now: Date.now(),
    };
  },
  computed: {
    id(): string {
      return this.$route.params.id as string;
    },
    mint() {
      return this.store.byId(this.id);
    },
    snap() {
      return this.store.snapshots[this.id];
    },
    alerts() {
      return this.store.alerts[this.id] || [];
    },
    ago(): string {
      return fmtAgo(this.snap?.updatedMs, this.now);
    },
    dashboardUrl(): string {
      return this.mint ? `${this.mint.api}/` : "";
    },
  },
  watch: {
    tab(t: string) {
      this.$router.replace({ query: { ...this.$route.query, tab: t } });
    },
  },
  mounted() {
    this.refresh();
    this.timer = window.setInterval(() => {
      this.now = Date.now();
      if (document.visibilityState === "visible") this.store.refresh(this.id);
    }, POLL_MS);
  },
  beforeUnmount() {
    window.clearInterval(this.timer);
  },
  methods: {
    async refresh() {
      this.refreshing = true;
      await this.store.refresh(this.id);
      this.refreshing = false;
    },
    reSignIn() {
      const m = this.mint;
      if (!m) return;
      this.$router.push({
        path: "/add",
        query: { kind: m.kind, url: m.mintUrl, user: m.user || "operator" },
      });
    },
    signOut() {
      this.$q
        .dialog({
          title: "Sign out of this mine?",
          message: "It is removed from this app. The mine keeps running.",
          cancel: { flat: true, noCaps: true },
          ok: {
            label: "Sign out",
            color: "negative",
            flat: true,
            noCaps: true,
          },
        })
        .onOk(async () => {
          await this.store.signOut(this.id);
          this.$router.replace("/");
        });
    },
  },
});
</script>

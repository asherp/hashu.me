<template>
  <q-page class="op-page">
    <div v-if="!store.mints.length" class="text-center q-py-xl">
      <HashuLogoIcon :size="56" class="q-mb-md" />
      <div class="text-h6">Run your Hashu mint from here</div>
      <div class="op-muted q-mt-sm q-mx-auto" style="max-width: 420px">
        Sign in with your mint's operator password, or a supplier mint's
        dashboard key. Your vouchers stay in the wallet: this app never holds
        any.
      </div>
      <q-btn
        unelevated
        rounded
        no-caps
        color="primary"
        class="q-mt-lg"
        icon="add"
        label="Sign into a mint"
        to="/add"
        data-testid="add-first-mint"
      />
    </div>

    <template v-else>
      <div class="column q-gutter-y-md q-mt-sm">
        <q-card
          v-for="m in store.mints"
          :key="m.id"
          flat
          class="op-card cursor-pointer"
          data-testid="mint-card"
          @click="$router.push(`/mint/${m.id}`)"
        >
          <q-card-section class="q-pb-sm">
            <div class="row items-center no-wrap">
              <q-avatar size="36px" class="q-mr-md mint-avatar">
                <img
                  v-if="iconOf(m)"
                  :src="iconOf(m)"
                  alt=""
                  @error="broken[m.id] = true"
                />
                <HashuLogoIcon v-else :size="22" />
              </q-avatar>
              <div class="col" style="min-width: 0">
                <div class="text-subtitle1 text-weight-medium ellipsis">
                  {{ m.label }}
                </div>
                <div class="text-caption op-muted ellipsis">
                  {{
                    m.kind === "operator" ? "Operator mint" : "Supplier mint"
                  }}
                  · {{ host(m.mintUrl) }}
                </div>
              </div>
              <q-badge
                v-if="warnings(m.id)"
                rounded
                color="orange-8"
                :label="warnings(m.id)"
                class="q-ml-sm"
              />
              <q-icon
                name="chevron_right"
                size="22px"
                class="q-ml-sm op-muted"
              />
            </div>
          </q-card-section>
          <q-card-section class="q-pt-none">
            <div class="op-tiles">
              <div v-for="t in tiles(m)" :key="t.label" class="op-tile op-card">
                <div class="op-tile-label">{{ t.label }}</div>
                <div class="op-tile-value">{{ t.value }}</div>
              </div>
            </div>
          </q-card-section>
          <q-card-section
            v-if="store.alerts[m.id]?.length"
            class="q-pt-none"
            @click.stop
          >
            <AlertList
              :alerts="store.alerts[m.id]"
              @open="(a) => $router.push(`/mint/${m.id}?tab=${a.tab}`)"
            />
          </q-card-section>
        </q-card>
      </div>
      <div class="row justify-center q-mt-lg">
        <q-btn
          outline
          rounded
          no-caps
          icon="add"
          label="Sign into another mint"
          to="/add"
        />
      </div>
    </template>
  </q-page>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import HashuLogoIcon from "components/icons/HashuLogoIcon.vue";
import AlertList from "../components/AlertList.vue";
import { useOperatorStore } from "../store";
import { rigStatus } from "../alerts";
import { fmtHashes, fmtRate, fmtThs } from "../format";
import type { OperatorMint } from "../api";

export default defineComponent({
  name: "OperatorHomePage",
  components: { HashuLogoIcon, AlertList },
  data() {
    return { store: useOperatorStore(), broken: {} as Record<string, boolean> };
  },
  methods: {
    host(u: string) {
      try {
        return new URL(u).host;
      } catch {
        return u;
      }
    },
    iconOf(m: OperatorMint): string | undefined {
      if (this.broken[m.id] || !m.mintUrl.startsWith("https://"))
        return undefined;
      return `${m.mintUrl}/nostr/avatar.png`;
    },
    warnings(id: string): number {
      return (this.store.alerts[id] || []).filter((a) => a.level !== "info")
        .length;
    },
    tiles(m: OperatorMint) {
      const s = this.store.snapshots[m.id];
      if (m.kind === "supplier") {
        const st = s?.supplier;
        return [
          { label: "For sale", value: fmtHashes(st?.capacity?.available_tih) },
          {
            label: "Live hashrate",
            value: fmtThs(st?.capacity?.live?.measured_ths),
          },
          {
            label: "Ask",
            value:
              st?.ask_sats_per_eih != null
                ? `${st.ask_sats_per_eih} sats/EiH`
                : "–",
          },
        ];
      }
      const op = s?.op;
      const rigs = rigStatus(s?.hashrate);
      const open = (op?.redemptions || []).filter(
        (r: any) => r.state === "active" || r.state === "pending"
      ).length;
      return [
        { label: "Hashrate", value: op ? fmtRate(op.proxy?.hashrate_hs) : "–" },
        {
          label: "Rigs online",
          value: op ? `${rigs.filter((r) => r.online).length}` : "–",
        },
        { label: "For sale", value: fmtHashes(op?.capacity?.available_tih) },
        { label: "Open redemptions", value: op ? `${open}` : "–" },
      ];
    },
  },
});
</script>

<style lang="scss">
.mint-avatar {
  background: rgba(128, 128, 128, 0.15);
}
</style>

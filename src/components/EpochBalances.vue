<template>
  <div v-if="show" class="epoch-balances q-mt-md" data-testid="epoch-balances">
    <div
      v-for="row in rows"
      :key="`${row.status}:${row.epoch}`"
      class="epoch-row row items-center no-wrap q-px-md q-py-xs"
      :class="`epoch-row--${row.status}`"
      :data-testid="`epoch-row-${row.status}`"
      :data-epoch="row.epoch ?? 'perpetual'"
    >
      <PickaxeIcon
        v-if="row.status === 'current'"
        :size="18"
        class="q-mr-sm text-grey-6"
      />
      <q-icon
        v-else
        :name="icon(row.status)"
        size="xs"
        class="q-mr-sm"
        :color="row.status === 'expired' ? 'warning' : 'grey-6'"
      />
      <div class="col text-left">
        <div class="text-weight-medium">{{ title(row) }}</div>
        <div class="text-caption text-grey-6">{{ subtitle(row) }}</div>
      </div>
      <div class="text-right q-ml-sm">
        <div class="text-weight-bold">{{ amount(row.amount) }}</div>
        <q-btn
          v-if="row.status === 'expired'"
          flat
          dense
          no-caps
          size="sm"
          color="primary"
          :loading="converting === row.epoch"
          :label="$t('Epochs.convert.action')"
          :data-testid="`epoch-convert-${row.epoch}`"
          @click="convert(row)"
        />
      </div>
    </div>
    <div class="row justify-center q-mt-xs" v-if="canBuy">
      <q-btn
        flat
        dense
        no-caps
        size="sm"
        color="primary"
        icon="event"
        :label="$t('Epochs.buy.action')"
        data-testid="epoch-buy"
        @click="showCreateInvoiceDialog = true"
      />
    </div>
  </div>
</template>
<script lang="ts">
import { defineComponent } from "vue";
import { mapWritableState } from "pinia";
import { useEpochsStore } from "src/stores/epochs";
import { useUiStore } from "src/stores/ui";
import { useSettingsStore } from "src/stores/settings";
import { formatTih } from "src/js/hashu";
import {
  buyableEpochs,
  formatEpochDate,
  type EpochBalanceRow,
  type EpochStatus,
} from "src/js/hashu-epochs";
import { notifyApiError, notifySuccess } from "src/js/notify";
import { Pickaxe as PickaxeIcon } from "lucide-vue-next";

export default defineComponent({
  name: "EpochBalances",
  components: { PickaxeIcon },
  props: {
    mintUrl: { type: String, required: true },
  },
  data() {
    return {
      converting: null as number | null,
      timer: null as ReturnType<typeof setInterval> | null,
    };
  },
  computed: {
    ...mapWritableState(useUiStore, ["showCreateInvoiceDialog"]),
    index() {
      return useEpochsStore().index(this.mintUrl);
    },
    rows(): EpochBalanceRow[] {
      return useEpochsStore().balances(this.mintUrl);
    },
    canBuy(): boolean {
      return !!this.index && buyableEpochs(this.index).length > 0;
    },
    show(): boolean {
      if (!this.index) return false;
      // Nothing to explain when everything is in the current epoch.
      return this.rows.some((r) => r.status !== "current") || this.canBuy;
    },
  },
  watch: {
    mintUrl: {
      immediate: true,
      handler(url: string) {
        if (url) useEpochsStore().refresh(url);
      },
    },
  },
  mounted() {
    const store = useEpochsStore();
    store.resumePending();
    this.timer = setInterval(() => store.tick(), 60_000);
  },
  beforeUnmount() {
    if (this.timer) clearInterval(this.timer);
  },
  methods: {
    amount(tih: number): string {
      return formatTih(
        tih,
        navigator.language,
        useSettingsStore().hashuDisplayUnit
      );
    },
    icon(status: EpochStatus): string {
      return {
        current: "",
        future: "schedule",
        expired: "history",
        perpetual: "all_inclusive",
      }[status];
    },
    title(row: EpochBalanceRow): string {
      if (row.status === "perpetual") return this.$t("Epochs.perpetual");
      return this.$t("Epochs.epoch", { epoch: row.epoch });
    },
    subtitle(row: EpochBalanceRow): string {
      const date = formatEpochDate(row.at);
      switch (row.status) {
        case "current":
          return this.$t("Epochs.status.current", { date });
        case "future":
          return this.$t("Epochs.status.future", { date });
        case "expired":
          return this.$t("Epochs.status.expired");
        default:
          return this.$t("Epochs.status.perpetual");
      }
    },
    async convert(row: EpochBalanceRow) {
      const store = useEpochsStore();
      const proofs = store.expiredProofs(this.mintUrl, row.epoch ?? undefined);
      if (!proofs.length) return;
      this.converting = row.epoch;
      try {
        const res = await store.convert(this.mintUrl, proofs, "auto");
        notifySuccess(
          this.$t("Epochs.convert.done", {
            amount: this.amount(res.amount),
            epoch: res.epoch,
          })
        );
      } catch (e) {
        notifyApiError(e, this.$t("Epochs.convert.failed"));
      } finally {
        this.converting = null;
      }
    },
  },
});
</script>
<style scoped>
.epoch-balances {
  max-width: 420px;
  width: calc(100% - 32px);
  margin-left: auto;
  margin-right: auto;
  border-radius: 12px;
  border: 1px solid rgba(128, 128, 128, 0.25);
  padding: 6px 0;
}
.epoch-row--future {
  opacity: 0.8;
}
</style>

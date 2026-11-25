<template>
  <q-dialog
    v-model="showRedeemPoolDialog"
    position="bottom"
    :maximized="$q.screen.lt.sm"
    transition-show="slide-up"
    transition-hide="slide-down"
    @hide="reset"
  >
    <q-card class="drawer-card text-white full-width-card q-pb-lg">
      <q-card-section class="row items-center q-pb-sm">
        <q-btn flat round dense v-close-popup class="q-ml-sm" color="primary">
          <XIcon />
        </q-btn>
        <div class="col text-center">
          <span class="text-h6">{{ $t("RedeemPoolDialog.title") }}</span>
        </div>
        <div style="width: 40px" />
      </q-card-section>

      <!-- form -->
      <q-card-section v-if="!started" class="q-pa-md q-gutter-y-md">
        <div
          class="redeem-from row items-center no-wrap"
          data-testid="redeem-from"
        >
          <div class="text-grey-5 text-caption q-mr-sm">
            {{ $t("RedeemPoolDialog.from") }}
          </div>
          <div class="col ellipsis">
            <span class="text-weight-medium">{{ sheetMintName }}</span>
            <span
              v-if="sheetMintHost !== sheetMintName"
              class="text-grey-5 q-ml-xs"
              >{{ sheetMintHost }}</span
            >
          </div>
          <div v-if="true" class="text-grey-5 text-caption q-ml-sm">
            {{
              $t("RedeemPoolDialog.balance", {
                balance: formatCurrency(balance, "tih"),
              })
            }}
          </div>
        </div>
        <div class="text-grey-5 text-body2">
          {{ $t("RedeemPoolDialog.text") }}
        </div>
        <PoolSettingsForm :mint-url="activeMintUrl" />
        <q-expansion-item
          dense
          dense-toggle
          expand-separator
          :label="backupLabel"
          header-class="text-primary q-px-none"
          data-testid="redeem-backups"
        >
          <div class="q-pt-sm">
            <FallbackPoolsForm />
          </div>
        </q-expansion-item>
        <div
          v-if="backupsUnsupported"
          class="text-grey-5 text-caption"
          data-testid="redeem-backups-unsupported"
        >
          {{ $t("FallbackPools.unsupported") }}
        </div>
        <q-input
          v-model.number="amountTih"
          type="number"
          inputmode="numeric"
          outlined
          rounded
          :label="$t('RedeemPoolDialog.inputs.amount.label')"
          :hint="amountHint"
          :error="amountError !== ''"
          :error-message="amountError"
          data-testid="redeem-amount"
        />
        <HashuAmountSlider
          v-if="balance > 0"
          :model-value="Number(amountTih) || 0"
          :min="minTih"
          :max="balance"
          :disable="balance < minTih"
          testid="redeem-amount-slider"
          @update:model-value="(v: number) => (amountTih = v)"
        />
        <div
          v-if="balance > 0 && balance < minTih"
          class="text-grey-5 text-caption"
          data-testid="redeem-below-min"
        >
          {{
            $t("MintDetailsDialog.details.eta.below_min", {
              min: formatCurrency(minTih, "tih"),
            })
          }}
        </div>
        <div
          v-if="estimateText"
          class="text-grey-5 text-body2"
          data-testid="redeem-estimate"
        >
          {{ estimateText }}
        </div>
        <q-btn
          rounded
          unelevated
          color="primary"
          class="full-width"
          :loading="busy"
          :disable="!canRedeem"
          :label="$t('RedeemPoolDialog.actions.redeem.label')"
          data-testid="redeem-submit"
          @click="redeem"
        />
      </q-card-section>

      <!-- status -->
      <q-card-section v-else class="q-pa-md q-gutter-y-md">
        <div
          class="redeem-from row items-center no-wrap"
          data-testid="redeem-from"
        >
          <div class="text-grey-5 text-caption q-mr-sm">
            {{ $t("RedeemPoolDialog.from") }}
          </div>
          <div class="col ellipsis">
            <span class="text-weight-medium">{{ sheetMintName }}</span>
            <span
              v-if="sheetMintHost !== sheetMintName"
              class="text-grey-5 q-ml-xs"
              >{{ sheetMintHost }}</span
            >
          </div>
        </div>
        <div class="text-body1" data-testid="redeem-status">
          {{
            settled
              ? settledText
              : $t("RedeemPoolDialog.status.opened", {
                  worker: trackedWorker || workerName,
                })
          }}
        </div>
        <div
          v-if="backupNotice"
          class="text-warning text-body2"
          data-testid="redeem-on-backup"
        >
          {{ backupNotice }}
        </div>
        <template v-if="progress">
          <q-linear-progress
            rounded
            size="10px"
            color="primary"
            instant-feedback
            :value="progressRatio"
          />
          <div class="text-grey-5 text-body2">
            {{
              progress.filled_tih > 0
                ? $t("RedeemPoolDialog.status.progress", {
                    filled: formatCurrency(progress.filled_tih, "tih"),
                    amount: formatCurrency(progress.amount_tih, "tih"),
                  })
                : $t("RedeemPoolDialog.status.waiting")
            }}
          </div>
        </template>
        <div
          v-if="rateText"
          class="text-grey-5 text-body2"
          data-testid="redeem-rate"
        >
          {{ rateText }}
        </div>
        <div v-else-if="progressUnavailable" class="text-grey-5 text-body2">
          {{ $t("RedeemPoolDialog.status.no_progress") }}
        </div>
        <div
          v-if="entry"
          class="redeem-details text-body2"
          data-testid="redeem-details"
        >
          <div v-for="row in detailRows" :key="row.label" class="row no-wrap">
            <div class="text-grey-5 q-mr-md">{{ row.label }}</div>
            <div class="col text-right ellipsis">{{ row.value }}</div>
          </div>
        </div>
        <div v-if="!settled" class="text-grey-6 text-caption">
          {{ $t("RedeemPoolDialog.status.background") }}
        </div>
        <q-btn
          rounded
          outline
          color="primary"
          class="full-width"
          v-close-popup
          :label="$t('RedeemPoolDialog.actions.close.label')"
        />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { mapActions, mapState, mapWritableState } from "pinia";
import axios from "axios";
import { MeltQuoteState } from "@cashu/cashu-ts";
import { X as XIcon } from "lucide-vue-next";
import { useUiStore } from "src/stores/ui";
import { useMintsStore } from "src/stores/mints";
import { useWalletStore } from "src/stores/wallet";
import { usePriceStore } from "src/stores/price";
import { useSettingsStore } from "src/stores/settings";
import PoolSettingsForm from "src/components/PoolSettingsForm.vue";
import FallbackPoolsForm from "src/components/FallbackPoolsForm.vue";
import HashuAmountSlider from "src/components/HashuAmountSlider.vue";
import {
  isStratumUrl,
  resolvePoolUrl,
  fallbackPoolsFor,
  redemptionId,
  estimateRedeemSeconds,
  formatDuration,
  formatHashrate,
  secondsLeft,
  trackRate,
  redemptionUrl,
  redemptionEntries,
  poolHost,
  poolLabel,
  shortDate,
  type RedemptionEntry,
  type RedemptionProgress,
} from "src/js/hashu-redeem";
import { TIH_PER_PIH, formatTih, isDisplayUnit } from "src/js/hashu";

const POLL_MS = 5000;
/** How often the open form refreshes the mint's hashrate and queue. */
const INFO_MS = 30000;

export default defineComponent({
  name: "RedeemPoolDialog",
  components: {
    XIcon,
    PoolSettingsForm,
    FallbackPoolsForm,
    HashuAmountSlider,
  },
  mixins: [windowMixin],
  data() {
    return {
      amountTih: null as number | null,
      busy: false,
      started: false,
      settled: false,
      quoteId: "",
      progress: null as RedemptionProgress | null,
      progressUnavailable: false,
      pollTimer: null as ReturnType<typeof setInterval> | null,
      infoTimer: null as ReturnType<typeof setInterval> | null,
      progressUrl: "",
      trackedWorker: "",
      trackedMint: "",
    };
  },
  computed: {
    ...mapWritableState(useUiStore, [
      "showRedeemPoolDialog",
      "redeemPoolQuote",
    ]),
    ...mapState(useMintsStore, ["activeMintUrl", "activeBalance", "mints"]),
    /** The mint this sheet redeems from: the redemption's own when
     * reopened from the Redemptions tab, else the active mint. */
    /** This redemption as the wallet's history has it (updates when it
     * settles). */
    entry(): RedemptionEntry | undefined {
      if (!this.quoteId) return undefined;
      return redemptionEntries(useWalletStore().invoiceHistory as any[]).find(
        (e) => e.quote === this.quoteId,
      );
    },
    /** What happened, in the amounts the wallet knows: delivered (from
     * the mint's progress when it has it, else what was charged), to
     * which pool, and the change if delivery stopped early. */
    settledText(): string {
      const e = this.entry;
      const t = (k: string, a?: Record<string, string>) =>
        this.$t(`RedeemPoolDialog.status.${k}`, a ?? {});
      if (!e || e.chargedTih == null) return t("settled");
      const p = this.progress;
      const delivered =
        p && p.filled_tih != null
          ? Math.min(p.filled_tih, e.chargedTih)
          : e.chargedTih;
      const pool = poolHost(e.poolUrl);
      const args = {
        delivered: this.formatCurrency(delivered, "tih"),
        pool,
        change: this.formatCurrency(e.changeTih ?? 0, "tih"),
      };
      return (e.changeTih ?? 0) > 0
        ? t("stopped_change", args)
        : t("delivered", args);
    },
    detailRows(): { label: string; value: string }[] {
      const e = this.entry;
      if (!e) return [];
      const t = (k: string) => this.$t(`RedeemPoolDialog.details.${k}`);
      const rows = [
        { label: t("pool"), value: poolLabel(e.poolUrl) },
        { label: t("worker"), value: e.workerName },
        { label: t("amount"), value: this.formatCurrency(e.amountTih, "tih") },
      ];
      if (e.chargedTih != null) {
        rows.push(
          {
            label: t("charged"),
            value: this.formatCurrency(e.chargedTih, "tih"),
          },
          {
            label: t("change"),
            value: this.formatCurrency(e.changeTih ?? 0, "tih"),
          },
        );
      }
      rows.push({ label: t("started"), value: shortDate(e.date) });
      if (e.paidDate)
        rows.push({ label: t("finished"), value: shortDate(e.paidDate) });
      return rows;
    },
    sheetMintUrl(): string {
      return this.trackedMint || this.activeMintUrl;
    },
    sheetMintHost(): string {
      try {
        return new URL(this.sheetMintUrl).host;
      } catch {
        return this.sheetMintUrl;
      }
    },
    sheetMintName(): string {
      const m = (this.mints as any[]).find((x) => x.url === this.sheetMintUrl);
      return m?.nickname || m?.info?.name || this.sheetMintHost;
    },
    ...mapState(usePriceStore, [
      "hashuPrices",
      "hashuDelivery",
      "hashuMaxFallbackPools",
    ]),
    ...mapState(useSettingsStore, {
      poolId: "hashuPoolId",
      poolUrl: "hashuPoolUrl",
      workerName: "hashuWorkerName",
      workerPassword: "hashuWorkerPassword",
      savedFallbacks: "hashuFallbackPools",
    }),
    /** Backup pools the active mint takes (0 if it takes none). */
    maxFallbacks(): number {
      return this.hashuMaxFallbackPools[this.activeMintUrl] ?? 0;
    },
    /** Saved backups that are complete, in order. */
    readyFallbacks() {
      return fallbackPoolsFor(this.savedFallbacks);
    },
    /** What this redemption sends: none to a mint that doesn't take them. */
    sentFallbacks() {
      return this.readyFallbacks.slice(0, this.maxFallbacks);
    },
    backupsUnsupported(): boolean {
      return this.readyFallbacks.length > 0 && this.maxFallbacks === 0;
    },
    backupLabel(): string {
      const n = this.readyFallbacks.length;
      return n
        ? this.$t("FallbackPools.summary", { n })
        : this.$t("FallbackPools.summary_none");
    },
    backupNotice(): string {
      const p = this.progress;
      if (!p || this.settled || !(Number(p.serving_pool) > 0)) return "";
      return this.$t("FallbackPools.on_backup", {
        pool: p.serving_pool_url ?? "",
      });
    },
    resolvedPoolUrl(): string {
      return resolvePoolUrl(this.poolId, this.poolUrl);
    },
    poolUrlValid(): boolean {
      return isStratumUrl(this.resolvedPoolUrl);
    },
    minTih(): number {
      return this.hashuPrices[this.activeMintUrl]?.minRedeemTih || TIH_PER_PIH;
    },
    balance(): number {
      return Number(this.activeBalance) || 0;
    },
    amountError(): string {
      const a = this.amountTih;
      if (a == null || (a as any) === "") return "";
      if (!Number.isInteger(a) || a < this.minTih) {
        return this.$t("RedeemPoolDialog.inputs.amount.min", {
          min: formatTih(this.minTih, navigator.language),
        });
      }
      if (a > this.balance) {
        return this.$t("RedeemPoolDialog.inputs.amount.too_much", {
          balance: formatTih(this.balance, navigator.language),
        });
      }
      return "";
    },
    amountHint(): string {
      const unit = useSettingsStore().hashuUnit;
      if (!this.amountTih || !isDisplayUnit(unit) || unit === "TiH") return "";
      return formatTih(this.amountTih, navigator.language, unit);
    },
    canRedeem(): boolean {
      return (
        !this.busy &&
        this.poolUrlValid &&
        this.workerName.trim().length > 0 &&
        this.amountTih != null &&
        this.amountError === ""
      );
    },
    delivery() {
      return this.hashuDelivery[this.activeMintUrl];
    },
    estimateText(): string {
      const d = this.delivery;
      const a = this.amountTih;
      if (!d || !a || a <= 0 || this.amountError !== "") return "";
      const secs = estimateRedeemSeconds(a, d);
      if (secs == null) return this.$t("RedeemPoolDialog.estimate.no_hashrate");
      let t = this.$t("RedeemPoolDialog.estimate.time", {
        time: formatDuration(secs),
        rate: formatHashrate(
          d.hashrate_hs,
          useSettingsStore().hashuUnit,
          navigator.language,
        ),
      });
      if (d.queue_tih >= 1) {
        t +=
          " " +
          this.$t("RedeemPoolDialog.estimate.queue", {
            queue: this.formatCurrency(Math.round(d.queue_tih), "tih"),
          });
      }
      if (d.capacityEndsMs && Date.now() + secs * 1000 > d.capacityEndsMs) {
        t += " " + this.$t("RedeemPoolDialog.estimate.past_rental");
      }
      return t;
    },
    rateText(): string {
      const p = this.progress;
      if (!p?.track || this.settled) return "";
      const rate = trackRate(p.track, p.now_ms ?? Date.now());
      if (!(rate > 0)) return "";
      const left = secondsLeft(p);
      const unit = useSettingsStore().hashuUnit;
      return left == null
        ? formatHashrate(rate, unit, navigator.language)
        : this.$t("RedeemPoolDialog.status.rate", {
            rate: formatHashrate(rate, unit, navigator.language),
            time: formatDuration(left),
          });
    },
    progressRatio(): number {
      const p = this.progress;
      if (!p || !p.amount_tih) return 0;
      return Math.min(1, p.filled_tih / p.amount_tih);
    },
  },
  watch: {
    showRedeemPoolDialog(open: boolean) {
      if (open && this.redeemPoolQuote) this.resume(this.redeemPoolQuote);
      else if (open) this.startInfo();
      else this.stopInfo();
    },
  },
  beforeUnmount() {
    this.stopPolling();
    this.stopInfo();
  },
  methods: {
    ...mapActions(useWalletStore, ["redeemToPool", "checkOutgoingInvoice"]),
    ...mapActions(usePriceStore, ["fetchHashuInfo"]),
    startInfo() {
      this.stopInfo();
      this.fetchHashuInfo(this.activeMintUrl);
      this.infoTimer = setInterval(() => {
        if (!this.started) this.fetchHashuInfo(this.activeMintUrl);
      }, INFO_MS);
    },
    stopInfo() {
      if (this.infoTimer) clearInterval(this.infoTimer);
      this.infoTimer = null;
    },
    async redeem() {
      if (!this.canRedeem) return;
      this.busy = true;
      try {
        const res = await this.redeemToPool({
          poolUrl: this.resolvedPoolUrl,
          workerName: this.workerName,
          workerPassword: this.workerPassword,
          amountTih: this.amountTih as number,
          fallbackPools: this.sentFallbacks,
        });
        this.quoteId = res.quote.quote;
        this.trackedMint = this.activeMintUrl;
        this.started = true;
        this.settled = res.state === MeltQuoteState.PAID;
        this.progressUrl = redemptionUrl(
          this.activeMintUrl,
          await redemptionId(res.request),
        );
        this.startPolling();
      } catch (error) {
        console.error(error);
      } finally {
        this.busy = false;
      }
    },
    /** Show the progress of a redemption started earlier (from the
     * Redemptions tab), on whichever mint it went to. */
    async resume(quote: string) {
      this.stopPolling();
      const entry = redemptionEntries(
        useWalletStore().invoiceHistory as any[],
      ).find((e) => e.quote === quote);
      if (!entry) return;
      this.quoteId = entry.quote;
      this.trackedWorker = entry.workerName;
      this.trackedMint = entry.mint;
      this.started = true;
      this.settled = !entry.active;

      this.progress = null;
      this.progressUnavailable = false;
      this.progressUrl = redemptionUrl(
        entry.mint,
        await redemptionId(entry.request),
      );
      // A finished one: the history has what it cost and the change;
      // read the mint's delivered total once, quietly, for the summary.
      if (entry.active) this.startPolling();
      else this.fetchFinalProgress();
    },
    redemptionPaid(): boolean {
      const entry = (useWalletStore().invoiceHistory as any[]).find(
        (i) => i.quote === this.quoteId,
      );
      return entry?.status === "paid";
    },
    async fetchFinalProgress() {
      const url = this.progressUrl;
      try {
        const { data } = await axios.get<RedemptionProgress>(url, {
          timeout: 5000,
        });
        if (this.progressUrl === url) this.progress = data;
      } catch {
        // The summary falls back to what was charged.
      }
    },
    startPolling() {
      this.stopPolling();
      this.poll();
      this.pollTimer = setInterval(() => this.poll(), POLL_MS);
    },
    stopPolling() {
      if (this.pollTimer) clearInterval(this.pollTimer);
      this.pollTimer = null;
    },
    async poll() {
      try {
        const { data } = await axios.get<RedemptionProgress>(this.progressUrl, {
          timeout: 5000,
        });
        this.progress = data;
        this.progressUnavailable = false;
        if (data.state === "completed" || data.state === "settled") {
          // Delivery ended: fetch the change now instead of waiting for the
          // background checker, unless that already did.
          if (!this.redemptionPaid()) {
            try {
              await this.checkOutgoingInvoice(this.quoteId, false);
            } catch {
              // the mint signs change shortly after; try again next poll
            }
          }
          if (this.redemptionPaid()) {
            this.settled = true;
            this.stopPolling();
          }
        }
      } catch {
        // Not a Hashu mint we can read progress from (e.g. a supplier
        // mint), or the redemption isn't open yet.
        if (!this.progress) this.progressUnavailable = true;
      }
    },
    reset() {
      this.stopPolling();
      this.stopInfo();
      if (this.started) {
        this.started = false;
        this.settled = false;
        this.progress = null;
        this.progressUnavailable = false;
        this.amountTih = null;
        this.quoteId = "";
        this.trackedWorker = "";
      }
      this.trackedMint = "";
      this.redeemPoolQuote = "";
    },
  },
});
</script>

<style scoped>
.redeem-details {
  border-top: 1px solid rgba(128, 128, 128, 0.3);
  padding-top: 8px;
}
.redeem-details > div {
  padding: 3px 0;
}
.redeem-from {
  border: 1px solid rgba(128, 128, 128, 0.3);
  border-radius: 10px;
  padding: 8px 12px;
}
</style>

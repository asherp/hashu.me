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
        <div class="text-grey-5 text-body2">
          {{ $t("RedeemPoolDialog.text") }}
        </div>
        <q-select
          v-model="poolId"
          :options="poolOptions"
          emit-value
          map-options
          outlined
          rounded
          :label="$t('RedeemPoolDialog.inputs.pool.label')"
          data-testid="redeem-pool-select"
        />
        <q-input
          v-if="poolId === 'other'"
          v-model="poolUrl"
          outlined
          rounded
          :label="$t('RedeemPoolDialog.inputs.pool_url.label')"
          :hint="$t('RedeemPoolDialog.inputs.pool_url.hint')"
          :error="poolUrl.length > 0 && !poolUrlValid"
          :error-message="$t('RedeemPoolDialog.inputs.pool_url.invalid')"
          data-testid="redeem-pool-url"
        />
        <q-input
          v-model="workerName"
          outlined
          rounded
          :label="$t('RedeemPoolDialog.inputs.worker.label')"
          :placeholder="preset?.worker"
          :hint="preset?.hint"
          data-testid="redeem-worker"
        />
        <q-input
          v-model="workerPassword"
          outlined
          rounded
          :label="$t('RedeemPoolDialog.inputs.password.label')"
          data-testid="redeem-password"
        />
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
        <div v-if="guideUrl" class="text-caption">
          <a
            :href="guideUrl"
            target="_blank"
            rel="noopener"
            class="text-primary"
          >
            {{ $t("RedeemPoolDialog.guide") }}
          </a>
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
        <div class="text-body1" data-testid="redeem-status">
          {{
            settled
              ? $t("RedeemPoolDialog.status.settled")
              : $t("RedeemPoolDialog.status.opened", { worker: workerName })
          }}
        </div>
        <template v-if="progress">
          <q-linear-progress
            rounded
            size="10px"
            color="primary"
            :value="progressRatio"
          />
          <div class="text-grey-5 text-body2">
            {{
              settled && progress.change_tih != null
                ? $t("RedeemPoolDialog.status.charged", {
                    spent: formatCurrency(progress.spent_tih ?? 0, "tih"),
                    change: formatCurrency(progress.change_tih, "tih"),
                  })
                : progress.filled_tih > 0
                ? $t("RedeemPoolDialog.status.progress", {
                    filled: formatCurrency(progress.filled_tih, "tih"),
                    amount: formatCurrency(progress.amount_tih, "tih"),
                  })
                : $t("RedeemPoolDialog.status.waiting")
            }}
          </div>
        </template>
        <div v-else-if="progressUnavailable" class="text-grey-5 text-body2">
          {{ $t("RedeemPoolDialog.status.no_progress") }}
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
import {
  POOL_PRESETS,
  isStratumUrl,
  redemptionId,
  redemptionUrl,
  type RedemptionProgress,
} from "src/js/hashu-redeem";
import { TIH_PER_PIH, formatTih, isDisplayUnit } from "src/js/hashu";

const POLL_MS = 5000;

export default defineComponent({
  name: "RedeemPoolDialog",
  components: { XIcon },
  mixins: [windowMixin],
  data() {
    return {
      poolId: POOL_PRESETS[0].id as string,
      poolUrl: "",
      workerName: "",
      workerPassword: "",
      amountTih: null as number | null,
      busy: false,
      started: false,
      settled: false,
      quoteId: "",
      progress: null as RedemptionProgress | null,
      progressUnavailable: false,
      pollTimer: null as ReturnType<typeof setInterval> | null,
      progressUrl: "",
    };
  },
  computed: {
    ...mapWritableState(useUiStore, ["showRedeemPoolDialog"]),
    ...mapState(useMintsStore, ["activeMintUrl", "activeBalance"]),
    ...mapState(usePriceStore, ["hashuPrices"]),
    poolOptions() {
      return [
        ...POOL_PRESETS.map((p) => ({ label: p.name, value: p.id })),
        {
          label: this.$t("RedeemPoolDialog.inputs.other_pool"),
          value: "other",
        },
      ];
    },
    preset() {
      return POOL_PRESETS.find((p) => p.id === this.poolId);
    },
    resolvedPoolUrl(): string {
      return this.preset ? this.preset.url : this.poolUrl.trim();
    },
    poolUrlValid(): boolean {
      return isStratumUrl(this.resolvedPoolUrl);
    },
    guideUrl(): string {
      if (!this.preset || !this.activeMintUrl) return "";
      return `${this.activeMintUrl.replace(/\/+$/, "")}/redeem/${
        this.preset.id
      }/`;
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
      const unit = useSettingsStore().hashuDisplayUnit;
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
    progressRatio(): number {
      const p = this.progress;
      if (!p || !p.amount_tih) return 0;
      return Math.min(1, p.filled_tih / p.amount_tih);
    },
  },
  watch: {
    showRedeemPoolDialog(open: boolean) {
      if (open) this.fetchHashuPrice(this.activeMintUrl);
    },
  },
  beforeUnmount() {
    this.stopPolling();
  },
  methods: {
    ...mapActions(useWalletStore, ["redeemToPool", "checkOutgoingInvoice"]),
    ...mapActions(usePriceStore, ["fetchHashuPrice"]),
    async redeem() {
      if (!this.canRedeem) return;
      this.busy = true;
      try {
        const res = await this.redeemToPool({
          poolUrl: this.resolvedPoolUrl,
          workerName: this.workerName,
          workerPassword: this.workerPassword,
          amountTih: this.amountTih as number,
        });
        this.quoteId = res.quote.quote;
        this.started = true;
        this.settled = res.state === MeltQuoteState.PAID;
        this.progressUrl = redemptionUrl(
          this.activeMintUrl,
          await redemptionId(res.request)
        );
        this.startPolling();
      } catch (error) {
        console.error(error);
      } finally {
        this.busy = false;
      }
    },
    redemptionPaid(): boolean {
      const entry = (useWalletStore().invoiceHistory as any[]).find(
        (i) => i.quote === this.quoteId
      );
      return entry?.status === "paid";
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
      if (this.started) {
        this.started = false;
        this.settled = false;
        this.progress = null;
        this.progressUnavailable = false;
        this.amountTih = null;
        this.quoteId = "";
      }
    },
  },
});
</script>

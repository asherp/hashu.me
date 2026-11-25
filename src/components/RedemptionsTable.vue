<template>
  <div class="q-pa-xs" style="max-width: 500px; margin: 0 auto">
    <div
      v-if="!entries.length"
      class="text-center q-py-lg q-px-md"
      data-testid="redemptions-empty"
    >
      <div class="text-body1">{{ $t("RedemptionsTable.empty_text") }}</div>
      <div class="text-grey-6 text-body2 q-mt-sm">
        {{ $t("RedemptionsTable.empty_hint") }}
      </div>
    </div>

    <q-list v-else class="text-left">
      <template v-if="active.length">
        <q-item-label header class="q-px-md q-pb-xs">
          {{ $t("RedemptionsTable.active") }}
        </q-item-label>
        <q-item
          v-for="r in active"
          :key="r.quote"
          clickable
          v-ripple
          class="q-px-md q-py-md"
          data-testid="redemption-active"
          @click="open(r)"
        >
          <q-item-section avatar class="q-pr-md" style="min-width: 40px">
            <q-avatar size="32px">
              <PickaxeIcon class="redemption-icon" />
            </q-avatar>
          </q-item-section>
          <q-item-section>
            <q-item-label class="row items-center justify-between no-wrap">
              <div class="col ellipsis text-weight-medium">
                {{ r.workerName || poolLabel(r.poolUrl) }}
              </div>
              <div class="text-weight-bold text-grey-6 q-ml-sm">
                {{ formatCurrency(r.amountTih, "tih") }}
              </div>
            </q-item-label>
            <q-item-label caption class="ellipsis text-grey-6">
              {{ poolLabel(r.poolUrl) }} · {{ mintHost(r.mint) }}
            </q-item-label>
            <q-linear-progress
              rounded
              size="6px"
              :color="pausedBy(r) ? 'grey-6' : 'primary'"
              class="q-mt-sm"
              instant-feedback
              :value="ratio(r)"
            />
            <q-item-label
              caption
              class="q-mt-xs text-grey-6"
              data-testid="redemption-progress"
            >
              <q-badge
                v-if="pausedBy(r)"
                outline
                color="warning"
                class="q-mr-xs"
                data-testid="redemption-paused"
                :label="$t(`RedemptionsTable.paused_${pausedBy(r)}`)"
              />
              {{ progressText(r) }}
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-icon name="chevron_right" color="grey-6" />
          </q-item-section>
        </q-item>
      </template>

      <template v-if="past.length">
        <q-item-label header class="q-px-md q-pb-xs">
          {{ $t("RedemptionsTable.past") }}
        </q-item-label>
        <q-item
          v-for="r in shownPast"
          :key="r.quote"
          clickable
          v-ripple
          class="q-px-md q-py-md"
          data-testid="redemption-past"
          @click="open(r)"
        >
          <q-item-section avatar class="q-pr-md" style="min-width: 40px">
            <q-avatar size="32px">
              <PickaxeIcon class="redemption-icon text-grey-6" />
            </q-avatar>
          </q-item-section>
          <q-item-section>
            <q-item-label class="row items-center justify-between no-wrap">
              <div class="col ellipsis text-weight-medium">
                {{ r.workerName || poolLabel(r.poolUrl) }}
              </div>
              <div class="text-weight-bold q-ml-sm">
                -{{ formatCurrency(r.chargedTih ?? 0, "tih") }}
              </div>
            </q-item-label>
            <q-item-label caption class="ellipsis text-grey-6">
              {{ poolLabel(r.poolUrl) }} · {{ mintHost(r.mint) }}
            </q-item-label>
            <q-item-label caption class="text-grey-6">
              {{
                $t("RedemptionsTable.charged", {
                  spent: formatCurrency(r.chargedTih ?? 0, "tih"),
                  change: formatCurrency(r.changeTih ?? 0, "tih"),
                })
              }}
            </q-item-label>
            <q-item-label caption class="text-grey-6">
              {{
                r.paidDate
                  ? $t("RedemptionsTable.finished", {
                      start: shortDate(r.date),
                      end: shortDate(r.paidDate),
                    })
                  : shortDate(r.date)
              }}
            </q-item-label>
          </q-item-section>
        </q-item>
        <div v-if="past.length > shownPast.length" class="text-center q-py-sm">
          <q-btn
            flat
            rounded
            no-caps
            color="primary"
            :label="$t('RedemptionsTable.show_more')"
            @click="pastLimit += PAGE"
          />
        </div>
      </template>
    </q-list>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { mapActions, mapState, mapWritableState } from "pinia";
import axios from "axios";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Pickaxe as PickaxeIcon } from "lucide-vue-next";
import { useWalletStore } from "src/stores/wallet";
import { useUiStore } from "src/stores/ui";
import {
  redemptionEntries,
  redemptionId,
  redemptionUrl,
  poolLabel,
  shortDate,
  secondsLeft,
  formatDuration,
  type RedemptionEntry,
  type RedemptionProgress,
} from "src/js/hashu-redeem";

const POLL_MS = 10000;
const PAGE = 10;

export default defineComponent({
  name: "RedemptionsTable",
  components: { PickaxeIcon },
  mixins: [windowMixin],
  data() {
    return {
      PAGE,
      pastLimit: PAGE,
      progress: {} as Record<string, RedemptionProgress>,
      unavailable: {} as Record<string, boolean>,
      urls: {} as Record<string, string>,
      timer: null as ReturnType<typeof setInterval> | null,
    };
  },
  computed: {
    ...mapState(useWalletStore, ["invoiceHistory"]),
    ...mapWritableState(useUiStore, [
      "showRedeemPoolDialog",
      "redeemPoolQuote",
    ]),
    entries(): RedemptionEntry[] {
      return redemptionEntries(this.invoiceHistory as any[]);
    },
    active(): RedemptionEntry[] {
      return this.entries.filter((e) => e.active);
    },
    past(): RedemptionEntry[] {
      return this.entries.filter((e) => !e.active);
    },
    shownPast(): RedemptionEntry[] {
      return this.past.slice(0, this.pastLimit);
    },
  },
  mounted() {
    this.poll();
    this.timer = setInterval(() => this.poll(), POLL_MS);
  },
  beforeUnmount() {
    if (this.timer) clearInterval(this.timer);
  },
  methods: {
    ...mapActions(useWalletStore, ["checkOutgoingInvoice"]),
    poolLabel,
    mintHost(url: string): string {
      try {
        return new URL(url).host;
      } catch {
        return url;
      }
    },
    shortDate,
    ratio(r: RedemptionEntry): number {
      const p = this.progress[r.quote];
      if (!p || !p.amount_tih) return 0;
      return Math.min(1, p.filled_tih / p.amount_tih);
    },
    /** "redeemer" or "operator" while paused, else "". */
    pausedBy(r: RedemptionEntry): string {
      const by = this.progress[r.quote]?.paused_by;
      return by === "operator" || by === "redeemer" ? by : "";
    },
    progressText(r: RedemptionEntry): string {
      const started = this.$t("RedemptionsTable.started", {
        date: formatDistanceToNow(parseISO(r.date), { addSuffix: true }),
      });
      if (this.unavailable[r.quote]) {
        return `${this.$t("RedemptionsTable.no_progress")} · ${started}`;
      }
      const p = this.progress[r.quote];
      if (!p || !(p.filled_tih > 0)) {
        return `${this.$t("RedemptionsTable.waiting")} · ${started}`;
      }
      let t = this.$t("RedemptionsTable.progress", {
        filled: this.formatCurrency(p.filled_tih, "tih"),
        amount: this.formatCurrency(p.amount_tih, "tih"),
      });
      const left = this.pausedBy(r) ? null : secondsLeft(p);
      if (left != null) {
        t +=
          " · " +
          this.$t("RedemptionsTable.left", { time: formatDuration(left) });
      }
      return t;
    },
    async urlFor(r: RedemptionEntry): Promise<string> {
      if (!this.urls[r.quote]) {
        this.urls[r.quote] = redemptionUrl(
          r.mint,
          await redemptionId(r.request)
        );
      }
      return this.urls[r.quote];
    },
    async poll() {
      await Promise.all(this.active.map((r) => this.pollOne(r)));
    },
    async pollOne(r: RedemptionEntry) {
      try {
        const { data } = await axios.get<RedemptionProgress>(
          await this.urlFor(r),
          { timeout: 5000 }
        );
        this.progress[r.quote] = data;
        this.unavailable[r.quote] = false;
        if (data.state === "completed" || data.state === "settled") {
          // Delivery ended: collect the change now rather than waiting for
          // the background checker. It moves the row to Past once paid.
          try {
            await this.checkOutgoingInvoice(r.quote, false);
          } catch {
            // change is signed shortly after; next poll tries again
          }
        }
      } catch {
        if (!this.progress[r.quote]) this.unavailable[r.quote] = true;
      }
    },
    open(r: RedemptionEntry) {
      this.redeemPoolQuote = r.quote;
      this.showRedeemPoolDialog = true;
    },
  },
});
</script>

<style scoped>
.redemption-icon {
  width: 22px;
  height: 22px;
}
</style>

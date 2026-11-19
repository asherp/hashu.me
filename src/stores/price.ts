import { defineStore } from "pinia";
import { useSettingsStore } from "./settings";
import { useLocalStorage } from "@vueuse/core";
import axios from "axios";
import {
  hashuInfoUrl,
  type HashuMintPrice,
  type MintDelivery,
} from "src/js/hashu";

export const usePriceStore = defineStore("price", {
  state: () => ({
    bitcoinPrice: useLocalStorage("cashu.price.bitcoinPrice", 0 as number),
    bitcoinPriceLastUpdated: useLocalStorage(
      "cashu.price.bitcoinPriceLastUpdated",
      0 as number
    ),
    bitcoinPriceMinRefreshInterval: 60_000,
    bitcoinPrices: useLocalStorage(
      "cashu.price.bitcoinPrices",
      {} as Record<string, number>
    ),
    // hashu.me: msat per PiH by mint URL, from each Hashu mint's
    // /checkout/api/info. Missing for mints that don't publish a price.
    hashuPrices: useLocalStorage(
      "hashu.price.msatPerPih",
      {} as Record<
        string,
        { msatPerPih: number; minRedeemTih?: number; updated: number }
      >
    ),
    // Delivery figures by mint URL, for redemption time estimates. Not
    // persisted: they go stale in minutes.
    hashuDelivery: {} as Record<
      string,
      MintDelivery & { capacityEndsMs?: number; updated: number }
    >,
    // Backup pools each Hashu mint takes per redemption (0 = none, so the
    // wallet leaves them out of the request). Not persisted.
    hashuMaxFallbackPools: {} as Record<string, number>,
  }),
  actions: {
    fetchBitcoinPrice: async function () {
      const settingsStore = useSettingsStore();
      if (!settingsStore.getBitcoinPrice) {
        this.bitcoinPrice = 0;
        this.bitcoinPriceLastUpdated = 0;
        this.bitcoinPrices = {};
        console.log("Not fetching bitcoin price, disabled in settings");
        return;
      }
      if (
        Date.now() - this.bitcoinPriceLastUpdated <
        this.bitcoinPriceMinRefreshInterval
      ) {
        console.log(
          `Not fetching bitcoin price, last updated ${
            Date.now() - this.bitcoinPriceLastUpdated
          }ms ago: ${this.bitcoinPrice}`
        );
        return;
      }
      try {
        const { data } = await axios.get(
          "https://api.coinbase.com/v2/exchange-rates?currency=BTC"
        );
        this.bitcoinPrices = data.data.rates;
        // Update the main bitcoinPrice to current selected currency for backward compatibility
        this.bitcoinPrice =
          data.data.rates[settingsStore.bitcoinPriceCurrency] ||
          data.data.rates.USD;
        this.bitcoinPriceLastUpdated = Date.now();
      } catch (error) {
        console.error("Failed to fetch bitcoin price:", error);
      }
    },
    /** Fetch a Hashu mint's voucher price; quietly skips non-Hashu mints. */
    fetchHashuPrice: async function (mintUrl: string) {
      if (!mintUrl) return;
      const cached = this.hashuPrices[mintUrl];
      if (
        cached &&
        Date.now() - cached.updated < this.bitcoinPriceMinRefreshInterval
      ) {
        return;
      }
      await this.fetchHashuInfo(mintUrl);
    },
    /** Fetch a Hashu mint's info now: its price and delivery figures. */
    fetchHashuInfo: async function (mintUrl: string) {
      if (!mintUrl) return;
      try {
        const { data } = await axios.get<HashuMintPrice>(
          hashuInfoUrl(mintUrl),
          { timeout: 5000 }
        );
        this.hashuMaxFallbackPools = {
          ...this.hashuMaxFallbackPools,
          [mintUrl]: Math.max(
            0,
            Math.floor(Number(data?.max_fallback_pools) || 0)
          ),
        };
        const d = data?.delivery;
        // hashrate_hs is null while the mint has seen no shares yet.
        if (d && typeof d === "object") {
          this.hashuDelivery = {
            ...this.hashuDelivery,
            [mintUrl]: {
              hashrate_hs: Number(d.hashrate_hs) || 0,
              window_s: d.window_s,
              queue_tih: Number(d.queue_tih) || 0,
              open_redemptions: Number(d.open_redemptions) || 0,
              capacityEndsMs: Number(data?.capacity_ends_ms) || undefined,
              updated: Date.now(),
            },
          };
        }
        const msatPerPih = Number(data?.msat_per_pih);
        if (!Number.isFinite(msatPerPih) || msatPerPih <= 0) return;
        this.hashuPrices = {
          ...this.hashuPrices,
          [mintUrl]: {
            msatPerPih,
            minRedeemTih: Number(data?.min_redeem_tih) || undefined,
            updated: Date.now(),
          },
        };
      } catch (error) {
        console.debug(`No Hashu info from ${mintUrl}:`, error);
      }
    },
    msatPerPihForMint: function (mintUrl: string): number {
      return this.hashuPrices[mintUrl]?.msatPerPih || 0;
    },
    updateBitcoinPriceForCurrentCurrency: function () {
      const settingsStore = useSettingsStore();
      // Update the main bitcoinPrice to reflect the current selected currency
      this.bitcoinPrice =
        this.bitcoinPrices[settingsStore.bitcoinPriceCurrency] ||
        this.bitcoinPrice;
    },
  },
  getters: {
    currentCurrencyPrice(): number {
      const settingsStore = useSettingsStore();
      return (
        this.bitcoinPrices[settingsStore.bitcoinPriceCurrency] ||
        this.bitcoinPrice
      );
    },
  },
});

import { defineStore } from "pinia";
import { useSettingsStore } from "./settings";
import { useLocalStorage } from "@vueuse/core";
import axios from "axios";
import { hashuInfoUrl, type HashuMintPrice } from "src/js/hashu";

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
      {} as Record<string, { msatPerPih: number; updated: number }>
    ),
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
      try {
        const { data } = await axios.get<HashuMintPrice>(
          hashuInfoUrl(mintUrl),
          { timeout: 5000 }
        );
        const msatPerPih = Number(data?.msat_per_pih);
        if (!Number.isFinite(msatPerPih) || msatPerPih <= 0) return;
        this.hashuPrices = {
          ...this.hashuPrices,
          [mintUrl]: { msatPerPih, updated: Date.now() },
        };
      } catch (error) {
        console.debug(`No Hashu price from ${mintUrl}:`, error);
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

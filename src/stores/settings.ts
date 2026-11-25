import {
  DEFAULT_DISPLAY_UNIT,
  autoScaleDisplayUnit,
  isDisplayUnit,
  type DisplayUnit,
} from "src/js/hashu";
import { DEFAULT_MONEY_UNIT, type MoneyUnit } from "src/js/money";
import { POOL_PRESETS, type SavedPool } from "src/js/hashu-redeem";
import { defineStore } from "pinia";
import { useMintsStore } from "src/stores/mints";
import { useLocalStorage } from "@vueuse/core";

const defaultNostrRelays = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.primal.net",
];

export const useSettingsStore = defineStore("settings", {
  state: () => {
    return {
      getBitcoinPrice: useLocalStorage<boolean>(
        "cashu.settings.getBitcoinPrice",
        true
      ),
      bitcoinPriceCurrency: useLocalStorage<string>(
        "cashu.settings.bitcoinPriceCurrency",
        "USD"
      ),
      checkSentTokens: useLocalStorage<boolean>(
        "cashu.settings.checkSentTokens",
        true
      ),
      checkIncomingInvoices: useLocalStorage<boolean>(
        "cashu.settings.checkIncomingInvoices",
        true
      ),
      periodicallyCheckIncomingInvoices: useLocalStorage<boolean>(
        "cashu.settings.periodicallyCheckIncomingInvoices",
        true
      ),
      checkInvoicesOnStartup: useLocalStorage<boolean>(
        "cashu.settings.checkInvoicesOnStartup",
        true
      ),
      useWebsockets: useLocalStorage<boolean>(
        "cashu.settings.useWebsockets",
        true
      ),
      defaultNostrRelays: useLocalStorage<string[]>(
        "cashu.settings.defaultNostrRelays",
        defaultNostrRelays
      ),
      includeFeesInSendAmount: useLocalStorage<boolean>(
        "cashu.settings.includeFeesInSendAmount",
        false
      ),
      nfcEncoding: useLocalStorage<string>(
        "cashu.settings.nfcEncoding",
        "weburl"
      ),
      useNumericKeyboard: useLocalStorage<boolean>(
        "cashu.settings.useNumericKeyboard",
        false
      ),
      enableReceiveSwaps: useLocalStorage<boolean>(
        "cashu.settings.enableReceiveSwaps",
        true
      ),
      showNfcButtonInDrawer: useLocalStorage(
        "cashu.ui.showNfcButtonInDrawer",
        true
      ),
      autoPasteEcashReceive: useLocalStorage(
        "cashu.settings.autoPasteEcashReceive",
        true
      ),
      auditorEnabled: useLocalStorage<boolean>(
        "cashu.settings.auditorEnabled",
        true
      ),
      auditorUrl: useLocalStorage<string>(
        "cashu.settings.auditorUrl",
        "https://audit.8333.space"
      ),
      auditorApiUrl: useLocalStorage<string>(
        "cashu.settings.auditorApiUrl",
        "https://api.audit.8333.space"
      ),
      // hashu.me: unit for showing bitcoin amounts and prices (sat, ₿, BTC,
      // msat). Replaces Cashu.me's "Use ₿ symbol" toggle (cashu.settings.bip177).
      moneyUnit: useLocalStorage<MoneyUnit>(
        "hashu.settings.moneyUnit",
        DEFAULT_MONEY_UNIT
      ),
      // hashu.me: unit for showing TiH amounts (TiH, PiH, EiH, THh, PHh, THd, PHd).
      hashuDisplayUnit: useLocalStorage<DisplayUnit>(
        "hashu.settings.displayUnit",
        DEFAULT_DISPLAY_UNIT
      ),
      // hashu.me: auto scale, on by default. Shows hashes in the chosen
      // unit's family at the scale of the wallet balance (e.g. PHd instead
      // of 1,200 THd).
      hashuAutoScaleUnit: useLocalStorage<boolean>(
        "hashu.settings.autoScaleUnit",
        true
      ),
      // hashu.me: the pool and worker that redemptions send hashrate to.
      // Set during onboarding or in Settings > Pool, used by Redeem to pool.
      hashuPoolId: useLocalStorage<string>(
        "hashu.settings.poolId",
        POOL_PRESETS[0].id
      ),
      hashuPoolUrl: useLocalStorage<string>("hashu.settings.poolUrl", ""),
      hashuWorkerName: useLocalStorage<string>("hashu.settings.workerName", ""),
      hashuWorkerPassword: useLocalStorage<string>(
        "hashu.settings.workerPassword",
        ""
      ),
      // Backup pools, tried in order when the main pool can't be reached
      // or refuses the work. Same fields as the main pool.
      hashuFallbackPools: useLocalStorage<SavedPool[]>(
        "hashu.settings.fallbackPools",
        []
      ),
      multinutEnabled: useLocalStorage<boolean>(
        "cashu.settings.multinutEnabled",
        false
      ),
      nostrMintBackupEnabled: useLocalStorage<boolean>(
        "cashu.settings.nostrMintBackupEnabled",
        true
      ),
    };
  },
  getters: {
    /**
     * hashu.me: the unit to show hashes in right now. The chosen display
     * unit, or with auto scale on, its family member that suits the
     * wallet balance in TiH across mints.
     */
    hashuUnit(state): DisplayUnit {
      const chosen = isDisplayUnit(state.hashuDisplayUnit)
        ? state.hashuDisplayUnit
        : DEFAULT_DISPLAY_UNIT;
      if (!state.hashuAutoScaleUnit) return chosen;
      return autoScaleDisplayUnit(chosen, useMintsStore().totalTihBalance);
    },
  },
});

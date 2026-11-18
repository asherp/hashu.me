import { DEFAULT_DISPLAY_UNIT, type DisplayUnit } from "src/js/hashu";
import { POOL_PRESETS } from "src/js/hashu-redeem";
import { defineStore } from "pinia";
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
      bip177BitcoinSymbol: useLocalStorage<boolean>(
        "cashu.settings.bip177",
        true
      ),
      // hashu.me: unit for showing TiH amounts (TiH, PiH, EiH, THH).
      hashuDisplayUnit: useLocalStorage<DisplayUnit>(
        "hashu.settings.displayUnit",
        DEFAULT_DISPLAY_UNIT
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
});

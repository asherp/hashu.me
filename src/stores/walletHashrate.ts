import type { Wallet } from "@cashu/cashu-ts";
import { MeltQuoteState } from "@cashu/cashu-ts";
import { useMintsStore } from "./mints";
import { type MutexPriority } from "src/stores/ui";
import { PaymentMethod } from "src/stores/walletTypes";
import { notifyApiError } from "src/js/notify";
import { type AppMeltQuote, normalizeMeltQuote } from "./walletMelt";
import {
  HASHRATE_METHOD,
  hashrateRequest,
  randomNonce,
  stopHashFor,
  stopSecretFor,
  type FallbackPoolRequest,
  poolTihOf,
  samePoolTih,
  type PoolTih,
  type RedemptionProgress,
} from "src/js/hashu-redeem";
import { UNIT_TIH } from "src/js/hashu";
import { usePaymentHistoryStore } from "src/stores/paymentHistory";

/** Save the mint's per-pool totals with the redemption's history entry,
 * so the wallet keeps a record of which pools got its hashes after the
 * mint stops reporting them. Writes only when they changed. */
export async function rememberPoolTih(
  quote: string,
  saved: PoolTih[],
  progress: RedemptionProgress | null | undefined
): Promise<void> {
  const next = poolTihOf(progress);
  if (!next.length || samePoolTih(saved, next)) return;
  try {
    await usePaymentHistoryStore().updatePayment(quote, { poolTih: next });
  } catch (e) {
    console.warn("could not save per-pool totals", e);
  }
}

export type RedeemToPoolInput = {
  poolUrl: string;
  workerName: string;
  workerPassword?: string;
  amountTih: number;
  /** Backup pools, in order. Leave empty for mints that don't take them. */
  fallbackPools?: FallbackPoolRequest[];
  /** Put a stop key in the request so the wallet can stop, pause and
   * resume it. Only for mints that advertise `redeemer_controls`: older
   * ones refuse unknown fields. */
  stopKey?: boolean;
};

/** Ask the active mint for a `hashrate` melt quote. */
export async function meltQuoteHashrate(
  this: any,
  input: RedeemToPoolInput
): Promise<{ quote: AppMeltQuote; request: string; mintWallet: Wallet }> {
  const mintStore = useMintsStore();
  const mintWallet: Wallet = await this.mintWallet(
    mintStore.activeMintUrl,
    UNIT_TIH,
    true
  );
  const nonce = randomNonce();
  const stopHash = input.stopKey
    ? await stopHashFor(await stopSecretFor(this.seed, nonce))
    : undefined;
  const request = hashrateRequest(
    input.poolUrl,
    input.workerName,
    input.amountTih,
    input.workerPassword,
    nonce,
    input.fallbackPools ?? [],
    stopHash
  );
  try {
    // cdk's custom-method handler also wants the method in the body.
    const raw = await mintWallet.createMeltQuote(HASHRATE_METHOD, {
      request,
      method: HASHRATE_METHOD,
    });
    const quote = normalizeMeltQuote(raw as any);
    quote.request = request;
    return { quote, request, mintWallet };
  } catch (error) {
    notifyApiError(error, "Could not start redemption");
    throw error;
  }
}

/**
 * Redeem TiH to a pool: quote, then melt with blank outputs for the
 * refundable part. Returns once the mint has opened the redemption (the
 * melt is PENDING while hashrate is delivered); the transaction worker
 * finishes it and stores the change when the mint reports it PAID.
 */
export async function redeemToPool(
  this: any,
  input: RedeemToPoolInput,
  mutexPriority: MutexPriority = "normal"
): Promise<{ quote: AppMeltQuote; request: string; state: MeltQuoteState }> {
  const mintStore = useMintsStore();
  const { quote, request, mintWallet } = await this.meltQuoteHashrate(input);
  // The pending history entry records the request (pool and worker).
  this.payInvoiceData.input.request = request;
  const checkQuote = (id: string) =>
    mintWallet.mint.checkMeltQuote(HASHRATE_METHOD, id) as any;
  try {
    await this.meltGeneric(
      mintStore.activeProofs,
      quote,
      mintWallet,
      true,
      checkQuote,
      PaymentMethod.Hashrate,
      { preferAsync: true },
      false,
      mutexPriority
    );
    return { quote, request, state: MeltQuoteState.PAID };
  } catch (error) {
    // meltGeneric throws when the melt isn't PAID yet. PENDING is the
    // normal case here: the redemption is open and hashrate is flowing.
    const latest = normalizeMeltQuote(await checkQuote(quote.quote));
    if (latest.state === MeltQuoteState.PENDING) {
      return { quote, request, state: MeltQuoteState.PENDING };
    }
    if (latest.state === MeltQuoteState.PAID) {
      return { quote, request, state: MeltQuoteState.PAID };
    }
    notifyApiError(error, "Redemption failed");
    throw error;
  } finally {
    this.payInvoiceData.input.request = "";
  }
}

/** Check a pending redemption; on PAID, store the change. */
export async function checkOutgoingHashrate(
  this: any,
  quote: string,
  verbose = true
) {
  return this.checkOutgoingInvoiceGeneric(
    quote,
    verbose,
    (wallet: Wallet, quoteId: string) =>
      wallet.mint.checkMeltQuote(HASHRATE_METHOD, quoteId)
  );
}

import { defineStore } from "pinia";
import { useLocalStorage } from "@vueuse/core";
import {
  Amount,
  OutputData,
  type MintKeys,
  type SerializedBlindedSignature,
  type Wallet,
  MeltQuoteState,
} from "@cashu/cashu-ts";
import { useMintsStore, type WalletProof } from "./mints";
import { useProofsStore } from "./proofs";

// proofs.ts imports this store, and wallet.ts pulls in modules that call
// useProofsStore() at load time, so load the wallet store lazily.
async function walletStore() {
  const { useWalletStore } = await import("./wallet");
  return useWalletStore();
}
import { UNIT_TIH } from "src/js/hashu";
import {
  EPOCH_METHOD,
  type HashuEpochIndex,
  convertRequest,
  epochBalances,
  epochStatus,
  fetchEpochIndex,
  lockedKeysetIds,
} from "src/js/hashu-epochs";

/** How long a fetched epoch index is trusted before refetching. */
const INDEX_MAX_AGE_MS = 10 * 60 * 1000;

type StoredIndex = { index: HashuEpochIndex; fetchedAt: number };

/** A future-epoch Lightning quote this wallet asked for. */
export type FutureEpochQuote = {
  mint: string;
  epoch: number;
  keysetId: string;
  amount: number;
};

/**
 * A conversion melted but not yet signed. Kept until the signatures are
 * back, so a reload or a dropped connection can finish it: the mint
 * answers the same outputs with the same signatures.
 */
export type PendingConversion = {
  mint: string;
  quote: string;
  amount: number;
  /** Set once the mint says where the vouchers went. */
  epoch?: number;
  keysetId?: string;
  /** First deterministic counter used for the outputs. */
  counter?: number;
};

function popcount(n: number): number {
  let c = 0;
  let x = BigInt(Math.floor(n));
  while (x > 0n) {
    c += Number(x & 1n);
    x >>= 1n;
  }
  return c;
}

function randomNonce(): string {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

/** Blinded messages as the mint's JSON wants them (amounts as numbers). */
function wireOutputs(outputs: OutputData[]) {
  return outputs.map((o) => ({
    ...o.blindedMessage,
    amount: Amount.from(o.blindedMessage.amount as any).toNumber(),
  }));
}

function base(url: string): string {
  return url.replace(/\/+$/, "");
}

async function postJson(url: string, body: unknown): Promise<any> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { detail: text };
  }
  if (!res.ok) {
    throw new Error(data?.detail || `${res.status} ${res.statusText}`);
  }
  return data;
}

export const useEpochsStore = defineStore("hashuEpochs", {
  state: () => ({
    indexes: useLocalStorage<Record<string, StoredIndex>>(
      "hashu.epochs.indexes",
      {}
    ),
    futureQuotes: useLocalStorage<Record<string, FutureEpochQuote>>(
      "hashu.epochs.futureQuotes",
      {}
    ),
    pendingConversions: useLocalStorage<PendingConversion[]>(
      "hashu.epochs.pendingConversions",
      []
    ),
    /** Bumped every minute so time-based states (future -> current) update. */
    clock: Date.now(),
    showEpochsDialog: false,
  }),
  getters: {
    index:
      (state) =>
      (mintUrl: string): HashuEpochIndex | undefined =>
        state.indexes[mintUrl]?.index,
    /** Keyset ids, across mints, whose vouchers can't be spent yet. */
    lockedIds(state): Set<string> {
      const now = state.clock / 1000;
      const ids = new Set<string>();
      for (const { index } of Object.values(state.indexes)) {
        lockedKeysetIds(index, now).forEach((id) => ids.add(id));
      }
      return ids;
    },
  },
  actions: {
    tick() {
      this.clock = Date.now();
    },
    /** Proofs that can be spent now (not dated to a future epoch). */
    spendable<T extends { id: string }>(proofs: T[]): T[] {
      const locked = this.lockedIds;
      if (locked.size === 0) return proofs;
      return proofs.filter((p) => !locked.has(p.id));
    },
    isLocked(keysetId: string): boolean {
      return this.lockedIds.has(keysetId);
    },
    /** Fetch a mint's epoch index (skipped if fresh, unless forced). */
    async refresh(
      mintUrl: string,
      force = false
    ): Promise<HashuEpochIndex | undefined> {
      const stored = this.indexes[mintUrl];
      this.tick();
      if (
        !force &&
        stored &&
        Date.now() - stored.fetchedAt < INDEX_MAX_AGE_MS
      ) {
        return stored.index;
      }
      const index = await fetchEpochIndex(mintUrl);
      if (index) {
        this.indexes = {
          ...this.indexes,
          [mintUrl]: { index, fetchedAt: Date.now() },
        };
        await this.ensureKeys(mintUrl, index);
      } else if (stored && force) {
        // The mint turned epochs off (or is unreachable): keep the last
        // index so future-dated vouchers stay marked.
      }
      useProofsStore().updateActiveProofs();
      return index ?? stored?.index;
    },
    /** Make sure the wallet holds keys for every epoch keyset listed. */
    async ensureKeys(mintUrl: string, index: HashuEpochIndex) {
      const ids = index.epochs
        .map((e) => e.keyset_id)
        .filter((k): k is string => !!k);
      for (const id of ids) {
        try {
          await this.keysFor(mintUrl, id);
        } catch (e) {
          console.warn("epochs: no keys for keyset", id, e);
        }
      }
    },
    /** Public keys of keyset `id` (fetched and stored on first use). */
    async keysFor(mintUrl: string, id: string): Promise<MintKeys> {
      const mints = useMintsStore();
      const mint = mints.mints.find((m) => m.url === mintUrl);
      if (!mint) throw new Error("mint not found");
      const have = mint.keys?.find((k) => k.id === id);
      if (have) return have;
      const res = await fetch(`${base(mintUrl)}/v1/keys/${id}`);
      if (!res.ok) throw new Error(`keys for ${id}: ${res.status}`);
      const keys: MintKeys = (await res.json()).keysets?.[0];
      if (!keys || keys.id !== id) throw new Error(`keys for ${id}: missing`);
      mint.keys = [...(mint.keys ?? []), keys];
      if (!mint.keysets.some((k) => k.id === id)) {
        mint.keysets = [
          ...mint.keysets,
          {
            id,
            unit: keys.unit,
            active: false,
            input_fee_ppk: 0,
          } as any,
        ];
      }
      return keys;
    },
    /** Balance rows by epoch for `mintUrl`'s TiH (empty without epochs). */
    balances(mintUrl: string) {
      const index = this.index(mintUrl);
      if (!index) return [];
      const mints = useMintsStore();
      const mint = mints.mints.find((m) => m.url === mintUrl);
      if (!mint) return [];
      const proofs = useProofsStore().proofs.filter(
        (p) =>
          !p.reserved &&
          mint.keysets.some((k) => k.id === p.id && k.unit === UNIT_TIH)
      );
      return epochBalances(index, proofs, this.clock / 1000);
    },
    /**
     * Build deterministic outputs for `amount` on keyset `keys`, reserving
     * wallet counters so a restore from the seed finds them.
     */
    async outputsFor(keys: MintKeys, amount: number, counter?: number) {
      const wallet = await walletStore();
      const n = popcount(amount);
      let start = counter;
      if (start === undefined) {
        const range = await wallet
          .getOrCreateCounterSource()
          .reserve(keys.id, n);
        start = range.start;
        wallet.syncCounterToStorage(keys.id, start + n);
      }
      const outputs = OutputData.createDeterministicData(
        amount,
        wallet.seed,
        start,
        { id: keys.id, keys: keys.keys }
      );
      return { outputs, counter: start };
    },
    toProofs(
      outputs: OutputData[],
      sigs: SerializedBlindedSignature[],
      keys: MintKeys
    ) {
      if (sigs.length !== outputs.length) {
        throw new Error(
          `mint returned ${sigs.length} signatures for ${outputs.length} outputs`
        );
      }
      return outputs.map((o, i) =>
        o.toProof(sigs[i], { id: keys.id, keys: keys.keys })
      );
    },

    // ---- buying a future epoch ------------------------------------------

    /**
     * Ask for a Lightning quote for `amount` TiH of future epoch `epoch`.
     * Same answer as a NUT-04 bolt11 quote, plus the epoch and keyset.
     */
    async requestFutureQuote(mintUrl: string, epoch: number, amount: number) {
      const data = await postJson(
        `${base(mintUrl)}/v1/hashu/epochs/${epoch}/mint/quote/bolt11`,
        { amount, unit: UNIT_TIH }
      );
      this.futureQuotes = {
        ...this.futureQuotes,
        [data.quote]: {
          mint: mintUrl,
          epoch,
          keysetId: data.keyset_id,
          amount,
        },
      };
      await this.keysFor(mintUrl, data.keyset_id);
      return data;
    },
    futureQuote(quote: string): FutureEpochQuote | undefined {
      return this.futureQuotes[quote];
    },
    /** Issue a paid future-epoch quote with that epoch's keyset. */
    async mintFutureQuote(quote: string): Promise<WalletProof[] | any[]> {
      const q = this.futureQuotes[quote];
      if (!q) throw new Error("not a future-epoch quote");
      const keys = await this.keysFor(q.mint, q.keysetId);
      const { outputs } = await this.outputsFor(keys, q.amount);
      const data = await postJson(
        `${base(q.mint)}/v1/hashu/epochs/mint/${quote}`,
        { outputs: wireOutputs(outputs) }
      );
      const proofs = this.toProofs(outputs, data.signatures, keys);
      await useProofsStore().addProofs(proofs);
      const rest = { ...this.futureQuotes };
      delete rest[quote];
      this.futureQuotes = rest;
      await this.refresh(q.mint, true);
      return proofs;
    },

    // ---- converting expired vouchers ------------------------------------

    /**
     * Convert `proofs` (all of them) to the current epoch, or the next with
     * room ("auto"), or to epoch `target`. Returns where they went.
     */
    async convert(
      mintUrl: string,
      proofs: WalletProof[],
      target: "auto" | number = "auto"
    ): Promise<{ epoch: number; amount: number }> {
      const proofsStore = useProofsStore();
      const amount = proofsStore.sumProofs(proofs);
      if (amount <= 0) throw new Error("nothing to convert");
      const mintWallet: Wallet = await (
        await walletStore()
      ).mintWallet(mintUrl, UNIT_TIH, true);
      const request = convertRequest(target, amount, randomNonce());
      const raw = await mintWallet.createMeltQuote(EPOCH_METHOD, {
        request,
        unit: UNIT_TIH,
        method: EPOCH_METHOD,
      } as any);
      const quote = raw as any;
      await proofsStore.setReserved(proofs, true, quote.quote);
      let state: MeltQuoteState | string = MeltQuoteState.UNPAID;
      try {
        const preview = await mintWallet.prepareMelt(
          EPOCH_METHOD,
          {
            ...quote,
            amount: Amount.from(quote.amount),
            fee_reserve: Amount.from(quote.fee_reserve ?? 0),
          } as any,
          proofs as any,
          { keysetId: mintWallet.keysetId }
        );
        const res = await mintWallet.completeMelt(preview);
        state = res.quote.state;
      } catch (e) {
        // The mint may have taken the inputs anyway; ask.
        const latest: any = await mintWallet.mint.checkMeltQuote(
          EPOCH_METHOD,
          quote.quote
        );
        state = latest.state;
        if (state !== MeltQuoteState.PAID) {
          await proofsStore.setReserved(proofs, false);
          throw e;
        }
      }
      if (state !== MeltQuoteState.PAID) {
        await proofsStore.setReserved(proofs, false);
        throw new Error(`conversion not settled (${state})`);
      }
      // The inputs are spent: record the conversion before anything else
      // so it can be finished after a failure.
      this.pendingConversions = [
        ...this.pendingConversions,
        { mint: mintUrl, quote: quote.quote, amount },
      ];
      await proofsStore.removeProofs(proofs);
      return this.finishConversion(quote.quote);
    },
    /** Fetch the signatures for a melted conversion and store the vouchers. */
    async finishConversion(
      quote: string
    ): Promise<{ epoch: number; amount: number }> {
      const i = this.pendingConversions.findIndex((c) => c.quote === quote);
      if (i < 0) throw new Error("unknown conversion");
      const c = { ...this.pendingConversions[i] };
      if (c.epoch === undefined || !c.keysetId) {
        const res = await fetch(
          `${base(c.mint)}/v1/hashu/epochs/convert/${quote}`
        );
        if (!res.ok) throw new Error(`conversion ${quote}: ${res.status}`);
        const info = await res.json();
        c.epoch = info.epoch;
        c.keysetId = info.keyset_id;
      }
      const keys = await this.keysFor(c.mint, c.keysetId!);
      const { outputs, counter } = await this.outputsFor(
        keys,
        c.amount,
        c.counter
      );
      if (c.counter === undefined) {
        c.counter = counter;
        this.pendingConversions = this.pendingConversions.map((p) =>
          p.quote === quote ? c : p
        );
      }
      const data = await postJson(
        `${base(c.mint)}/v1/hashu/epochs/convert/${quote}`,
        { outputs: wireOutputs(outputs) }
      );
      const proofs = this.toProofs(outputs, data.signatures, keys);
      await useProofsStore().addProofs(proofs);
      this.pendingConversions = this.pendingConversions.filter(
        (p) => p.quote !== quote
      );
      await this.refresh(c.mint, true);
      return { epoch: c.epoch!, amount: c.amount };
    },
    /** Retry conversions a reload or a dropped connection left unsigned. */
    async resumePending() {
      for (const c of [...this.pendingConversions]) {
        try {
          await this.finishConversion(c.quote);
        } catch (e) {
          console.warn("epochs: conversion still unfinished", c.quote, e);
        }
      }
    },
    /** Expired proofs for `mintUrl`, to convert. */
    expiredProofs(mintUrl: string, epoch?: number): WalletProof[] {
      const index = this.index(mintUrl);
      if (!index) return [];
      const now = this.clock / 1000;
      return useProofsStore().proofs.filter((p) => {
        if (p.reserved) return false;
        if (epochStatus(index, p.id, now) !== "expired") return false;
        if (epoch === undefined) return true;
        return (
          index.keysets?.[p.id]?.epoch === epoch ||
          index.epochs.some((e) => e.keyset_id === p.id && e.epoch === epoch)
        );
      });
    },
  },
});

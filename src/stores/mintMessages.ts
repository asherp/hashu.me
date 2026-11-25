// hashu.me: private messages with mints (NIP-17), keyed by the mint's
// Nostr pubkey (from its NUT-06 contact). Messages go out from the wallet's
// own Nostr key (derived from the seed, the same one NIP-17 payment
// requests use), gift wrapped to the mint and to ourselves, so the
// conversation can be rebuilt from relays. A Hashu mint answers from the
// same key: its operator, or the supplier on a supplier mint.
import { defineStore } from "pinia";
import { useLocalStorage } from "@vueuse/core";
import { SimplePool } from "nostr-tools";
import type { Event as NostrEvent } from "nostr-tools";
import { useNostrStore } from "./nostr";
import { notify } from "src/js/notify";
import {
  BACKDATE_S,
  KIND_GIFT_WRAP,
  Rumor,
  makeRumor,
  recipients,
  unwrapGift,
  wrapRumor,
} from "src/js/nip17";

export type MintMessage = {
  /** kind 14 id */
  id: string;
  outgoing: boolean;
  text: string;
  created_at: number;
};

export type MintConversation = {
  pubkey: string;
  mintUrl?: string;
  title?: string;
  /** The mint's relays: where it reads and answers. */
  relays: string[];
  messages: MintMessage[];
  /** created_at of the newest incoming message seen in the dialog */
  lastRead: number;
};

/** Longest message, as on the mint side: room for a token of a couple
 * dozen proofs, which a mint sends hashes as. */
export const MAX_TEXT = 16000;
const PUBLISH_TIMEOUT_MS = 8000;
const QUERY_WAIT_MS = 6000;
/** Messages kept per conversation. */
const KEEP = 500;

const isRelay = (u: unknown): u is string =>
  typeof u === "string" && /^wss?:\/\/[^\s]+$/.test(u);

let pool: SimplePool | null = null;
const getPool = () => (pool ??= new SimplePool());

export const useMintMessagesStore = defineStore("mintMessages", {
  state: () => ({
    conversations: useLocalStorage<Record<string, MintConversation>>(
      "hashu.mintMessages",
      {}
    ),
    syncing: false,
  }),
  getters: {
    unread: (state) => (pubkey: string) => {
      const c = state.conversations[pubkey];
      if (!c) return 0;
      return c.messages.filter((m) => !m.outgoing && m.created_at > c.lastRead)
        .length;
    },
  },
  actions: {
    /** Start (or update) the conversation with a mint. */
    open(pubkey: string, relays: string[], mintUrl?: string, title?: string) {
      const old = this.conversations[pubkey];
      const merged = Array.from(
        new Set([...(old?.relays || []), ...relays.filter(isRelay)])
      ).slice(0, 12);
      this.conversations[pubkey] = {
        pubkey,
        relays: merged,
        messages: old?.messages || [],
        lastRead: old?.lastRead || 0,
        mintUrl: mintUrl || old?.mintUrl,
        title: title || old?.title,
      };
      return this.conversations[pubkey];
    },
    markRead(pubkey: string) {
      const c = this.conversations[pubkey];
      if (!c) return;
      const newest = Math.max(
        c.lastRead,
        ...c.messages.filter((m) => !m.outgoing).map((m) => m.created_at)
      );
      c.lastRead = newest;
    },
    relaysFor(pubkey: string): string[] {
      const nostr = useNostrStore();
      return Array.from(
        new Set([
          ...(this.conversations[pubkey]?.relays || []),
          ...((nostr.relays || []) as string[]).filter(isRelay),
        ])
      );
    },
    /** Keep `rumor` if it belongs to a conversation. True if new. */
    keep(rumor: Rumor, me: string): boolean {
      let peer: string | undefined;
      let outgoing = false;
      if (rumor.pubkey === me) {
        peer = recipients(rumor).find((p) => this.conversations[p]);
        outgoing = true;
      } else if (this.conversations[rumor.pubkey]) {
        peer = rumor.pubkey;
      }
      if (!peer) return false;
      const c = this.conversations[peer];
      if (c.messages.some((m) => m.id === rumor.id)) return false;
      const now = Math.floor(Date.now() / 1000);
      c.messages.push({
        id: rumor.id,
        outgoing,
        text: rumor.content.slice(0, MAX_TEXT),
        created_at: Math.min(rumor.created_at, now),
      });
      c.messages.sort((a, b) => a.created_at - b.created_at);
      if (c.messages.length > KEEP)
        c.messages.splice(0, c.messages.length - KEEP);
      return true;
    },
    /**
     * A DM the wallet's own NIP-17 subscription already opened (payment
     * requests use the same key). Kept only for a mint we talk to.
     */
    receiveFromSubscription(rumor: Rumor) {
      const nostr = useNostrStore();
      const me = nostr.seedSignerPublicKey;
      if (!me || !rumor?.id) return;
      const isNew = this.keep(rumor, me);
      if (isNew && rumor.pubkey !== me) {
        const c = this.conversations[rumor.pubkey];
        notify(`New message from ${c?.title || "a mint"}`);
      }
    },
    async send(pubkey: string, text: string) {
      text = text.trim();
      if (!text) return;
      if (text.length > MAX_TEXT) throw new Error("Message is too long");
      const nostr = useNostrStore();
      await nostr.walletSeedGenerateKeyPair();
      const me = nostr.seedSignerPublicKey;
      const priv = nostr.seedSignerPrivateKey;
      const rumor = makeRumor(me, pubkey, text);
      const toMint = wrapRumor(rumor, priv, pubkey);
      const toSelf = wrapRumor(rumor, priv, me);
      const relays = this.relaysFor(pubkey);
      if (!relays.length) throw new Error("No Nostr relays to send on");
      // NIP-17: also the relays the recipient reads DMs on (kind 10050),
      // e.g. a supplier reading in their own Nostr client.
      for (const r of await inboxRelays(relays, pubkey))
        if (!relays.includes(r)) relays.push(r);
      const accepted = await publish(relays, toMint);
      if (!accepted) throw new Error("No relay took the message");
      // Our own copy: best effort.
      publish(relays, toSelf).catch(() => {});
      this.keep(rumor, me);
    },
    /** Fetch recent gift wraps to us from the conversation's relays. */
    async sync(pubkey?: string) {
      if (this.syncing) return;
      const nostr = useNostrStore();
      if (!nostr.seedSignerPublicKey) await nostr.walletSeedGenerateKeyPair();
      const me = nostr.seedSignerPublicKey;
      const priv = nostr.seedSignerPrivateKey;
      const peers = pubkey ? [pubkey] : Object.keys(this.conversations);
      if (!me || !priv || !peers.length) return;
      const relays = Array.from(
        new Set(peers.flatMap((p) => this.relaysFor(p)))
      );
      if (!relays.length) return;
      this.syncing = true;
      try {
        const since =
          Math.floor(Date.now() / 1000) - BACKDATE_S - 7 * 24 * 3600;
        const events = await getPool().querySync(
          relays,
          { kinds: [KIND_GIFT_WRAP], "#p": [me], since },
          { maxWait: QUERY_WAIT_MS }
        );
        for (const ev of events) {
          const rumor = unwrapGift(ev, priv);
          if (rumor) this.keep(rumor, me);
        }
      } catch (e) {
        console.warn("[mint-messages] sync failed", e);
      } finally {
        this.syncing = false;
      }
    },
  },
});

/** Publish to every relay; true once one takes it. */
async function publish(relays: string[], ev: NostrEvent): Promise<boolean> {
  const tries = getPool()
    .publish(relays, ev)
    .map((p) =>
      Promise.race([
        p,
        new Promise((_, rej) =>
          setTimeout(() => rej(new Error("timeout")), PUBLISH_TIMEOUT_MS)
        ),
      ])
    );
  try {
    await Promise.any(tries);
    return true;
  } catch (e) {
    return false;
  }
}

/** The recipient's NIP-17 inbox relays (kind 10050), looked up on `relays`. */
async function inboxRelays(
  relays: string[],
  pubkey: string
): Promise<string[]> {
  try {
    const events = await getPool().querySync(
      relays,
      { kinds: [10050], authors: [pubkey], limit: 1 },
      { maxWait: 3000 }
    );
    const newest = events.sort((a, b) => b.created_at - a.created_at)[0];
    return (newest?.tags || [])
      .filter((t) => t[0] === "relay" && isRelay(t[1]))
      .map((t) => t[1])
      .slice(0, 6);
  } catch (e) {
    return [];
  }
}

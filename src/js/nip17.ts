// hashu.me: NIP-17 private direct messages (kind 14 rumor, sealed as
// kind 13, gift wrapped as kind 1059 with a throwaway key), used to message
// a mint at the Nostr key in its NUT-06 contact.
// https://github.com/nostr-protocol/nips/blob/master/17.md
import {
  finalizeEvent,
  generateSecretKey,
  getEventHash,
  nip44,
  verifyEvent,
} from "nostr-tools";
import type { Event as NostrEvent } from "nostr-tools";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";

export const KIND_DM = 14;
export const KIND_SEAL = 13;
export const KIND_GIFT_WRAP = 1059;
/** Seals and wraps are dated up to two days back so relays can't time them. */
export const BACKDATE_S = 2 * 24 * 3600;

export type Rumor = {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
};

const nowS = () => Math.floor(Date.now() / 1000);
const backdated = () => nowS() - Math.floor(Math.random() * BACKDATE_S);
const convKey = (privHex: string, pubHex: string) =>
  nip44.v2.utils.getConversationKey(privHex, pubHex);

/** An unsigned kind 14 message from `fromPub` to `toPub`. */
export function makeRumor(
  fromPub: string,
  toPub: string,
  text: string,
  createdAt = nowS()
): Rumor {
  const r = {
    pubkey: fromPub,
    created_at: createdAt,
    kind: KIND_DM,
    tags: [["p", toPub]],
    content: text,
  };
  return { ...r, id: getEventHash(r) };
}

/** Seal `rumor` with the sender's key and gift wrap it to `recipientPub`. */
export function wrapRumor(
  rumor: Rumor,
  senderPrivHex: string,
  recipientPub: string
): NostrEvent {
  const seal = finalizeEvent(
    {
      kind: KIND_SEAL,
      created_at: backdated(),
      tags: [],
      content: nip44.v2.encrypt(
        JSON.stringify(rumor),
        convKey(senderPrivHex, recipientPub)
      ),
    },
    hexToBytes(senderPrivHex)
  );
  const throwaway = generateSecretKey();
  return finalizeEvent(
    {
      kind: KIND_GIFT_WRAP,
      created_at: backdated(),
      tags: [["p", recipientPub]],
      content: nip44.v2.encrypt(
        JSON.stringify(seal),
        convKey(bytesToHex(throwaway), recipientPub)
      ),
    },
    throwaway
  );
}

/**
 * Open a gift wrap addressed to `myPrivHex`. Returns the kind 14 message
 * when the seal verifies and was signed by the message's author, else null.
 */
export function unwrapGift(
  wrap: { kind: number; pubkey: string; content: string },
  myPrivHex: string
): Rumor | null {
  try {
    if (wrap.kind !== KIND_GIFT_WRAP) return null;
    const seal = JSON.parse(
      nip44.v2.decrypt(wrap.content, convKey(myPrivHex, wrap.pubkey))
    ) as NostrEvent;
    if (seal.kind !== KIND_SEAL || !verifyEvent(seal)) return null;
    return openSeal(seal, myPrivHex);
  } catch (e) {
    return null;
  }
}

/** The kind 14 message inside a verified seal, or null. */
export function openSeal(
  seal: { pubkey: string; content: string },
  myPrivHex: string
): Rumor | null {
  try {
    const rumor = JSON.parse(
      nip44.v2.decrypt(seal.content, convKey(myPrivHex, seal.pubkey))
    ) as Rumor;
    if (rumor.kind !== KIND_DM || rumor.pubkey !== seal.pubkey) return null;
    if (typeof rumor.content !== "string") return null;
    // The id is not signed: recompute it so it can't collide on purpose.
    rumor.id = getEventHash(rumor);
    return rumor;
  } catch (e) {
    return null;
  }
}

/** The `p` tags of a message. */
export function recipients(rumor: Rumor): string[] {
  return (rumor.tags || [])
    .filter((t) => t[0] === "p" && typeof t[1] === "string")
    .map((t) => t[1]);
}

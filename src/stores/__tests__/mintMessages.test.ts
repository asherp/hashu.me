import { describe, expect, it } from "vitest";
import { generateSecretKey, getPublicKey } from "nostr-tools";
import { bytesToHex } from "@noble/hashes/utils";
import { makeRumor, unwrapGift, wrapRumor } from "src/js/nip17";
import { useMintMessagesStore } from "src/stores/mintMessages";

const keypair = () => {
  const sk = generateSecretKey();
  return { priv: bytesToHex(sk), pub: getPublicKey(sk) };
};

describe("NIP-17 gift wraps", () => {
  it("only the recipient opens a wrap, and the author is the seal's signer", () => {
    const wallet = keypair();
    const mint = keypair();
    const other = keypair();
    const rumor = makeRumor(wallet.pub, mint.pub, "Do you sell PHd?");
    const wrap = wrapRumor(rumor, wallet.priv, mint.pub);
    expect(wrap.kind).toBe(1059);
    expect(wrap.pubkey).not.toBe(wallet.pub);
    expect(wrap.tags).toEqual([["p", mint.pub]]);
    const opened = unwrapGift(wrap, mint.priv);
    expect(opened?.content).toBe("Do you sell PHd?");
    expect(opened?.pubkey).toBe(wallet.pub);
    expect(opened?.id).toBe(rumor.id);
    expect(unwrapGift(wrap, other.priv)).toBeNull();
  });

  it("refuses a rumor that claims another author than the seal", () => {
    const wallet = keypair();
    const mint = keypair();
    const forged = makeRumor(mint.pub, wallet.pub, "I am the mint");
    // Sealed by `wallet` though the rumor says the mint wrote it.
    const wrap = wrapRumor(forged, wallet.priv, wallet.pub);
    expect(unwrapGift(wrap, wallet.priv)).toBeNull();
  });
});

describe("mint conversations", () => {
  it("keeps replies from a mint we talk to, and our own copies", () => {
    const store = useMintMessagesStore();
    const me = keypair().pub;
    const mint = keypair().pub;
    const stranger = keypair().pub;
    store.open(
      mint,
      ["wss://relay.example", "https://not-a-relay"],
      "https://mint.example",
      "Mint"
    );
    expect(store.conversations[mint].relays).toEqual(["wss://relay.example"]);

    expect(store.keep(makeRumor(me, mint, "hi", 100), me)).toBe(true);
    const reply = makeRumor(mint, me, "hello", 200);
    expect(store.keep(reply, me)).toBe(true);
    expect(store.keep(reply, me)).toBe(false);
    expect(store.keep(makeRumor(stranger, me, "spam", 300), me)).toBe(false);

    const msgs = store.conversations[mint].messages;
    expect(msgs.map((m) => [m.outgoing, m.text])).toEqual([
      [true, "hi"],
      [false, "hello"],
    ]);
    expect(store.unread(mint)).toBe(1);
    store.markRead(mint);
    expect(store.unread(mint)).toBe(0);
  });
});

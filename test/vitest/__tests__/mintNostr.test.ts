import { describe, it, expect, vi } from "vitest";
import { nip19 } from "nostr-tools";
import {
  parseMintNostrContact,
  parseProfileContent,
  displayNip05,
  nip05LookupUrl,
  verifyNip05,
  mintMessageTarget,
} from "src/js/mint-nostr";

const HEX = "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d";
const NPUB = nip19.npubEncode(HEX);

describe("parseMintNostrContact", () => {
  it("reads npub, nostr: URI and hex", () => {
    expect(parseMintNostrContact(NPUB)?.pubkey).toBe(HEX);
    expect(parseMintNostrContact(`nostr:${NPUB}`)?.pubkey).toBe(HEX);
    expect(parseMintNostrContact(HEX.toUpperCase())?.npub).toBe(NPUB);
  });
  it("keeps nprofile relay hints", () => {
    const np = nip19.nprofileEncode({
      pubkey: HEX,
      relays: ["wss://relay.example"],
    });
    expect(parseMintNostrContact(np)).toEqual({
      pubkey: HEX,
      npub: NPUB,
      relays: ["wss://relay.example"],
    });
  });
  it("rejects junk", () => {
    expect(parseMintNostrContact("")).toBeNull();
    expect(parseMintNostrContact("@mint")).toBeNull();
    expect(parseMintNostrContact("npub1nope")).toBeNull();
  });
});

describe("parseProfileContent", () => {
  it("keeps display fields and normalizes website", () => {
    expect(
      parseProfileContent(
        JSON.stringify({
          name: "mint",
          about: " hi ",
          website: "hashu.io",
          picture: "javascript:alert(1)",
          nip05: "_@hashu.io",
          extra: 1,
        })
      )
    ).toEqual({
      name: "mint",
      about: "hi",
      website: "https://hashu.io",
      nip05: "_@hashu.io",
    });
  });
  it("uses image when picture is missing", () => {
    expect(
      parseProfileContent(JSON.stringify({ image: "https://x/y.png" }))
    ).toEqual({ picture: "https://x/y.png" });
  });
  it("returns null for empty or invalid content", () => {
    expect(parseProfileContent("")).toBeNull();
    expect(parseProfileContent("{")).toBeNull();
    expect(parseProfileContent("{}")).toBeNull();
  });
});

describe("nip05", () => {
  it("displays root identifiers as the domain", () => {
    expect(displayNip05("_@hashu.io")).toBe("hashu.io");
    expect(displayNip05("bob@hashu.io")).toBe("bob@hashu.io");
  });
  it("builds the well-known URL", () => {
    expect(nip05LookupUrl("Bob@Hashu.io")?.url).toBe(
      "https://Hashu.io/.well-known/nostr.json?name=bob"
    );
    expect(nip05LookupUrl("no-at-sign")).toBeNull();
  });
  it("verifies against the pubkey", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({ names: { _: HEX } }),
    })) as any;
    expect(await verifyNip05("_@hashu.io", HEX, fetcher)).toBe(true);
    expect(await verifyNip05("_@hashu.io", "00".repeat(32), fetcher)).toBe(
      false
    );
  });
});

describe("mintMessageTarget", () => {
  const info = { contact: [{ method: "nostr", info: NPUB }] };
  const OTHER = "11".repeat(32);
  it("uses the Nostr contact when the mint has no reliability index", () => {
    expect(mintMessageTarget(info, null)?.pubkey).toBe(HEX);
    expect(mintMessageTarget({ contact: [] }, null)).toBeNull();
    expect(mintMessageTarget(undefined, null)).toBeNull();
  });
  it("prefers the reliability index's DM target, with its relays first", () => {
    const t = mintMessageTarget(info, {
      totals: {},
      messages: { pubkey: OTHER, npub: "npub1x", relays: ["wss://a"] },
      announcement: { relays: ["wss://b"] },
    });
    expect(t).toEqual({
      pubkey: OTHER,
      npub: "npub1x",
      relays: ["wss://a", "wss://b"],
    });
  });
  it("hides Message when a Hashu mint takes no messages", () => {
    expect(mintMessageTarget(info, { totals: {}, messages: null })).toBeNull();
  });
});

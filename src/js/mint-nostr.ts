// hashu.me: the mint's Nostr identity (NUT-06 contact method "nostr").
// Hashu mints put the npub of their receipt key there and publish a
// kind 0 profile signed by it; other mints may list any npub, nprofile
// or hex key, or nothing at all.
import { nip19 } from "nostr-tools";

export type MintNostrIdentity = {
  pubkey: string; // hex
  npub: string;
  relays: string[]; // relay hints from an nprofile, if any
};

export type MintNostrProfile = {
  name?: string;
  display_name?: string;
  picture?: string;
  about?: string;
  website?: string;
  nip05?: string;
  lud16?: string;
};

const HEX_KEY = /^[0-9a-f]{64}$/i;

/** Parse a NUT-06 nostr contact (npub, nprofile, nostr: URI or hex). */
export function parseMintNostrContact(
  info: string | undefined | null
): MintNostrIdentity | null {
  if (!info) return null;
  let s = info.trim();
  if (s.toLowerCase().startsWith("nostr:")) s = s.slice(6);
  if (HEX_KEY.test(s)) {
    const pubkey = s.toLowerCase();
    return { pubkey, npub: nip19.npubEncode(pubkey), relays: [] };
  }
  try {
    const decoded = nip19.decode(s);
    if (decoded.type === "npub") {
      const pubkey = decoded.data as string;
      return { pubkey, npub: nip19.npubEncode(pubkey), relays: [] };
    }
    if (decoded.type === "nprofile") {
      const { pubkey, relays } = decoded.data as {
        pubkey: string;
        relays?: string[];
      };
      return { pubkey, npub: nip19.npubEncode(pubkey), relays: relays || [] };
    }
  } catch {}
  return null;
}

/** Keep only displayable fields of a kind 0 content string. */
export function parseProfileContent(
  content: string | undefined
): MintNostrProfile | null {
  if (!content) return null;
  let raw: any;
  try {
    raw = JSON.parse(content);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const out: MintNostrProfile = {};
  for (const k of [
    "name",
    "display_name",
    "picture",
    "about",
    "website",
    "nip05",
    "lud16",
  ] as const) {
    const v = raw[k];
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
  }
  if (!out.picture && typeof raw.image === "string" && raw.image.trim())
    out.picture = raw.image.trim();
  if (out.picture && !isHttpUrl(out.picture)) delete out.picture;
  if (out.website) {
    const w = /^[a-z][a-z0-9+.-]*:/i.test(out.website)
      ? out.website
      : `https://${out.website}`;
    if (isHttpUrl(w)) out.website = w;
    else delete out.website;
  }
  return Object.keys(out).length ? out : null;
}

export function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** "_@example.com" shows as "example.com" (NIP-05 root identifier). */
export function displayNip05(nip05: string): string {
  return nip05.startsWith("_@") ? nip05.slice(2) : nip05;
}

/** Split a NIP-05 identifier into its well-known lookup URL and name. */
export function nip05LookupUrl(
  nip05: string
): { url: string; name: string } | null {
  const m = /^([a-z0-9._-]+)@([a-z0-9.-]+\.[a-z]{2,}|localhost(:\d+)?)$/i.exec(
    nip05.trim()
  );
  if (!m) return null;
  const name = m[1].toLowerCase();
  return {
    url: `https://${m[2]}/.well-known/nostr.json?name=${encodeURIComponent(
      name
    )}`,
    name,
  };
}

/** Check a NIP-05 identifier resolves to the given hex pubkey. */
export async function verifyNip05(
  nip05: string,
  pubkey: string,
  fetcher: typeof fetch = fetch
): Promise<boolean> {
  const lookup = nip05LookupUrl(nip05);
  if (!lookup) return false;
  try {
    const res = await fetcher(lookup.url);
    if (!res.ok) return false;
    const data = await res.json();
    const found = data?.names?.[lookup.name];
    return typeof found === "string" && found.toLowerCase() === pubkey;
  } catch {
    return false;
  }
}

export function njumpUrl(npub: string): string {
  return `https://njump.me/${npub}`;
}

/**
 * Whom "Message" writes to (NIP-17) for a mint. A Hashu mint names it in
 * its reliability index (`messages`): the operator mint's own key, or a
 * supplier's own npub (null = it takes no messages, e.g. a supplier
 * without one). Any other mint: its NUT-06 Nostr contact. null = no
 * Message button.
 */
export function mintMessageTarget(
  info: { contact?: { method: string; info: string }[] } | undefined | null,
  reliability: any
): MintNostrIdentity | null {
  const contact = (info?.contact || []).find((c) => c.method === "nostr");
  const nostr = contact ? parseMintNostrContact(contact.info) : null;
  const announced = reliability?.announcement?.relays;
  const relays = [
    ...(nostr?.relays || []),
    ...(Array.isArray(announced) ? announced : []),
  ];
  if (reliability) {
    const m = reliability.messages;
    if (!m?.pubkey || !m?.npub) return null;
    return {
      pubkey: m.pubkey,
      npub: m.npub,
      relays: [...(Array.isArray(m.relays) ? m.relays : []), ...relays],
    };
  }
  return nostr ? { ...nostr, relays } : null;
}

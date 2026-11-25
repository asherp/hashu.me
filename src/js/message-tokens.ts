// hashu.me: Cashu inside a chat message. A Hashu mint sends hashes as a
// NUT-18 payment payload ({mint, unit, memo, proofs}) in a NIP-17 message,
// which the wallet's payment-request listener also receives like any
// Cashu.me wallet; people may also paste cashuA/cashuB tokens. Splits the
// text so the dialog can show each as a short chip with a Receive button.
import { getEncodedToken } from "@cashu/cashu-ts";
import token from "src/js/token";

export type MessagePart = {
  text: string;
  /** set when this part is a token that decodes */
  token?: { amount: number; unit: string; mint: string };
  label?: string;
};

const TOKEN_RE = /cashu[AB][A-Za-z0-9_\-+/=]{20,}/g;

export function splitTokens(
  text: string,
  label: (amount: number, unit: string) => string = (a, u) => `${a} ${u}`
): MessagePart[] {
  const payload = nut18Payload(text);
  if (payload) {
    const amount = payload.proofs.reduce(
      (a, p) => a + Number(p.amount || 0),
      0
    );
    const unit = payload.unit || "sat";
    let encoded = "";
    try {
      encoded = getEncodedToken({
        mint: payload.mint,
        unit,
        memo: payload.memo,
        proofs: payload.proofs,
      } as any);
    } catch {
      encoded = "";
    }
    if (encoded) {
      const parts: MessagePart[] = [];
      if (payload.memo) parts.push({ text: payload.memo });
      parts.push({
        text: encoded,
        token: { amount, unit, mint: payload.mint },
        label: label(amount, unit),
      });
      return parts;
    }
  }
  const out: MessagePart[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN_RE)) {
    const at = m.index ?? 0;
    let meta: ReturnType<typeof token.decodeMeta> | undefined;
    try {
      meta = token.decodeMeta(m[0]);
    } catch {
      meta = undefined;
    }
    if (!meta) continue;
    if (at > last) out.push({ text: text.slice(last, at) });
    const unit = meta.unit || "sat";
    out.push({
      text: m[0],
      token: { amount: meta.amount, unit, mint: meta.mint },
      label: label(meta.amount, unit),
    });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

type Nut18Payload = {
  mint: string;
  unit?: string;
  memo?: string;
  proofs: { amount: number | string }[];
};

/** A NUT-18 payment payload, if that is all `text` is. */
export function nut18Payload(text: string): Nut18Payload | undefined {
  const t = text.trim();
  if (!t.startsWith("{")) return undefined;
  try {
    const p = JSON.parse(t);
    if (
      p &&
      typeof p.mint === "string" &&
      Array.isArray(p.proofs) &&
      p.proofs.length
    )
      return p as Nut18Payload;
  } catch {
    return undefined;
  }
  return undefined;
}

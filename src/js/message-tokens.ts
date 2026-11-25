// hashu.me: Cashu tokens inside a chat message (a mint sends hashes as a
// cashuA/cashuB token in a NIP-17 message). Splits the text so the dialog
// can show each token as a short chip with a Receive button.
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

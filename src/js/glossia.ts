/**
 * Vouchers as plain English, with Glossia (github.com/asherp/glossia).
 *
 * A `cashuB` token becomes a paragraph of ordinary sentences that decodes
 * back to the same voucher; a few mistyped words are repaired. This is
 * `glossia::cashu`, the encoding the Hashu mint's checkout uses, built to
 * WebAssembly from ../../glossia-wasm. The module is ~3.6 MB, so it loads
 * only when words are actually shown or read.
 */

type GlossiaModule = typeof import("./glossia/hashu_glossia");

let loading: Promise<GlossiaModule> | null = null;

function load(): Promise<GlossiaModule> {
  if (!loading) {
    loading = import("./glossia/hashu_glossia")
      .then(async (m) => {
        await m.default();
        return m;
      })
      .catch((e) => {
        loading = null;
        throw e;
      });
  }
  return loading;
}

/**
 * Cheap check before loading the codec: a voucher in words is dozens of
 * sentences of plain words (1 proof is ~100 words), with no token prefix.
 */
export function looksLikeWords(text: string): boolean {
  const t = (text || "").trim();
  if (!t || /^(cashu|creq|ln|bitcoin:|http)/i.test(t)) return false;
  const words = t.split(/\s+/);
  if (words.length < 40) return false;
  const plain = words.filter((w) => /^[A-Za-z][A-Za-z'’-]*[.,;:!?]?$/.test(w));
  return plain.length / words.length > 0.8;
}

export type FromWords = { token: string; repaired: number };

/** A paragraph of words → `cashuB…`, or null if it isn't a voucher. */
export async function tokenFromWords(text: string): Promise<FromWords | null> {
  if (!looksLikeWords(text)) return null;
  try {
    const m = await load();
    const r = JSON.parse(m.cashuFromWords(text));
    return r.token ? { token: r.token, repaired: r.repaired ?? 0 } : null;
  } catch (e) {
    console.debug("glossia: not a voucher in words", e);
    return null;
  }
}

/** `cashuB…` → a paragraph of words, or null (e.g. a V3 `cashuA` token). */
export async function tokenToWords(token: string): Promise<string | null> {
  if (!token || !token.trim().startsWith("cashuB")) return null;
  const m = await load();
  const r = JSON.parse(m.cashuToWords(token));
  return r.words ?? null;
}

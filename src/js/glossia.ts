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

/** A paragraph of words → `creqA…` (a NUT-18 payment request), or null. */
export async function requestFromWords(
  text: string
): Promise<{ request: string; repaired: number } | null> {
  const t = (text || "").trim();
  if (!t || /^(cashu|creq|ln|bitcoin:|http)/i.test(t)) return null;
  const words = t.split(/\s+/);
  if (words.length < 12) return null;
  const plain = words.filter((w) => /^[A-Za-z][A-Za-z'’-]*[.,;:!?]?$/.test(w));
  if (plain.length / words.length <= 0.8) return null;
  try {
    const m = await load();
    const r = JSON.parse(m.requestFromWords(t));
    return r.request ? { request: r.request, repaired: r.repaired ?? 0 } : null;
  } catch (e) {
    console.debug("glossia: not a payment request in words", e);
    return null;
  }
}

/** `creqA…` → a paragraph of words, or null. */
export async function requestToWords(request: string): Promise<string | null> {
  if (!request || !request.trim().startsWith("creqA")) return null;
  const m = await load();
  const r = JSON.parse(m.requestToWords(request));
  return r.words ?? null;
}

/** `cashuB…` → a paragraph of words, or null (e.g. a V3 `cashuA` token). */
export async function tokenToWords(token: string): Promise<string | null> {
  if (!token || !token.trim().startsWith("cashuB")) return null;
  const m = await load();
  const r = JSON.parse(m.cashuToWords(token));
  return r.words ?? null;
}

type Vocab = ReturnType<typeof import("./glossia-scan").buildVocab>;
let vocabLoading: Promise<Vocab> | null = null;

function loadVocab(): Promise<Vocab> {
  if (!vocabLoading) {
    vocabLoading = Promise.all([load(), import("./glossia-scan")])
      .then(([m, scan]) => {
        const v = JSON.parse(m.vocabulary());
        if (v.error) throw new Error(v.error);
        return scan.buildVocab([...v.payload, ...v.cover], v.payload);
      })
      .catch((e) => {
        vocabLoading = null;
        throw e;
      });
  }
  return vocabLoading;
}

let payloadLoading: Promise<Set<string>> | null = null;

/**
 * The words that carry the voucher's data (the BIP-39 list), lower-case.
 * Every other word in a paragraph is cover: grammar that makes it read as
 * English and carries nothing.
 */
export function payloadWordSet(): Promise<Set<string>> {
  if (!payloadLoading) {
    payloadLoading = load()
      .then((m) => {
        const v = JSON.parse(m.vocabulary());
        if (v.error) throw new Error(v.error);
        return new Set<string>(v.payload);
      })
      .catch((e) => {
        payloadLoading = null;
        throw e;
      });
  }
  return payloadLoading;
}

/** Split a paragraph into words and the text between them. */
export function splitWords(
  text: string
): { text: string; word: string | null }[] {
  const parts: { text: string; word: string | null }[] = [];
  const re = /[A-Za-z][A-Za-z'’-]*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last)
      parts.push({ text: text.slice(last, m.index), word: null });
    parts.push({ text: m[0], word: m[0].toLowerCase() });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), word: null });
  return parts;
}

export type ScanProgress = (status: string, fraction: number) => void;

// The OCR worker is created once and keeps the progress callback it was made
// with, so it gets this stable one, which reports to the current scan.
let currentProgress: ScanProgress | undefined;
const reportProgress: ScanProgress = (status, fraction) =>
  currentProgress?.(status, fraction);

export type ScannedWords = {
  /** The voucher, when the photo decoded to one. */
  token: string | null;
  repaired: number;
  /** What was read, with misreads snapped to real words. */
  text: string;
  words: number;
};

/**
 * A photo or video frame of a voucher paragraph → the voucher. OCR runs in
 * the browser (Tesseract.js, served by the app from /ocr/, ~7 MB on first
 * use and cached after), misread words are snapped to Glossia's vocabulary,
 * and the paragraph's parity repairs what is left.
 */
export async function scanWordsImage(
  image: Blob | HTMLCanvasElement | HTMLVideoElement | ImageBitmap,
  onProgress?: ScanProgress
): Promise<ScannedWords> {
  const [scan, vocab] = await Promise.all([
    import("./glossia-scan"),
    loadVocab(),
  ]);
  currentProgress = onProgress;
  let r;
  try {
    r = await scan.scanImage(image, { vocab, onProgress: reportProgress });
  } finally {
    currentProgress = undefined;
  }
  const decoded = await tokenFromWords(r.text);
  return {
    token: decoded?.token ?? null,
    repaired: decoded?.repaired ?? 0,
    text: r.text,
    words: r.summary.words,
  };
}

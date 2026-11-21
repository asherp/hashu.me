//! Glossia's Cashu word encoding (`glossia::cashu`) for the wallet: the
//! same compact envelope the Hashu mint's checkout uses, so a voucher shown
//! as words there reads back here and the other way round.

use wasm_bindgen::prelude::*;

const LANGUAGE: &str = "english";
const WORDLIST: &str = "bip39";

/// `cashuB…` → a paragraph of English. JSON `{ words }` or `{ error }`.
#[wasm_bindgen(js_name = cashuToWords)]
pub fn cashu_to_words(token: &str) -> String {
    match glossia::cashu::cashu_to_words(token.trim(), LANGUAGE, WORDLIST) {
        Ok(words) => serde_json::json!({ "words": words }).to_string(),
        Err(e) => serde_json::json!({ "error": e.to_string() }).to_string(),
    }
}

/// A paragraph of English → `cashuB…`. Text around the paragraph is
/// ignored. JSON `{ token, repaired }` (how many words parity repaired) or
/// `{ error }`.
#[wasm_bindgen(js_name = cashuFromWords)]
pub fn cashu_from_words(text: &str) -> String {
    match glossia::cashu::cashu_from_words(text, LANGUAGE, WORDLIST) {
        Ok(d) => serde_json::json!({ "token": d.token, "repaired": d.repaired.len() }).to_string(),
        Err(e) => serde_json::json!({ "error": e.to_string() }).to_string(),
    }
}

/// Every word a voucher paragraph can contain, for snapping OCR misreads to
/// the nearest real word. JSON `{ payload, cover }` (lower-case) or
/// `{ error }`. Mirrors glossia's own `get_payload_words`/`get_cover_words`.
#[wasm_bindgen]
pub fn vocabulary() -> String {
    use std::collections::{BTreeSet, HashSet};
    let payload = match glossia::load_payload_words_for_wordlist(LANGUAGE, WORDLIST) {
        Ok(w) => w,
        Err(e) => return serde_json::json!({ "error": e }).to_string(),
    };
    let payload_set: HashSet<String> = payload.iter().map(|w| w.to_lowercase()).collect();
    let cover_wl = match glossia::DialectConfig::from_language_dialect_cached(LANGUAGE, "body") {
        Ok(cfg) => cfg.cover_wordlist().to_string(),
        Err(_) => "cover".to_string(),
    };
    let (by_pos, refined) =
        glossia::load_cover_words_by_pos_for_wordlist(&payload_set, LANGUAGE, &cover_wl);
    let mut cover: BTreeSet<String> = BTreeSet::new();
    for words in by_pos.into_values().chain(refined.into_values()) {
        cover.extend(words.into_iter().map(|w| w.to_lowercase()));
    }
    let payload: Vec<String> = payload.iter().map(|w| w.to_lowercase()).collect();
    serde_json::json!({ "payload": payload, "cover": cover }).to_string()
}

/// Envelope tag for a NUT-18 payment request (`creqA…`): `0x10` then the
/// request's CBOR. Kept clear of `glossia::cashu`'s tags (0x00..0x02), so
/// request prose never reads back as a voucher and the other way round.
const PAYMENT_REQUEST: u8 = 0x10;

fn b64url_to_bytes(body: &str) -> Option<Vec<u8>> {
    let mut b64: String = body
        .chars()
        .map(|c| match c {
            '-' => '+',
            '_' => '/',
            c => c,
        })
        .filter(|&c| c != '=')
        .collect();
    while b64.len() % 4 != 0 {
        b64.push('=');
    }
    glossia::base64_decode(&b64)
}

fn bytes_to_b64url(bytes: &[u8]) -> String {
    glossia::base64_encode(bytes)
        .chars()
        .filter(|&c| c != '=')
        .map(|c| match c {
            '+' => '-',
            '/' => '_',
            c => c,
        })
        .collect()
}

/// `creqA…` → a paragraph of English. JSON `{ words }` or `{ error }`.
#[wasm_bindgen(js_name = requestToWords)]
pub fn request_to_words(request: &str) -> String {
    let Some(cbor) = request
        .trim()
        .strip_prefix("creqA")
        .and_then(b64url_to_bytes)
    else {
        return serde_json::json!({ "error": "not a creqA payment request" }).to_string();
    };
    let mut payload = vec![PAYMENT_REQUEST];
    payload.extend_from_slice(&cbor);
    match glossia::canonical_encode(&payload, LANGUAGE, WORDLIST) {
        Ok(words) => serde_json::json!({ "words": words }).to_string(),
        Err(e) => serde_json::json!({ "error": e.to_string() }).to_string(),
    }
}

/// A paragraph of English → `creqA…`. JSON `{ request, repaired }` or
/// `{ error }`.
#[wasm_bindgen(js_name = requestFromWords)]
pub fn request_from_words(text: &str) -> String {
    match glossia::canonical_decode(text.trim(), LANGUAGE, WORDLIST) {
        Ok(d) => match d.payload.split_first() {
            Some((&PAYMENT_REQUEST, cbor)) => serde_json::json!({
                "request": format!("creqA{}", bytes_to_b64url(cbor)),
                "repaired": d.repaired.len(),
            })
            .to_string(),
            _ => serde_json::json!({ "error": "the text decodes, but not to a payment request" })
                .to_string(),
        },
        Err(e) => serde_json::json!({ "error": e.to_string() }).to_string(),
    }
}

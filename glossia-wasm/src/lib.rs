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
        Ok(d) => serde_json::json!({ "token": d.token, "repaired": d.repaired.len() })
            .to_string(),
        Err(e) => serde_json::json!({ "error": e.to_string() }).to_string(),
    }
}

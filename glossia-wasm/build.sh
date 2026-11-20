#!/usr/bin/env sh
# Rebuild src/js/glossia/ from this crate. Needs the wasm32-unknown-unknown
# target and wasm-bindgen-cli at the version pinned in Cargo.toml.
set -eu
cd "$(dirname "$0")"
cargo build --release --target wasm32-unknown-unknown
wasm-bindgen --target web --out-dir ../src/js/glossia --out-name hashu_glossia \
  target/wasm32-unknown-unknown/release/hashu_glossia.wasm

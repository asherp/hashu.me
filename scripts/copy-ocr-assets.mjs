// Copy Tesseract's worker, cores and English data from node_modules into
// public/ocr/, so the wallet serves its own OCR files (src/js/glossia-scan.js)
// instead of fetching them from a CDN. Runs on npm install.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public", "ocr");
const files = [
  ["tesseract.js/dist/worker.min.js", "worker.min.js"],
  // OEM LSTM_ONLY: tesseract.js picks the SIMD build when the browser has it.
  [
    "tesseract.js-core/tesseract-core-lstm.wasm.js",
    "tesseract-core-lstm.wasm.js",
  ],
  [
    "tesseract.js-core/tesseract-core-simd-lstm.wasm.js",
    "tesseract-core-simd-lstm.wasm.js",
  ],
  // The integer "best" model: about 3 MB, and what glossia.io reads with.
  [
    "@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz",
    "eng.traineddata.gz",
  ],
];

mkdirSync(out, { recursive: true });
for (const [from, to] of files) {
  const src = join(root, "node_modules", from);
  if (!existsSync(src)) {
    console.warn(
      `copy-ocr-assets: ${from} is missing; scanning words will not work`
    );
    continue;
  }
  copyFileSync(src, join(out, to));
}

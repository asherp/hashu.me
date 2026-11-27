// Renders the Hashu Operator icon set into public-operator/, which the
// operator build (HASHU_APP=operator) lays over public/. The wallet keeps the
// orange Hash cup tile; Operator flips it: a dark badge with an orange ring
// as its border and the orange cup inside, clear of the ring.
//
//   node scripts/render-operator-icons.mjs
//
// Uses Playwright's Chromium to rasterise the SVGs. favicon.ico is packed
// from the 16/32/48/64 renders.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public-operator"
);
const ORANGE = "#f7931a";
const DARK = "#111111";

const CUP =
  '<path d="M10.5 6V20A5.5 5.5 0 0 0 21.5 20V6" stroke-width="3"/>' +
  '<path d="M5 11.5H27M5 18H27" stroke-width="2.6"/>';

// The badge in a 32-unit box: ring as the border, cup scaled to sit clear of it.
// Below 48 px the ring is drawn heavier so it survives rasterising.
function badge(px) {
  const ring = px < 48 ? 3 : 2;
  const s = 0.66;
  const t = 16 - 16 * s;
  return (
    `<circle cx="16" cy="16" r="${
      16 - ring / 2
    }" fill="${DARK}" stroke="${ORANGE}" stroke-width="${ring}"/>` +
    `<g transform="translate(${t} ${t}) scale(${s})" stroke="${ORANGE}" fill="none" stroke-linecap="round" stroke-linejoin="round">${CUP}</g>`
  );
}

// Round icon, transparent outside the badge (favicons, "any" PWA icon, splash).
const round = (px) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 32 32">${badge(
    px
  )}</svg>`;

// Full-bleed dark square with the badge inside, for tiles the platform crops
// to its own shape. fill is the badge's share of the width: 0.8 keeps it in
// the maskable safe zone (a circle of 40% radius) for Android; iOS and
// Windows only round the corners, so their tiles use a larger badge.
const square = (px, fill) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 32 32">` +
  `<rect width="32" height="32" fill="${DARK}"/>` +
  `<g transform="translate(${16 - 16 * fill} ${
    16 - 16 * fill
  }) scale(${fill})">${badge(px)}</g></svg>`;

// iOS launch screen: badge centred on black, a quarter of the short side.
const launch = (w, h) => {
  const d = Math.round(Math.min(w, h) / 4);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<rect width="${w}" height="${h}" fill="#000"/>` +
    `<svg x="${(w - d) / 2}" y="${
      (h - d) / 2
    }" width="${d}" height="${d}" viewBox="0 0 32 32">${badge(d)}</svg></svg>`
  );
};

const MASKABLE = {
  "icons/icon-128x128.png": 128,
  "icons/icon-192x192.png": 192,
  "icons/icon-256x256.png": 256,
  "icons/icon-384x384.png": 384,
  "icons/icon-512x512.png": 512,
};
const TILE = {
  "icons/apple-icon-120x120.png": 120,
  "icons/apple-icon-152x152.png": 152,
  "icons/apple-icon-167x167.png": 167,
  "icons/apple-icon-180x180.png": 180,
  "icons/ms-icon-144x144.png": 144,
};
const ROUND = {
  "icons/favicon-16x16.png": 16,
  "icons/favicon-32x32.png": 32,
  "icons/favicon-96x96.png": 96,
  "icons/favicon-128x128.png": 128,
  "icons/icon-round-512x512.png": 512,
  "icon-round.png": 1024,
};
const LAUNCH = [
  [750, 1334],
  [828, 1792],
  [1080, 2340],
  [1125, 2436],
  [1170, 2532],
  [1179, 2556],
  [1242, 2208],
  [1242, 2688],
  [1284, 2778],
  [1290, 2796],
  [1536, 2048],
  [1620, 2160],
  [1668, 2224],
  [1668, 2388],
  [2048, 2732],
];
const ICO = [16, 32, 48, 64];

// CHROMIUM_PATH lets the script use an already-installed Chromium.
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);
const page = await browser.newPage();
async function render(svg, w, h) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg}</body></html>`
  );
  return page.screenshot({
    omitBackground: true,
    clip: { x: 0, y: 0, width: w, height: h },
  });
}
function save(rel, buf) {
  const p = join(OUT, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, buf);
}

for (const [rel, px] of Object.entries(MASKABLE))
  save(rel, await render(square(px, 0.8), px, px));
for (const [rel, px] of Object.entries(TILE))
  save(rel, await render(square(px, 0.9), px, px));
for (const [rel, px] of Object.entries(ROUND))
  save(rel, await render(round(px), px, px));
for (const [w, h] of LAUNCH)
  save(`icons/apple-launch-${w}x${h}.png`, await render(launch(w, h), w, h));

// favicon.ico: PNG-compressed entries (supported by every current browser).
const pngs = [];
for (const px of ICO) pngs.push(await render(round(px), px, px));
const header = Buffer.alloc(6 + 16 * pngs.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(pngs.length, 4);
let offset = header.length;
pngs.forEach((png, i) => {
  const e = 6 + 16 * i;
  header.writeUInt8(ICO[i] % 256, e);
  header.writeUInt8(ICO[i] % 256, e + 1);
  header.writeUInt16LE(1, e + 4);
  header.writeUInt16LE(32, e + 6);
  header.writeUInt32LE(png.length, e + 8);
  header.writeUInt32LE(offset, e + 12);
  offset += png.length;
});
save("favicon.ico", Buffer.concat([header, ...pngs]));

// Safari pinned tab: a one-colour mask, so ring plus cup in black.
save(
  "icons/safari-pinned-tab.svg",
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
    '<circle cx="16" cy="16" r="15" stroke="#000" stroke-width="2" fill="none"/>' +
    '<g transform="translate(5.44 5.44) scale(0.66)" stroke="#000" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
    CUP +
    "</g></svg>\n"
);

await browser.close();
console.log("Wrote Operator icons to", OUT);

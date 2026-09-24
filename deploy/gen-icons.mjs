/**
 * Build every icon the dashboard serves from one source image.
 *
 *   node deploy/gen-icons.mjs deploy/icon-source.png
 *
 * deploy/icon-source.png is the 558×740 original. It arrived as an AVIF
 * named `.png` and was converted to a real PNG. The square is cropped from
 * its centre, where the face is.
 *
 * Writes into public/: the SVG favicon, PNG favicons, the Apple touch icon
 * and the two manifest sizes a phone uses for its home screen.
 *
 * THE SVG WRAPS THE RASTER; IT DOES NOT TRACE IT. The source is a photograph,
 * and a tracer turns a photograph into a handful of flat blobs that no longer
 * look like it. Embedding keeps every pixel and still gives browsers the one
 * scalable `icon.svg` they prefer. A true vector would have to be redrawn.
 *
 * RE-RUN WITH A LARGER SOURCE when there is one. The home-screen sizes are
 * upscaled from whatever comes in, and 512 px drawn from 60 px is soft.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const source = process.argv[2];
if (!source) {
  console.error("usage: node deploy/gen-icons.mjs <source.png>");
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
mkdirSync(join(root, "icons"), { recursive: true });

// The app's surface colour. Anything transparent at the edge lands on this
// rather than on white, which is what iOS fills transparency with.
const BACKGROUND = { r: 11, g: 11, b: 15, alpha: 1 };

async function square(size) {
  return sharp(source)
    .resize(size, size, { fit: "cover", kernel: "lanczos3" })
    .flatten({ background: BACKGROUND })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

// Maskable: Android crops the icon to its own shape (circle, squircle), and
// only the centre 80% is guaranteed to survive. Shrinking into a padded canvas
// keeps the face from losing its edges to the mask.
async function maskable(size) {
  const inner = Math.round(size * 0.8);
  const art = await square(inner);
  return sharp({ create: { width: size, height: size, channels: 4, background: BACKGROUND } })
    .composite([{ input: art, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

const outputs = {
  "icons/favicon-32.png": await square(32),
  "icons/apple-touch-icon.png": await square(180),
  "icons/icon-192.png": await square(192),
  "icons/icon-512.png": await square(512),
  "icons/maskable-512.png": await maskable(512),
};

for (const [name, buffer] of Object.entries(outputs)) {
  writeFileSync(join(root, name), buffer);
  console.log(`${name}: ${buffer.length} bytes`);
}

// 128 px inside the SVG: twice the source, sharp enough for any tab or
// bookmark, small enough that the favicon is not the heaviest thing on the
// login page. The viewBox stays 256 so the corner radius reads the same.
const embedded = (await square(128)).toString("base64");
const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">` +
  `<title>CDEXIO</title>` +
  `<defs><clipPath id="r"><rect width="256" height="256" rx="56"/></clipPath></defs>` +
  `<image width="256" height="256" clip-path="url(#r)" href="data:image/png;base64,${embedded}"/>` +
  `</svg>\n`;
writeFileSync(join(root, "icon.svg"), svg);
console.log(`icon.svg: ${svg.length} bytes`);

/**
 * Renders the option images of the "European Countries Ranking" official
 * template: one square WebP per country flag, ready to upload to the
 * `options/` prefix of the img.rankmaker.net bucket like every other official
 * asset.
 *
 * Option cards are square and painted with `object-cover`, while national
 * flags are wildly different shapes (1:2 for the Nordics, 1:1 for Switzerland
 * and the Vatican, 5:3 for Sweden…). Pointing the options straight at a flag
 * image would therefore crop every flag differently. So each flag is centred
 * and letterboxed on a square canvas at its official ratio, on the card's own
 * surface colour, with a hairline outline so the white-heavy flags (Poland,
 * Malta, Monaco) still read as a flag.
 *
 * Source artwork: flagcdn.com, which serves the Wikipedia/Wikimedia SVG flags.
 *
 * Files are named after the MD5 of their bytes, matching the existing official
 * keys, and land in `.flags/` (git-ignored) next to a `manifest.json` mapping
 * country → key. Upload them with:
 *
 *   for f in .flags/*.webp; do
 *     pnpm wrangler r2 object put "rankmaker-imgs/options/$(basename $f)" \
 *       --remote --file "$f" --content-type image/webp
 *   done
 *
 * Usage: pnpm gen:flags
 */
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/** ISO 3166-1 alpha-2 codes, in the template's option order. `xk` is the
 *  user-assigned code flagcdn uses for Kosovo. */
const COUNTRIES = {
    Albania: 'al', Andorra: 'ad', Armenia: 'am', Austria: 'at', Azerbaijan: 'az',
    Belarus: 'by', Belgium: 'be', 'Bosnia and Herzegovina': 'ba', Bulgaria: 'bg',
    Croatia: 'hr', Cyprus: 'cy', Czechia: 'cz', Denmark: 'dk', Estonia: 'ee',
    Finland: 'fi', France: 'fr', Georgia: 'ge', Germany: 'de', Greece: 'gr',
    Hungary: 'hu', Iceland: 'is', Ireland: 'ie', Italy: 'it', Kosovo: 'xk',
    Latvia: 'lv', Liechtenstein: 'li', Lithuania: 'lt', Luxembourg: 'lu',
    Malta: 'mt', Moldova: 'md', Monaco: 'mc', Montenegro: 'me',
    Netherlands: 'nl', 'North Macedonia': 'mk', Norway: 'no', Poland: 'pl',
    Portugal: 'pt', Romania: 'ro', Russia: 'ru', 'San Marino': 'sm',
    Serbia: 'rs', Slovakia: 'sk', Slovenia: 'si', Spain: 'es', Sweden: 'se',
    Switzerland: 'ch', Turkey: 'tr', Ukraine: 'ua', 'United Kingdom': 'gb',
    'Vatican City': 'va',
};

/** IMAGE_DIMENSIONS.option from src/lib/images.ts: the size user uploads are
 *  re-encoded to, so official assets weigh the same as everything else. */
const SIZE = 600;
/** Padding around the flag, so the grid of cards looks like one set. */
const INSET = 48;
/** --color-surface from src/styles/global.css, the card's own background. */
const SURFACE = '#12121a';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../.flags');

const browser = await chromium.launch();
const page = await browser.newPage({
    viewport: { width: SIZE, height: SIZE },
    deviceScaleFactor: 1,
});

/** Chromium encodes the WebP — no image encoder is installed in this repo,
 *  the same trick generate-brand-cover.mjs uses. */
const encodeWebp = (png) =>
    page.evaluate(async (dataUri) => {
        const img = new Image();
        img.src = dataUri;
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext('2d').drawImage(img, 0, 0);
        return canvas.toDataURL('image/webp', 0.92).split(',')[1];
    }, `data:image/png;base64,${png.toString('base64')}`);

const flagHtml = (svg) => `<!doctype html><html><head><meta charset="utf-8"><style>
  html, body { margin: 0; width: ${SIZE}px; height: ${SIZE}px; background: ${SURFACE}; }
  body { display: flex; align-items: center; justify-content: center; }
  img {
    max-width: ${SIZE - INSET * 2}px; max-height: ${SIZE - INSET * 2}px;
    box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.22);
  }
</style></head><body>
  <img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" />
</body></html>`;

await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(OUT_DIR, { recursive: true });

const manifest = {};
for (const [name, code] of Object.entries(COUNTRIES)) {
    const res = await fetch(`https://flagcdn.com/${code}.svg`);
    if (!res.ok) throw new Error(`${name} (${code}): HTTP ${res.status}`);
    await page.setContent(flagHtml(await res.text()), { waitUntil: 'load' });
    const webp = Buffer.from(
        await encodeWebp(await page.screenshot({ type: 'png' })),
        'base64'
    );
    const key = `${createHash('md5').update(webp).digest('hex')}.webp`;
    await writeFile(join(OUT_DIR, key), webp);
    manifest[name] = `options/${key}`;
    console.log(`${name} → ${key} (${(webp.length / 1024).toFixed(1)} KB)`);
}

await writeFile(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
await browser.close();

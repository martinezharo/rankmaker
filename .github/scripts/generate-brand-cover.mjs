/**
 * Renders the square cover shipped at public/rankmaker-cover.webp (the path the
 * app reads through BRAND_COVER in src/lib/site.ts).
 *
 * It illustrates the product in one frame — a 1v1 duel resolving into a ranked
 * top 3 — because it serves two jobs at once: it is the visual for the "What is
 * RANKMAKER?" block on the home page, and it is the candidate Google draws from
 * when it picks the thumbnail beside a search result (that comes from images in
 * the page, never from og:image, and it favours large square ones). A logo
 * lockup would satisfy the second job and say nothing in the first.
 *
 * The composition is CSS rather than a hand-drawn asset so it stays in step with
 * the brand: the palette mirrors the @theme tokens in src/styles/global.css and
 * the icons are the same Font Awesome glyphs the category rows use.
 *
 * Re-run after touching the tokens below:
 *   pnpm gen:brand-cover
 */
import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../../', import.meta.url);
const asDataUri = async (relPath, mime) =>
    `data:${mime};base64,${(await readFile(new URL(relPath, root))).toString('base64')}`;

const [outfit, fontAwesome] = await Promise.all([
    asDataUri(
        'node_modules/@fontsource-variable/outfit/files/outfit-latin-wght-normal.woff2',
        'font/woff2',
    ),
    asDataUri(
        'node_modules/@fortawesome/fontawesome-free/webfonts/fa-solid-900.woff2',
        'font/woff2',
    ),
]);

const SIZE = 1200;

// fa-film and fa-gamepad: two of the category icons from src/lib/categories.ts.
const FILM = '&#xf008;';
const GAMEPAD = '&#xf11b;';

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  @font-face {
    font-family: "Outfit";
    src: url("${outfit}") format("woff2-variations");
    font-weight: 100 900;
  }
  @font-face {
    font-family: "FontAwesome";
    src: url("${fontAwesome}") format("woff2");
    font-weight: 900;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${SIZE}px; height: ${SIZE}px; }
  body {
    background: #0a0a0f;
    font-family: "Outfit", sans-serif;
    position: relative;
    overflow: hidden;
  }
  .glow { position: absolute; border-radius: 50%; }
  .glow-primary {
    width: 900px; height: 900px;
    top: -240px; left: -160px;
    background: #8400ff;
    opacity: 0.30;
    filter: blur(190px);
  }
  .glow-gold {
    width: 560px; height: 560px;
    bottom: -260px; right: -200px;
    background: #ffba00;
    opacity: 0.10;
    filter: blur(200px);
  }
  /* Full-bleed: the cover is displayed inside a rounded, bordered container in
     the page and cropped to a square by Search, so an inner frame would only
     shrink the artwork. */
  .frame {
    position: absolute;
    inset: 0;
    background: linear-gradient(155deg, rgba(17,17,24,0.92) 0%, rgba(10,10,15,0.55) 60%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 64px;
  }

  /* The duel: the choice the ranking is built from. */
  .duel { position: relative; display: flex; gap: 66px; margin-bottom: 96px; }
  .option {
    width: 350px; height: 350px;
    border-radius: 38px;
    border: 3px solid rgba(168, 85, 247, 0.45);
    background: linear-gradient(150deg, #241a3d, #141020);
    box-shadow: 0 0 60px rgba(132, 0, 255, 0.25);
    display: flex; align-items: center; justify-content: center;
    font-family: "FontAwesome";
    font-size: 132px;
    color: #a855f7;
  }
  /* The winner carries the gold the results view uses for first place. */
  .option.winner {
    border-color: rgba(255, 215, 0, 0.45);
    background: linear-gradient(150deg, #332711, #1a1408);
    box-shadow: 0 0 60px rgba(255, 186, 0, 0.20);
    color: #ffd700;
  }
  .vs {
    position: absolute; left: 50%; top: 50%;
    transform: translate(-50%, -50%);
    width: 120px; height: 120px;
    border-radius: 50%;
    background: #141020;
    border: 3px solid rgba(255, 215, 0, 0.6);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.7);
    display: flex; align-items: center; justify-content: center;
    font-size: 50px; font-weight: 900;
    color: #ffd700;
  }

  /* The result: what the duels add up to. */
  .standings { display: flex; flex-direction: column; gap: 26px; }
  .place { display: flex; align-items: center; gap: 24px; }
  .position { width: 52px; text-align: right; font-size: 54px; font-weight: 900; color: #a855f7; }
  .bar { height: 36px; border-radius: 18px; background: rgba(168, 85, 247, 0.3); }
  .place.first .position { color: #ffd700; }
  .place.first .bar { background: linear-gradient(90deg, #ffd700, #ffba00); opacity: 0.9; }

</style></head>
<body>
  <div class="glow glow-primary"></div>
  <div class="glow glow-gold"></div>
  <div class="frame">
    <div class="duel">
      <div class="option">${FILM}</div>
      <div class="vs">VS</div>
      <div class="option winner">${GAMEPAD}</div>
    </div>
    <div class="standings">
      <div class="place first">
        <span class="position">1</span><span class="bar" style="width: 470px"></span>
      </div>
      <div class="place">
        <span class="position">2</span><span class="bar" style="width: 375px"></span>
      </div>
      <div class="place">
        <span class="position">3</span><span class="bar" style="width: 292px"></span>
      </div>
    </div>
  </div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({
    viewport: { width: SIZE, height: SIZE },
    deviceScaleFactor: 1,
});
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
const png = await page.screenshot({ type: 'png' });

// No image encoder is installed in this repo, so Chromium does the WebP
// encoding — the same encoder the browsers fetching the asset decode with.
const webp = await page.evaluate(async (pngDataUri) => {
    const img = new Image();
    img.src = pngDataUri;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext('2d').drawImage(img, 0, 0);
    return canvas.toDataURL('image/webp', 0.92).split(',')[1];
}, `data:image/png;base64,${png.toString('base64')}`);

const out = fileURLToPath(new URL('public/rankmaker-cover.webp', root));
await writeFile(out, Buffer.from(webp, 'base64'));
await browser.close();
console.log(`wrote ${out} (${SIZE}x${SIZE})`);

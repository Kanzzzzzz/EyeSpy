/**
 * Renders the app icon and in-app logo from assets/logo.jpg, and the splash
 * screen from assets/splash.svg, into every size Android and iOS need. Run with `pnpm --filter @eyespy/app icons`.
 */
import sharp from 'sharp';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const LOGO = 'assets/logo.jpg';
// The logo's own corner colour, so padding around it is invisible.
const BG = '#0C101C';

const save = async (img, file) => {
  mkdirSync(dirname(file), { recursive: true });
  await img.png().toFile(file);
};

/** The whole logo as a square, optionally cut to a circle or rounded square. */
async function icon(size, file, { shape = 'square' } = {}) {
  let img = sharp(LOGO).resize(size, size);
  if (shape !== 'square') {
    const r = shape === 'round' ? size / 2 : size * 0.22;
    const mask = Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" ry="${r}"/></svg>`);
    img = img.composite([{ input: mask, blend: 'dest-in' }]);
  }
  await save(img, file);
}

/**
 * Android adaptive foreground: 108dp canvas of which only the middle 66dp is
 * guaranteed visible, so the badge is scaled to sit inside that safe zone.
 */
async function adaptiveForeground(size, file) {
  const inner = Math.round(size * 0.69);
  const pad = size - inner;
  const left = Math.floor(pad / 2);
  const img = sharp(LOGO)
    .resize(inner, inner)
    .extend({ top: left, bottom: pad - left, left, right: pad - left, background: BG });
  await save(img, file);
}

/** The original EyeSpy eye splash, kept so the launch screen matches the in-app design. */
async function splash(W, H, file) {
  await save(sharp('assets/splash.svg', { density: 72 }).resize(W, H, { fit: 'cover' }), file);
}

// Android launcher icons (legacy + adaptive foreground).
const android = 'android/app/src/main/res';
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
if (existsSync(android)) {
  for (const [d, k] of Object.entries(densities)) {
    await icon(Math.round(48 * k), `${android}/mipmap-${d}/ic_launcher.png`, { shape: 'rounded' });
    await icon(Math.round(48 * k), `${android}/mipmap-${d}/ic_launcher_round.png`, { shape: 'round' });
    await adaptiveForeground(Math.round(108 * k), `${android}/mipmap-${d}/ic_launcher_foreground.png`);
  }
  for (const [d, k] of Object.entries(densities)) {
    const w = Math.round(320 * k);
    const h = Math.round(480 * k);
    await splash(w, h, `${android}/drawable-port-${d}/splash.png`);
    await splash(h, w, `${android}/drawable-land-${d}/splash.png`);
  }
  await splash(480, 480, `${android}/drawable/splash.png`);
}

// iOS: a single 1024 icon (Xcode 14+ derives the rest) and the splash.
const ios = 'ios/App/App/Assets.xcassets';
if (existsSync(ios)) {
  await icon(1024, `${ios}/AppIcon.appiconset/AppIcon-512@2x.png`);
  for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
    await splash(2732, 2732, `${ios}/Splash.imageset/${name}`);
  }
}

// Store listing icon, browser tab icon and the logo shown inside the app.
await icon(512, 'assets/store-icon-512.png');
await icon(256, 'public/icon.png', { shape: 'rounded' });
mkdirSync('src/art', { recursive: true });
await sharp(LOGO).resize(720, 720).webp({ quality: 88 }).toFile('src/art/logo.webp');
console.log('icons, splash screens and logo written');

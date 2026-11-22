/**
 * Renders the app icon and splash screen from the SVGs in assets/ into every
 * size Android and iOS need. Run with `pnpm --filter @eyespy/app icons`.
 */
import sharp from 'sharp';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const BG = '#0B1020';
const out = async (input, size, file, opts = {}) => {
  mkdirSync(dirname(file), { recursive: true });
  let img = sharp(input, { density: 600 }).resize(size, size, { fit: 'contain', background: BG });
  if (opts.round) {
    const mask = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/></svg>`);
    img = img.composite([{ input: mask, blend: 'dest-in' }]);
  }
  if (opts.flatten) img = img.flatten({ background: BG });
  await img.png().toFile(file);
};

// Android launcher icons (legacy + adaptive foreground).
const android = 'android/app/src/main/res';
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
if (existsSync(android)) {
  for (const [d, k] of Object.entries(densities)) {
    await out('public/icon.svg', Math.round(48 * k), `${android}/mipmap-${d}/ic_launcher.png`);
    await out('public/icon.svg', Math.round(48 * k), `${android}/mipmap-${d}/ic_launcher_round.png`, { round: true });
    await out('assets/icon-foreground.svg', Math.round(108 * k), `${android}/mipmap-${d}/ic_launcher_foreground.png`);
  }
  for (const [d, k] of Object.entries({ mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 })) {
    const w = Math.round(320 * k);
    const h = Math.round(480 * k);
    for (const orient of ['port', 'land']) {
      const [W, H] = orient === 'port' ? [w, h] : [h, w];
      const file = `${android}/drawable-${orient}-${d}/splash.png`;
      mkdirSync(dirname(file), { recursive: true });
      await sharp('assets/splash.svg', { density: 72 }).resize(W, H, { fit: 'cover' }).png().toFile(file);
    }
  }
  await sharp('assets/splash.svg', { density: 72 }).resize(480, 480).png().toFile(`${android}/drawable/splash.png`);
}

// iOS: a single 1024 icon (Xcode 14+ derives the rest) and the splash.
const ios = 'ios/App/App/Assets.xcassets';
if (existsSync(ios)) {
  await out('public/icon.svg', 1024, `${ios}/AppIcon.appiconset/AppIcon-512@2x.png`, { flatten: true });
  for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
    await sharp('assets/splash.svg', { density: 72 }).resize(2732, 2732).png().toFile(`${ios}/Splash.imageset/${name}`);
  }
}

// Store listing icon.
await out('public/icon.svg', 512, 'assets/store-icon-512.png', { flatten: true });
console.log('icons and splash screens written');

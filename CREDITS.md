# Credits

All art, sounds and music in EyeSpy are original and made in code: the logo,
the anime character kit (12 public characters and 42 secret role characters),
role badges, finisher animations, sound effects (ZzFX and Web Audio) and the
tension loop. The characters are original; none are taken from existing anime.
Japanese lettering uses the phone's built-in CJK font. This file lists
borrowed code, fonts and libraries.

## Code copied or ported into this repo

| What | Where | Source | Licence |
| --- | --- | --- | --- |
| ZzFX sound generator (TypeScript port) | `app/src/audio/zzfx.ts` | [ZzFX](https://github.com/KilledByAPixel/ZzFX) by Frank Force | MIT |
| mulberry32 PRNG | `packages/engine/src/state.ts` | Public-domain algorithm by Tommy Ettinger | Public domain |

## Fonts (bundled)

| Font | Package | Licence |
| --- | --- | --- |
| Anton | `@fontsource/anton` ([Google Fonts](https://fonts.google.com/specimen/Anton)) | SIL Open Font License 1.1 |
| Outfit | `@fontsource-variable/outfit` ([Google Fonts](https://fonts.google.com/specimen/Outfit)) | SIL Open Font License 1.1 |

## Libraries shipped in the app

| Library | Licence |
| --- | --- |
| React, React DOM | MIT |
| Motion (Framer Motion) | MIT |
| Zustand | MIT |
| Zod | MIT |
| Capacitor core and official plugins | MIT |
| @capacitor-community/keep-awake | MIT |
| capacitor-zeroconf | MIT |
| qrcode | MIT |
| jsQR | Apache-2.0 |
| canvas-confetti | ISC |
| Java-WebSocket (Android host server) | MIT |

## Not used

The design doc lists Lucide, Phosphor, Kenney, DiceBear, LottieFiles, Freesound,
Sonniss, Pixabay Music, Incompetech, Howler.js and Tone.js as possible sources.
None of them ended up being needed; add a row above if one is introduced.

## Visual reference

The UI's motion style (springy controls with drawn impact bursts, slashes,
smoke and manga sound-effect lettering) takes inspiration from the
[Sakuga VFX gallery](https://sakuga-vfx.vercel.app/gallery/). No code or
assets were copied; EyeSpy's effects layer (`app/src/fx`) is written from
scratch.

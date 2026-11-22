# Credits

All art, sounds and music in EyeSpy are original and made in code: the logo,
the 12 avatars, role badges, sound effects (ZzFX parameters) and the tension
loop (Web Audio). This file lists borrowed code, fonts and libraries.

## Code copied or ported into this repo

| What | Where | Source | Licence |
| --- | --- | --- | --- |
| ZzFX sound generator (TypeScript port) | `app/src/audio/zzfx.ts` | [ZzFX](https://github.com/KilledByAPixel/ZzFX) by Frank Force | MIT |
| mulberry32 PRNG | `packages/engine/src/state.ts` | Public-domain algorithm by Tommy Ettinger | Public domain |

## Fonts (bundled)

| Font | Package | Licence |
| --- | --- | --- |
| Fraunces | `@fontsource-variable/fraunces` ([Google Fonts](https://fonts.google.com/specimen/Fraunces)) | SIL Open Font License 1.1 |
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

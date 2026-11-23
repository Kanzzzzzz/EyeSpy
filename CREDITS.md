# Credits

The app logo (`app/assets/logo.jpg`, used for the launcher icon, store icon and
the Home screen) is artwork supplied by the project owner. All other art, sounds and music in
EyeSpy are original and made in code: the role badges and the motion-graphics finishers. The 12 lobby portraits (`app/src/art/portraits/`) are
painted art from the EyeSpy character sheet, upscaled and rigged (see below). The characters are original;
none are taken from existing anime. Sound effects are recordings from
効果音ラボ (see below), layered and mixed in code.
Japanese lettering uses the phone's built-in CJK font. This file lists
borrowed code, fonts and libraries.

## Code copied or ported into this repo

| What | Where | Source | Licence |
| --- | --- | --- | --- |
| mulberry32 PRNG | `packages/engine/src/state.ts` | Public-domain algorithm by Tommy Ettinger | Public domain |

## Tools used to make assets (not shipped)

| What | Used for | Source | Licence |
| --- | --- | --- | --- |
| Real-ESRGAN, `RealESRGAN_x4plus_anime_6B` model | 4x upscale of the 12 lobby portraits and their eye close-ups | [xinntao/Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN) | BSD 3-Clause |

## Sound effects (bundled)

| What | Where | Source | Licence |
| --- | --- | --- | --- |
| 27 recorded sound effects (slashes, impacts, temple bell, gong, taiko, kotsudumi, magic, heartbeat, glints, wood knocks) | `app/public/sfx/` | [効果音ラボ (Soundeffect-Lab)](https://soundeffect-lab.info/) | Free for use in games and apps, commercial included, no credit required. Redistributing the raw files (as a library, soundboard or in a public repo) is not allowed, and direct linking to their files is not allowed. Terms: https://soundeffect-lab.info/agreement/ |

Keep this repository private while `app/public/sfx/` is in it, since a public repo would count as redistributing the raw files.

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

## Name references

| What | Where | Reference |
| --- | --- | --- |
| The Judge's signature move, "Domain Expansion: Deadly Sentencing" (and the 領域展開 lettering in its intro) | `packages/engine/src/roster.ts`, `app/src/motion/CourtScene*.tsx` | A fan nod to Hiromi Higuruma's domain in *Jujutsu Kaisen* by Gege Akutami (Shueisha). Only the name is referenced; the character (Rei Tenbin), art and animation are original. Credited in the app's Settings screen. Not affiliated with or endorsed by the series. |

## Visual reference

The UI's motion style (springy controls with drawn impact bursts, slashes,
smoke and manga sound-effect lettering) takes inspiration from the
[Sakuga VFX gallery](https://sakuga-vfx.vercel.app/gallery/). No code or
assets were copied; EyeSpy's effects layer (`app/src/fx`) is written from
scratch.

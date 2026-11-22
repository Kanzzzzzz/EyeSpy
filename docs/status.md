# Build status

Where each task in the build plan (`docs/design.md`) stands. "Verified" means
checked by an automated test or build on a Windows dev machine; anything
that needs real phones, a Mac or store accounts is marked as such.

| # | Task | Status |
| --- | --- | --- |
| 0.1 | Monorepo, React app, Capacitor Android + iOS, lint, Vitest, CI | Done. Android debug APK builds locally; CI workflows written (not yet run on GitHub) |
| 0.2 | CLAUDE.md, CREDITS.md, design tokens | Done |
| 1.1 | GameState, phases, reducer, `viewFor` | Done, tested |
| 1.2 | Role interface + registry; Killer, Sheriff, Citizen | Done, tested |
| 1.3 | Raises, Shush, Snitch, Lovers, role-mix suggester | Done, tested (mixes valid for 5 to 20) |
| 1.4 | Win checks, timers via `tick`, event log, settings | Done; 1,000 random games with no illegal state |
| 2.1 | Protocol schemas, `room`, Node dev host | Done; 10 bots finish a game over real sockets |
| 2.2 | Native local-server plugin | Written. Android (Kotlin) compiles in the APK build; iOS (Swift) is uncompiled until built on a Mac. Not yet run on a phone |
| 2.3 | Bonjour discovery, game QR, Wi-Fi QR | Written (capacitor-zeroconf, jsQR camera scanner, QR codes). Needs a phone test |
| 2.4 | Heartbeats, resend missed events, snapshots, version check | Done, tested (including host crash and restart) |
| 2.5 | Device test, Android ↔ iPhone, 6+ phones | **Needs real phones** |
| 3.1 to 3.3 | All screens, full round, play again | Done; a full round plays in the browser (Playwright) |
| 3.4 | Playtest with a real group | **Needs people** |
| 4.1 | Shared components, motion presets, logo, fonts | Done |
| 4.2 | Avatar kit, role badges, animations, particles | Done. 60 fps on a mid-range Android phone still to be measured |
| 4.3 | ZzFX sounds, music loop, vibration patterns | Done |
| 4.4 | Reduced motion, accessibility pass, CREDITS check | Done in code (48 px targets, team icon + pattern, reduced-motion setting, captions for every sound). A screen-reader pass on devices is still worth doing |
| 5.1 | Icons, splash, permission explainers, privacy text | Done (`pnpm --filter @eyespy/app icons`, PRIVACY.md) |
| 5.2 | TestFlight and Play internal testing | **Needs an Apple developer account and a Play Console account** |
| 6.x | Special roles | All seven done in the engine, behind switches, with tests and badges |

## Choices that differ from the design doc

- **Android server library:** Java-WebSocket instead of Ktor. It does the one
  job needed (text frames on a local socket) at about 100 KB, where Ktor
  adds coroutines and a server engine.
- **No Lottie, Howler or Tone.js:** every animation is Motion on SVG, sound
  effects play through Web Audio directly, and the music loop is synthesised
  live rather than recorded to a file. Fewer dependencies, same result.
- **Browser development mode:** a host tab serves other tabs of the same
  browser over BroadcastChannel, and "Add practice bots" fills the lobby, so
  the whole game can be played and screenshotted without phones.
- **Phases:** lobby, reveal, playing, arrest, ended (the doc's diagram was
  embedded content that didn't come through).

## Proposals adopted (from the design doc)

15 s wink cooldown, 10 s between raises, the multi-Killer win rule, Shush lock
for 2 more kills, Snitch tip without the Snitch's name. All are host settings
or easy to change in `packages/engine/src/state.ts`.

## Known gaps

- iOS host must keep EyeSpy in the foreground (iOS suspends sockets in the
  background). The app keeps the screen awake and explains this up front.
- A few Android models block traffic between hotspot guests; the plan's
  5-model test (task 2.5) is the way to find them.
- Camera winks/eyebrows (the stretch idea) are not started.

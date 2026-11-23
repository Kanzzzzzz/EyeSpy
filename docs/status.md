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

## Version 2: eyes, anime and the Judge (Nov 2026)

| Change | Status |
| --- | --- |
| Manga-panel look mode: one panel open at a time | Done (engine `look` action, Play screen) |
| Real eye contact for winks and raises; witnesses see winks and raises; "eyes on you" counter | Done, tested (`packages/engine/test/eyes.test.ts`) |
| Only the Shush, Snitch and Judge can raise | Done, tested |
| Judge role (7+ players): one hearing, a 30 s vote after the intro cutscene with live counts per player (never who voted for whom), ties free everyone, Sheriff voted out loses, last Killer voted out wins | Done, tested (`judge.test.ts`); hearing screen in the app |
| Secret role characters (names and finisher moves) + 12 public characters | Superseded in Version 4: the drawn role faces are gone, see below |
| Killer finishers: realm (domain-style), slash, shadow; arrest chains; hearing gavel | Done |
| Anime UI: tokens, Anton display type, sakuga effects layer (impact, slash, smoke, splash, sparkle, speed lines, manga lettering, shake, flash), springy controls | Done; switches off with reduced motion |
| Anime sound design and taiko/koto tension loop, synthesised live | Done |
| Protocol bumped to v2 (old apps get "Update EyeSpy") | Done |
| Host bandwidth: phones whose view didn't change get nothing; looks are rate-limited and not written to disk | Done |
| Bots play by the eye rules (glance, wait for contact, prefer unwatched winks, vote) | Done; 10 bots still finish a game over real sockets |

**Why the characters are original:** the app stores reject games that use
another studio's characters (for example Sukuna), so the cast is original,
written in the same spirit: a cursed demon-king Killer with a domain-style
finisher, a silent blade, a puppet queen, and so on for every role.

**Still needs real phones:** eye contact over the hotspot feels instant in the
browser; it should be checked on 6+ phones (task 2.5), along with the effects'
frame rate on a mid-range Android phone.

## Admin test tools

Settings → Testing → **Admin test tools** (off by default). When this phone
hosts: a **Practice** game on the home screen (you plus 7 bots, faster
cooldowns), and an **Admin** button in game. In the panel you can:
- play as any of the 14 roles
- unlock abilities and reset cooldowns, and lift the Shush lock
- call a hearing, and make the bots vote someone out
- pause the bots and show every role on the panels
- make any bot lock eyes with you, look at you, wink you or raise an eyebrow at you

The tools act only on the host's own room (`Room.admin` and
`packages/engine/src/admin.ts`). They are not in the protocol, so guests'
phones can't use them.

## Version 3: exclusive characters, motion graphics, recorded sound

- The cast is now two exclusive original characters, **Shuten, the Cursed
  Sovereign** (Killer) and **Rei Tenbin, the Unblinking Magistrate** (Judge).
  Other roles play as their public lobby face. Characters from existing
  anime (for example Sukuna or Higuruma) are not used, by policy, even
  for a private build.
- Drawing kit upgraded: cel shading, layered irises, lid creases, winged
  lashes, gradient hair with highlights and strands. All 12 public faces redrawn.
- Motion-graphics finishers on a frame-timed canvas engine (`app/src/motion`):
  "Thousand-Petal Abattoir" (Shuten's kill, 4.2 s) and "Domain Expansion:
  Deadly Sentencing" (the hearing intro, 4.4 s, on every phone; a real-time
  WebGL2 scene where a dark courtroom assembles itself under striking
  spotlights and the gavel raps three times, with a 2D fallback and a failsafe
  timer; a nod to Jujutsu Kaisen credited in Settings).
- Sound: 27 recorded effects from 効果音ラボ, layered with sub-bass and a
  generated reverb into cues; the music is now recorded taiko over a low pad.
  The 8-bit synth is gone.

## Version 4: your own face in the kill, and screens that fit

- The drawn role characters (Shuten, Rei Tenbin) and the whole drawing kit
  (`AnimeFace`, `characters.ts`) are gone. Killer and Judge keep their names
  and move titles, but every face on screen is a player's painted lobby portrait.
- The Killer's finisher is now played on the victim's own portrait: it is
  dragged into the realm, trembles, and one slash through the middle of the
  screen splits it in two (`app/src/motion/SlashedFace.tsx`); the other cuts
  fan out over it. The lighter slash and shadow finishers use the same cut.
- The Play screen sizes every player's panel to the space left on screen
  (`app/src/ui/fitGrid.ts`), so a full room of up to 20 fits without scrolling,
  and the open eye panel is capped to a share of the screen height. The hearing
  docket goes to two slimmer columns when more than 6 players are alive.
- Custom image slots now cover the 12 lobby faces only (`avatar-0` .. `avatar-11`);
  the `char-killer` and `char-judge` slots went with the role faces.

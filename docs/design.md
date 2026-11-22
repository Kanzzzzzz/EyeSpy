# EyeSpy: Game Design & Build Plan

Nov 21, 2026 · @Kanz

## Overview

EyeSpy is a phone-only party game in the wink-murder genre. Players sit in the same room in silence, each with the EyeSpy app, and every move happens on the phone: winks, eyebrow raises, deaths, tips and arrests. The plan is a React web app packaged as native Android and iPhone apps. One phone hosts the game over its hotspot and every other phone joins it, with no internet needed.

**Goals**

- Works fully offline over a phone hotspot or shared Wi-Fi, with Android phones and iPhones in the same game.
- Reliable connections: automatic discovery, fast reconnects, and a game that survives a dropped phone or a crashed host app.
- Feels premium: smooth transitions, dramatic role reveals and deaths, sound and haptics.
- Role system built so new roles are a small, self-contained addition.
- Built in small, testable steps that Claude Code can do one pull request at a time.

**Open questions for you** (my default is in brackets, and the rest of the doc assumes it)

- [x] **Digital winks**, with the whole game on phones.
- [x] **Everyone installs the app** on Android or iPhone, and any phone can host.
- [x] **Web tech, not Flutter:** React and TypeScript, packaged with Capacitor.
- [x] **5 to 20 players**, tuned for 8 to 12.
- [x] **Rules from Kanz:** the Killer wins when only the Sheriff, the Killer and one other are alive; the Shush is on the Killer's team and the Snitch on the town's; Lovers don't know each other; victims see who winked them (host can turn it off); special roles are opt-in.
- [x] **Shush lock.** Does it last for 2 more kills after the Shush acts, or until the Killer has 2 kills in total? \[2 more kills\]
- [x] **Snitch tip.** Does it show the Snitch's name? \[No\]
- [x] **Several Killers.** With 2 or 3 Killers, do they win when only the Sheriff, the Killers and one other are alive? \[Yes\]
- [x] **Art direction.** Noir detective, playful cartoon, or neon? \[Playful noir\]

## Platform and tech stack

I recommend React and TypeScript, packaged with Capacitor into real Android and iPhone apps that everyone installs from the app stores. The game runs in the app's built-in web view, and a small native plugin lets any phone act as the host server. The rules live in a pure TypeScript package, so they get fast tests and are shared by the host and every player. Compared with Flutter, this needs a little native code for the server, and animations need care to stay smooth, which the performance budget below covers.

| Layer | Choice | Why |
| --- | --- | --- |
| App | React 18, TypeScript and Vite, packaged with Capacitor as native Android and iOS apps | One web codebase; installed from Google Play and the App Store |
| Game rules | Pure TS package (`engine`), reducer style | No I/O, so it is fast to test and easy for Claude Code to reason about |
| Room logic | Pure TS package (`room`): players, seats, reconnects, snapshots | Runs on the host phone, and in Node for automated tests |
| Host server | Small native Capacitor plugin: Kotlin (Ktor) on Android, Swift (Network framework) on iOS. It accepts WebSocket connections and hands messages to the room logic | The only native code in the project, a few hundred lines per platform, written by Claude Code |
| Messages | Zod schemas, JSON over WebSockets, with a protocol version | Typed on both ends; mismatched app versions get a clear message |
| Discovery | Bonjour/mDNS through a Capacitor zeroconf plugin, with QR codes as a fallback | The same service is found from Android and iPhone; QR always works |
| UI | Tailwind CSS, Zustand | Utility styling, small state store |
| Animation | Motion (Framer Motion) for UI, animated SVG and Lottie for characters and role cards | Smooth transitions plus rich animations that work offline |
| Sound and haptics | Howler.js, Capacitor Haptics | Native vibration patterns on both platforms |
| Storage | Capacitor Preferences for the player token, Filesystem for the host's game snapshot | Reconnects and crash recovery |
| Screen awake | Capacitor keep-awake plugin | Phones don't sleep mid-round |
| Tests | Vitest (rules, room), simulated 10-player games, Playwright for screens | Most testing runs without a phone |
| CI | GitHub Actions for tests and Android builds; a macOS runner for iPhone builds | iPhone builds need Xcode |

**Alternatives I considered.** Flutter would need no native server code, but you'd rather not use it. React Native is close to this plan, but its UI is not plain web, so less code carries over. Google Nearby Connections and Apple's MultipeerConnectivity each work only within their own platform, so plain Wi-Fi sockets are the only offline option that lets Android phones and iPhones play together.

## Offline networking

The host phone runs the game and is the only source of truth. Every other phone joins it over the host's hotspot or a shared Wi-Fi, and Android phones and iPhones can mix freely. No internet, accounts or cloud are involved.

&#91;embedded content: offline architecture · one host, many phones\]

Each phone keeps one two-way connection to the host: it sends actions, and the host sends back only what that player may see.

**How a game connects**

1. The host turns on their phone's hotspot (or everyone joins one Wi-Fi) and taps Host. The app shows a Wi-Fi QR code so guests join the network with one scan. The host types the hotspot name and password once, because phones don't let apps read them.
2. The app starts its game server and announces `_eyespy._tcp` over Bonjour/mDNS.
3. Guests open EyeSpy and the game appears under Nearby games. If discovery is blocked, they scan the game QR code (address, port and room code) instead.
4. Each phone keeps a player token. If it locks or drops off Wi-Fi, it reconnects in seconds and gets its seat and role back. The game waits up to 30 seconds for a missing player before marking them away.

**Making connections reliable.** A heartbeat every 2 seconds spots a dropped phone within about 5 seconds. Every message carries a sequence number, so a reconnecting phone receives exactly what it missed. The host saves the game to disk after every action, so even an app crash resumes the round. Each phone sends its app version on join, so an outdated app gets an "Update EyeSpy" message instead of strange bugs.

**Anti-cheat.** The server never sends a phone anyone else's role. Each client gets its own filtered view of the game, so even a modified app reveals nothing.

**Platform rules to design around.** iPhones need the Local Network permission and the Bonjour service name declared in the app. Both apps must also allow plain WebSocket traffic to local addresses (an App Transport Security exception on iOS, a network security config on Android). We explain the permission on first launch, because a denied permission is the most common cause of "can't find the game". iOS cuts an app's network when it goes to the background, so every phone, especially the host, keeps EyeSpy open during a round. The app keeps the screen awake and warns before you switch away.

**Hosting on each platform**

| Host | Setup | Risk |
| --- | --- | --- |
| Android phone | Turn on hotspot in settings, tap Host | Low to medium: a few phone models block traffic between hotspot guests, so we test at least 5 models |
| iPhone | Turn on Personal Hotspot with "Allow Others to Join", tap Host | Medium: the host must keep the app open |
| Shared Wi-Fi | Any phone taps Host | Low at home; hotel and public Wi-Fi often block devices from seeing each other |

## Roles and rules

These are Kanz's rules. The room plays in silence and every action goes through the app. The Killer wins by thinning out the room, and the Sheriff wins by arresting the Killer. Nobody knows who the Shush and Snitch are, not even the Killer or the Sheriff, so every eyebrow raise could come from a friend or an enemy. Anything marked **Proposal** is my addition for you to confirm.

**Gestures become taps.** Every phone shows the same grid of players' faces, and everyone taps all game long, so tapping alone gives nobody away.

- **Wink** (Killer only): tap a face, then Wink. The victim's phone buzzes and counts down 3 seconds so the room can't match the timing, then the death shows on every phone. **Proposal:** a 15-second cooldown between winks.
- **Eyebrow raise** (everyone): tap a face, then Raise eyebrow. The target sees who raised an eyebrow at them. Anyone can do it to bluff or stir up panic, which hides the Shush and Snitch charging up: their 3rd raise unlocks their ability. **Proposal:** raises at least 10 seconds apart.
- **Arrest** (Sheriff only): tap a face and hold to confirm. The game pauses for the verdict.
- **Stretch idea:** a camera mode where the front camera detects real winks and eyebrow raises on the device, for groups who want the physical feel back.

| Role | Team | Knows at the start | Ability |
| --- | --- | --- | --- |
| Killer | Killers | Own role (and fellow Killers in big games) | Winks to kill anyone except the Sheriff. Winking the Sheriff kills nobody and tells the Sheriff who the Killer is |
| Sheriff | Town | Own role only; hidden from everyone | Arrests a player. Arresting the Killer wins; arresting anyone else loses the game. Can't be killed |
| Shush | Killers | Own role only. Doesn't know the Killer or Sheriff, and they don't know the Shush | After 3 eyebrow raises, one time only: shushes the Sheriff, who then can't arrest until 2 more kills happen. Works without knowing who the Sheriff is |
| Snitch | Town | Own role only. Doesn't know the Killer or Sheriff, and they don't know the Snitch | After 3 eyebrow raises, one time only: names who they think the Killer is, shown on every phone. The Sheriff decides whether to act on it |
| Lovers (a pair) | Town | Nothing: a Lover doesn't know who their partner is | If one dies, the other dies too. A Lover holds no other role |
| Citizen | Town | Own role only | No ability. Watch and wait; when you die, your death and its timing become clues for the Sheriff and Snitch |

**Win conditions**

- **Town wins** when the Sheriff arrests the Killer. With more than one Killer, each correct arrest removes one and the Sheriff keeps going until all are caught.
- **Killers win** the moment the Sheriff arrests anyone who isn't a Killer.
- **Killers also win** when only 3 players are alive: the Sheriff, the Killer and one other. With 2 or 3 Killers, **Proposal:** when only the Sheriff, the Killers and one other are alive.
- The Shush wins with the Killers; the Snitch, Lovers and Citizens win with the town, alive or dead.

**Suggested role mix by player count** (host can override every number)

| Players | Killers | Sheriff | Shush | Snitch | Lover pair | Citizens |
| --- | --- | --- | --- | --- | --- | --- |
| 5–6 | 1 | 1 | 1 | 1 | 0 | rest |
| 7–9 | 1 | 1 | 1 | 1 | 1 | rest |
| 10–14 | 2 | 2 | 1 | 1 | 1 | rest |
| 15–20 | 3 | 3 | 1 | 1 | 1 | rest |

**The tricky part.** Because nobody knows the Shush and Snitch, an eyebrow raise is a puzzle. The Killer can't tell whether a raiser is an ally charging up the Shush or a Snitch about to name them. The Sheriff can't tell help from a trap. The Killer also risks winking the hidden Sheriff, which gives away their name, unless the Shush has already locked arrests. **Rule:** victims see who winked them on their death screen and must stay silent; the host can switch this off in game settings.

**Special roles** (off by default; the host switches each one on in game settings. The standard roles above are always the base game)

| Role | Team | Twist |
| --- | --- | --- |
| Drama Queen | Alone | Wins if the Sheriff or Killer arrests/kill them, so they raise eyebrows like crazy to look guilty |
| Bodyguard | Town | Once, guards a player. If that player is winked, the Bodyguard dies instead |
| Paparazzi | Town | Once, "snaps" a player and learns how many winks they have sent |
| Copycat | Changes | Becomes the role of the first player to die |
| Medium | Town | Each dead player can send the Medium one emoji |
| Decoy | Killers | Sends fake winks: the target's phone counts down, then shows "Phew, just a twitch" |
| Insomniac | Town | Feels a nameless buzz every time anyone winks |

Every role is one TypeScript file that declares its team, what it knows at the start, its abilities (unlock rules such as 3 raises, uses and cooldowns), how it reacts to events, and how it affects the win check. That makes each new role a self-contained task.

## Game state machine and architecture

The server owns one game state per room and changes it only through the engine's reducer: `(state, action) → { state, events }`. Phones send actions; the server validates them, runs the reducer, and pushes each phone its own filtered view. This keeps the rules in one tested place and makes cheating or desync impossible by design.

**Phases**

&#91;embedded content: game phases · 6 states\]

Role reveal ends when everyone taps Ready or after 30 seconds. An arrest pauses the game: a correct arrest goes back to Playing while Killers remain, and a wrong arrest ends the game.

**Engine shape**

- `GameState`: phase, players (seat, name, avatar, alive, role, connected), role state (eyebrow raise counts, abilities used, wink cooldowns, the Shush lock's kills remaining, lover links), timers and an event log.
- `Action`: `join`, `configure`, `start`, `ready`, `wink`, `raiseEyebrow`, `useAbility`, `arrest`, `playAgain`, plus host-only `tick` and `disconnect`.
- `Event`: what the UI animates, for example `Winked`, `PlayerDied { cause: wink | heartbreak }`, `EyebrowRaised`, `SheriffWinked` (private to the Sheriff), `SheriffShushed`, `SnitchTip`, `ArrestResult`, `GameEnded`.
- `viewFor(state, playerId)`: the filtered view one phone may see.
- `RoleDefinition`: the plugin interface from the Roles section; roles react to events through hooks rather than special cases in the core.

Timers come from the server clock only, so a phone that sleeps cannot pause or skip time. Every phase also survives a host refresh: the server snapshots state to disk after each action, so a crashed host can restart and everyone reconnects into the same game.

## Screens and UX flow

Players hold their phones all game, so every screen is built for a quick glance: one grid, one big action, dark background, no clutter. Secret information only shows on press-and-hold, so a neighbour can't read it over your shoulder.

| Screen | Who sees it | Key elements | UX notes |
| --- | --- | --- | --- |
| Home | Everyone | Host game, Join game, How to play | Blinking-eye logo as the hero animation |
| Host setup | Host | Wi-Fi QR code, game QR code, live player list, standard role counts, special role switches, death delay, cooldowns, "victims see their killer" switch | Role mix auto-suggests from player count |
| Join | Guests | Nearby games list, Scan QR fallback, name, avatar | Remembers your last name and avatar |
| Lobby | Everyone | Avatars drop in with a bounce, ready ticks, connection dots | Host can kick or reorder players |
| Role reveal | Each player | Face-down card; hold to flip; role art, team, goal | Release to hide; haptic tick on flip |
| Player grid | Living players | Faces of the living; tap a face for Raise eyebrow, plus Wink for the Killer or Arrest for the Sheriff; a raise counter for the Shush and Snitch | Same layout for every role, so no screen looks different from across the room |
| Alerts | The target | "Maya raised an eyebrow at you", "Winked! 3, 2, 1", "The Killer winked you: it's Leo" (Sheriff), "You've been shushed" (Sheriff) | Each alert has its own vibration pattern, so you can feel it without looking |
| Snitch tip | Everyone | Spotlight: "The Snitch thinks it's Leo" | Plays on every phone at once |
| Death | Victim | Death animation, who winked you, then ghost mode | Ghosts watch but stay silent |
| Arrest | Everyone | Spotlight on the arrested player, drumroll, verdict stamp | All phones play it in sync |
| Game over | Everyone | Winner banner, every role revealed, timeline replay | Play again keeps the same lobby |

**Accessibility.** Tap targets of at least 48 px, team colours that work for colour-blind players (each team also has a distinct icon and pattern), a reduced-motion setting that swaps big animations for fades, and every audio cue paired with a visual one.

## Art, animation and sound

I suggest a "playful noir" look: deep ink-blue backgrounds, one warm spotlight colour, chunky rounded characters, and an eye motif that blinks, winks and narrows throughout the UI. It reads well on a phone held in a dim room and gives the deaths and reveals room to be theatrical. All art is original to EyeSpy.

**Design system first.** Colours, type scale, spacing, radii and motion timings live as design tokens in one file that feeds Tailwind. Every screen pulls from the same palette, which keeps Claude Code's output consistent across many separate tasks.

**Claude Code makes every asset.** It writes art as code (SVG, CSS, canvas, Lottie JSON) and generates sound effects in code, and it pulls from free sources whose licences allow commercial use with no attribution or only a credits line. Every borrowed file is logged in `CREDITS.md` with its source and licence.

| Asset | How Claude Code makes it | Best sources to draw from | Licence |
| --- | --- | --- | --- |
| Logo (blinking eye) | Hand-written SVG, animated with Motion | Original; no source needed | Yours |
| Role badges and UI icons | Hand-written SVG for role badges; UI icons from a set | [Lucide](https://lucide.dev), [Phosphor Icons](https://phosphoricons.com) | ISC and MIT (free, commercial use) |
| 12 avatars and role card art | Layered SVG characters built from shared parts (faces, eyes, hats, outfits), so winks and eyebrow raises are just animated eye and brow layers | [Kenney](https://kenney.nl/assets) for shapes and style reference; [DiceBear](https://www.dicebear.com) for the build-from-parts approach | Kenney is CC0; check each DiceBear style's licence |
| Character animations (wink, eyebrow raise, faint, heartbreak) | Motion animations on the SVG layers; Lottie JSON for bigger moments | [LottieFiles](https://lottiefiles.com) free animations as a base | Lottie Simple License (free, commercial use) |
| Particles (a "poof" on death, confetti on win) | Canvas code | [canvas-confetti](https://github.com/catdad/canvas-confetti) | ISC |
| Fonts | Chosen and bundled in the app | [Google Fonts](https://fonts.google.com) | SIL Open Font License |
| Sound effects (wink, raise, buzz, death, stamp) | Generated in code with [ZzFX](https://github.com/KilledByAPixel/ZzFX) or [jsfxr](https://sfxr.me), so every sound is original | [Kenney audio packs](https://kenney.nl/assets/category:Audio), [Freesound](https://freesound.org) filtered to CC0, [Sonniss GDC bundles](https://sonniss.com/gameaudiogdc) | CC0, CC0, royalty-free |
| Tension music loop | Composed in code with [Tone.js](https://tonejs.github.io) and recorded to a file | [Pixabay Music](https://pixabay.com/music/), [Incompetech](https://incompetech.com) | Pixabay Content License; CC BY (credit needed) |

One limit: Claude Code can't paint detailed raster illustrations itself. The layered-SVG style above plays to its strengths and animates better anyway. If you later want painted art, an image-generation API can plug into the same slots.

**Performance budget.** 60 fps on a mid-range Android phone and an older iPhone, animating only `transform` and `opacity`, with art preloaded in the lobby so the reveal never stutters. Every asset is bundled in the app, so nothing loads over the network during play.

## Repo structure

One pnpm monorepo: the React app with its Capacitor Android and iOS projects, plus shared TypeScript packages. The engine has no network or UI code, so most game work happens there with fast tests.

```
eyespy/
├─ CLAUDE.md                  # conventions, commands, rules for Claude Code
├─ CREDITS.md                 # every borrowed asset, its source and licence
├─ package.json               # pnpm workspaces, root scripts (dev, test, android, ios)
├─ packages/
│  ├─ engine/                 # pure game rules
│  │  ├─ src/state.ts
│  │  ├─ src/reducer.ts       # (state, action) -> { state, events }
│  │  ├─ src/view.ts          # viewFor(state, playerId)
│  │  ├─ src/win.ts
│  │  ├─ src/roles/standard/  # Killer, Sheriff, Shush, Snitch, Lovers, Citizen
│  │  ├─ src/roles/special/   # opt-in roles, one file each
│  │  └─ test/                # scripted and randomised games
│  ├─ room/                   # players, reconnects, snapshots
│  └─ protocol/               # Zod schemas for every message
├─ app/                       # React app
│  ├─ src/screens/
│  ├─ src/design/             # tokens, shared components, motion presets
│  ├─ src/art/                # SVG characters, badges, logo
│  ├─ src/audio/              # ZzFX sound definitions, music
│  ├─ android/                # Capacitor Android project
│  ├─ ios/                    # Capacitor iOS project
│  └─ plugins/local-server/   # native WebSocket server (Kotlin, Swift)
├─ tools/dev-host/            # Node host for development and tests only
└─ .github/workflows/         # tests, Android build, iOS build
```

`CLAUDE.md` holds the rules every Claude Code session follows: run `pnpm test` before finishing, keep game logic out of React components, add each role as one file under `roles/` with its own tests, use design tokens instead of raw colours, and log every borrowed asset in `CREDITS.md`.

## Build plan with Claude Code

Six phases, each split into tasks small enough for one Claude Code session and one pull request. Android and iPhone playing together is the riskiest part, so phase 2 proves it on real phones. By the end of phase 3 a group can play a full round; phase 4 makes it beautiful and phase 5 gets it into app stores.

Claude Code can write all of the code, including the small Kotlin and Swift server, and run the rules and networking tests in the cloud. Running it on your phones needs Android Studio for Android and a Mac with Xcode for iPhone, or a CI build. Putting test builds on friends' iPhones needs an Apple developer account ($99 a year) for TestFlight.

**How to work with Claude Code on this**

- Start each task in plan mode, review the plan, then let it build.
- One task = one branch = one PR, with tests passing in CI before merge.
- Rules tasks are test-first: ask for failing tests that describe the rule, then the code.
- For UI tasks, ask Claude Code to screenshot each screen at phone size with Playwright, so you review pictures rather than code.

| # | Phase | Task | Done when |
| --- | --- | --- | --- |
| 0.1 | Foundations | Scaffold pnpm monorepo, React app, Capacitor Android and iOS projects, lint, Vitest, CI | Tests and an Android build pass in CI |
| 0.2 | Foundations | Write `CLAUDE.md`, `CREDITS.md` and the design tokens file | Conventions and palette committed |
| 1.1 | Rules | GameState, phases, reducer skeleton, `viewFor` | Lobby → Reveal → Playing transitions tested |
| 1.2 | Rules | Role interface and registry; Killer (wink, cooldown, winking the Sheriff reveals the Killer), Sheriff (arrest; a wrong arrest loses), Citizen | Scripted games for every way to win pass |
| 1.3 | Rules | Eyebrow raises, Shush (3 raises, one-time arrest lock for 2 kills), Snitch (3 raises, one-time tip), Lovers, role-mix suggester | Each rule has tests; mixes valid for 5 to 20 players |
| 1.4 | Rules | Win checks including the 3-players-left rule, timers via `tick`, event log, game settings | 1,000 random games with no illegal state |
| 2.1 | Network | Protocol schemas, `room` package, Node dev host | 10 simulated players finish a game over real sockets |
| 2.2 | Network | Native local-server plugin for Android and iOS | A phone hosts, and the simulated players connect to it |
| 2.3 | Network | Bonjour discovery, game QR code fallback, Wi-Fi QR code | A phone finds the host on its own |
| 2.4 | Network | Heartbeats, resend missed events, host snapshot and recovery, version check | Closing the host app mid-game and reopening resumes the round |
| 2.5 | Network | Device test: Android host with iPhone guests, and iPhone host with Android guests, 6+ phones | Both directions work on a hotspot; go or no-go |
| 3.1 | Playable | Home, Host setup, Join, Lobby | 6 real phones reach the lobby |
| 3.2 | Playable | Role reveal, player grid, wink, eyebrow raise, alerts, Death | Kills and raises work on real phones |
| 3.3 | Playable | Shush and Snitch flows, Arrest, Game over, Play again | A full round plays start to finish |
| 3.4 | Playable | Playtest with a real group and fix what breaks | 3 rounds in a row with no lost connections |
| 4.1 | Polish | Shared components and motion presets from tokens; logo and fonts | Every screen uses the design system |
| 4.2 | Polish | SVG avatar kit and role badges; wink, eyebrow, death, arrest and win animations; particles | 60 fps on a mid-range Android phone |
| 4.3 | Polish | Sound effects in ZzFX, music loop, vibration patterns | Every event has a sound and a vibration |
| 4.4 | Polish | Reduced motion and accessibility pass; `CREDITS.md` check | Accessibility audit has no blockers; every asset's licence logged |
| 5.1 | Release | App icons, splash screen, permission explainers, privacy text | Store checklists pass |
| 5.2 | Release | TestFlight and Google Play internal testing builds | Friends install from a link |
| 6.x | Special roles | One task per special role (Drama Queen, Bodyguard, Paparazzi, Copycat, Medium, Decoy, Insomniac), each behind a switch | Role file + tests + art, off by default |

**Example first prompt for task 1.2:** "In `packages/engine`, add a `RoleDefinition` interface and a registry. Implement Killer, Sheriff and Citizen per the Roles section of the design doc, including: winking the Sheriff reveals the Killer to the Sheriff, and a wrong arrest ends the game. Write the tests first. Don't touch the app or networking."

**Next step.** Once you've answered the open questions, I'll update this doc, then (with your OK) create the repo and start on phase 0.

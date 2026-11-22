# EyeSpy

A silent, phone-only party game of winks, raised eyebrows and very bad liars.
One phone hosts the game over its hotspot, everyone else joins, and no
internet is needed. Android phones and iPhones can play together.

Design and build plan: [docs/design.md](docs/design.md). Conventions for
contributors (human or Claude Code): [CLAUDE.md](CLAUDE.md).

## Quick start

```sh
pnpm install
pnpm test          # rules, protocol, room, dev host and app tests
pnpm dev           # the app in a browser
```

**Try it in a browser:** open http://localhost:5173, host a game, then either
tap "+ Add 4 practice bots" or open a second tab and pick the game under
Nearby games.

**Dev host with bots:** `pnpm dev:host --bots 6`, then in the app choose
Join game and type `localhost:8787`. Phones on the same Wi-Fi can join the
dev server at your computer's address.

## Phones

```sh
pnpm --filter @eyespy/app android        # build, sync and open Android Studio
pnpm --filter @eyespy/app android:build  # debug APK at app/android/app/build/outputs/apk/debug
pnpm --filter @eyespy/app ios            # on a Mac: build, sync and open Xcode
```

Android needs JDK 21 and the Android SDK (Android Studio provides both).
iPhone builds need a Mac with Xcode 16; run `pod install` in `app/ios/App`
after `cap sync ios`.

## How it fits together

```
packages/engine    pure rules: reduce(state, action) -> { state, events }, viewFor()
packages/protocol  Zod message schemas, protocol version, QR formats
packages/room      host Room (tokens, reconnects, heartbeats, snapshots), GameClient, bots
tools/dev-host     Node WebSocket host for development and tests
app                React + Capacitor app; plugins/local-server is the native WebSocket server
```

The host phone runs the `Room` inside the app's web view. The native
`local-server` plugin (Kotlin on Android, Swift on iOS) only moves text between
sockets and the room. Each phone receives its own filtered view, so even a
modified app can't see anyone else's role.

## Status

See the build-plan table in [docs/design.md](docs/design.md) and the notes in
[docs/status.md](docs/status.md).

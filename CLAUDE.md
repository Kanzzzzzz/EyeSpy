# EyeSpy: rules for Claude Code

EyeSpy is an offline, phone-only wink-murder party game. One phone hosts over
its hotspot; every other phone joins. The design doc is `docs/design.md`.

## Layout

- `packages/engine`: pure game rules. `reduce(state, action) -> { state, events }`,
  `viewFor(state, playerId)`, win checks, roles. No I/O, no timers, no `Date.now()`.
- `packages/engine/src/roles/{standard,special}`: one file per role.
- `packages/engine/src/roster.ts`: the secret characters for each role (ids, names, moves).
  Their looks live in `app/src/art/characters.ts`, drawn by `app/src/art/AnimeFace.tsx`.
- `packages/protocol`: Zod schemas for every message, QR formats, constants.
- `packages/room`: the host-side `Room` (tokens, reconnects, heartbeats,
  snapshots), the phone-side `GameClient`, transports and `Bot`.
- `tools/dev-host`: Node WebSocket host for development and tests only.
- `app`: React + Vite + Tailwind + Capacitor. `app/plugins/local-server` is the
  only native code (Kotlin and Swift WebSocket server).

## Commands

- `pnpm test`: every Vitest project (engine, protocol, room, dev-host, app).
- `pnpm check`: lint + typecheck + tests. Run it before you finish a task.
- `pnpm dev`: the app in a browser. Host in one tab, join from another tab.
- `pnpm dev:host --bots 6`: a Node host with bots; join `localhost:8787`.
- `pnpm screenshots`: Playwright screenshots of every screen at phone size.
- `pnpm --filter @eyespy/app android:build`: debug APK (needs JDK 21 and the Android SDK).

## Rules

1. Run `pnpm check` before finishing. All tests must pass.
2. Keep game logic out of React components. Rules belong in `packages/engine`;
   the app only renders `viewFor` output and sends actions.
3. Rules work is test-first: write failing tests that describe the rule, then the code.
4. A new role is one file under `packages/engine/src/roles/`, registered in
   `roles/index.ts`, with its own tests, a badge glyph in `app/src/art/RoleBadge.tsx`,
   optionally an exclusive character in `roster.ts` + `characters.ts`, and off by default if it is special.
5. Eye rules: winks and raises need eye contact (both looking at each other);
   arrests and targeted abilities act on the panel the player has open. Gaze is
   secret: a phone only learns whether the person it looks at looks back, and how
   many people look at it.
6. Characters must be original. Never draw or name characters from existing anime or games.
   Recorded sounds in `app/public/sfx` come from 効果音ラボ: keep the repo private (see CREDITS.md).
7. Never send a phone anything it may not see. Anything role-related goes
   through `viewFor` / event audiences; add a test when you add a field.
8. Use design tokens (`app/src/design/tokens.ts`) via Tailwind classes. No raw
   hex colours outside the tokens file.
9. Every borrowed asset or copied code goes in `CREDITS.md` with source and licence.
10. Engine state must stay plain JSON (it is snapshotted to disk after every action).
11. Bump `PROTOCOL_VERSION` in `packages/protocol` when a message shape changes.

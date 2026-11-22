# @eyespy/local-server

Capacitor plugin that runs a WebSocket server on the phone, so one phone can
host an EyeSpy game over its hotspot with no internet.

- Android: Kotlin + [Java-WebSocket](https://github.com/TooTallNate/Java-WebSocket) (MIT).
- iOS: Swift + Apple's Network framework (`NWListener` with `NWProtocolWebSocket`).

It is deliberately dumb: it only moves text frames between sockets and the
room logic in the web view (`@eyespy/room`). See `src/index.ts` for the API.

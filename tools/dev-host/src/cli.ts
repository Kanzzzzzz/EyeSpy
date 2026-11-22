/**
 * Dev host: `pnpm dev:host [--port 8787] [--bots 7] [--fresh]`
 *
 * Runs a game room in Node so browsers (and phones on the same Wi-Fi) can
 * join with "Join by address". --bots fills the lobby with automated players.
 */
import { joinUrl } from '@eyespy/protocol';
import { Bot, GameClient, webSocketTransport } from '@eyespy/room';
import { lanAddresses, startDevHost } from './server';

const args = process.argv.slice(2);
const flag = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1]! : fallback;
};

const port = Number(flag('port', '8787'));
const bots = Number(flag('bots', '0'));
const fresh = args.includes('--fresh');

const BOT_NAMES = ['Ava', 'Ben', 'Cleo', 'Dev', 'Eli', 'Fay', 'Gus', 'Hana', 'Ivo', 'Jun', 'Kit', 'Leo', 'Maya', 'Nia', 'Oz', 'Pia', 'Quin', 'Ray', 'Sol'];

const host = await startDevHost({
  port,
  snapshotPath: fresh ? null : '.dev-host/snapshot.json',
  log: (m) => console.log(`[host] ${m}`),
});

console.log(`\nEyeSpy dev host, room ${host.room.code}, port ${host.port}`);
for (const ip of ['localhost', ...lanAddresses()]) {
  console.log(`  ws://${ip}:${host.port}    ${joinUrl({ host: ip, port: host.port, room: host.room.code })}`);
}
console.log(`  host key: ${host.room.hostKey} (the first phone to join hosts)\n`);

for (let i = 0; i < bots; i++) {
  const client = new GameClient({
    transport: webSocketTransport(`ws://127.0.0.1:${host.port}`),
    name: `${BOT_NAMES[i % BOT_NAMES.length]} (bot)`.slice(0, 16),
    avatar: i % 12,
    appVersion: 'dev-bot',
  });
  new Bot(client, { thinkMs: 900, winkChance: 0.08, raiseChance: 0.06, arrestChance: 0.002 }).start();
}

process.on('SIGINT', () => {
  void host.close().then(() => process.exit(0));
});

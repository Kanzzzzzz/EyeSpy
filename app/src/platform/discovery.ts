import { ZeroConf } from 'capacitor-zeroconf';
import { SERVICE_DOMAIN, SERVICE_TYPE } from '@eyespy/protocol';
import { isNative } from './device';
import { watchTabGames } from './tabs';

export type FoundGame =
  | { kind: 'lan'; key: string; room: string; hostName: string; host: string; port: number }
  | { kind: 'tab'; key: string; room: string; hostName: string; players: number };

/**
 * Lists games nearby: Bonjour on phones, other browser tabs on the web.
 * Returns a stop function.
 */
export function watchGames(onChange: (games: FoundGame[]) => void): () => void {
  if (!isNative) {
    return watchTabGames((games) =>
      onChange(
        games.map((g) => ({ kind: 'tab', key: `tab:${g.code}`, room: g.code, hostName: g.hostName, players: g.players })),
      ),
    );
  }
  const found = new Map<string, FoundGame>();
  const request = { type: SERVICE_TYPE, domain: SERVICE_DOMAIN };
  let stopped = false;
  void ZeroConf.watch(request, (result) => {
    if (stopped || !result) return;
    const s = result.service;
    if (result.action === 'removed') {
      found.delete(s.name);
    } else if (result.action === 'resolved') {
      const host = s.ipv4Addresses?.[0];
      if (!host) return;
      found.set(s.name, {
        kind: 'lan',
        key: `lan:${s.name}`,
        room: s.txtRecord?.room ?? s.name.replace(/^EyeSpy /, ''),
        hostName: s.txtRecord?.host ?? 'Someone',
        host,
        port: s.port,
      });
    }
    onChange([...found.values()]);
  }).catch((err) => console.warn('Bonjour watch failed', err));
  return () => {
    stopped = true;
    void ZeroConf.unwatch(request).catch(() => {});
  };
}

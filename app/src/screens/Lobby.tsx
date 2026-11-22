import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { getRole, MAX_PLAYERS, MIN_PLAYERS, SPECIAL_ROLE_IDS, type SettingsPatch } from '@eyespy/engine';
import { joinUrl, wifiQr } from '@eyespy/protocol';
import { Avatar } from '../art/Avatar';
import { RoleBadge } from '../art/RoleBadge';
import { isNative, loadJson, saveJson } from '../platform/device';
import { useGame } from '../state/store';
import { Button, Card, Label, PresenceDot, QrCode, Screen, Stepper, Toggle, TopBar } from '../ui/kit';
import { motion as m } from '../design/tokens';

export function Lobby() {
  const view = useGame((s) => s.snap!.view!);
  const me = useGame((s) => s.snap!.playerId);
  const room = useGame((s) => s.snap!.room);
  const presence = useGame((s) => s.snap!.presence);
  const hosting = useGame((s) => s.hosting);
  const send = useGame((s) => s.send);
  const leaveGame = useGame((s) => s.leaveGame);
  const isHost = view.hostId === me;
  const n = view.players.length;

  return (
    <Screen>
      <TopBar
        onBack={() => void leaveGame()}
        title={isHost ? 'Your game' : 'Lobby'}
        jp={isHost ? 'ホスト' : 'ロビー'}
        right={
          <span className="border-[3px] border-black bg-spot px-3 py-1 font-display text-2xl tracking-[0.2em] text-ink-950" style={{ boxShadow: '3px 3px 0 0 #000' }} aria-label={`Room code ${room}`}>
            {room}
          </span>
        }
      />

      <div className="flex flex-1 flex-col gap-4 pb-28">
        {isHost && hosting && <InviteCard addresses={hosting.addresses} port={hosting.port} room={room ?? ''} />}

        <Card>
          <div className="mb-2 flex items-baseline justify-between">
            <Label>
              Players {n}/{MAX_PLAYERS}
            </Label>
            {n < MIN_PLAYERS && <span className="text-xs text-paper-faint">{MIN_PLAYERS - n} more to start</span>}
          </div>
          <ul className="flex flex-col gap-1">
            <AnimatePresence initial={false}>
              {view.players.map((p, i) => (
                <motion.li
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: -24, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 40 }}
                  transition={m.bouncy}
                  className="flex min-h-[56px] items-center gap-3 rounded-md px-1"
                >
                  <Avatar id={p.avatar} size={44} expression={p.id === me ? 'happy' : 'neutral'} />
                  <span className="flex-1 truncate text-paper">
                    {p.name}
                    {p.id === me && <span className="text-paper-faint"> (you)</span>}
                    {p.isHost && <span className="ml-2 rounded-sm bg-spot/20 px-1.5 py-0.5 text-xs font-semibold text-spot">HOST</span>}
                  </span>
                  <PresenceDot state={presence[p.id]} />
                  {isHost && p.id !== me && (
                    <div className="flex">
                      <IconButton
                        label={`Move ${p.name} up`}
                        disabled={i === 0}
                        onClick={() => {
                          const order = view.players.map((x) => x.id);
                          [order[i - 1], order[i]] = [order[i]!, order[i - 1]!];
                          void send({ type: 'reorder', order });
                        }}
                        path="M6 15l6-6 6 6"
                      />
                      <IconButton label={`Remove ${p.name}`} onClick={() => void send({ type: 'kick', playerId: p.id })} path="M6 6l12 12M18 6L6 18" />
                    </div>
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </Card>

        {isHost ? <HostSettings /> : <RoleSummary />}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-[520px] bg-gradient-to-t from-ink-900 via-ink-900 to-transparent px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-6">
        {isHost ? (
          <>
            {!view.mix.ok && <p className="mb-2 text-center text-sm text-warn">{view.mix.problem}</p>}
            <Button size="lg" className="w-full" disabled={!view.mix.ok} onClick={() => void send({ type: 'start' })} sfx="開始">
              Deal the roles
            </Button>
          </>
        ) : (
          <p className="flex min-h-[64px] items-center justify-center text-center font-display text-xl uppercase text-paper-dim">Waiting for the host to start…</p>
        )}
      </div>
    </Screen>
  );
}

function IconButton({ label, onClick, path, disabled }: { label: string; onClick: () => void; path: string; disabled?: boolean }) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className="flex h-tap w-tap items-center justify-center text-paper-faint disabled:opacity-20">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d={path} />
      </svg>
    </button>
  );
}

function InviteCard({ addresses, port, room }: { addresses: string[]; port: number; room: string }) {
  const [tab, setTab] = useState<'game' | 'wifi'>('game');
  const [wifi, setWifi] = useState({ ssid: '', password: '' });
  const addBots = useGame((s) => s.addBots);
  useEffect(() => {
    void loadJson('eyespy.wifi', { ssid: '', password: '' }).then(setWifi);
  }, []);
  const saveWifi = (w: typeof wifi) => {
    setWifi(w);
    void saveJson('eyespy.wifi', w);
  };
  const host = addresses[0];

  return (
    <Card>
      <div role="tablist" className="mb-3 grid grid-cols-2 gap-1 rounded-md bg-ink-800 p-1">
        {(['wifi', 'game'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            type="button"
            onClick={() => setTab(t)}
            className={`min-h-tap rounded-sm text-sm font-semibold ${tab === t ? 'bg-ink-600 text-paper' : 'text-paper-faint'}`}
          >
            {t === 'wifi' ? '1. Join the Wi-Fi' : '2. Join the game'}
          </button>
        ))}
      </div>
      {tab === 'game' ? (
        <div className="flex flex-col items-center gap-2 text-center">
          {host ? (
            <>
              <QrCode text={joinUrl({ host, port, room })} size={196} label="Game QR code" />
              <p className="text-sm text-paper-dim">
                Guests open EyeSpy and pick <b className="text-paper">{room}</b> under Nearby games, or scan this code.
              </p>
              <p className="font-mono text-xs text-paper-faint">
                {addresses.map((a) => `${a}:${port}`).join('  ·  ')}
              </p>
            </>
          ) : isNative ? (
            <p className="py-6 text-paper-dim">Turn on your hotspot or join a Wi-Fi so guests can reach you.</p>
          ) : (
            <p className="py-4 text-sm text-paper-dim">
              Browser preview: open EyeSpy in another tab and pick <b className="text-paper">{room}</b> under Nearby games.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 text-center">
          {wifi.ssid ? (
            <QrCode text={wifiQr(wifi.ssid, wifi.password)} size={196} label="Wi-Fi QR code" />
          ) : (
            <p className="text-sm text-paper-dim">Phones don't let apps read hotspot details, so type them once. Guests scan with their camera to join your Wi-Fi.</p>
          )}
          <div className="grid w-full grid-cols-2 gap-2">
            <input
              value={wifi.ssid}
              onChange={(e) => saveWifi({ ...wifi, ssid: e.target.value })}
              placeholder="Hotspot name"
              aria-label="Hotspot name"
              className="min-h-tap rounded-md border border-ink-500 bg-ink-800 px-3 text-sm text-paper placeholder:text-paper-faint"
            />
            <input
              value={wifi.password}
              onChange={(e) => saveWifi({ ...wifi, password: e.target.value })}
              placeholder="Password"
              aria-label="Hotspot password"
              type="password"
              className="min-h-tap rounded-md border border-ink-500 bg-ink-800 px-3 text-sm text-paper placeholder:text-paper-faint"
            />
          </div>
        </div>
      )}
      {(import.meta.env.DEV || !isNative) && (
        <button type="button" onClick={() => addBots(4)} className="mt-3 min-h-tap w-full rounded-md border border-dashed border-ink-500 text-sm text-paper-faint">
          + Add 4 practice bots
        </button>
      )}
    </Card>
  );
}

function HostSettings() {
  const view = useGame((s) => s.snap!.view!);
  const send = useGame((s) => s.send);
  const s = view.settings;
  const configure = (patch: SettingsPatch) => void send({ type: 'configure', settings: patch });
  const role = (key: keyof typeof s.roles, label: string, max: number) => (
    <Stepper label={label} value={s.roles[key]} min={0} max={max} onChange={(v) => configure({ roles: { [key]: v } })} />
  );
  const secs = (v: number) => `${Math.round(v / 1000)}s`;

  return (
    <>
      <Card>
        <Label>Roles</Label>
        <Toggle
          label="Suggested mix"
          hint={`Follows the player count (${view.players.length} players)`}
          checked={s.autoRoles}
          onChange={(v) => configure({ autoRoles: v })}
        />
        {role('killer', 'Killers', 3)}
        {role('sheriff', 'Sheriffs', 3)}
        {role('shush', 'Shush', 1)}
        {role('snitch', 'Snitch', 1)}
        {role('judge', 'Judge', 1)}
        {role('loverPairs', 'Lover pairs', 2)}
        <p className="mt-1 text-right text-sm text-paper-faint">Citizens: {Math.max(0, view.mix.citizens)}</p>
      </Card>
      <Card>
        <Label>Special roles</Label>
        {SPECIAL_ROLE_IDS.map((id) => {
          const r = getRole(id);
          return (
            <div key={id} className="flex items-center gap-3">
              <RoleBadge role={id} team={r.team} size={40} />
              <div className="flex-1">
                <Toggle label={r.name} hint={r.summary} checked={s.special[id]} onChange={(v) => configure({ special: { [id]: v } })} />
              </div>
            </div>
          );
        })}
      </Card>
      <Card>
        <Label>Game settings</Label>
        <Stepper label="Death delay" value={s.deathDelayMs / 1000} min={1} max={10} format={(v) => `${v}s`} onChange={(v) => configure({ deathDelayMs: v * 1000 })} />
        <Stepper label="Wink cooldown" value={s.winkCooldownMs / 5000} min={0} max={12} format={(v) => secs(v * 5000)} onChange={(v) => configure({ winkCooldownMs: v * 5000 })} />
        <Stepper label="Raise cooldown" value={s.raiseCooldownMs / 5000} min={0} max={6} format={(v) => secs(v * 5000)} onChange={(v) => configure({ raiseCooldownMs: v * 5000 })} />
        <Toggle label="Victims see their killer" hint="On their death screen. They must stay silent." checked={s.victimsSeeKiller} onChange={(v) => configure({ victimsSeeKiller: v })} />
      </Card>
    </>
  );
}

function RoleSummary() {
  const view = useGame((s) => s.snap!.view!);
  const r = view.settings.roles;
  const specials = SPECIAL_ROLE_IDS.filter((id) => view.settings.special[id]);
  const rows: [string, number][] = [
    ['Killers', r.killer],
    ['Sheriffs', r.sheriff],
    ['Shush', r.shush],
    ['Snitch', r.snitch],
    ['Judge', r.judge],
    ['Lovers', r.loverPairs * 2],
    ['Citizens', Math.max(0, view.mix.citizens)],
  ];
  return (
    <Card>
      <Label>In this game</Label>
      <div className="grid grid-cols-3 gap-2 text-center">
        {rows
          .filter(([, v]) => v > 0)
          .map(([k, v]) => (
            <div key={k} className="rounded-md bg-ink-800 py-2">
              <div className="font-display text-2xl text-paper">{v}</div>
              <div className="text-xs text-paper-faint">{k}</div>
            </div>
          ))}
      </div>
      {specials.length > 0 && <p className="mt-3 text-sm text-paper-dim">Plus: {specials.map((id) => getRole(id).name).join(', ')}</p>}
    </Card>
  );
}

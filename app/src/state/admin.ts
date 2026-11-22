import { adminLiftShush, adminSetRole, adminUnlock, type ActionBody, type RoleId } from '@eyespy/engine';
import { useGame } from './store';

/**
 * Admin test tools. They act directly on the room this phone is hosting, so
 * they only work for the host with test tools switched on, and no other
 * phone can trigger them.
 */

function room() {
  const s = useGame.getState();
  if (!s.prefs.adminTools || !s.hosting) return null;
  return s.hosting.room;
}

function me(): string | null {
  return useGame.getState().snap?.playerId ?? null;
}

function toast(title: string) {
  const at = Date.now();
  useGame.setState((s) => ({ alerts: [...s.alerts, { id: -at, at, style: 'toast', title, tone: 'neutral', ttl: 2500 }] }));
}

function as(by: string, body: ActionBody): boolean {
  const r = room();
  if (!r) return false;
  const res = r.dispatch(by, body);
  if (res.error) toast(res.message ?? res.error);
  return !res.error;
}

export const admin = {
  available(): boolean {
    return !!room();
  },
  becomeRole(role: RoleId) {
    const r = room();
    const id = me();
    if (!r || !id) return;
    r.admin((s) => adminSetRole(s, id, role));
  },
  unlockMe() {
    const r = room();
    const id = me();
    if (r && id) r.admin((s) => adminUnlock(s, id));
  },
  liftShush() {
    room()?.admin(adminLiftShush);
  },
  /** A bot opens your panel (and you open theirs): instant eye contact. */
  eyeContact(botId: string) {
    const id = me();
    if (!id) return;
    as(botId, { type: 'look', targetId: id });
    useGame.getState().look(botId);
  },
  lookAtMe(botId: string) {
    const id = me();
    if (id) as(botId, { type: 'look', targetId: id });
  },
  /** Make a bot wink you right now (it becomes a Killer first if it isn't one). */
  winkMe(botId: string) {
    const r = room();
    const id = me();
    if (!r || !id) return;
    if (r.state.roles[botId]?.role !== 'killer') r.admin((s) => adminSetRole(s, botId, 'killer'));
    r.admin((s) => adminUnlock(s, botId));
    as(botId, { type: 'look', targetId: id });
    as(id, { type: 'look', targetId: botId });
    as(botId, { type: 'wink', targetId: id });
  },
  /** Make a bot raise an eyebrow at you (it becomes a Snitch first if it can't raise). */
  raiseAtMe(botId: string) {
    const r = room();
    const id = me();
    if (!r || !id) return;
    const role = r.state.roles[botId]?.role;
    if (role !== 'shush' && role !== 'snitch' && role !== 'judge') r.admin((s) => adminSetRole(s, botId, 'snitch'));
    r.admin((s) => {
      const next = structuredClone(s);
      const rs = next.roles[botId];
      if (rs) rs.lastRaiseAt = null;
      return next;
    });
    as(botId, { type: 'look', targetId: id });
    as(id, { type: 'look', targetId: botId });
    as(botId, { type: 'raiseEyebrow', targetId: id });
  },
  /** A Judge (a bot, if you aren't one) calls a hearing now. */
  callHearing() {
    const r = room();
    const id = me();
    if (!r || !id) return;
    let judge = Object.keys(r.state.roles).find((p) => r.state.roles[p]!.role === 'judge' && r.state.players.find((x) => x.id === p)?.alive);
    if (!judge) {
      judge = r.state.players.find((p) => p.alive && p.id !== id)?.id;
      if (!judge) return;
      r.admin((s) => adminSetRole(s, judge!, 'judge'));
    }
    r.admin((s) => adminUnlock(s, judge!));
    as(judge, { type: 'useAbility', abilityId: 'hearing' });
  },
  /** Every bot votes for one player (to finish a hearing). */
  botsVote(targetId: string) {
    const r = room();
    const id = me();
    if (!r) return;
    for (const p of r.state.players) if (p.alive && p.id !== id && p.id !== targetId) as(p.id, { type: 'vote', targetId });
  },
  setBotsPaused(paused: boolean) {
    for (const b of useGame.getState().bots) {
      if (paused) b.pause();
      else b.resume();
    }
    useGame.setState({ botsPaused: paused });
  },
  roleOf(playerId: string): RoleId | null {
    return room()?.state.roles[playerId]?.role ?? null;
  },
};

import { getRole, SPECIAL_ROLE_IDS, STANDARD_ROLE_IDS, type RoleId } from '@eyespy/engine';
import { useState } from 'react';
import { AnimeFace } from '../art/AnimeFace';
import { publicLook } from '../art/characters';
import { RoleBadge } from '../art/RoleBadge';
import { color } from '../design/tokens';
import { admin } from '../state/admin';
import { useGame } from '../state/store';
import { Label, Sheet, Toggle } from '../ui/kit';

const ALL_ROLES: RoleId[] = [...STANDARD_ROLE_IDS, ...SPECIAL_ROLE_IDS];

function Chip({ children, onClick, tone = color.ink[700] }: { children: React.ReactNode; onClick: () => void; tone?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-[40px] border-[3px] border-black px-2 font-display text-sm uppercase text-paper"
      style={{ background: tone, boxShadow: '2px 2px 0 0 #000' }}
    >
      {children}
    </button>
  );
}

/**
 * Admin test tools for the host (Settings → Admin test tools). Play as any
 * role, stage eye contact, winks, raises and hearings, and see every role.
 */
export function AdminPanel() {
  const view = useGame((s) => s.snap?.view ?? null);
  const meId = useGame((s) => s.snap?.playerId ?? null);
  const reveal = useGame((s) => s.adminReveal);
  const paused = useGame((s) => s.botsPaused);
  const [open, setOpen] = useState(false);
  const enabled = useGame((s) => s.prefs.adminTools && !!s.hosting);
  if (!enabled || !view) return null;
  const inRound = view.phase !== 'lobby' && view.phase !== 'ended';
  const others = view.players.filter((p) => p.id !== meId && p.alive);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[max(16px,env(safe-area-inset-bottom))] left-3 z-30 border-[3px] border-black bg-violet px-3 py-2 font-display text-base uppercase text-paper"
        style={{ boxShadow: '3px 3px 0 0 #000' }}
        aria-label="Admin test tools"
      >
        Admin
      </button>
      <Sheet open={open} onClose={() => setOpen(false)}>
        <div className="max-h-[75vh] overflow-y-auto pb-2">
          <p className="font-display text-2xl uppercase text-violet">Admin test tools</p>
          <p className="mb-3 text-xs font-semibold text-paper-faint">Host only. Bypasses the rules for testing.</p>

          {!inRound && <p className="mb-3 text-sm font-semibold text-paper-dim">Deal the roles to start testing. Tip: "Add 4 practice bots" in the lobby.</p>}

          {inRound && (
            <>
              <Label>Play as</Label>
              <div className="mb-4 grid grid-cols-5 gap-2">
                {ALL_ROLES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => admin.becomeRole(r)}
                    className="flex flex-col items-center border-[3px] p-1"
                    style={{ borderColor: view.me?.role === r ? color.cyan.DEFAULT : '#000', background: color.ink[800] }}
                    aria-label={`Play as ${getRole(r).name}`}
                  >
                    <RoleBadge role={r} team={getRole(r).team} size={40} />
                    <span className="mt-0.5 text-[10px] font-semibold leading-tight text-paper-dim">{getRole(r).name}</span>
                  </button>
                ))}
              </div>

              <Label>You</Label>
              <div className="mb-4 flex flex-wrap gap-2">
                <Chip onClick={() => admin.unlockMe()} tone={color.violet.deep}>Unlock abilities + reset cooldowns</Chip>
                <Chip onClick={() => admin.liftShush()}>Lift Shush lock</Chip>
                <Chip onClick={() => admin.callHearing()}>Call a hearing</Chip>
              </div>

              <Label>Bots</Label>
              <Toggle label="Pause bots" hint="Bots stop moving so you can stage a moment" checked={paused} onChange={(v) => admin.setBotsPaused(v)} />
              <Toggle label="Show everyone's role" hint="On panels, for this phone only" checked={reveal} onChange={(v) => useGame.setState({ adminReveal: v })} />
              <ul className="mt-2 flex flex-col gap-2">
                {others.map((p) => {
                  const role = admin.roleOf(p.id);
                  return (
                    <li key={p.id} className="border-[3px] border-black bg-ink-800 p-2">
                      <div className="mb-1.5 flex items-center gap-2">
                        <AnimeFace look={publicLook(p.avatar)} size={34} crop="face" />
                        <span className="flex-1 font-display text-lg uppercase text-paper">{p.name}</span>
                        {role && <span className="text-xs font-semibold text-paper-faint">{getRole(role).name}</span>}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Chip onClick={() => admin.eyeContact(p.id)} tone={color.cyan.deep}>Eye contact</Chip>
                        <Chip onClick={() => admin.lookAtMe(p.id)}>Look at me</Chip>
                        <Chip onClick={() => { admin.winkMe(p.id); setOpen(false); }} tone={color.crimson.deep}>Wink me</Chip>
                        <Chip onClick={() => { admin.raiseAtMe(p.id); setOpen(false); }}>Raise at me</Chip>
                        {view.phase === 'hearing' && <Chip onClick={() => admin.botsVote(p.id)}>All vote out</Chip>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </Sheet>
    </>
  );
}

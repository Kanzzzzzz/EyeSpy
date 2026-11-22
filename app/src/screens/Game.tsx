import { AnimatePresence, motion } from 'motion/react';
import { LogoEye } from '../art/Logo';
import { useGame } from '../state/store';
import { Button, Screen, Spinner } from '../ui/kit';
import { Lobby } from './Lobby';
import { Reveal } from './Reveal';
import { Play } from './Play';
import { Hearing } from './Hearing';
import { GameOver } from './GameOver';
import { Alerts } from './Alerts';

export function Game() {
  const snap = useGame((s) => s.snap);
  const leaveGame = useGame((s) => s.leaveGame);
  const view = snap?.view ?? null;

  if (snap?.status === 'failed' || (!view && snap?.error)) {
    const err = snap.error;
    return (
      <Screen className="items-center justify-center gap-4 text-center" lines>
        <LogoEye size={150} wink />
        <h2 className="title-outline font-display text-4xl uppercase text-paper">
          {err?.code === 'version' ? 'Update EyeSpy' : err?.code === 'kicked' ? 'You were removed' : "Couldn't join"}
        </h2>
        <p className="max-w-xs font-semibold text-paper-dim">{err?.message ?? 'The game is no longer available.'}</p>
        <Button onClick={() => void leaveGame()}>Back to start</Button>
      </Screen>
    );
  }

  if (!view) {
    return (
      <Screen className="items-center justify-center gap-4 text-center" lines>
        <LogoEye size={150} />
        <div className="flex items-center gap-3 font-display text-xl uppercase text-paper-dim">
          <Spinner />
          <span>Connecting…</span>
        </div>
        <p className="max-w-xs text-sm font-semibold text-paper-faint">Make sure you're on the host's hotspot or Wi-Fi.</p>
        <Button variant="ghost" onClick={() => void leaveGame()}>
          Cancel
        </Button>
      </Screen>
    );
  }

  return (
    <>
      <AnimatePresence mode="wait">
        {view.phase === 'lobby' && <Lobby key="lobby" />}
        {view.phase === 'reveal' && <Reveal key="reveal" />}
        {(view.phase === 'playing' || view.phase === 'arrest' || view.phase === 'hearing') && <Play key="play" />}
        {view.phase === 'ended' && <GameOver key="over" />}
      </AnimatePresence>
      <Hearing />
      <Alerts />
      <AnimatePresence>
        {snap && snap.status !== 'online' && (
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            className="fixed inset-x-0 top-0 z-50 flex justify-center pt-[max(8px,env(safe-area-inset-top))]"
            role="status"
          >
            <span className="flex items-center gap-2 border-[3px] border-black bg-warn px-4 py-2 font-display text-base uppercase text-ink-950" style={{ boxShadow: '4px 4px 0 0 #000' }}>
              <Spinner /> Reconnecting…
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

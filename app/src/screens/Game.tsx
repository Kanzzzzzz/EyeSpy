import { AnimatePresence, motion } from 'motion/react';
import { LogoEye } from '../art/Logo';
import { useGame } from '../state/store';
import { Button, Screen, Spinner } from '../ui/kit';
import { Lobby } from './Lobby';
import { Reveal } from './Reveal';
import { Play } from './Play';
import { GameOver } from './GameOver';
import { Alerts } from './Alerts';

export function Game() {
  const snap = useGame((s) => s.snap);
  const leaveGame = useGame((s) => s.leaveGame);
  const view = snap?.view ?? null;

  if (snap?.status === 'failed' || (!view && snap?.error)) {
    const err = snap.error;
    return (
      <Screen className="items-center justify-center gap-4 text-center">
        <LogoEye size={140} wink />
        <h2 className="font-display text-2xl text-paper">
          {err?.code === 'version' ? 'Update EyeSpy' : err?.code === 'kicked' ? 'You were removed' : "Couldn't join"}
        </h2>
        <p className="max-w-xs text-paper-dim">{err?.message ?? 'The game is no longer available.'}</p>
        <Button onClick={() => void leaveGame()}>Back to start</Button>
      </Screen>
    );
  }

  if (!view) {
    return (
      <Screen className="items-center justify-center gap-4 text-center">
        <LogoEye size={140} />
        <div className="flex items-center gap-3 text-paper-dim">
          <Spinner />
          <span>Connecting to the game…</span>
        </div>
        <p className="max-w-xs text-sm text-paper-faint">Make sure you're on the host's hotspot or Wi-Fi.</p>
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
        {(view.phase === 'playing' || view.phase === 'arrest') && <Play key="play" />}
        {view.phase === 'ended' && <GameOver key="over" />}
      </AnimatePresence>
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
            <span className="flex items-center gap-2 rounded-full bg-warn px-4 py-2 text-sm font-semibold text-ink-950 shadow-lift">
              <Spinner /> Reconnecting…
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { LogoEye } from '../art/Logo';
import { useGame } from '../state/store';
import { Button, Screen, Spinner } from '../ui/kit';
import { Lobby } from './Lobby';
import { Reveal } from './Reveal';
import { Play } from './Play';
import { Hearing } from './Hearing';
import { GameOver } from './GameOver';
import { Alerts } from './Alerts';
import { AdminPanel } from './AdminPanel';

/** Seconds since `active` became true (0 while false). */
function useSecondsWhile(active: boolean): number {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!active) {
      setSecs(0);
      return;
    }
    const start = Date.now();
    const id = setInterval(() => setSecs(Math.floor((Date.now() - start) / 1000)), 500);
    return () => clearInterval(id);
  }, [active]);
  return secs;
}

export function Game() {
  const snap = useGame((s) => s.snap);
  const leaveGame = useGame((s) => s.leaveGame);
  const hosting = useGame((s) => s.hosting);
  const view = snap?.view ?? null;
  const offline = !!snap && snap.status !== 'online';
  const offlineFor = useSecondsWhile(offline);
  const [dismissedAt, setDismissedAt] = useState(-1);

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
        <p className="max-w-xs text-sm font-semibold text-paper-faint">
          {offlineFor >= 8 ? "Still can't reach the host. Check you're on their hotspot or Wi-Fi, or that the game is still running." : "Make sure you're on the host's hotspot or Wi-Fi."}
        </p>
        <Button variant="secondary" onClick={() => void leaveGame()}>
          Back to start
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
      <AdminPanel />
      <AnimatePresence>
        {snap && snap.status !== 'online' && (
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            className="fixed inset-x-0 top-0 z-50 flex justify-center pt-[max(8px,env(safe-area-inset-top))]"
            role="status"
          >
            <span className="flex items-center gap-2 border-[3px] border-black bg-warn px-3 py-1.5 font-display text-base uppercase text-ink-950" style={{ boxShadow: '4px 4px 0 0 #000' }}>
              <Spinner /> Reconnecting…
              <button type="button" onClick={() => void leaveGame()} className="ml-1 border-2 border-black bg-ink-900 px-2 py-0.5 text-sm text-paper">
                Leave
              </button>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Lost the host for a while: offer a clear choice instead of spinning forever. */}
      <AnimatePresence>
        {offline && !hosting && offlineFor >= 10 && dismissedAt !== Math.floor(offlineFor / 30) && (
          <motion.div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink-950/85 px-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="alertdialog" aria-label="Lost the host">
            <div className="w-full max-w-sm border-[4px] border-paper bg-ink-850 p-5 text-center" style={{ boxShadow: '6px 6px 0 0 #000' }}>
              <h2 className="title-outline font-display text-3xl uppercase text-paper">Lost the host</h2>
              <p className="mt-2 text-sm font-semibold text-paper-dim">EyeSpy keeps trying to reconnect. If the host's phone closed the game, leave and join the next one.</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => setDismissedAt(Math.floor(offlineFor / 30))} burst={null}>
                  Keep waiting
                </Button>
                <Button variant="danger" onClick={() => void leaveGame()}>
                  Leave
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Avatar, AVATARS } from '../art/Avatar';
import { LogoEye, Wordmark } from '../art/Logo';
import { isNative } from '../platform/device';
import { useGame } from '../state/store';
import { Button, Screen, Spinner } from '../ui/kit';
import { color, motion as m } from '../design/tokens';
import { play } from '../audio/sounds';

export function Home() {
  const prefs = useGame((s) => s.prefs);
  const setPrefs = useGame((s) => s.setPrefs);
  const go = useGame((s) => s.go);
  const hostGame = useGame((s) => s.hostGame);
  const resumable = useGame((s) => s.resumable);
  const resumeHosting = useGame((s) => s.resumeHosting);
  const lastGame = useGame((s) => s.lastGame);
  const rejoinLast = useGame((s) => s.rejoinLast);
  const busy = useGame((s) => s.busy);
  const practice = useGame((s) => s.practice);
  const problem = useGame((s) => s.problem);
  const [picking, setPicking] = useState(false);

  const nameOk = prefs.name.trim().length > 0;
  const needsPermissions = isNative && !prefs.seenPermissions;
  const proceed = (fn: () => void) => () => {
    if (needsPermissions) go('permissions');
    else fn();
  };

  return (
    <Screen className="justify-between" lines>
      <div className="flex items-center justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={() => go('how')} burst={null}>
          How to play
        </Button>
        <Button variant="secondary" size="sm" onClick={() => go('settings')} burst={null} aria-label="Settings">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
            <circle cx="12" cy="12" r="3.2" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
          </svg>
        </Button>
      </div>

      <motion.div className="flex flex-col items-center text-center" initial={{ opacity: 0, scale: 0.8, rotate: -4 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ ...m.bouncy, delay: 0.05 }}>
        <LogoEye size={210} />
        <Wordmark className="mt-1 text-6xl" />
        <p className="mt-3 max-w-[19rem] font-semibold text-paper-dim">
          Lock eyes. Wink to kill. Raise a brow to plot. A silent party game for very bad liars.
        </p>
      </motion.div>

      <div className="flex flex-col gap-4">
        {resumable && (
          <div className="border-[3px] border-spot bg-ink-850 p-3" style={{ boxShadow: '5px 5px 0 0 #000' }}>
            <p className="text-sm font-semibold text-paper-dim">Your game was interrupted mid-round.</p>
            <Button className="mt-2 w-full" onClick={() => void resumeHosting()} disabled={busy}>
              Resume hosting
            </Button>
          </div>
        )}
        {!resumable && lastGame && (
          <Button variant="cyan" onClick={rejoinLast}>
            Rejoin game {lastGame.room}
          </Button>
        )}

        <div className="flex items-center gap-3 border-[3px] border-paper bg-ink-850 p-2" style={{ boxShadow: `5px 5px 0 0 ${color.crimson.DEFAULT}` }}>
          <button
            type="button"
            onClick={() => {
              play('select');
              setPicking((p) => !p);
            }}
            className="shrink-0 border-[3px] border-black bg-ink-700"
            aria-label="Choose your character"
            aria-expanded={picking}
          >
            <Avatar id={prefs.avatar} size={64} expression={picking ? 'happy' : 'neutral'} blink />
          </button>
          <input
            value={prefs.name}
            onChange={(e) => setPrefs({ name: e.target.value.slice(0, 16) })}
            placeholder="YOUR NAME"
            maxLength={16}
            autoComplete="nickname"
            aria-label="Your name"
            className="min-h-tap min-w-0 flex-1 bg-transparent font-display text-3xl uppercase text-paper placeholder:text-paper-faint focus:outline-none"
          />
        </div>
        <AnimatePresence>
          {picking && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="grid grid-cols-6 gap-2 overflow-hidden">
              {AVATARS.map((a, i) => (
                <motion.button
                  key={a.name}
                  type="button"
                  whileTap={{ scale: 0.85 }}
                  onClick={() => {
                    play('select');
                    setPrefs({ avatar: i });
                    setPicking(false);
                  }}
                  className="border-[3px] bg-ink-800"
                  style={{ borderColor: i === prefs.avatar ? color.cyan.DEFAULT : '#000' }}
                  aria-label={a.name}
                >
                  <Avatar id={i} size={50} />
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {problem && <p className="border-[3px] border-danger bg-ink-850 p-3 text-sm text-paper">{problem}</p>}

        <div className="grid grid-cols-2 gap-3">
          <Button size="lg" onClick={proceed(() => void hostGame())} disabled={!nameOk || busy} sfx="ドン">
            {busy ? <Spinner /> : 'Host'}
          </Button>
          <Button size="lg" variant="cyan" onClick={proceed(() => go('join'))} disabled={!nameOk} sfx="シュッ">
            Join
          </Button>
        </div>
        {prefs.adminTools && (
          <Button variant="secondary" onClick={() => void practice()} disabled={!nameOk || busy}>
            Practice: test roles with bots
          </Button>
        )}
        {!nameOk && <p className="text-center text-sm font-semibold text-paper-faint">Pick a name to play.</p>}
      </div>
    </Screen>
  );
}

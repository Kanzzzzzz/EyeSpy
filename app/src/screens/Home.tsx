import { motion } from 'motion/react';
import { useState } from 'react';
import { Avatar, AVATARS } from '../art/Avatar';
import { LogoEye, Wordmark } from '../art/Logo';
import { isNative } from '../platform/device';
import { useGame } from '../state/store';
import { Button, Screen, Spinner } from '../ui/kit';
import { motion as m } from '../design/tokens';

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
  const problem = useGame((s) => s.problem);
  const [picking, setPicking] = useState(false);

  const nameOk = prefs.name.trim().length > 0;
  const needsPermissions = isNative && !prefs.seenPermissions;
  const proceed = (fn: () => void) => () => {
    if (needsPermissions) go('permissions');
    else fn();
  };

  return (
    <Screen className="justify-between">
      <div className="flex items-center justify-end gap-1">
        <button type="button" onClick={() => go('how')} className="min-h-tap px-3 text-sm font-semibold text-paper-dim">
          How to play
        </button>
        <button type="button" onClick={() => go('settings')} className="flex h-tap w-tap items-center justify-center text-paper-dim" aria-label="Settings">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
          </svg>
        </button>
      </div>

      <motion.div
        className="flex flex-col items-center text-center"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ ...m.soft, delay: 0.05 }}
      >
        <LogoEye size={190} />
        <Wordmark className="mt-2 text-5xl" />
        <p className="mt-2 max-w-[18rem] text-base text-paper-dim">A silent party game of winks, raised eyebrows and very bad liars.</p>
      </motion.div>

      <div className="flex flex-col gap-3">
        {resumable && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-spot/60 bg-ink-850 p-3">
            <p className="text-sm text-paper-dim">Your game was interrupted mid-round.</p>
            <Button className="mt-2 w-full" onClick={() => void resumeHosting()} disabled={busy}>
              Resume hosting
            </Button>
          </motion.div>
        )}
        {!resumable && lastGame && (
          <Button variant="secondary" onClick={rejoinLast}>
            Rejoin game {lastGame.room}
          </Button>
        )}

        <div className="flex items-center gap-3 rounded-lg border border-ink-600 bg-ink-850 p-2 pl-2">
          <button
            type="button"
            onClick={() => setPicking((p) => !p)}
            className="shrink-0 rounded-full"
            aria-label="Choose your character"
            aria-expanded={picking}
          >
            <Avatar id={prefs.avatar} size={56} expression={picking ? 'happy' : 'neutral'} />
          </button>
          <input
            value={prefs.name}
            onChange={(e) => setPrefs({ name: e.target.value.slice(0, 16) })}
            placeholder="Your name"
            maxLength={16}
            autoComplete="nickname"
            aria-label="Your name"
            className="min-h-tap flex-1 bg-transparent font-display text-xl text-paper placeholder:text-paper-faint focus:outline-none"
          />
        </div>
        {picking && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="grid grid-cols-6 gap-2">
            {AVATARS.map((a, i) => (
              <button
                key={a.name}
                type="button"
                onClick={() => {
                  setPrefs({ avatar: i });
                  setPicking(false);
                }}
                className={`rounded-full p-0.5 ${i === prefs.avatar ? 'ring-2 ring-spot' : ''}`}
                aria-label={a.name}
              >
                <Avatar id={i} size={48} />
              </button>
            ))}
          </motion.div>
        )}

        {problem && <p className="rounded-md bg-danger/15 p-3 text-sm text-paper">{problem}</p>}

        <div className="grid grid-cols-2 gap-3">
          <Button size="lg" onClick={proceed(() => void hostGame())} disabled={!nameOk || busy}>
            {busy ? <Spinner /> : 'Host game'}
          </Button>
          <Button size="lg" variant="secondary" onClick={proceed(() => go('join'))} disabled={!nameOk}>
            Join game
          </Button>
        </div>
        {!nameOk && <p className="text-center text-sm text-paper-faint">Pick a name to play.</p>}
      </div>
    </Screen>
  );
}

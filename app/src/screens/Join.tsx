import jsQR from 'jsqr';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { DEFAULT_PORT, parseJoinUrl } from '@eyespy/protocol';
import { LogoEye } from '../art/Logo';
import { watchGames, type FoundGame } from '../platform/discovery';
import { HAPTICS, isNative, vibrate } from '../platform/device';
import { useGame } from '../state/store';
import { Button, Card, Label, Screen, Spinner, TopBar } from '../ui/kit';

export function Join() {
  const go = useGame((s) => s.go);
  const joinGame = useGame((s) => s.joinGame);
  const [games, setGames] = useState<FoundGame[]>([]);
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => watchGames(setGames), []);

  const joinFound = (g: FoundGame) =>
    joinGame(g.kind === 'lan' ? { kind: 'lan', host: g.host, port: g.port, room: g.room } : { kind: 'tab', room: g.room });

  const joinManual = () => {
    const text = manual.trim();
    const fromUrl = parseJoinUrl(text);
    if (fromUrl) return joinGame({ kind: 'lan', host: fromUrl.host, port: fromUrl.port, room: fromUrl.room });
    const m = text.replace(/^ws:\/\//, '').match(/^([\w.-]+)(?::(\d{1,5}))?$/);
    if (!m) return setError('Type an address like 192.168.43.1 or 192.168.43.1:8787');
    joinGame({ kind: 'lan', host: m[1]!, port: m[2] ? Number(m[2]) : DEFAULT_PORT });
  };

  return (
    <Screen>
      <TopBar title="Join a game" onBack={() => go('home')} />
      <div className="flex flex-col gap-4">
        <Card>
          <Label>Nearby games</Label>
          <AnimatePresence initial={false}>
            {games.map((g) => (
              <motion.button
                key={g.key}
                type="button"
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                onClick={() => joinFound(g)}
                className="mb-2 flex min-h-[64px] w-full items-center gap-3 rounded-md border border-ink-500 bg-ink-800 px-3 text-left"
              >
                <span className="font-display text-2xl tracking-widest text-spot">{g.room}</span>
                <span className="flex-1 text-paper">
                  {g.hostName}'s game
                  {g.kind === 'tab' && <span className="block text-sm text-paper-faint">{g.players} in the lobby</span>}
                </span>
                <span className="text-sm font-semibold text-spot">Join</span>
              </motion.button>
            ))}
          </AnimatePresence>
          {games.length === 0 && (
            <div className="flex items-center gap-3 py-3 text-paper-dim">
              <Spinner />
              <span className="text-sm">
                Looking for games… Make sure you're on the host's hotspot or Wi-Fi.
              </span>
            </div>
          )}
        </Card>

        <Button variant="secondary" size="lg" onClick={() => setScanning(true)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10" />
          </svg>
          Scan the host's QR code
        </Button>

        <Card>
          <Label>Or type the address</Label>
          <div className="flex gap-2">
            <input
              value={manual}
              onChange={(e) => {
                setManual(e.target.value);
                setError(null);
              }}
              placeholder="192.168.43.1:8787"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              aria-label="Host address"
              className="min-h-tap min-w-0 flex-1 rounded-md border border-ink-500 bg-ink-800 px-3 text-paper placeholder:text-paper-faint focus:border-spot focus:outline-none"
            />
            <Button onClick={joinManual} disabled={!manual.trim()}>
              Join
            </Button>
          </div>
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          {!isNative && <p className="mt-2 text-xs text-paper-faint">In a browser, run `pnpm dev:host` and join localhost:8787.</p>}
        </Card>
      </div>

      <AnimatePresence>
        {scanning && (
          <Scanner
            onClose={() => setScanning(false)}
            onResult={(text) => {
              const info = parseJoinUrl(text);
              if (!info) return false;
              void vibrate(HAPTICS.tip);
              setScanning(false);
              joinGame({ kind: 'lan', host: info.host, port: info.port, room: info.room });
              return true;
            }}
          />
        )}
      </AnimatePresence>
    </Screen>
  );
}

/** Camera QR scanner using jsQR (works in browsers and Capacitor web views). */
function Scanner({ onClose, onResult }: { onClose: () => void; onResult: (text: string) => boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [wrongCode, setWrongCode] = useState(false);
  const resultRef = useRef(onResult);
  resultRef.current = onResult;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const scan = () => {
      if (stopped) return;
      const v = video.current;
      if (v && ctx && v.readyState >= 2 && v.videoWidth) {
        const w = 480;
        const h = Math.round((v.videoHeight / v.videoWidth) * w);
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(v, 0, 0, w, h);
        const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
        if (code?.data) {
          if (resultRef.current(code.data)) return;
          setWrongCode(true);
        }
      }
      raf = requestAnimationFrame(scan);
    };
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        if (stopped) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play();
        }
        raf = requestAnimationFrame(scan);
      })
      .catch(() => setProblem("Couldn't open the camera. Allow camera access, or type the address instead."));
    if (!navigator.mediaDevices) setProblem('This device has no camera access here. Type the address instead.');
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <motion.div className="fixed inset-0 z-50 flex flex-col bg-ink-950" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="relative flex-1 overflow-hidden">
        <video ref={video} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-64 w-64 rounded-xl border-4 border-spot shadow-spot" />
        </div>
        {problem && (
          <div className="absolute inset-x-4 top-1/3 flex flex-col items-center gap-3 text-center">
            <LogoEye size={110} />
            <p className="text-paper">{problem}</p>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2 p-4 pb-[max(16px,env(safe-area-inset-bottom))]">
        <p className="text-center text-sm text-paper-dim">
          {wrongCode ? "That's not an EyeSpy game code. Scan the code on the host's screen." : "Point at the game QR code on the host's phone."}
        </p>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </motion.div>
  );
}

import { useEffect, useState } from 'react';
import { CourtScene } from '../motion/CourtScene';

/**
 * Development preview of the Judge's hearing intro (open the app with
 * ?court). Plays on a loop; tap to replay. Add &t=1.9 to hold one moment,
 * &tier=0|1|2 to hold a quality tier (high, medium, low) instead of measuring.
 * Not reachable in the shipped app.
 */
export function CourtPreview() {
  const params = new URLSearchParams(location.search);
  const t = params.get('t');
  const [freezeAt, setFreezeAt] = useState(t === null ? undefined : Number(t));
  const [run, setRun] = useState(0);
  // Lets a recording script step through a held scene: window.__courtSeek(1.9).
  useEffect(() => {
    (window as unknown as { __courtSeek?: (t: number) => void }).__courtSeek = setFreezeAt;
  }, []);

  return (
    <div onClick={() => setRun((r) => r + 1)}>
      <CourtScene key={run} freezeAt={freezeAt} tier={params.has('tier') ? Number(params.get('tier')) : undefined} onDone={() => setTimeout(() => setRun((r) => r + 1), 600)} />
    </div>
  );
}

import { useEffect, useRef } from 'react';
import { play } from '../audio/sounds';
import { color, font } from '../design/tokens';
import { CourtRenderer } from './court/CourtRenderer';
import { COURT_BEATS, COURT_DURATION, courtShot } from './court/timeline';
import { clamp, ease, fitCanvas, runScene, seg, slamText } from './engine';

/**
 * "Domain Expansion: Deadly Sentencing", the Judge's hearing intro (a nod to
 * Jujutsu Kaisen; credited in Settings and CREDITS.md), played on every phone.
 * A real-time WebGL2 scene: ink floods the screen, a courtroom assembles
 * itself out of the dark under striking spotlights, and the gavel falls on an
 * empty judge's chair.
 *
 * It always ends when voting opens: given `opensAt` (and `now`, the shared
 * clock), a phone that starts late (a slow warm-up, a reconnect) joins the
 * clip part-way, or skips it if almost nothing is left. It can never strand
 * a player: a failsafe timer ends it even if the phone stalls. `freezeAt`
 * holds one moment and `tier` holds a quality tier (development previews).
 */
export function CourtScene({ onDone, freezeAt, tier, opensAt, now }: { onDone: () => void; freezeAt?: number; tier?: number; opensAt?: number; now?: () => number }) {
  const finished = useRef(false);
  const finish = useRef(onDone);
  finish.current = () => {
    if (finished.current) return;
    finished.current = true;
    onDone();
  };

  useEffect(() => {
    if (freezeAt !== undefined) return;
    const remaining = opensAt !== undefined && now ? Math.max(0, (opensAt - now()) / 1000) : COURT_DURATION;
    const limit = Math.min(COURT_DURATION, remaining) + 1.5;
    const timer = setTimeout(() => finish.current(), limit * 1000);
    return () => clearTimeout(timer);
  }, [freezeAt, opensAt, now]);

  const done = () => finish.current();
  return <CourtSceneGL onDone={done} freezeAt={freezeAt} tier={tier} opensAt={opensAt} now={now} />;
}

/** Skip the clip entirely if less than this is left of it. */
const MIN_CLIP_S = 0.8;

function CourtSceneGL({ onDone, freezeAt, tier, opensAt, now }: { onDone: () => void; freezeAt?: number; tier?: number; opensAt?: number; now?: () => number }) {
  const glHost = useRef<HTMLDivElement>(null);
  const textCanvas = useRef<HTMLCanvasElement>(null);
  // Previews may move the held moment without remounting.
  const held = useRef(freezeAt);
  held.current = freezeAt;

  useEffect(() => {
    // A fresh canvas per mount: a disposed renderer loses its context for good.
    const canvas = document.createElement('canvas');
    canvas.className = 'absolute inset-0 h-full w-full';
    glHost.current!.appendChild(canvas);
    let made: CourtRenderer | null = null;
    try {
      made = new CourtRenderer(canvas);
      // Compile, then time a few hidden frames and pick this device's quality tier
      // before the clock starts. Slow devices get the lightest tier, never no intro.
      if (tier !== undefined) made.forceTier(tier);
      else made.warmUp();
    } catch (err) {
      // Only a real failure (no WebGL2, a driver error) skips the intro.
      console.warn('[court] WebGL scene unavailable, skipping intro', err);
      // In the development preview, say why on screen instead of a blank page.
      if (freezeAt !== undefined && textCanvas.current) {
        const { ctx, w, h } = fitCanvas(textCanvas.current);
        ctx.fillStyle = color.paper.DEFAULT;
        ctx.font = `14px ${font.body}`;
        ctx.textAlign = 'center';
        ctx.fillText(`3D intro failed: ${err instanceof Error ? err.message : String(err)}`.slice(0, 120), w / 2, h / 2);
      }
      try {
        made?.dispose();
      } catch {
        // already gone
      }
      canvas.remove();
      if (freezeAt === undefined) onDone();
      return;
    }
    const renderer = made;

    const { ctx, w, h } = fitCanvas(textCanvas.current!);
    const lost = (e: Event) => {
      e.preventDefault();
      if (freezeAt === undefined) onDone();
    };
    canvas.addEventListener('webglcontextlost', lost);

    let stop: () => void;
    if (freezeAt !== undefined) {
      let raf = 0;
      let drawn = -1;
      let drawnAt = 0;
      const loop = (now: number) => {
        // Redraw when the held moment moves, and a few times a second for flicker and grain.
        const at = held.current ?? 0;
        if (at !== drawn || now - drawnAt > 250) {
          renderer.render(courtShot(at), at, false);
          drawTitles(ctx, w, h, at);
          drawn = at;
          drawnAt = now;
        }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      stop = () => cancelAnimationFrame(raf);
    } else {
      // Join part-way if this phone is late, so the clip ends as voting opens.
      const from = opensAt !== undefined && now ? Math.max(0, COURT_DURATION - (opensAt - now()) / 1000) : 0;
      if (from > COURT_DURATION - MIN_CLIP_S) {
        renderer.dispose();
        canvas.remove();
        onDone();
        return;
      }
      play('court', from);
      stop = runScene(
        COURT_DURATION,
        (t) => {
          renderer.render(courtShot(t), t);
          drawTitles(ctx, w, h, t);
        },
        onDone,
        from,
      );
    }
    return () => {
      stop();
      canvas.removeEventListener('webglcontextlost', lost);
      renderer.dispose();
      canvas.remove();
    };
    // The scene runs once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[56] overflow-hidden bg-ink-950" role="img" aria-label="Domain Expansion: Deadly Sentencing">
      <div ref={glHost} className="absolute inset-0" />
      <canvas ref={textCanvas} className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}

/** 領域展開 as the domain closes, then the domain's name after the gavel. */
function drawTitles(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.clearRect(0, 0, w, h);
  const B = COURT_BEATS;
  // Hidden during the impact frame so the negative reads cleanly.
  if (t >= B.gavel && t < B.gavel + 0.065) return;
  const cx = w / 2;

  // The incantation: big kanji slam in over the ink, then dissolve.
  const kIn = seg(t, B.kanji, B.kanji + 0.25);
  const kOut = 1 - seg(t, 0.85, 1.1);
  if (kIn > 0 && kOut > 0) {
    const size = Math.min(78, w * 0.19);
    const s = 1.5 - 0.5 * ease.outExpo(kIn);
    ctx.save();
    ctx.globalAlpha = clamp(kIn * 3) * kOut;
    ctx.translate(cx, h * 0.47);
    ctx.scale(s, s);
    ctx.font = `900 ${size}px ${font.jp}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color.crimson.DEFAULT;
    ctx.shadowBlur = 28;
    ctx.fillStyle = color.paper.DEFAULT;
    ctx.fillText('領域展開', 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  const fade = 1 - seg(t, B.fade, COURT_DURATION);
  if (t < B.title || fade <= 0) return;
  ctx.save();
  ctx.globalAlpha = fade * seg(t, B.title + 0.15, B.title + 0.4);
  ctx.font = `900 ${Math.min(18, w * 0.045)}px ${font.jp}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = color.crimson.DEFAULT;
  ctx.shadowColor = color.crimson.deep;
  ctx.shadowBlur = 12;
  ctx.fillText('領 域 展 開', cx, h * 0.735);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = fade;
  slamText(ctx, 'DOMAIN EXPANSION', cx, h * 0.8, Math.min(30, w * 0.075), seg(t, B.title, B.title + 0.3), color.paper.DEFAULT, color.crimson.deep);
  slamText(ctx, 'DEADLY SENTENCING', cx, h * 0.87, Math.min(46, w * 0.1), seg(t, B.title + 0.12, B.title + 0.42), color.paper.DEFAULT, color.crimson.DEFAULT);
  ctx.restore();
}

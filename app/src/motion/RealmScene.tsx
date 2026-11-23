import { useEffect, useRef, useState } from 'react';
import { play } from '../audio/sounds';
import { blade, clamp, ease, fitCanvas, lerp, rng, runScene, seg, slamText } from './engine';
import { SlashedFace, type SlashedFaceHandle } from './SlashedFace';

/**
 * "Realm Unfolded: Thousand-Petal Abattoir", Shuten's finisher, played on
 * the victim's phone. An original motion-graphics piece:
 *
 *  0.00  impact frame (negative flash)
 *  0.15  crimson ink blooms out from the centre, camera pushes in
 *  1.20  the barrier snaps shut, a blood moon rises, a lotus of blades opens
 *  1.00  the victim's own portrait is dragged into the realm, trembling
 *  1.45  the title slams in
 *  2.40  twelve cuts criss-cross the screen; the first one splits the portrait
 *        in two and the halves slide apart
 *  3.02  white-out, the world shatters
 *  4.20  done
 *
 * Sound cues ('realm' at 0, 'realmCuts' at 2.4) are timed to these marks.
 */
export const REALM_DURATION = 4.2;

/** The angle of the first cut, the one that splits the victim's portrait (radians, y down: rising to the right). */
export const MAIN_CUT = -0.55;

export function RealmScene({ avatar, onDone }: { avatar: number; onDone: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const front = useRef<HTMLCanvasElement>(null);
  const face = useRef<SlashedFaceHandle>(null);
  const [cut, setCut] = useState(false);
  // Sized once, like the canvases, so the portrait and the cuts line up.
  const [{ size, cy: centerY }] = useState(() => ({ size: Math.min(window.innerWidth * 0.62, 250), cy: window.innerHeight * 0.42 }));

  useEffect(() => {
    const { ctx, w, h } = fitCanvas(canvas.current!);
    // A second canvas above the portrait carries the cuts, the white-outs and the title.
    const { ctx: fg } = fitCanvas(front.current!);
    const cx = w / 2;
    const cy = centerY;
    const R = Math.hypot(w, h);
    const r = rng(7);
    // Pre-roll the random shapes so every frame draws the same scene.
    const tendrils = Array.from({ length: 34 }, () => ({ a: r() * Math.PI * 2, len: 0.5 + r() * 0.6, wob: (r() - 0.5) * 1.6, w: 6 + r() * 18 }));
    const embers = Array.from({ length: 90 }, () => ({ x: r() * w, y: h + r() * h * 0.6, v: 60 + r() * 160, s: 1 + r() * 3, ph: r() * 6 }));
    const cuts = Array.from({ length: 12 }, (_, i) => {
      // The first cut is the one that splits the portrait; the rest fan out through the same point.
      const a = i === 0 ? MAIN_CUT : MAIN_CUT + (i / 12) * Math.PI + (r() - 0.5) * 0.4;
      const len = R * 0.6;
      return { x1: cx - Math.cos(a) * len, y1: cy - Math.sin(a) * len, x2: cx + Math.cos(a) * len, y2: cy + Math.sin(a) * len, at: 2.4 + i * 0.045 + r() * 0.02 };
    });
    const shards = Array.from({ length: 26 }, () => ({ x: r() * w, y: r() * h, vx: (r() - 0.5) * 900, vy: (r() - 0.6) * 900, rot: (r() - 0.5) * 8, s: 40 + r() * 90 }));
    let cutsPlayed = false;
    let faceCut = false;
    play('realm');

    const stop = runScene(
      REALM_DURATION,
      (t) => {
        if (t >= 2.4 && !cutsPlayed) {
          cutsPlayed = true;
          play('realmCuts');
        }
        if (t >= 2.4 && !faceCut) {
          faceCut = true;
          setCut(true);
        }
        // Camera: a slow push in, a kick on the barrier, a shake during the cuts.
        const push = 1 + 0.12 * ease.outCubic(seg(t, 0, 2.4)) + 0.06 * Math.exp(-12 * Math.max(0, t - 1.2)) * (t > 1.2 ? 1 : 0);
        const shake = t > 2.4 && t < 3.2 ? (1 - seg(t, 2.4, 3.2)) * 14 : t > 1.2 && t < 1.5 ? 10 * (1 - seg(t, 1.2, 1.5)) : 0;
        const sx = (Math.sin(t * 91) + Math.sin(t * 37)) * shake * 0.5;
        const sy = (Math.cos(t * 83) + Math.sin(t * 29)) * shake * 0.5;

        ctx.setTransform(ctx.getTransform().a, 0, 0, ctx.getTransform().d, 0, 0);
        ctx.clearRect(0, 0, w, h);
        fg.clearRect(0, 0, w, h);
        ctx.save();
        ctx.translate(cx + sx, cy + sy);
        ctx.scale(push, push);
        ctx.translate(-cx, -cy);

        // Background: black, then the crimson realm.
        ctx.fillStyle = '#050003';
        ctx.fillRect(-w, -h, w * 3, h * 3);
        const bloom = ease.outExpo(seg(t, 0.15, 1.3));
        if (bloom > 0) {
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.75 * bloom + 1);
          g.addColorStop(0, '#5C0014');
          g.addColorStop(0.45, '#2A0008');
          g.addColorStop(1, '#070002');
          ctx.fillStyle = g;
          ctx.fillRect(-w, -h, w * 3, h * 3);
          // Ink tendrils racing outward.
          for (const td of tendrils) {
            const k = ease.outExpo(seg(t, 0.15, 1.1));
            ctx.strokeStyle = 'rgba(190, 0, 30, 0.55)';
            ctx.lineWidth = td.w * (1 - k * 0.6);
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            const ex = cx + Math.cos(td.a) * R * td.len * k;
            const ey = cy + Math.sin(td.a) * R * td.len * k;
            const mx = cx + Math.cos(td.a + td.wob) * R * td.len * 0.5 * k;
            const my = cy + Math.sin(td.a + td.wob) * R * td.len * 0.5 * k;
            ctx.quadraticCurveTo(mx, my, ex, ey);
            ctx.stroke();
          }
        }

        // The blood moon and the barrier ring.
        const moon = ease.outBack(seg(t, 1.2, 1.9));
        if (moon > 0) {
          const mr = Math.min(w, h) * 0.36 * moon;
          const mg = ctx.createRadialGradient(cx, cy - 10, mr * 0.2, cx, cy, mr);
          mg.addColorStop(0, '#FF6A4D');
          mg.addColorStop(0.6, '#C4001F');
          mg.addColorStop(1, '#3A0008');
          ctx.save();
          ctx.shadowColor = '#FF2D55';
          ctx.shadowBlur = 60;
          ctx.fillStyle = mg;
          ctx.beginPath();
          ctx.arc(cx, cy, mr, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          // Barrier: a bright ring that snaps from the screen edge to the moon.
          const ring = lerp(R * 0.8, mr * 1.25, ease.outExpo(seg(t, 1.2, 1.45)));
          ctx.strokeStyle = `rgba(255, 220, 220, ${0.9 * (1 - seg(t, 1.45, 2.6))})`;
          ctx.lineWidth = 3 + 10 * (1 - seg(t, 1.2, 1.6));
          ctx.beginPath();
          ctx.arc(cx, cy, ring, 0, Math.PI * 2);
          ctx.stroke();
        }

        // A lotus of blades unfurling around the moon, slowly turning.
        const petals = ease.outCubic(seg(t, 1.3, 2.2));
        if (petals > 0) {
          const base = Math.min(w, h) * 0.38;
          for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2 + t * 0.35;
            const len = base * (0.55 + 0.45 * petals) + (i % 2) * base * 0.18;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(a);
            ctx.globalAlpha = 0.9 * petals;
            const pg = ctx.createLinearGradient(0, -base * 0.4, 0, -len);
            pg.addColorStop(0, '#2A0008');
            pg.addColorStop(1, i % 2 ? '#FFE1E1' : '#FF2D55');
            ctx.fillStyle = pg;
            ctx.beginPath();
            ctx.moveTo(-10, -base * 0.42);
            ctx.lineTo(0, -len);
            ctx.lineTo(10, -base * 0.42);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }
        }

        // Embers rising.
        if (t > 1.2) {
          for (const e of embers) {
            const y = e.y - (t - 1.2) * e.v;
            const x = e.x + Math.sin(t * 2 + e.ph) * 14;
            ctx.fillStyle = `rgba(255, ${120 + (e.s * 30) | 0}, 90, ${0.8 * (1 - seg(t, 3.4, 4.0))})`;
            ctx.fillRect(x, ((y % (h * 1.6)) + h * 1.6) % (h * 1.6) - h * 0.3, e.s, e.s * 2.2);
          }
        }
        ctx.restore();

        // Title, in screen space so it reads cleanly.
        slamText(fg, 'REALM UNFOLDED', cx, h * 0.76, Math.min(30, w * 0.075), seg(t, 1.45, 1.75), '#F7F2E8', '#C4001F');
        slamText(fg, 'THOUSAND-PETAL', cx, h * 0.83, Math.min(52, w * 0.12), seg(t, 1.6, 1.9), '#F7F2E8', '#FF2D55');
        slamText(fg, 'ABATTOIR', cx, h * 0.9, Math.min(60, w * 0.14), seg(t, 1.72, 2.02), '#FFFFFF', '#FF2D55');
        fg.save();
        fg.globalAlpha = seg(t, 1.9, 2.2) * (1 - seg(t, 3.0, 3.2));
        fg.font = `900 ${Math.min(18, w * 0.045)}px "Hiragino Sans","Noto Sans CJK JP","Noto Sans JP",sans-serif`;
        fg.textAlign = 'center';
        fg.fillStyle = '#FF8A9B';
        fg.fillText('千 花 屠 苑', cx, h * 0.705);
        fg.restore();

        // Twelve cuts.
        for (const c of cuts) {
          const k = seg(t, c.at, c.at + 0.07);
          const fade = 1 - seg(t, c.at + 0.07, c.at + 0.5);
          if (k > 0 && fade > 0) {
            fg.save();
            fg.globalAlpha = fade;
            blade(fg, c.x1, c.y1, c.x2, c.y2, 7, '#FF2D55', k);
            fg.restore();
          }
        }

        // Impact frames: the opening negative flash, and the white-out before the shatter.
        const flash = Math.max(1 - seg(t, 0, 0.15), t > 3.02 ? 1 - seg(t, 3.02, 3.25) : 0, t > 1.2 && t < 1.3 ? 0.6 : 0);
        if (flash > 0) {
          fg.fillStyle = `rgba(255,255,255,${flash})`;
          fg.fillRect(0, 0, w, h);
        }

        // The shatter: black shards fly out, revealing darkness.
        if (t > 3.1) {
          const k = seg(t, 3.1, 4.0);
          fg.fillStyle = '#000';
          fg.globalAlpha = clamp(k * 1.5);
          fg.fillRect(0, 0, w, h);
          fg.globalAlpha = 1 - k;
          for (const s of shards) {
            fg.save();
            fg.translate(s.x + s.vx * k, s.y + s.vy * k + 600 * k * k);
            fg.rotate(s.rot * k);
            fg.fillStyle = '#5C0014';
            fg.strokeStyle = '#FF8A9B';
            fg.beginPath();
            fg.moveTo(0, -s.s / 2);
            fg.lineTo(s.s / 2, s.s / 3);
            fg.lineTo(-s.s / 2, s.s / 4);
            fg.closePath();
            fg.fill();
            fg.stroke();
            fg.restore();
          }
          fg.globalAlpha = 1;
        }

        // The victim's portrait (DOM, between the two canvases): dragged in, trembling, then cut in two.
        const rise = ease.outCubic(seg(t, 1.0, 1.7));
        const tremble = t > 1.7 && t < 2.4 ? Math.sin(t * 80) * 2.2 * seg(t, 1.7, 2.3) : 0;
        const hit = t >= 2.4 ? Math.exp(-14 * (t - 2.4)) * 10 : 0;
        face.current?.pose({
          alpha: rise * (1 - seg(t, 3.0, 3.2)),
          x: sx + tremble + hit,
          y: lerp(60, 0, rise) + sy,
          scale: lerp(1.25, 1, rise) * (1 + 0.05 * seg(t, 1.7, 2.4)),
          split: ease.outExpo(seg(t, 2.42, 3.0)),
          flash: t >= 2.4 ? 1 - seg(t, 2.4, 2.6) : 0,
          glitch: t > 2.4 && t < 3.05 && Math.floor(t * 30) % 4 === 0,
        });
      },
      onDone,
    );
    face.current?.pose({ alpha: 0, split: 0, flash: 0 });
    return stop;
    // The scene runs once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[55] overflow-hidden bg-black" role="img" aria-label="Realm Unfolded: Thousand-Petal Abattoir. You are cut down.">
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
      <SlashedFace ref={face} avatar={avatar} size={size} angle={MAIN_CUT} expression={cut ? 'dead' : 'shock'} className="pointer-events-none" style={{ top: centerY, opacity: 0 }} />
      <canvas ref={front} className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}

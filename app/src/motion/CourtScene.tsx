import { useEffect, useRef } from 'react';
import { Face } from '../art/Face';
import { play } from '../audio/sounds';
import { ease, fitCanvas, lerp, rng, runScene, seg, slamText } from './engine';

/**
 * "Realm Unfolded: Court of the Unblinking Eye", the Judge's hearing intro,
 * played on every phone. An original motion-graphics piece:
 *
 *  0.00  lights cut; a vertical slit of gold light opens into a giant eye
 *  0.60  the courtroom rushes in: perspective floor, pillars rising
 *  1.00  gold scales lower and swing (temple gong)
 *  1.30  the Magistrate slides in; title slams
 *  1.90  the gavel falls: shockwave, impact frame (knock + boom)
 *  3.20  done; the voting screen takes over
 */
export const COURT_DURATION = 3.2;

export function CourtScene({ characterId, onDone }: { characterId: string | null; onDone: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const portrait = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const { ctx, w, h } = fitCanvas(canvas.current!);
    const cx = w / 2;
    const horizon = h * 0.36;
    const r = rng(11);
    const motes = Array.from({ length: 70 }, () => ({ x: r() * w, y: r() * h, s: 0.6 + r() * 2, v: 8 + r() * 20, ph: r() * 6 }));
    const gold = '#FFC83A';
    play('court');

    const stop = runScene(
      COURT_DURATION,
      (t) => {
        const shake = t > 1.9 && t < 2.3 ? (1 - seg(t, 1.9, 2.3)) * 12 : 0;
        const sx = Math.sin(t * 97) * shake;
        const sy = Math.cos(t * 89) * shake;
        ctx.clearRect(0, 0, w, h);
        ctx.save();
        ctx.translate(sx, sy);
        ctx.fillStyle = '#030208';
        ctx.fillRect(-20, -20, w + 40, h + 40);

        // The courtroom: perspective floor lines rushing in, pillars rising.
        const build = ease.outExpo(seg(t, 0.6, 1.4));
        if (build > 0) {
          const bg = ctx.createLinearGradient(0, 0, 0, h);
          bg.addColorStop(0, '#0B0A1C');
          bg.addColorStop(0.36, '#1B1636');
          bg.addColorStop(1, '#07060F');
          ctx.globalAlpha = build;
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = 'rgba(255, 200, 58, 0.35)';
          ctx.lineWidth = 1.2;
          for (let i = -8; i <= 8; i++) {
            ctx.beginPath();
            ctx.moveTo(cx + i * 6, horizon);
            ctx.lineTo(cx + i * w * 0.25 * build, h);
            ctx.stroke();
          }
          for (let j = 1; j < 9; j++) {
            const y = horizon + (h - horizon) * Math.pow(j / 9, 1.8) * build + ((t * 40) % 20) * (1 - build);
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
          }
          // Pillars on both sides.
          for (let i = 0; i < 3; i++) {
            const rise = ease.outBack(seg(t, 0.7 + i * 0.08, 1.3 + i * 0.08));
            const pw = w * (0.07 - i * 0.012);
            const ph = h * (0.75 - i * 0.12) * rise;
            for (const side of [-1, 1]) {
              const x = cx + side * w * (0.46 - i * 0.12) - pw / 2;
              const pg = ctx.createLinearGradient(x, 0, x + pw, 0);
              pg.addColorStop(0, '#2A2448');
              pg.addColorStop(0.5, '#5A4E8C');
              pg.addColorStop(1, '#1A1630');
              ctx.fillStyle = pg;
              ctx.fillRect(x, h - ph - h * 0.05 * i, pw, ph);
              ctx.fillStyle = gold;
              ctx.fillRect(x - 3, h - ph - h * 0.05 * i, pw + 6, 5);
            }
          }
          ctx.globalAlpha = 1;
        }

        // The Unblinking Eye: a slit of light that opens, then watches from above.
        const open = ease.outExpo(seg(t, 0.05, 0.6));
        const eyeY = lerp(h * 0.42, h * 0.17, ease.inOutCubic(seg(t, 0.55, 1.2)));
        const eyeW = lerp(w * 0.9, w * 0.42, ease.inOutCubic(seg(t, 0.55, 1.2)));
        const eyeH = eyeW * 0.32 * open;
        if (open > 0) {
          ctx.save();
          ctx.shadowColor = gold;
          ctx.shadowBlur = 40;
          ctx.fillStyle = '#FFF4D6';
          ctx.beginPath();
          ctx.moveTo(cx - eyeW / 2, eyeY);
          ctx.quadraticCurveTo(cx, eyeY - eyeH * 1.6, cx + eyeW / 2, eyeY);
          ctx.quadraticCurveTo(cx, eyeY + eyeH * 1.6, cx - eyeW / 2, eyeY);
          ctx.fill();
          ctx.restore();
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(cx - eyeW / 2, eyeY);
          ctx.quadraticCurveTo(cx, eyeY - eyeH * 1.6, cx + eyeW / 2, eyeY);
          ctx.quadraticCurveTo(cx, eyeY + eyeH * 1.6, cx - eyeW / 2, eyeY);
          ctx.clip();
          const ir = eyeW * 0.17;
          const ig = ctx.createRadialGradient(cx, eyeY - ir * 0.2, ir * 0.1, cx, eyeY, ir);
          ig.addColorStop(0, '#FFE08A');
          ig.addColorStop(0.6, gold);
          ig.addColorStop(1, '#7A4A00');
          ctx.fillStyle = ig;
          ctx.beginPath();
          ctx.arc(cx, eyeY, ir, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#05030A';
          ctx.beginPath();
          ctx.ellipse(cx, eyeY, ir * 0.18, ir * 0.7, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // Gold scales lower on a chain and swing to rest.
        const lower = ease.outCubic(seg(t, 1.0, 1.5));
        if (lower > 0) {
          const pivotY = lerp(-60, h * 0.3, lower);
          const tilt = 0.35 * ease.swing(seg(t, 1.0, 3.2), 1.6, 3);
          ctx.save();
          ctx.translate(cx, pivotY);
          ctx.strokeStyle = gold;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, -h);
          ctx.lineTo(0, 0);
          ctx.stroke();
          ctx.rotate(tilt);
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(-w * 0.28, 0);
          ctx.lineTo(w * 0.28, 0);
          ctx.stroke();
          for (const side of [-1, 1]) {
            ctx.save();
            ctx.translate(side * w * 0.28, 0);
            ctx.rotate(-tilt);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-24, 50);
            ctx.moveTo(0, 0);
            ctx.lineTo(24, 50);
            ctx.stroke();
            ctx.fillStyle = gold;
            ctx.beginPath();
            ctx.ellipse(0, 52, 30, 8, 0, 0, Math.PI);
            ctx.fill();
            ctx.restore();
          }
          ctx.restore();
        }

        // Dust in the light.
        for (const m of motes) {
          ctx.fillStyle = `rgba(255, 224, 138, ${0.5 * build})`;
          ctx.fillRect(m.x + Math.sin(t + m.ph) * 8, (m.y - t * m.v + h) % h, m.s, m.s);
        }

        // The gavel falls.
        const fall = seg(t, 1.6, 1.9);
        if (fall > 0 && t < 2.6) {
          const ang = lerp(-1.2, 0.05, ease.inExpo(fall));
          ctx.save();
          ctx.translate(cx + w * 0.22, h * 0.6);
          ctx.rotate(ang);
          ctx.fillStyle = '#6B3A1E';
          ctx.fillRect(-4, -90, 8, 90);
          ctx.fillStyle = '#8A4A26';
          ctx.fillRect(-34, -110, 68, 30);
          ctx.fillStyle = gold;
          ctx.fillRect(-36, -100, 6, 10);
          ctx.fillRect(30, -100, 6, 10);
          ctx.restore();
        }
        if (t > 1.9) {
          const k = seg(t, 1.9, 2.6);
          ctx.strokeStyle = `rgba(255, 224, 138, ${1 - k})`;
          ctx.lineWidth = 6 * (1 - k);
          ctx.beginPath();
          ctx.ellipse(cx + w * 0.2, h * 0.6, k * w * 0.8, k * w * 0.2, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();

        slamText(ctx, 'COURT OF THE', cx, h * 0.8, Math.min(34, w * 0.085), seg(t, 1.35, 1.65), '#F7F2E8', '#7A4A00');
        slamText(ctx, 'UNBLINKING EYE', cx, h * 0.88, Math.min(50, w * 0.115), seg(t, 1.5, 1.8), '#FFFFFF', gold);
        ctx.save();
        ctx.globalAlpha = seg(t, 1.7, 2.0);
        ctx.font = `900 ${Math.min(18, w * 0.045)}px "Hiragino Sans","Noto Sans CJK JP","Noto Sans JP",sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFE08A';
        ctx.fillText('審 判 の 間', cx, h * 0.74);
        ctx.restore();

        // Impact frames: the lights cutting out, and the gavel.
        const flash = Math.max(t < 0.1 ? 1 - seg(t, 0, 0.1) : 0, t > 1.9 ? 1 - seg(t, 1.9, 2.1) : 0);
        if (flash > 0) {
          ctx.fillStyle = `rgba(255, 244, 214, ${flash})`;
          ctx.fillRect(0, 0, w, h);
        }
        // Fade out into the voting screen.
        const out = seg(t, 2.7, 3.2);
        if (out > 0) {
          ctx.fillStyle = `rgba(3, 2, 8, ${out})`;
          ctx.fillRect(0, 0, w, h);
        }

        const p = portrait.current;
        if (p) {
          const slide = ease.outExpo(seg(t, 1.25, 1.7));
          p.style.opacity = String(slide * (1 - out));
          p.style.transform = `translate(${lerp(-w * 0.6, 0, slide) + sx}px, ${sy}px)`;
        }
      },
      onDone,
    );
    return stop;
    // The scene runs once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[56] overflow-hidden bg-black" role="img" aria-label="Realm Unfolded: Court of the Unblinking Eye">
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
      <div ref={portrait} className="pointer-events-none absolute left-0 right-0 top-[34%] flex justify-center" style={{ opacity: 0, willChange: 'transform, opacity' }}>
        <div style={{ WebkitMaskImage: 'radial-gradient(ellipse 50% 52% at 50% 46%, #000 62%, transparent 100%)', maskImage: 'radial-gradient(ellipse 50% 52% at 50% 46%, #000 62%, transparent 100%)', }}>
          <Face character={characterId} role={'judge'} size={Math.min(window.innerWidth * 0.62, 280)} crop="face" expression="angry" glowEyes />
        </div>
      </div>
    </div>
  );
}

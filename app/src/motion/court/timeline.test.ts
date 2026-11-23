import { describe, expect, it } from 'vitest';
import { CUES } from '../../audio/sounds';
import { COURT_BEATS, COURT_DURATION, GAVEL_RAPS, courtShot } from './timeline';
import { ASSEMBLED_BY, LIGHTS, PIECES, landTime, lightLevel, piecePose } from './set';

const samples = Array.from({ length: 441 }, (_, i) => (i / 440) * COURT_DURATION);

describe('court timeline', () => {
  it('lines up with the court sound cue', () => {
    const at = (file: string) => CUES.court.find((l) => 'file' in l && l.file === file)?.at ?? 0;
    expect(at('solemnity1')).toBe(COURT_BEATS.firstLight);
    expect(at('text-impact1')).toBe(COURT_BEATS.title);
    const knocks = CUES.court.filter((l) => 'file' in l && l.file === 'door-wood-knock1').map((l) => l.at);
    expect(knocks).toEqual([COURT_BEATS.gavel, ...GAVEL_RAPS]);
  });

  it('raps the gavel down on every knock, lifting it in between', () => {
    for (const r of GAVEL_RAPS) {
      expect(courtShot(r).gavel).toBeCloseTo(0, 5);
      expect(courtShot(r - 0.07).gavel).toBeGreaterThan(0.2);
    }
    expect(courtShot(3.6).gavel).toBe(0);
  });

  it('opens with the ink flood and no lights', () => {
    const s = courtShot(0);
    expect(s.ink).toBe(0);
    expect(s.lights.every((l) => l === 0)).toBe(true);
    expect(courtShot(0.7).ink).toBeGreaterThan(2);
  });

  it('strikes the first spotlight on the dock on the solemn sting', () => {
    const dock = LIGHTS.findIndex((l) => l.target[0] === 0 && l.target[2] === 0);
    expect(courtShot(COURT_BEATS.firstLight - 0.01).lights[dock]).toBe(0);
    expect(courtShot(COURT_BEATS.firstLight).lights[dock]).toBeGreaterThan(0);
  });

  it('brings the gavel down exactly on the knock', () => {
    expect(courtShot(2.7).gavel).toBeGreaterThan(1);
    expect(courtShot(COURT_BEATS.gavel).gavel).toBeCloseTo(0, 5);
    expect(courtShot(COURT_BEATS.gavel - 0.01).impact).toBe(0);
    expect(courtShot(COURT_BEATS.gavel).impact).toBe(1);
    expect(courtShot(COURT_BEATS.gavel + 0.2).impact).toBe(0);
    expect(courtShot(COURT_BEATS.gavel - 0.01).shock).toBe(-1);
  });

  it('ends fully faded', () => {
    expect(courtShot(COURT_DURATION).fade).toBe(1);
    expect(courtShot(3.5).fade).toBe(0);
  });

  it('always produces a usable camera', () => {
    for (const t of samples) {
      const s = courtShot(t);
      for (const v of [...s.cam.pos, ...s.cam.target, s.cam.fov, s.cam.roll, s.scalesY, s.swing, ...s.lights]) expect(Number.isFinite(v)).toBe(true);
      const d = Math.hypot(s.cam.target[0] - s.cam.pos[0], s.cam.target[1] - s.cam.pos[1], s.cam.target[2] - s.cam.pos[2]);
      expect(d).toBeGreaterThan(2);
      expect(s.cam.pos[1]).toBeGreaterThan(0.5); // never under the floor
    }
  });

  it('is deterministic and clamps time', () => {
    expect(courtShot(1.93)).toEqual(courtShot(1.93));
    expect(courtShot(-1)).toEqual(courtShot(0));
    expect(courtShot(99)).toEqual(courtShot(COURT_DURATION));
  });
});

describe('court set', () => {
  it('assembles every piece before the gavel lifts', () => {
    for (const p of PIECES) expect(landTime(p)).toBeLessThanOrEqual(ASSEMBLED_BY);
    expect(ASSEMBLED_BY).toBeLessThan(COURT_BEATS.lift);
  });

  it('hides pieces until they start, then settles them exactly in their slot', () => {
    for (const p of PIECES) {
      expect(piecePose(p, p.start - 0.001)).toBeNull();
      const rest = piecePose(p, landTime(p) + 0.01)!;
      for (let i = 0; i < 3; i++) {
        expect(rest.pos[i]).toBeCloseTo(p.pos[i]!, 6);
        expect(rest.rot[i]).toBeCloseTo(p.rot[i]!, 6);
        expect(rest.size[i]).toBeCloseTo(p.size[i]!, 6);
      }
    }
  });

  it('glows while flying in and cools after locking', () => {
    const p = PIECES[0]!;
    expect(piecePose(p, p.start)!.glow).toBeGreaterThan(0.8);
    expect(piecePose(p, landTime(p) + 1)!.glow).toBeLessThan(0.01);
  });

  it('stays within what the renderer sorts per draw (under 1024 of each shape)', () => {
    expect(PIECES.filter((p) => p.mesh === 'box').length).toBeLessThan(1024);
    expect(PIECES.filter((p) => p.mesh === 'cyl').length).toBeLessThan(1024);
  });

  it('builds a full floor, the dock, the bench and pillars', () => {
    expect(PIECES.filter((p) => p.mat === 'marbleA' || p.mat === 'marbleB')).toHaveLength(170);
    expect(PIECES.filter((p) => p.mesh === 'cyl' && p.mat === 'stone').length).toBeGreaterThanOrEqual(60);
  });

  it('strikes lights with a stutter, then holds them on', () => {
    const l = LIGHTS[1]!;
    expect(lightLevel(l, l.on - 0.01, 9)).toBe(0);
    expect(lightLevel(l, l.on + 0.05, 9)).toBeLessThan(0.5);
    expect(lightLevel(l, l.on + 0.5, 9)).toBe(1);
  });
});

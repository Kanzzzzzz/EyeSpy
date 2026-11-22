import { describe, expect, it } from 'vitest';
import { joinUrl, parseClientMessage, parseJoinUrl, parseServerMessage, wifiQr, wsUrl, PROTOCOL_VERSION } from '../src';

describe('client messages', () => {
  it('accepts every valid action', () => {
    const actions = [
      { type: 'configure', settings: { deathDelayMs: 3000, roles: { killer: 2 }, special: { medium: true } } },
      { type: 'start' },
      { type: 'ready' },
      { type: 'wink', targetId: 'p1' },
      { type: 'raiseEyebrow', targetId: 'p1' },
      { type: 'useAbility', abilityId: 'tip', targetId: 'p1' },
      { type: 'useAbility', abilityId: 'emoji', payload: '🔪' },
      { type: 'arrest', targetId: 'p1' },
      { type: 'look', targetId: 'p1' },
      { type: 'look', targetId: null },
      { type: 'vote', targetId: 'p1' },
      { type: 'pickCharacter', characterId: 'killer.garaku' },
      { type: 'configure', settings: { roles: { judge: 1 }, hearingMs: 20000 } },
      { type: 'playAgain' },
      { type: 'kick', playerId: 'p2' },
      { type: 'reorder', order: ['a', 'b'] },
      { type: 'leave' },
    ];
    for (const action of actions) {
      const r = parseClientMessage(JSON.stringify({ t: 'action', id: 1, action }));
      expect(r.ok, JSON.stringify(action)).toBe(true);
    }
  });

  it('rejects host-only system actions and extra fields from phones', () => {
    for (const action of [
      { type: 'tick' },
      { type: 'join', playerId: 'x', name: 'x', avatar: 0 },
      { type: 'disconnect', playerId: 'x' },
      { type: 'wink', targetId: 'p1', by: 'p9' },
      { type: 'configure', settings: { hacked: true } },
    ]) {
      expect(parseClientMessage({ t: 'action', id: 1, action }).ok, JSON.stringify(action)).toBe(false);
    }
  });

  it('rejects junk', () => {
    expect(parseClientMessage('not json').ok).toBe(false);
    expect(parseClientMessage('{"t":"nope"}').ok).toBe(false);
    expect(parseClientMessage('x'.repeat(70_000)).ok).toBe(false);
  });

  it('parses hello', () => {
    const r = parseClientMessage({ t: 'hello', protocol: PROTOCOL_VERSION, app: '0.1.0', name: 'Maya', avatar: 3, token: null });
    expect(r.ok).toBe(true);
  });
});

describe('server messages', () => {
  it('checks the envelope', () => {
    expect(parseServerMessage('{"t":"pong","at":1,"serverTime":2}').ok).toBe(true);
    expect(parseServerMessage('{"t":"evil"}').ok).toBe(false);
  });
});

describe('QR codes', () => {
  it('round-trips the game QR code', () => {
    const url = joinUrl({ host: '192.168.43.1', port: 8787, room: 'WINK' });
    expect(parseJoinUrl(url)).toEqual({ host: '192.168.43.1', port: 8787, room: 'WINK' });
  });

  it('rejects other QR codes', () => {
    expect(parseJoinUrl('https://example.com')).toBeNull();
    expect(parseJoinUrl('eyespy://join?h=evil host&p=1')).toBeNull();
    expect(parseJoinUrl('eyespy://join?h=1.2.3.4&p=99999')).toBeNull();
    expect(parseJoinUrl('garbage')).toBeNull();
  });

  it('escapes Wi-Fi QR fields', () => {
    expect(wifiQr('My;Net', 'p:ss')).toBe('WIFI:T:WPA;S:My\\;Net;P:p\\:ss;;');
    expect(wifiQr('Open', '')).toBe('WIFI:T:nopass;S:Open;;');
  });

  it('builds WebSocket URLs, including IPv6', () => {
    expect(wsUrl('10.0.0.2', 8787)).toBe('ws://10.0.0.2:8787');
    expect(wsUrl('fe80::1', 8787)).toBe('ws://[fe80::1]:8787');
  });
});

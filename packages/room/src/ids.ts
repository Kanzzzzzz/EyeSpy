const ALPHABET = 'abcdefghijkmnopqrstuvwxyz23456789';
// No 0/O, 1/I/L: room codes get read aloud and typed.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function randomId(random: () => number, length: number): string {
  // Prefer crypto randomness for tokens when it exists.
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint32Array) => Uint32Array } }).crypto;
  if (c?.getRandomValues && random === Math.random) {
    const buf = c.getRandomValues(new Uint32Array(length));
    return Array.from(buf, (n) => ALPHABET[n % ALPHABET.length]).join('');
  }
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return out;
}

export function roomCode(random: () => number): string {
  let out = '';
  for (let i = 0; i < 4; i++) out += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return out;
}

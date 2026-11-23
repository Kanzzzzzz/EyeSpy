import type { Expression, Gaze } from '../art/faceTypes';
import { Portrait } from '../art/Portrait';
import { PORTRAITS } from '../art/portraits';

/**
 * Development-only sheet of every portrait and expression, for reviewing
 * the art (open the app with ?gallery). Not reachable in the shipped app.
 */
export function Gallery() {
  const expressions: Expression[] = ['neutral', 'wink', 'raise', 'happy', 'shock', 'angry', 'sly', 'dead'];
  const gazes: Gaze[] = ['you', 'left', 'right', 'down', 'up'];
  return (
    <div className="min-h-screen bg-ink-900 p-4 text-paper">
      <h1 className="font-display text-4xl uppercase">Characters</h1>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {PORTRAITS.map((l, i) => (
          <figure key={l.id} className="rounded-md border-2 border-paper bg-ink-800 p-1 text-center" data-testid={`portrait-${l.id}`}>
            <Portrait id={i} size={118} blink />
            <Portrait id={i} size={118} crop="eyes" />
            <figcaption className="text-sm">{l.name}</figcaption>
          </figure>
        ))}
      </div>
      <h1 className="mt-6 font-display text-4xl uppercase">Expressions and eye crops</h1>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {expressions.map((e) => (
          <figure key={e} className="rounded-md border-2 border-paper bg-ink-800 p-1 text-center">
            <Portrait id={0} size={118} crop="eyes" expression={e} />
            <Portrait id={3} size={118} crop="face" expression={e} />
            <figcaption className="text-sm">{e}</figcaption>
          </figure>
        ))}
        {gazes.map((g) => (
          <figure key={g} className="rounded-md border-2 border-paper bg-ink-800 p-1 text-center">
            <Portrait id={1} size={118} crop="eyes" gaze={g} />
            <figcaption className="text-sm">gaze {g}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

import { ROSTER, type RoleId } from '@eyespy/engine';
import { AnimeFace, type Expression, type Gaze } from '../art/AnimeFace';
import { PUBLIC_LOOKS, ROLE_LOOKS } from '../art/characters';

/**
 * Development-only sheet of every character and expression, for reviewing
 * the art (open the app with ?gallery). Not reachable in the shipped app.
 */
export function Gallery() {
  const expressions: Expression[] = ['neutral', 'wink', 'raise', 'happy', 'shock', 'angry', 'sly', 'dead'];
  const gazes: Gaze[] = ['you', 'left', 'right', 'down'];
  return (
    <div className="min-h-screen bg-ink-900 p-4 text-paper">
      <h1 className="font-display text-4xl uppercase">Public characters</h1>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {PUBLIC_LOOKS.map((l) => (
          <figure key={l.name} className="rounded-md border-2 border-paper bg-ink-800 p-1 text-center">
            <AnimeFace look={l} size={118} />
            <figcaption className="text-sm">{l.name}</figcaption>
          </figure>
        ))}
      </div>
      <h1 className="mt-6 font-display text-4xl uppercase">Expressions and eye crops</h1>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {expressions.map((e) => (
          <figure key={e} className="rounded-md border-2 border-paper bg-ink-800 p-1 text-center">
            <AnimeFace look={PUBLIC_LOOKS[0]!} size={118} crop="eyes" expression={e} />
            <AnimeFace look={PUBLIC_LOOKS[3]!} size={118} crop="face" expression={e} />
            <figcaption className="text-sm">{e}</figcaption>
          </figure>
        ))}
        {gazes.map((g) => (
          <figure key={g} className="rounded-md border-2 border-paper bg-ink-800 p-1 text-center">
            <AnimeFace look={PUBLIC_LOOKS[1]!} size={118} crop="eyes" gaze={g} />
            <figcaption className="text-sm">gaze {g}</figcaption>
          </figure>
        ))}
      </div>
      {(Object.keys(ROSTER) as RoleId[]).map((role) => (
        <section key={role} className="mt-6">
          <h2 className="font-display text-3xl uppercase">{role}</h2>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {ROSTER[role].map((c) => (
              <figure key={c.id} className="rounded-md border-2 border-paper bg-ink-800 p-1 text-center" style={{ background: `${ROLE_LOOKS[c.id]?.accent}33` }}>
                {ROLE_LOOKS[c.id] ? <AnimeFace look={ROLE_LOOKS[c.id]!} size={118} /> : <p>missing</p>}
                <figcaption className="text-sm">
                  {c.name}
                  <br />
                  <span className="text-xs text-paper-dim">{c.title}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

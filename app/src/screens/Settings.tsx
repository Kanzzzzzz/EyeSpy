import { useGame } from '../state/store';
import { APP_VERSION } from '../platform/device';
import { Card, Label, Screen, Toggle, TopBar } from '../ui/kit';

export function Settings() {
  const prefs = useGame((s) => s.prefs);
  const setPrefs = useGame((s) => s.setPrefs);
  const go = useGame((s) => s.go);
  return (
    <Screen>
      <TopBar title="Settings" onBack={() => go('home')} />
      <div className="flex flex-col gap-4">
        <Card>
          <Label>Sound and touch</Label>
          <Toggle label="Sound effects" checked={prefs.sound} onChange={(v) => setPrefs({ sound: v })} />
          <Toggle label="Tension music" hint="Plays quietly during a round" checked={prefs.music} onChange={(v) => setPrefs({ music: v })} />
          <Toggle label="Vibration" hint="Every alert has its own pattern" checked={prefs.haptics} onChange={(v) => setPrefs({ haptics: v })} />
        </Card>
        <Card>
          <Label>Motion</Label>
          <div role="radiogroup" aria-label="Reduce motion" className="grid grid-cols-3 gap-2">
            {(['system', 'on', 'off'] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={prefs.reducedMotion === v}
                onClick={() => setPrefs({ reducedMotion: v })}
                className={`min-h-tap rounded-md border text-sm font-semibold ${prefs.reducedMotion === v ? 'border-spot bg-spot text-ink-950' : 'border-ink-500 text-paper-dim'}`}
              >
                {v === 'system' ? 'Like my phone' : v === 'on' ? 'Reduce' : 'Full'}
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-paper-faint">"Reduce" swaps big animations for simple fades.</p>
        </Card>
        <Card>
          <Label>Testing</Label>
          <Toggle
            label="Admin test tools"
            hint="When you host: a Practice game on the home screen, and an Admin panel to play as any role and stage winks, raises and hearings."
            checked={prefs.adminTools}
            onChange={(v) => setPrefs({ adminTools: v })}
          />
        </Card>
        <Card>
          <Label>Privacy</Label>
          <p className="text-sm text-paper-dim">
            EyeSpy has no accounts, ads or analytics, and never uses the internet. Your name and character are stored on this phone only and shared only with the phones in your game.
          </p>
        </Card>
        <Card>
          <Label>Credits</Label>
          <p className="text-sm text-paper-dim">
            The Judge's <span className="text-spot">Domain Expansion: Deadly Sentencing</span> is a fan nod to Hiromi Higuruma's domain in <em>Jujutsu Kaisen</em> by Gege Akutami (Shueisha). EyeSpy's characters, art and animation are original, and the game isn't affiliated with or endorsed by the series.
          </p>
          <p className="mt-2 text-sm text-paper-faint">Sound effects from 効果音ラボ (Soundeffect-Lab). Fonts: Anton and Outfit (SIL Open Font License).</p>
        </Card>
        <p className="text-center text-xs text-paper-faint">EyeSpy {APP_VERSION}</p>
      </div>
    </Screen>
  );
}

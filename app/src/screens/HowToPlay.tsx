import { getRole, ROSTER, type RoleId } from '@eyespy/engine';
import { Face } from '../art/Face';
import { RoleBadge, TeamIcon, TEAM_LABEL } from '../art/RoleBadge';
import { useGame } from '../state/store';
import { Card, Label, Screen, TopBar } from '../ui/kit';

const STANDARD: RoleId[] = ['killer', 'sheriff', 'shush', 'snitch', 'judge', 'lover', 'citizen'];
const SPECIAL: RoleId[] = ['dramaQueen', 'bodyguard', 'paparazzi', 'copycat', 'medium', 'decoy', 'insomniac'];

function RoleRow({ id }: { id: RoleId }) {
  const r = getRole(id);
  return (
    <div className="flex gap-3 border-b-2 border-dashed border-ink-600 py-3 last:border-b-0">
      <RoleBadge role={id} team={r.team} size={54} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-display text-xl uppercase leading-none text-paper">
          {r.name}
          <span className="inline-flex items-center gap-1 font-body text-xs font-semibold uppercase tracking-wider text-paper-faint">
            <TeamIcon team={r.team} size={12} /> {TEAM_LABEL[r.team]}
          </span>
        </p>
        <p className="mt-1 text-sm text-paper-dim">{r.summary}</p>
        <div className="mt-1.5 flex gap-1">
          {ROSTER[id].map((c) => (
            <span key={c.id} className="border-2 border-black bg-ink-800" title={`${c.name}, ${c.title}`}>
              <Face character={c.id} size={34} crop="face" />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function HowToPlay() {
  const go = useGame((s) => s.go);
  return (
    <Screen>
      <TopBar title="How to play" jp="遊び方" onBack={() => go('home')} />
      <div className="flex flex-col gap-5 pb-6">
        <Card>
          <Label jp="目">Eyes are everything</Label>
          <p className="text-paper">
            Sit together and stay <b>silent</b>. Everyone is a manga panel on your phone. Tap a panel to look someone in the eye. You can only look at one person at a time.
          </p>
          <ul className="mt-3 space-y-2 text-sm text-paper-dim">
            <li>
              <b className="text-cyan">Eye contact</b>: when the person you're looking at looks back, their panel lights up.
            </li>
            <li>
              <b className="text-crimson">Wink</b> (Killer only): needs eye contact. Their phone counts down 3 seconds, then they fall.
            </li>
            <li>
              <b className="text-paper">Witnesses</b>: anyone looking at the Killer at that moment sees the wink (not who it hit). The <b>eye</b> counter shows how many people are watching you.
            </li>
            <li>
              <b className="text-paper">Raise an eyebrow</b> (Shush, Snitch and Judge only): needs eye contact. Three raises unlock their power.
            </li>
            <li>
              <b className="text-spot">Arrest</b> (Sheriff only): open someone's panel and hold to confirm. Catch the Killer and the town wins. Arrest anyone else and the town loses.
            </li>
          </ul>
        </Card>
        <Card>
          <Label jp="審判">The hearing</Label>
          <p className="text-sm text-paper-dim">
            The <b className="text-paper">Judge</b> (games of 7+) can call one hearing after 3 raises. Play stops and everyone alive votes in secret. The most votes is out; a tie frees everyone. Vote out a Sheriff and the town loses. Vote out the last Killer and the town wins.
          </p>
        </Card>
        <Card>
          <Label jp="勝利">Who wins</Label>
          <p className="text-sm text-paper-dim">
            The <b className="text-paper">town</b> wins when every Killer is caught. The <b className="text-paper">Killers</b> win on a wrong arrest, a Sheriff voted out, or when only the Sheriff, the Killers and one other player are left.
          </p>
        </Card>
        <Card>
          <Label jp="キャラ">Secret characters</Label>
          <p className="text-sm text-paper-dim">
            Each role has its own characters. Pick yours on the reveal screen. Nobody else sees it until the end, except your victims: they see your character's finisher.
          </p>
        </Card>
        <Card>
          <Label jp="役職">Roles</Label>
          {STANDARD.map((id) => (
            <RoleRow key={id} id={id} />
          ))}
        </Card>
        <Card>
          <Label jp="特別">Special roles (host switches them on)</Label>
          {SPECIAL.map((id) => (
            <RoleRow key={id} id={id} />
          ))}
        </Card>
      </div>
    </Screen>
  );
}

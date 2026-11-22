import { getRole, type RoleId } from '@eyespy/engine';
import { RoleBadge, TeamIcon, TEAM_LABEL } from '../art/RoleBadge';
import { useGame } from '../state/store';
import { Card, Label, Screen, TopBar } from '../ui/kit';

const STANDARD: RoleId[] = ['killer', 'sheriff', 'shush', 'snitch', 'lover', 'citizen'];
const SPECIAL: RoleId[] = ['dramaQueen', 'bodyguard', 'paparazzi', 'copycat', 'medium', 'decoy', 'insomniac'];

function RoleRow({ id }: { id: RoleId }) {
  const r = getRole(id);
  return (
    <div className="flex gap-3 py-2">
      <RoleBadge role={id} team={r.team} size={52} />
      <div className="flex-1">
        <p className="flex items-center gap-2 font-display text-lg text-paper">
          {r.name}
          <span className="inline-flex items-center gap-1 font-body text-xs font-semibold uppercase tracking-wider text-paper-faint">
            <TeamIcon team={r.team} size={12} /> {TEAM_LABEL[r.team]}
          </span>
        </p>
        <p className="text-sm text-paper-dim">{r.summary}</p>
      </div>
    </div>
  );
}

export function HowToPlay() {
  const go = useGame((s) => s.go);
  return (
    <Screen>
      <TopBar title="How to play" onBack={() => go('home')} />
      <div className="flex flex-col gap-4 pb-6">
        <Card>
          <p className="text-paper">
            Sit together and stay <b>silent</b>. Everything happens on your phone. Everyone taps all game long, so tapping gives nobody away.
          </p>
          <ul className="mt-3 space-y-2 text-sm text-paper-dim">
            <li>
              <b className="text-paper">Wink</b> (Killer only): tap a face, then Wink. Their phone counts down 3 seconds, then they die.
            </li>
            <li>
              <b className="text-paper">Raise an eyebrow</b> (everyone): they see who did it. Bluff, stir up panic, or charge up a secret ability.
            </li>
            <li>
              <b className="text-paper">Arrest</b> (Sheriff only): hold to confirm. Catch the Killer and the town wins. Arrest anyone else and the town loses.
            </li>
          </ul>
        </Card>
        <Card>
          <Label>Who wins</Label>
          <p className="text-sm text-paper-dim">
            The <b className="text-paper">town</b> wins when the Sheriff arrests every Killer. The <b className="text-paper">Killers</b> win on a wrong arrest, or when only the Sheriff, the Killers and one other player are left alive.
          </p>
        </Card>
        <Card>
          <Label>Roles</Label>
          {STANDARD.map((id) => (
            <RoleRow key={id} id={id} />
          ))}
        </Card>
        <Card>
          <Label>Special roles (host switches them on)</Label>
          {SPECIAL.map((id) => (
            <RoleRow key={id} id={id} />
          ))}
        </Card>
      </div>
    </Screen>
  );
}

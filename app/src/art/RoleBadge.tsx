import type { RoleId, Team } from '@eyespy/engine';
import { color } from '../design/tokens';

/**
 * Role badges: hand-written SVG. Each team has a colour, an icon (▲ Killers,
 * ● Town, ◆ Alone) and a pattern (stripes, dots, checks), so colour is never
 * the only cue.
 */

const INK = color.ink[950];
const PAPER = color.paper.DEFAULT;

export const TEAM_LABEL: Record<Team, string> = { killers: 'Killers', town: 'Town', alone: 'Alone' };

export function TeamIcon({ team, size = 14 }: { team: Team; size?: number }) {
  const fill = color.team[team];
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      {team === 'killers' && <path d="M10 2 L19 18 H1 Z" fill={fill} stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />}
      {team === 'town' && <circle cx="10" cy="10" r="8" fill={fill} stroke={INK} strokeWidth="1.5" />}
      {team === 'alone' && <path d="M10 1 L19 10 L10 19 L1 10 Z" fill={fill} stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />}
    </svg>
  );
}

function TeamPattern({ team, id }: { team: Team; id: string }) {
  const c = color.team[team];
  if (team === 'killers') {
    return (
      <pattern id={id} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="10" height="10" fill={c} />
        <rect width="4" height="10" fill="rgba(0,0,0,0.22)" />
      </pattern>
    );
  }
  if (team === 'town') {
    return (
      <pattern id={id} width="10" height="10" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" fill={c} />
        <circle cx="5" cy="5" r="1.8" fill="rgba(0,0,0,0.22)" />
      </pattern>
    );
  }
  return (
    <pattern id={id} width="12" height="12" patternUnits="userSpaceOnUse">
      <rect width="12" height="12" fill={c} />
      <rect width="6" height="6" fill="rgba(0,0,0,0.2)" />
      <rect x="6" y="6" width="6" height="6" fill="rgba(0,0,0,0.2)" />
    </pattern>
  );
}

/** The glyph in the middle of each badge, drawn in a 0..100 box. */
function Glyph({ role }: { role: RoleId }) {
  const s = { stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  switch (role) {
    case 'killer':
      return (
        <g {...s}>
          <path d="M22 52 C 36 34, 64 34, 78 52 C 64 70, 36 70, 22 52 Z" fill={PAPER} />
          <path d="M30 52 C 42 60, 58 60, 70 52" fill="none" strokeWidth="5" />
          <path d="M34 40 L28 32 M50 37 V27 M66 40 L72 32" />
          <path d="M66 66 L78 78" stroke={color.team.killers} strokeWidth="6" />
          <path d="M64 64 L70 70" strokeWidth="9" />
        </g>
      );
    case 'sheriff':
      return (
        <path
          d="M50 20 L58 40 L80 41 L63 54 L69 76 L50 64 L31 76 L37 54 L20 41 L42 40 Z"
          fill={color.spot.DEFAULT}
          {...s}
        />
      );
    case 'shush':
      return (
        <g {...s}>
          <path d="M28 56 C 36 46, 64 46, 72 56 C 64 66, 36 66, 28 56 Z" fill={color.team.killers} />
          <path d="M28 56 H72" />
          <rect x="45" y="26" width="10" height="46" rx="5" fill={PAPER} />
        </g>
      );
    case 'snitch':
      return (
        <g {...s}>
          <path d="M24 44 H36 L66 28 V76 L36 60 H24 Z" fill={PAPER} />
          <path d="M30 60 L34 74 H42 L40 62" fill={PAPER} />
          <path d="M74 42 C 80 48, 80 56, 74 62 M80 34 C 90 44, 90 60, 80 70" fill="none" />
        </g>
      );
    case 'lover':
      return <path d="M50 78 C 20 58, 18 30, 36 28 C 44 27, 49 33, 50 38 C 51 33, 56 27, 64 28 C 82 30, 80 58, 50 78 Z" fill={color.team.killers} {...s} />;
    case 'citizen':
      return (
        <g {...s}>
          <ellipse cx="50" cy="64" rx="30" ry="8" fill={color.ink[700]} />
          <path d="M32 64 C 30 34, 70 34, 68 64 Z" fill={color.ink[700]} />
          <path d="M33 56 H67" stroke={color.spot.DEFAULT} strokeWidth="5" />
        </g>
      );
    case 'dramaQueen':
      return (
        <g {...s}>
          <path d="M24 70 L28 34 L40 50 L50 28 L60 50 L72 34 L76 70 Z" fill={color.spot.DEFAULT} />
          <circle cx="50" cy="60" r="5" fill={color.team.alone} />
        </g>
      );
    case 'bodyguard':
      return (
        <g {...s}>
          <path d="M50 22 L76 32 C 76 56, 66 70, 50 80 C 34 70, 24 56, 24 32 Z" fill={PAPER} />
          <path d="M40 50 L48 58 L62 42" fill="none" strokeWidth="6" />
        </g>
      );
    case 'paparazzi':
      return (
        <g {...s}>
          <rect x="22" y="36" width="56" height="38" rx="8" fill={PAPER} />
          <path d="M38 36 L42 28 H58 L62 36" fill={PAPER} />
          <circle cx="50" cy="55" r="11" fill={color.ink[700]} />
          <circle cx="68" cy="44" r="3" fill={color.spot.DEFAULT} stroke="none" />
        </g>
      );
    case 'copycat':
      return (
        <g {...s}>
          <path d="M28 76 V40 L36 24 L46 36 H54 L64 24 L72 40 V76 Z" fill={PAPER} />
          <circle cx="41" cy="52" r="3.5" fill={INK} stroke="none" />
          <circle cx="59" cy="52" r="3.5" fill={INK} stroke="none" />
          <path d="M46 62 L50 66 L54 62 M50 66 V70" fill="none" />
        </g>
      );
    case 'medium':
      return (
        <g {...s}>
          <circle cx="50" cy="46" r="22" fill={color.team.alone} />
          <path d="M40 38 C 44 34, 48 34, 50 36" stroke={PAPER} fill="none" />
          <path d="M32 78 L36 66 H64 L68 78 Z" fill={color.spot.DEFAULT} />
        </g>
      );
    case 'decoy':
      return (
        <g {...s}>
          <path d="M22 62 C 22 50, 40 48, 50 54 C 58 44, 62 32, 72 34 C 80 36, 80 46, 74 50 L84 52 L74 56 C 74 70, 60 76, 46 76 C 32 76, 22 72, 22 62 Z" fill={color.spot.DEFAULT} />
          <circle cx="70" cy="42" r="2.8" fill={INK} stroke="none" />
          <path d="M34 62 C 40 66, 48 66, 54 62" fill="none" />
        </g>
      );
    case 'insomniac':
      return (
        <g {...s}>
          <path d="M60 22 C 40 26, 30 46, 38 64 C 46 80, 68 80, 78 68 C 60 70, 46 56, 50 40 C 52 32, 56 26, 60 22 Z" fill={color.spot.soft} />
          <path d="M64 34 H74 L64 44 H74" fill="none" strokeWidth="3.5" />
        </g>
      );
  }
}

export function RoleBadge({ role, team, size = 96 }: { role: RoleId; team: Team; size?: number }) {
  const pid = `pat-${role}-${team}`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`${role} badge`}>
      <defs>
        <TeamPattern team={team} id={pid} />
      </defs>
      <circle cx="50" cy="50" r="47" fill={`url(#${pid})`} stroke={INK} strokeWidth="3" />
      <circle cx="50" cy="50" r="38" fill={color.ink[850]} stroke={INK} strokeWidth="3" />
      <g transform="translate(14 14) scale(0.72)">
        <Glyph role={role} />
      </g>
    </svg>
  );
}

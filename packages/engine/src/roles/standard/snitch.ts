import type { RoleDefinition } from '../types';

export const snitch: RoleDefinition = {
  id: 'snitch',
  name: 'Snitch',
  team: 'town',
  special: false,
  summary: 'After your 3rd eyebrow raise, name who you think the Killer is, once. Every phone shows it.',
  goal: 'Help the Sheriff find the Killers. Nobody knows who you are.',
  canRaise: true,
  abilities: [
    {
      id: 'tip',
      label: 'Tip off the town',
      hint: 'Names the player whose panel you have open. Every phone shows it; your name stays secret.',
      target: 'player',
      unlock: 'raises',
      uses: 1,
      apply(ctx, userId, targetId) {
        ctx.emit({ type: 'SnitchTip', suspectId: targetId!, snitchCharacter: ctx.roleOf(userId).character }, 'all');
      },
    },
  ],
};

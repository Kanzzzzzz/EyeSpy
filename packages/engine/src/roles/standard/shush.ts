import type { RoleDefinition } from '../types';

export const shush: RoleDefinition = {
  id: 'shush',
  name: 'Shush',
  team: 'killers',
  special: false,
  summary: 'After your 3rd eyebrow raise, shush the Sheriff once: no arrests until 2 more kills.',
  goal: 'Help the Killers win. You do not know who they are, and they do not know you.',
  abilities: [
    {
      id: 'shush',
      label: 'Shush the Sheriff',
      hint: 'The Sheriff cannot arrest anyone until more kills happen.',
      target: 'none',
      unlock: 'raises',
      uses: 1,
      apply(ctx, userId) {
        const kills = Math.max(1, ctx.state.settings.shushLockKills);
        ctx.state.shushLockKillsRemaining = kills;
        const sheriffs = ctx.alive().filter((p) => ctx.roleOf(p.id).role === 'sheriff').map((p) => p.id);
        ctx.emit({ type: 'SheriffShushed', kills }, [...sheriffs, userId]);
      },
    },
  ],
};

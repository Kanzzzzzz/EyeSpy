import type { RoleDefinition } from '../types';

export const killer: RoleDefinition = {
  id: 'killer',
  name: 'Killer',
  team: 'killers',
  special: false,
  summary: 'Wink at a player to kill them. Winking the Sheriff kills nobody and gives you away.',
  goal: 'Thin out the room until only the Sheriff, the Killers and one other are left.',
  canWink: true,
  isKiller: true,
  knowsAtStart(ctx, selfId) {
    // In big games the Killers know each other.
    return ctx.withRole('killer').map((p) => p.id).filter((id) => id !== selfId);
  },
};

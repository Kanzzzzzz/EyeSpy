import type { RoleDefinition } from '../types';

export const lover: RoleDefinition = {
  id: 'lover',
  name: 'Lover',
  team: 'town',
  special: false,
  summary: 'Somebody here is your secret partner. If one of you dies, so does the other.',
  goal: 'Help the Sheriff find the Killers, and hope your partner is careful.',
  onAssigned(ctx, selfId) {
    const me = ctx.roleOf(selfId);
    if (me.data.partnerId) return;
    // Pair with the next unpaired Lover in seat order. Roles are dealt at
    // random, so this pairing is random too.
    const partner = ctx
      .withRole('lover')
      .find((p) => p.id !== selfId && !ctx.roleOf(p.id).data.partnerId);
    if (!partner) return;
    me.data.partnerId = partner.id;
    ctx.roleOf(partner.id).data.partnerId = selfId;
  },
  onEvent(ctx, event, selfId) {
    if (event.type !== 'PlayerDied') return;
    const partnerId = ctx.roleOf(selfId).data.partnerId;
    if (event.playerId === partnerId && ctx.player(selfId).alive) {
      ctx.kill(selfId, 'heartbreak');
    }
  },
};

import type { RoleDefinition } from '../types';

export const insomniac: RoleDefinition = {
  id: 'insomniac',
  name: 'Insomniac',
  team: 'town',
  special: true,
  summary: 'You feel a nameless buzz every time anyone winks.',
  goal: 'Help the Sheriff find the Killers. Watch who blinks when you buzz.',
  onEvent(ctx, event, selfId) {
    if (event.type !== 'WinkSent' || !ctx.player(selfId).alive || event.killerId === selfId) return;
    ctx.emit({ type: 'Buzz' }, [selfId]);
  },
};

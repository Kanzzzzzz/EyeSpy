import type { RoleDefinition } from '../types';

export const MEDIUM_EMOJI = ['👀', '🔪', '😉', '🤨', '🤫', '💔', '👍', '👎', '⭐', '❓'];

export const medium: RoleDefinition = {
  id: 'medium',
  name: 'Medium',
  team: 'town',
  special: true,
  summary: 'Every dead player can send you one emoji from beyond.',
  goal: 'Help the Sheriff find the Killers.',
  ghostAbilities: [
    {
      id: 'emoji',
      label: 'Message the Medium',
      hint: 'Send one emoji to the Medium. You only get one.',
      target: 'none',
      uses: 1,
      payload: { kind: 'emoji', options: MEDIUM_EMOJI },
      validate(_ctx, _userId, _targetId, payload) {
        return payload && MEDIUM_EMOJI.includes(payload) ? null : 'Pick one of the emoji.';
      },
      apply(ctx, userId, _targetId, payload) {
        const mediums = ctx.withRole('medium').filter((p) => p.alive).map((p) => p.id);
        ctx.emit({ type: 'MediumMessage', fromId: userId, emoji: payload! }, [...mediums, userId]);
      },
    },
  ],
};

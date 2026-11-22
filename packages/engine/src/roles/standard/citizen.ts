import type { RoleDefinition } from '../types';

export const citizen: RoleDefinition = {
  id: 'citizen',
  name: 'Citizen',
  team: 'town',
  special: false,
  summary: 'No ability. Watch closely: when you die, your death and its timing are clues.',
  goal: 'Help the Sheriff find the Killers.',
};

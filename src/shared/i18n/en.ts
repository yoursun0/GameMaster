export const en = {
  'check.success': 'Success',
  'check.partial': 'Partial success',
  'check.failure': 'Failure',
  'stakes.strain.success': 'Progress +2.',
  'stakes.strain.partial': 'Progress +1; actor HP -1.',
  'stakes.strain.failure': 'Actor HP -2; threat +1.',
  'stakes.pressure.success': 'Progress +2.',
  'stakes.pressure.partial': 'Progress +1; threat +1.',
  'stakes.pressure.failure': 'Threat +1.',
  'stakes.trust.success': 'Progress +2; target NPC trust +1.',
  'stakes.trust.partial': 'Progress +1; threat +1.',
  'stakes.trust.failure': 'Target NPC trust -1; threat +1.',
  'turn.allPassHint': 'Everyone passed. The situation still waits.',
} as const;

export type UiMessageKey = keyof typeof en;

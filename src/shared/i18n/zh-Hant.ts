import type { UiMessageKey } from './en';

export const zhHant: Record<UiMessageKey, string> = {
  'check.success': '成功',
  'check.partial': '部分成功',
  'check.failure': '失敗',
  'stakes.strain.success': '進度 +2。',
  'stakes.strain.partial': '進度 +1；行動者生命 -1。',
  'stakes.strain.failure': '行動者生命 -2；危機 +1。',
  'stakes.pressure.success': '進度 +2。',
  'stakes.pressure.partial': '進度 +1；危機 +1。',
  'stakes.pressure.failure': '危機 +1。',
  'stakes.trust.success': '進度 +2；目標人物信任 +1。',
  'stakes.trust.partial': '進度 +1；危機 +1。',
  'stakes.trust.failure': '目標人物信任 -1；危機 +1。',
  'turn.allPassHint': '全員略過。局面仍在等待。',
};

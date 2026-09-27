import type { Attribute } from '@/shared/schemas';

type ChosenAction =
  | { kind: 'automatic'; intentSummary: string }
  | {
      kind: 'check';
      approachId: string;
      intentSummary: string;
      toll: 'none' | 'reckless';
    };

const HINTS: Record<Attribute, string[]> = {
  might: [
    'might', 'force', 'fight', 'hold', 'door', 'charge', 'blade', 'sword', 'duel',
    '撞', '打', '砍', '頂', '擋', '殿', '劍', '衝', '門', '殺',
  ],
  agility: [
    'agility', 'run', 'slip', 'drag', 'ditch', 'flee', 'kitchen',
    '跑', '退', '拖', '溝', '閃', '廚房',
  ],
  insight: [
    'insight', 'read', 'seal', 'letter', 'study',
    '封', '蠟', '信', '辨', '讀',
  ],
  presence: [
    'presence', 'ask', 'shout', 'hail', 'speak',
    '喊', '喝', '問', '說',
  ],
};

export function chooseAction(input: {
  text: string;
  closing: boolean;
  suggestions: Array<{ text: string; approachId: string | null }>;
  approaches: Array<{ id: string; label: string; attribute: Attribute }>;
  availableIds: string[];
}): ChosenAction {
  const text = input.text.trim().slice(0, 300);
  if (input.closing || input.availableIds.length === 0) {
    return { kind: 'automatic', intentSummary: text || 'move on' };
  }
  const available = new Set(input.availableIds);
  const exact = input.suggestions.find(
    (entry) => entry.approachId && available.has(entry.approachId) && entry.text === input.text.trim(),
  );
  if (exact?.approachId) {
    return { kind: 'check', approachId: exact.approachId, intentSummary: text, toll: 'none' };
  }
  let bestId: string | null = null;
  let bestScore = 0;
  for (const id of input.availableIds) {
    const approach = input.approaches.find((entry) => entry.id === id);
    if (!approach) continue;
    const suggestion = input.suggestions.find((entry) => entry.approachId === id);
    const score = Math.max(
      overlap(input.text, approach.label),
      suggestion ? overlap(input.text, suggestion.text) : 0,
      hintScore(input.text, approach.attribute),
    );
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }
  const spine =
    input.availableIds.find((id) => id.endsWith('-might')) ?? input.availableIds[0]!;
  if (!bestId || bestScore <= 0) {
    return {
      kind: 'check',
      approachId: spine,
      intentSummary: text || 'act',
      toll: 'reckless',
    };
  }
  return { kind: 'check', approachId: bestId, intentSummary: text, toll: 'none' };
}

function overlap(text: string, candidate: string): number {
  const haystack = text.toLowerCase();
  let score = 0;
  for (const piece of pieces(candidate)) {
    if (haystack.includes(piece)) score += piece.length;
  }
  return score;
}

function hintScore(text: string, attribute: Attribute): number {
  const haystack = text.toLowerCase();
  let score = 0;
  for (const hint of HINTS[attribute]) {
    if (haystack.includes(hint)) score += 8;
  }
  return score;
}

function pieces(value: string): string[] {
  const lower = value.toLowerCase();
  const words = lower.split(/[^\p{L}\p{N}]+/u).filter((word) => word.length >= 4);
  const runs = lower.match(/[\u3400-\u9fff]{2,}/g) ?? [];
  const grams: string[] = [];
  for (const run of runs) {
    for (let index = 0; index < run.length - 1; index += 1) {
      grams.push(run.slice(index, index + 2));
    }
  }
  return [...words, ...grams];
}

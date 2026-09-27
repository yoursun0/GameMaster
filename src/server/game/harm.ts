export type StoryHarm = {
  playerId: string;
  hp: number;
  mp: number;
};

const HEAVY = ['燙', '燎', '灼', '燒焦', '血', '流血', '傷口', '刀傷', '刺傷', '砍傷', '骨折', 'burn', 'blood', 'bleed', 'wound', 'gash', 'stab'];
const LIGHT = ['痛', '疼', '擦破', '口子', '青腫', '磕破', 'bruise', 'scrape', 'hurt'];
const FOCUS = ['魔力', '頭暈', '眼前發黑', '力氣用盡', '喘不過氣', '虛脫'];

export function storyHarm(input: {
  paragraphs: string[];
  party: Array<{ playerId: string; displayName: string }>;
  proposed?: Array<{ playerId: string; hp?: number; mp?: number }>;
}): StoryHarm[] {
  const found = new Map<string, StoryHarm>();
  for (const member of input.party) {
    const fromText = harmInText(input.paragraphs.join('\n'), member.displayName);
    const proposed = input.proposed?.find((entry) => entry.playerId === member.playerId);
    const hp = clamp(Math.max(fromText.hp, proposed?.hp ?? 0), 0, 3);
    const mp = clamp(Math.max(fromText.mp, proposed?.mp ?? 0), 0, 2);
    if (hp > 0 || mp > 0) {
      found.set(member.playerId, { playerId: member.playerId, hp, mp });
    }
  }
  return [...found.values()];
}

function harmInText(text: string, name: string): { hp: number; mp: number } {
  let hp = 0;
  let mp = 0;
  for (const sentence of sentences(text)) {
    if (!mentions(sentence, name)) continue;
    if (HEAVY.some((mark) => sentence.toLowerCase().includes(mark))) hp = Math.max(hp, 2);
    else if (LIGHT.some((mark) => sentence.toLowerCase().includes(mark))) hp = Math.max(hp, 1);
    if (FOCUS.some((mark) => sentence.includes(mark))) mp = Math.max(mp, 1);
  }
  return { hp, mp };
}

function sentences(text: string): string[] {
  const parts = text
    .split(/(?<=[。！？!?；;\n])/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return parts.length > 0 ? parts : [text];
}

function mentions(sentence: string, name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  if (sentence.includes(trimmed)) return true;
  return /[A-Za-z]/.test(trimmed) && sentence.toLowerCase().includes(trimmed.toLowerCase());
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

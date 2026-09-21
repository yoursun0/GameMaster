import type {
  Attribute,
  ConditionId,
  Difficulty,
  EndingKind,
  Locale,
  Localized,
  Profile,
} from '@/shared/schemas';

export type Requirement = {
  allFlags?: string[];
  revealedFacts?: string[];
  itemId?: string;
  minimumTrust?: { npcId: string; value: number };
};

export type StoryEffect =
  | { type: 'set_flag'; flagId: string }
  | { type: 'reveal_fact'; factId: string }
  | { type: 'grant_item'; itemId: string }
  | { type: 'apply_condition'; conditionId: ConditionId };

export type ApproachDefinition = {
  id: string;
  obstacleId: string;
  methodVariantId: string;
  label: Localized;
  intentExamples: Localized[];
  attribute: Attribute;
  target: Difficulty;
  risk: 'strain' | 'pressure' | 'trust';
  npcId?: string;
  choiceId?: string;
  requires: Requirement;
  retryUnlockedBy: Requirement[];
  successEffects: StoryEffect[];
  partialEffects: StoryEffect[];
  failureEffects: StoryEffect[];
};

export type SceneDefinition = {
  id: string;
  index: number;
  act: 1 | 2 | 3;
  title: Localized;
  location: Localized;
  opening: Localized;
  objective: Localized;
  prompt: Localized;
  suggestions: Array<{ text: Localized; approachId: string | null }>;
  challengeId: string;
  approaches: ApproachDefinition[];
  availableNpcIds: string[];
  publicFactsOnEntry: string[];
  clearedTransition: Localized;
  setbackTransition: Localized;
  factsRequiredForNextScene: string[];
  restAllowed: boolean;
};

export type CharacterDefinition = {
  id: string;
  profile: Profile;
  name: Localized;
  role: Localized;
  biography: Localized;
  motivation: Localized;
  connection: Localized;
  ability: {
    id: string;
    name: Localized;
    description: Localized;
  };
  startingItemId: string;
};

export type NpcDefinition = {
  id: string;
  name: Localized;
};

export type ItemDefinition = {
  id: string;
  kind: 'restorative' | 'focus-draught' | 'story';
  name: Localized;
  description: Localized;
};

export type FactDefinition = {
  id: string;
  text: Localized;
  secret: boolean;
  revealGate: {
    sceneId: string;
    on: 'cleared' | 'setback' | 'either';
  } | null;
};

export type EndingVariant = {
  routeId: string;
  kind: EndingKind;
  summary: Localized;
  epilogues: Array<{ characterId: string; text: Localized }>;
};

export type OpeningByProfile = Record<
  Profile,
  {
    prompt: Localized;
    suggestions: Array<{ text: Localized; approachId: string | null }>;
  }
>;

export type WorldPack = {
  id: string;
  contentVersion: 1;
  title: Localized;
  premise: Localized;
  tone: Localized;
  resourceLabels: { hp: Localized; mp: Localized };
  restorativeItemId: string;
  focusDraughtItemId: string;
  defaultRouteId: string;
  openingByProfile: OpeningByProfile;
  characters: CharacterDefinition[];
  npcs: NpcDefinition[];
  items: ItemDefinition[];
  facts: FactDefinition[];
  flags: string[];
  scenes: SceneDefinition[];
  endingVariants: EndingVariant[];
};

export type ContentIssue = { path: string; message: string };

export function localized(en: string, zhHant: string): Localized {
  return { en, 'zh-Hant': zhHant };
}

export function hasBothLocales(value: Localized): value is Localized {
  return (
    typeof value.en === 'string' &&
    value.en.length > 0 &&
    typeof value['zh-Hant'] === 'string' &&
    value['zh-Hant'].length > 0
  );
}

export const LOCALES: Locale[] = ['en', 'zh-Hant'];

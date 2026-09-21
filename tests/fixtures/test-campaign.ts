import type {
  ApproachDefinition,
  SceneDefinition,
  WorldPack,
} from '@/server/content/types';
import { localized } from '@/server/content/types';
import type { Attribute, Profile } from '@/shared/schemas';
import { ATTRIBUTES } from '@/shared/schemas';

const L = localized;

function approach(
  sceneIndex: number,
  attribute: Attribute,
): ApproachDefinition {
  const isPresence = attribute === 'presence';
  const isMight = attribute === 'might';
  const routeId =
    sceneIndex === 6
      ? attribute === 'might' || attribute === 'agility'
        ? 'test-disclose'
        : 'test-negotiate'
      : undefined;
  return {
    id: `s${sceneIndex}-${attribute}`,
    obstacleId: `s${sceneIndex}-${attribute}`,
    methodVariantId: 'default',
    label: L(`${attribute} approach`, `${attribute} 途徑`),
    intentExamples: [L(`try ${attribute}`, `嘗試 ${attribute}`)],
    attribute,
    target: 12,
    risk: isPresence ? 'trust' : isMight ? 'strain' : 'pressure',
    npcId: isPresence ? 'test-npc-a' : undefined,
    choiceId: routeId,
    requires: {},
    retryUnlockedBy:
      attribute === 'might'
        ? [{ revealedFacts: [`unlock-${sceneIndex}`] }]
        : [],
    successEffects: [
      ...(isPresence
        ? ([{ type: 'reveal_fact', factId: `unlock-${sceneIndex}` }] as const)
        : []),
      ...(sceneIndex === 0 && isPresence
        ? ([{ type: 'grant_item', itemId: 'test-seal' }] as const)
        : []),
      ...(sceneIndex === 0 && attribute === 'insight'
        ? ([{ type: 'apply_condition', conditionId: 'focused' }] as const)
        : []),
    ],
    partialEffects: [],
    failureEffects: [],
  };
}

function scene(index: number): SceneDefinition {
  const act = index <= 1 ? 1 : index <= 5 ? 2 : 3;
  const suggestions = ATTRIBUTES.slice(0, 3).map((attribute) => ({
    text: L(`Use ${attribute}`, `使用 ${attribute}`),
    approachId: `s${index}-${attribute}`,
  }));
  return {
    id: `test-scene-${index}`,
    index,
    act,
    title: L(`Scene ${index}`, `場景 ${index}`),
    location: L('Test hall', '試驗廳'),
    opening: L(`Opening ${index}.`, `開場 ${index}。`),
    objective: L(`Objective ${index}.`, `目標 ${index}。`),
    prompt: L(`What will you do in scene ${index}?`, `場景 ${index} 你要怎麼做？`),
    suggestions,
    challengeId: `test-challenge-${index}`,
    approaches: ATTRIBUTES.map((attribute) => approach(index, attribute)),
    availableNpcIds: ['test-npc-a', 'test-npc-b', 'test-npc-c'],
    publicFactsOnEntry: index === 0 ? ['test-public-start'] : [],
    clearedTransition: L(`Cleared ${index}.`, `過關 ${index}。`),
    setbackTransition: L(`Setback ${index}.`, `受挫 ${index}。`),
    factsRequiredForNextScene: [`clue-${index}`],
    restAllowed: index === 3,
  };
}

const openingSuggestions = [
  {
    text: L('Ask carefully', '小心詢問'),
    approachId: 's0-presence',
  },
  {
    text: L('Watch the room', '觀察四周'),
    approachId: 's0-insight',
  },
  {
    text: L('Force the door', '強行開門'),
    approachId: 's0-might',
  },
];

function openingFor(profile: Profile) {
  return {
    prompt: L(
      `${profile} sees the sealed door.`,
      `${profile} 看見封住的門。`,
    ),
    suggestions: openingSuggestions,
  };
}

export const testCampaign: WorldPack = {
  id: 'test-campaign',
  contentVersion: 1,
  title: L('Test Campaign', '試驗戰役'),
  premise: L('A fixture used by rules tests.', '規則測試用戰役。'),
  tone: L('Plain and mechanical.', '平實而機械。'),
  resourceLabels: {
    hp: L('Vitality', '生命'),
    mp: L('Mana', '魔力'),
  },
  restorativeItemId: 'test-restorative',
  focusDraughtItemId: 'test-focus-draught',
  defaultRouteId: 'test-negotiate',
  openingByProfile: {
    guardian: openingFor('guardian'),
    specialist: openingFor('specialist'),
    mediator: openingFor('mediator'),
    scout: openingFor('scout'),
  },
  characters: [
    {
      id: 'test-guardian',
      profile: 'guardian',
      name: L('Gale', '蓋爾'),
      role: L('Guardian', '守護者'),
      biography: L('A steadfast fighter.', '堅定的戰士。'),
      motivation: L('Protect the party.', '保護同伴。'),
      connection: L('Knows the missing courier.', '認識失蹤信差。'),
      ability: {
        id: 'test-oath',
        name: L('Oath', '誓言'),
        description: L('+3 Might.', '力量 +3。'),
      },
      startingItemId: 'test-sword',
    },
    {
      id: 'test-specialist',
      profile: 'specialist',
      name: L('Sera', '瑟菈'),
      role: L('Specialist', '專家'),
      biography: L('A careful scholar.', '謹慎的學者。'),
      motivation: L('Understand the seal.', '理解封印。'),
      connection: L('Recognises the mark.', '認得那個印記。'),
      ability: {
        id: 'test-resonance',
        name: L('Resonance', '共鳴'),
        description: L('+3 Insight.', '洞察 +3。'),
      },
      startingItemId: 'test-codex',
    },
    {
      id: 'test-mediator',
      profile: 'mediator',
      name: L('Mio', '米歐'),
      role: L('Mediator', '調停者'),
      biography: L('A calm negotiator.', '沉穩的交涉者。'),
      motivation: L('Keep peace.', '維持和平。'),
      connection: L('Knows both houses.', '認識雙方家族。'),
      ability: {
        id: 'test-voice',
        name: L('Voice', '言辭'),
        description: L('+3 Presence.', '魅力 +3。'),
      },
      startingItemId: 'test-signet',
    },
    {
      id: 'test-scout',
      profile: 'scout',
      name: L('Nye', '奈伊'),
      role: L('Scout', '斥候'),
      biography: L('A quiet pathfinder.', '安靜的探路者。'),
      motivation: L('Find a safe route.', '找出安全路線。'),
      connection: L('Knows the forest.', '熟悉森林。'),
      ability: {
        id: 'test-passage',
        name: L('Passage', '通行'),
        description: L('+3 Agility.', '敏捷 +3。'),
      },
      startingItemId: 'test-map',
    },
  ],
  npcs: [
    { id: 'test-npc-a', name: L('Tavi', '塔維') },
    { id: 'test-npc-b', name: L('Orren', '奧倫') },
    { id: 'test-npc-c', name: L('Maera', '梅菈') },
  ],
  items: [
    {
      id: 'test-restorative',
      kind: 'restorative',
      name: L('Healing potion', '療傷藥水'),
      description: L('Restore 4 HP.', '恢復 4 生命。'),
    },
    {
      id: 'test-focus-draught',
      kind: 'focus-draught',
      name: L('Focus tea', '專注茶'),
      description: L('Restore 3 MP.', '恢復 3 魔力。'),
    },
    {
      id: 'test-seal',
      kind: 'story',
      name: L('Silver seal', '銀色封蠟'),
      description: L('A unique clue.', '獨特線索。'),
    },
    {
      id: 'test-sword',
      kind: 'story',
      name: L('Chipped sword', '缺口劍'),
      description: L('A family blade.', '家傳劍。'),
    },
    {
      id: 'test-codex',
      kind: 'story',
      name: L('Codex', '抄本'),
      description: L('Annotated notes.', '註解筆記。'),
    },
    {
      id: 'test-signet',
      kind: 'story',
      name: L('Signet', '印戒'),
      description: L('A court seal.', '宮廷印記。'),
    },
    {
      id: 'test-map',
      kind: 'story',
      name: L('Map', '地圖'),
      description: L('A border map.', '邊境地圖。'),
    },
  ],
  facts: [
    {
      id: 'test-public-start',
      text: L('The door is sealed.', '門被封住。'),
      secret: false,
      revealGate: null,
    },
    {
      id: 'test-secret',
      text: L('The genealogy was altered.', '族譜曾被竄改。'),
      secret: true,
      revealGate: { sceneId: 'test-scene-5', on: 'either' },
    },
    ...Array.from({ length: 8 }, (_, index) => ({
      id: `clue-${index}`,
      text: L(`Clue ${index}.`, `線索 ${index}。`),
      secret: false,
      revealGate: {
        sceneId: `test-scene-${index}`,
        on: 'either' as const,
      },
    })),
    ...Array.from({ length: 8 }, (_, index) => ({
      id: `unlock-${index}`,
      text: L(`Unlock ${index}.`, `解鎖 ${index}。`),
      secret: false,
      revealGate: {
        sceneId: `test-scene-${index}`,
        on: 'either' as const,
      },
    })),
  ],
  flags: ['rest-used', 'test-flag'],
  scenes: Array.from({ length: 8 }, (_, index) => scene(index)),
  endingVariants: ['test-disclose', 'test-negotiate'].flatMap((routeId) =>
    (['success', 'compromise', 'failure'] as const).map((kind) => ({
      routeId,
      kind,
      summary: L(`${routeId} ${kind}.`, `${routeId} ${kind}。`),
      epilogues: [
        'test-guardian',
        'test-specialist',
        'test-mediator',
        'test-scout',
      ].map((characterId) => ({
        characterId,
        text: L(
          `${characterId} ${routeId} ${kind}.`,
          `${characterId} ${routeId} ${kind}。`,
        ),
      })),
    })),
  ),
};

export const TEST_CHARACTERS: Record<Profile, string> = {
  guardian: 'test-guardian',
  specialist: 'test-specialist',
  mediator: 'test-mediator',
  scout: 'test-scout',
};

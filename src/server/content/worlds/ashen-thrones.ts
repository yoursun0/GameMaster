import 'server-only';

import type {
  ApproachDefinition,
  SceneDefinition,
  WorldPack,
} from '@/server/content/types';
import { localized } from '@/server/content/types';
import type { Attribute, Profile } from '@/shared/schemas';
import { ATTRIBUTES } from '@/shared/schemas';

const L = localized;

const SCENE_COPY: Array<{
  title: ReturnType<typeof L>;
  location: ReturnType<typeof L>;
  opening: ReturnType<typeof L>;
  objective: ReturnType<typeof L>;
  prompt: ReturnType<typeof L>;
  npc: string;
}> = [
  {
    title: L('A Broken Seal', '破損的封蠟'),
    location: L('North road inn', '北境客棧'),
    opening: L(
      'A wounded traveller presses a letter into your hands. The silver Greywing seal is cracked. He whispers that royal messenger Orren never reached the capital, then loses consciousness.',
      '負傷的旅人把一封信塞進你們手裡。銀色灰翼封蠟已經裂開。他低聲說，王室信使奧倫始終沒能抵達都城，隨即昏了過去。',
    ),
    objective: L(
      'Learn who Orren was carrying word for, and where he was bound.',
      '查明奧倫為誰送信，以及他原本要去哪裡。',
    ),
    prompt: L('The letter is still warm. Who acts first?', '信還帶著體溫。誰先行動？'),
    npc: 'ash-tavi',
  },
  {
    title: L('The Border Road', '邊境小徑'),
    location: L('Guarded forest road', '有人把守的林道'),
    opening: L(
      'The road to the city splits: a watched causeway and a wet forest track. Fresh hoofprints show someone is hunting the same seal you carry.',
      '通往城市的路分成兩條：受監視的官道，以及潮濕的林徑。新的馬蹄印顯示，有人正在追捕你們手上的封蠟。',
    ),
    objective: L('Reach the city without losing the letter.', '在不失去信件的前提下進入城市。'),
    prompt: L('The pursuit is close. How do you move?', '追兵已近。你們怎麼走？'),
    npc: 'ash-tavi',
  },
  {
    title: L('Before the Evening Bell', '晚鐘之前'),
    location: L('North gate of Crowkeep', '鴉堡北門'),
    opening: L(
      'Rain needles the gate. A thin youth in a too-large cloak watches your hands. He is Tavi. The first evening bell sounds; the guards begin searching departing packs.',
      '細雨刺打城門。一個披著過大斗篷的瘦削少年盯著你的手。他是塔維。第一聲晚鐘響起，守衛開始搜查離城者的行囊。',
    ),
    objective: L(
      'Gain Tavi’s help before the gates close for the night.',
      '在城門關閉前取得塔維的協助。',
    ),
    prompt: L('Tavi waits for an answer. What do you do?', '塔維正等著回答。你要怎麼做？'),
    npc: 'ash-tavi',
  },
  {
    title: L('Shelter in the Archive', '檔案室的庇護'),
    location: L('Greywing archive loft', '灰翼檔案閣樓'),
    opening: L(
      'Tavi leads you into a dust-choked loft of ledgers. The Greywing mark repeats on older charters. A hidden stair is marked only in the margins. You may rest here once.',
      '塔維帶你們進入佈滿灰塵的帳簿閣樓。灰翼印記反覆出現在舊特許狀上。隱密樓梯只寫在欄外。你們可以在這裡休息一次。',
    ),
    objective: L('Trace the Greywing seal and find a hidden route onward.', '追查灰翼封蠟，並找出隱藏去路。'),
    prompt: L('The archive is quiet. How do you use this shelter?', '檔案室很安靜。你們要如何利用這處庇護？'),
    npc: 'ash-tavi',
  },
  {
    title: L("The Officer's Bargain", '隊長的交易'),
    location: L('Prison-district watch post', '監牢區哨站'),
    opening: L(
      'Captain Maera blocks the corridor, rain still on her cloak. She has seen the seal. She will not raise the alarm yet, but she wants to know which house you serve.',
      '梅菈隊長擋住走廊，斗篷上還掛著雨。她看見了封蠟。她暫時不會示警，但想知道你們究竟為哪一家效力。',
    ),
    objective: L('Decide whether to trust Maera and gain prison access.', '決定是否信任梅菈，並取得進入監牢區的途徑。'),
    prompt: L('Maera’s hand rests on her sword. What do you offer?', '梅菈的手按在劍上。你要提出什麼？'),
    npc: 'ash-maera',
  },
  {
    title: L('Beneath the Dragon Chapel', '龍殿之下'),
    location: L('Chapel undercroft', '龍殿下窖'),
    opening: L(
      'You find Orren bound but alive. He insists the genealogy you carry is genuine—and also wrong. Someone altered a true dragon line to justify a purge.',
      '你們找到被縛但仍活著的奧倫。他堅持你們手上的族譜是真的——同時也是錯的。有人竄改了一條真正的龍裔譜系，好為清洗正名。',
    ),
    objective: L('Secure Orren and understand how the evidence was changed.', '救出奧倫，並弄清證據如何被改動。'),
    prompt: L('Orren looks to the active player. How do you proceed?', '奧倫望向正在行動的人。你們要怎麼做？'),
    npc: 'ash-orren',
  },
  {
    title: L('The House Divided', '分裂的家族'),
    location: L('Inner court gallery', '內廷長廊'),
    opening: L(
      'Two routes remain. Publish the altered genealogy and split the court, or negotiate a quiet release that leaves the houses standing. If you fail here, the safer path is a negotiated peace.',
      '只剩兩條路。公開被竄改的族譜、撕裂朝堂；或談判一場安靜的釋放，讓家族仍能站著。若在此受挫，較穩妥的路是協商的和平。',
    ),
    objective: L('Choose public disclosure or a negotiated release.', '選擇公開揭發，或談判釋放。'),
    prompt: L('The court is listening. Which way do you commit?', '朝堂正在聽。你們要押上哪一條路？'),
    npc: 'ash-maera',
  },
  {
    title: L('The Last Bell', '最後的鐘聲'),
    location: L('Bell tower and outer ward', '鐘樓與外郭'),
    opening: L(
      'The last bell is ringing. Whoever altered the line is moving to seize Orren and the letter. Your chosen path—disclosure or negotiation—must be finished before the ward locks.',
      '最後的鐘聲正在響。竄改譜系的人正要奪走奧倫與信件。你們選擇的路——揭發或談判——必須在外郭上鎖前走完。',
    ),
    objective: L('Finish the chosen plan and decide the kingdom’s immediate future.', '完成選定的計劃，並決定王國眼前的未來。'),
    prompt: L('The bell does not wait. What do you do?', '鐘聲不等你們。你要怎麼做？'),
    npc: 'ash-orren',
  },
];

const APPROACH_LABEL: Record<Attribute, ReturnType<typeof L>> = {
  might: L('Force a way through', '以力開路'),
  agility: L('Slip past notice', '避人耳目'),
  insight: L('Read the marks', '辨讀印記'),
  presence: L('Speak for trust', '以言取信'),
};

function approachFor(index: number, attribute: Attribute): ApproachDefinition {
  const copy = SCENE_COPY[index]!;
  const routeId =
    index === 6
      ? attribute === 'might' || attribute === 'agility'
        ? 'ash-disclose'
        : 'ash-negotiate'
      : undefined;
  return {
    id: `ash-s${index}-${attribute}`,
    obstacleId: `ash-s${index}-${attribute}`,
    methodVariantId: 'default',
    label: APPROACH_LABEL[attribute],
    intentExamples: [
      L(`Use ${attribute} here.`, `在此運用${attribute}。`),
    ],
    attribute,
    target: index === 7 && attribute === 'might' ? 16 : index % 2 === 0 ? 8 : 12,
    risk: attribute === 'presence' ? 'trust' : attribute === 'might' ? 'strain' : 'pressure',
    npcId: attribute === 'presence' ? copy.npc : undefined,
    choiceId: routeId,
    requires: {},
    retryUnlockedBy:
      attribute === 'might' ? [{ revealedFacts: [`ash-unlock-${index}`] }] : [],
    successEffects: [
      ...(attribute === 'presence'
        ? ([{ type: 'reveal_fact', factId: `ash-unlock-${index}` }] as const)
        : []),
      ...(index === 0 && attribute === 'insight'
        ? ([{ type: 'grant_item', itemId: 'ash-silver-seal' }] as const)
        : []),
    ],
    partialEffects: [],
    failureEffects: [],
  };
}

function scene(index: number): SceneDefinition {
  const copy = SCENE_COPY[index]!;
  const act = index <= 1 ? 1 : index <= 5 ? 2 : 3;
  const suggestions = ATTRIBUTES.slice(0, 3).map((attribute) => ({
    text: APPROACH_LABEL[attribute],
    approachId: `ash-s${index}-${attribute}`,
  }));
  return {
    id: `ash-scene-${index}`,
    index,
    act,
    title: copy.title,
    location: copy.location,
    opening: copy.opening,
    objective: copy.objective,
    prompt: copy.prompt,
    suggestions,
    challengeId: `ash-challenge-${index}`,
    approaches: ATTRIBUTES.map((attribute) => approachFor(index, attribute)),
    availableNpcIds: ['ash-orren', 'ash-tavi', 'ash-maera'],
    publicFactsOnEntry: index === 0 ? ['ash-messenger-missing'] : [],
    clearedTransition: L(
      `You press on from ${copy.title.en}.`,
      `你們從「${copy.title['zh-Hant']}」繼續前進。`,
    ),
    setbackTransition: L(
      `You are driven on, bruised but not finished.`,
      `你們受挫仍被推向前，還沒結束。`,
    ),
    factsRequiredForNextScene:
      index === 5
        ? [`ash-clue-${index}`, 'ash-truth-altered-genealogy']
        : [`ash-clue-${index}`],
    restAllowed: index === 3,
  };
}

function openingFor(profile: Profile) {
  const names: Record<Profile, ReturnType<typeof L>> = {
    guardian: L('Kaen', '凱恩'),
    specialist: L('Lya', '莉雅'),
    mediator: L('Sien', '席恩'),
    scout: L('Aela', '艾菈'),
  };
  const name = names[profile];
  return {
    prompt: L(
      `${name.en} sees the cracked Greywing seal.`,
      `${name['zh-Hant']} 看見裂開的灰翼封蠟。`,
    ),
    suggestions: [
      {
        text: L('Ask who sent the traveller', '詢問旅人是誰派來的'),
        approachId: 'ash-s0-presence',
      },
      {
        text: L('Study the broken seal', '檢視破損的封蠟'),
        approachId: 'ash-s0-insight',
      },
      {
        text: L('Watch the road behind you', '留意身後的路'),
        approachId: 'ash-s0-agility',
      },
    ],
  };
}

export const ashenThrones: WorldPack = {
  id: 'ashen-thrones',
  contentVersion: 1,
  title: L('Ashen Thrones', '權鬥王座'),
  premise: L(
    'Find the royal messenger and decide how to handle evidence that could start a succession war.',
    '找到王室信使，並決定如何處理可能引爆繼承戰爭的證據。',
  ),
  tone: L(
    'Wet-stone courts, rain, and careful speech. Violence is possible but never required.',
    '濕冷石庭、細雨與謹慎的言辭。暴力可行，但絕非必要。',
  ),
  resourceLabels: { hp: L('Vitality', '生命'), mp: L('Mana', '魔力') },
  restorativeItemId: 'ash-restorative',
  focusDraughtItemId: 'ash-focus-draught',
  defaultRouteId: 'ash-negotiate',
  openingByProfile: {
    guardian: openingFor('guardian'),
    specialist: openingFor('specialist'),
    mediator: openingFor('mediator'),
    scout: openingFor('scout'),
  },
  characters: [
    {
      id: 'ash-knight',
      profile: 'guardian',
      name: L('Kaen', '凱恩'),
      role: L('Exiled escort', '被放逐的護衛'),
      biography: L(
        'Kaen once rode with royal couriers and was dismissed after a charge he still cannot name in public. He keeps the chipped sword because it is the last honest thing he owns. He believes a clean record is worth more than a clean death.',
        '凱恩曾與王室信差同行，因一樁他至今不能公開說清的指控而被黜。他留著那把缺口劍，因為那是他僅剩的老實物件。他相信清白的名聲比乾淨的死更值錢。',
      ),
      motivation: L('Clear the accusation that exiled him.', '洗清迫使他流亡的指控。'),
      connection: L('He once escorted the missing messenger Orren.', '他曾經護送失蹤的信使奧倫。'),
      ability: {
        id: 'ash-oath',
        name: L('Unbroken Oath', '不屈誓言'),
        description: L('+3 Might on a relevant check.', '相關力量檢定 +3。'),
      },
      startingItemId: 'ash-family-sword',
    },
    {
      id: 'ash-scholar',
      profile: 'specialist',
      name: L('Lya', '莉雅'),
      role: L('Dragon historian', '龍語學者'),
      biography: L(
        'Lya copies forbidden dragon genealogies in a hand small enough to hide in margins. She came north because the Greywing seal matches a fragment in her codex. She would rather be right than safe.',
        '莉雅以細到能藏進欄外的字跡抄寫被禁的龍裔譜系。她北上是因為灰翼封蠟對得上抄本裡的殘片。她寧可正確，也不願只求安全。',
      ),
      motivation: L('Preserve forbidden dragon history.', '保存被禁的龍族史。'),
      connection: L('She recognises the Greywing seal at a glance.', '她一眼就認出灰翼封蠟。'),
      ability: {
        id: 'ash-resonance',
        name: L('Dragon Resonance', '龍語共鳴'),
        description: L('+3 Insight on a relevant check.', '相關洞察檢定 +3。'),
      },
      startingItemId: 'ash-codex',
    },
    {
      id: 'ash-envoy',
      profile: 'mediator',
      name: L('Sien', '席恩'),
      role: L('House envoy', '家族使節'),
      biography: L(
        'Sien has eaten at both rival tables and remembers which toasts were lies. The court sent no one; Sien came anyway, hoping a succession war can still be talked down. Words, to Sien, are load-bearing walls.',
        '席恩在敵對兩家的席上都吃過飯，也記得哪些祝酒是謊。朝堂沒派人；席恩還是來了，希望繼承戰爭仍能被談下來。對席恩來說，言語是承重的牆。',
      ),
      motivation: L('Prevent a civil war.', '阻止內戰。'),
      connection: L('Knows the rival houses and their private insults.', '認識敵對家族與他們私下的辱詞。'),
      ability: {
        id: 'ash-insight-court',
        name: L('Courtly Insight', '宮廷辭令'),
        description: L('+3 Presence on a relevant check.', '相關魅力檢定 +3。'),
      },
      startingItemId: 'ash-signet',
    },
    {
      id: 'ash-scout',
      profile: 'scout',
      name: L('Aela', '艾菈'),
      role: L('Border ranger', '邊境巡林者'),
      biography: L(
        'Aela walks the forest routes the maps call impassable. Villages on the border paid her in bread to watch for riders who do not belong. She trusts trees more than seals.',
        '艾菈走的是地圖稱為不通的林路。邊境村子用麵包雇她看守不該出現的騎兵。她信樹，多過信封蠟。',
      ),
      motivation: L('Protect the border villages from a coming purge.', '保護邊境村落免於即將到來的清洗。'),
      connection: L('She knows the forest road into Crowkeep.', '她熟悉進入鴉堡的林道。'),
      ability: {
        id: 'ash-passage',
        name: L('Silent Passage', '無聲步伐'),
        description: L('+3 Agility on a relevant check.', '相關敏捷檢定 +3。'),
      },
      startingItemId: 'ash-border-map',
    },
  ],
  npcs: [
    { id: 'ash-orren', name: L('Orren', '奧倫') },
    { id: 'ash-tavi', name: L('Tavi', '塔維') },
    { id: 'ash-maera', name: L('Captain Maera', '梅菈隊長') },
  ],
  items: [
    {
      id: 'ash-restorative',
      kind: 'restorative',
      name: L('Healing draught', '療傷藥'),
      description: L('Restore 4 HP.', '恢復 4 生命。'),
    },
    {
      id: 'ash-focus-draught',
      kind: 'focus-draught',
      name: L('Bitter tea', '苦茶'),
      description: L('Restore 3 MP.', '恢復 3 魔力。'),
    },
    {
      id: 'ash-silver-seal',
      kind: 'story',
      name: L('Cracked Greywing seal', '裂開的灰翼封蠟'),
      description: L('A unique clue from the traveller’s letter.', '旅人信上的獨特線索。'),
    },
    {
      id: 'ash-family-sword',
      kind: 'story',
      name: L('Chipped family sword', '缺口家傳劍'),
      description: L('Kaen’s last honest blade.', '凱恩僅剩的老實刀。'),
    },
    {
      id: 'ash-codex',
      kind: 'story',
      name: L('Annotated dragon codex', '龍語註解本'),
      description: L('Lya’s forbidden margins.', '莉雅那些被禁的欄外字。'),
    },
    {
      id: 'ash-signet',
      kind: 'story',
      name: L('Diplomatic signet', '外交印戒'),
      description: L('Sien’s pass through polite doors.', '席恩通過客氣門扉的信物。'),
    },
    {
      id: 'ash-border-map',
      kind: 'story',
      name: L('Border map', '邊境地圖'),
      description: L('Aela’s wet-ink forest routes.', '艾菈那些墨跡未乾的林路。'),
    },
  ],
  facts: [
    {
      id: 'ash-messenger-missing',
      text: L(
        'Royal messenger Orren never reached the capital.',
        '王室信使奧倫始終沒有抵達都城。',
      ),
      secret: false,
      revealGate: null,
    },
    {
      id: 'ash-truth-altered-genealogy',
      text: L(
        'A rival faction altered a genuine dragon genealogy to justify a purge.',
        '敵對派系竄改了一份真正的龍裔族譜，好為清洗正名。',
      ),
      secret: true,
      revealGate: { sceneId: 'ash-scene-5', on: 'either' },
    },
    ...Array.from({ length: 8 }, (_, index) => ({
      id: `ash-clue-${index}`,
      text: L(`A usable clue from scene ${index}.`, `場景 ${index} 得到的可用線索。`),
      secret: false,
      revealGate: { sceneId: `ash-scene-${index}`, on: 'either' as const },
    })),
    ...Array.from({ length: 8 }, (_, index) => ({
      id: `ash-unlock-${index}`,
      text: L(`A new angle on scene ${index}.`, `場景 ${index} 的新角度。`),
      secret: false,
      revealGate: { sceneId: `ash-scene-${index}`, on: 'either' as const },
    })),
  ],
  flags: ['rest-used'],
  scenes: Array.from({ length: 8 }, (_, index) => scene(index)),
  endingVariants: ['ash-disclose', 'ash-negotiate'].flatMap((routeId) =>
    (['success', 'compromise', 'failure'] as const).map((kind) => ({
      routeId,
      kind,
      summary: L(
        routeId === 'ash-disclose'
          ? kind === 'success'
            ? 'The altered genealogy is read in court. The purge stalls; the houses split in public.'
            : kind === 'compromise'
              ? 'Enough of the truth is spoken to halt the worst of the purge, but the court remains armed.'
              : 'The disclosure is twisted. The purge begins under a different name.'
          : kind === 'success'
            ? 'Orren is released under a fragile negotiated peace. The houses remain standing, barely.'
            : kind === 'compromise'
              ? 'A quiet bargain saves lives and buries part of the evidence. Peace holds for now.'
              : 'The negotiation collapses. Orren survives, but the succession war is already moving.',
        routeId === 'ash-disclose'
          ? kind === 'success'
            ? '被竄改的族譜在朝堂上被宣讀。清洗停住；家族在公開場合分裂。'
            : kind === 'compromise'
              ? '真相說得夠多，擋住最壞的清洗，但朝堂依然刀出鞘。'
              : '揭發被扭曲。清洗換了名字開始。'
          : kind === 'success'
            ? '奧倫在脆弱的協商和平下被釋放。家族勉強還站著。'
            : kind === 'compromise'
              ? '一場安靜的交易救了人，也埋掉部分證據。和平暫時還在。'
              : '談判破裂。奧倫活著，繼承戰爭卻已在移動。',
      ),
      epilogues: [
        {
          characterId: 'ash-knight',
          text: L(
            `Kaen ${kind}: the accusation on his name is ${kind === 'failure' ? 'not cleared' : 'at last spoken aloud'}.`,
            `凱恩（${kind}）：他名上的指控${kind === 'failure' ? '仍未洗清' : '終於被說出口'}。`,
          ),
        },
        {
          characterId: 'ash-scholar',
          text: L(
            `Lya ${kind}: the dragon line is ${kind === 'success' ? 'preserved in the open' : 'only half-saved'}.`,
            `莉雅（${kind}）：龍裔譜系${kind === 'success' ? '被公開保存' : '只救回一半'}。`,
          ),
        },
        {
          characterId: 'ash-envoy',
          text: L(
            `Sien ${kind}: the houses ${kind === 'failure' ? 'choose war anyway' : 'still have a table to sit at'}.`,
            `席恩（${kind}）：家族${kind === 'failure' ? '還是選擇了戰爭' : '仍有一張能坐下的桌子'}。`,
          ),
        },
        {
          characterId: 'ash-scout',
          text: L(
            `Aela ${kind}: the border villages ${kind === 'failure' ? 'prepare for riders' : 'get one more quiet season'}.`,
            `艾菈（${kind}）：邊境村子${kind === 'failure' ? '開始防備騎兵' : '多得一個安靜的季節'}。`,
          ),
        },
      ],
    })),
  ),
};

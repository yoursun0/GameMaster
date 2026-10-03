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

type Move = {
  label: ReturnType<typeof L>;
  risk: 'strain' | 'pressure' | 'trust';
  target: 8 | 12 | 16;
};

type Beat = {
  title: ReturnType<typeof L>;
  location: ReturnType<typeof L>;
  opening: ReturnType<typeof L>;
  objective: ReturnType<typeof L>;
  prompt: ReturnType<typeof L>;
  npc: string;
  cleared: ReturnType<typeof L>;
  setback: ReturnType<typeof L>;
  moves: Record<Attribute, Move>;
};

const BEATS: Beat[] = [
  {
    title: L('The Door Breaks', '門被踹開'),
    location: L('North road inn', '北境客棧'),
    opening: L(
      'Sellswords boot the inn door off its hinges. Wounded Orren shoves the sealed letter into your hands and drops. Tavi screams to bar the door. They will cut you for that letter. Win this room, then run for the north road while the inn burns.',
      '傭兵一腳踹開客棧的門。負傷的奧倫把一封封了蠟的信塞進你們手裡，隨即倒下。塔維尖叫著要你們門上落栓。他們為了這封信會砍人。守住這間屋子，然後趁客棧燒起來時往北境大路跑。',
    ),
    objective: L(
      'Hold the inn, keep the letter, and get out onto the north road.',
      '守住客棧、保住信件，然後衝上北境大路。',
    ),
    prompt: L('The first sellsword is already inside. Who meets him?', '第一個傭兵已經進門。誰上去擋？'),
    npc: 'ash-tavi',
    cleared: L(
      'You break into the wet yard. The north road is the only way that is not on fire.',
      '你們衝進濕院子。沒著火的路只剩北境大路。',
    ),
    setback: L(
      'They take blood and a torn page. You still run: the roof is coming down onto the north road.',
      '他們拿走了血和撕下的一頁。你們還是跑了：屋頂正往北境大路上塌。',
    ),
    moves: {
      might: { label: L('Hold the door', '頂住店門'), risk: 'strain', target: 8 },
      agility: { label: L('Drag the courier out the kitchen', '從廚房拖走信差'), risk: 'strain', target: 8 },
      insight: { label: L('Rip the letter free and read the seal', '搶下信並辨認封蠟'), risk: 'pressure', target: 8 },
      presence: { label: L('Make Tavi drop the bar with you', '讓塔維一起落下門栓'), risk: 'trust', target: 8 },
    },
  },
  {
    title: L('The Lance Road', '長槍大路'),
    location: L('Open causeway', '暴露的官道'),
    opening: L(
      'The inn is smoke behind you. Vesper, the sellsword captain, lowers a lance and comes up the causeway for the letter. Talk will not stop this charge. Break through and Crowkeep’s north gate is in sight, under the first evening bell.',
      '客棧在你們身後只剩煙。傭兵頭子薇絲珀放平長槍，為了那封信沿官道衝來。說話擋不住這次衝鋒。衝破他們，鴉堡北門就在第一聲晚鐘之下。',
    ),
    objective: L('Survive the charge and reach Crowkeep’s gate.', '活過這次衝鋒，抵達鴉堡城門。'),
    prompt: L('Vesper’s hooves are on you. How do you take the hit?', '薇絲珀的馬蹄已經到了。你怎麼接這一擊？'),
    npc: 'ash-tavi',
    cleared: L(
      'The last rider goes past. Crowkeep’s north gate is ahead, and the evening bell is warming.',
      '最後一名騎兵衝了過去。鴉堡北門就在前方，晚鐘正在熱身。',
    ),
    setback: L(
      'A lance finds flesh. You still reach the ditch under the gate, bleeding.',
      '長槍入肉。你們仍然帶著血爬到城門下的溝裡。',
    ),
    moves: {
      might: { label: L('Meet the lance', '迎上長槍'), risk: 'strain', target: 12 },
      agility: { label: L('Dive for the ditch', '翻進邊溝'), risk: 'strain', target: 12 },
      insight: { label: L('Find the gap in their line', '找到隊列的缺口'), risk: 'pressure', target: 12 },
      presence: { label: L('Shout Tavi clear of the hooves', '喝令塔維避開馬蹄'), risk: 'trust', target: 12 },
    },
  },
  {
    title: L('The Beating at the Gate', '城門的毆打'),
    location: L('North gate of Crowkeep', '鴉堡北門'),
    opening: L(
      'A frightened guard is beating travellers at the search while the evening bell starts. He will take one name and look away. Tavi points at a drain that floods into the city. Fight the line, buy the name, or take the drain. When the bell finishes, this gate closes, and the only door beyond it is the Greywing archive.',
      '晚鐘一響，一名害怕的守衛正在搜查處毆打旅人。他只要一個名字就會別過臉。塔維指向一條灌進城裡的排水溝。跟隊列打、用名字買路，或鑽進溝裡。鐘聲結束時這道門就關，門後唯一的路是灰翼檔案閣樓。',
    ),
    objective: L('Get inside before the bell ends.', '在鐘聲結束前進城。'),
    prompt: L('A guard raises a cudgel. What do you do?', '一名守衛舉起短棍。你要怎麼做？'),
    npc: 'ash-tavi',
    cleared: L(
      'You are through. Tavi runs you toward the archive loft as the bell finishes.',
      '你們進來了。鐘聲結束時，塔維帶著你們往檔案閣樓跑。',
    ),
    setback: L(
      'You get inside bruised, with a guard’s shout behind you. The archive is still the only door.',
      '你們帶著傷進城，身後是守衛的喊聲。檔案閣樓仍是唯一的門。',
    ),
    moves: {
      might: { label: L('Brawl the search line', '和搜查隊列打起來'), risk: 'strain', target: 12 },
      agility: { label: L("Take Tavi's drain", '鑽進塔維的排水溝'), risk: 'pressure', target: 8 },
      insight: { label: L('See which guard will not die for this', '看穿誰不肯為此送死'), risk: 'pressure', target: 12 },
      presence: { label: L('Buy one name at the gate', '在城門用一個名字換路'), risk: 'trust', target: 12 },
    },
  },
  {
    title: L('Blood in the Stacks', '書架間的血'),
    location: L('Greywing archive loft', '灰翼檔案閣樓'),
    opening: L(
      'An assassin is cutting the archivist among the ledgers. One margin names a dragon line that was rewritten. Kill or pin the assassin. After this fight you may rest once. The stair below leads to Captain Maera’s prison watch, where the courier Orren is held.',
      '刺客正在帳簿間砍檔案官。一處欄外寫著被改寫的龍裔譜系。殺掉刺客，或把他壓住。這一架之後你們可以休息一次。樓下的樓梯通向梅菈隊長的監牢哨站，信差奧倫被關在那裡。',
    ),
    objective: L('Save the charter, then reach Maera’s watch.', '保住特許狀，然後抵達梅菈的哨站。'),
    prompt: L("The assassin's knife is already red. Who moves?", '刺客的刀已經紅了。誰先動？'),
    npc: 'ash-tavi',
    cleared: L(
      'The assassin is down and the margin is yours. Maera’s lamp is lit at the bottom of the stair. Rest once if you must, then go down.',
      '刺客倒下，欄外的字是你們的了。樓梯底亮著梅菈的燈。要休息就現在，然後下去。',
    ),
    setback: L(
      'The archivist dies. You keep one page. Maera’s watch is down the stair, and you are not welcome.',
      '檔案官死了。你們只保住一頁。梅菈的哨站在樓下，而且不歡迎你們。',
    ),
    moves: {
      might: { label: L('Kill the assassin in the aisle', '在通道裡殺掉刺客'), risk: 'strain', target: 12 },
      agility: { label: L('Pin the assassin in the stacks', '把刺客壓進書架'), risk: 'strain', target: 12 },
      insight: { label: L('Read the rewritten margin', '讀被改過的欄外'), risk: 'pressure', target: 8 },
      presence: { label: L('Make Tavi bind the wound', '讓塔維先去綁傷口'), risk: 'trust', target: 12 },
    },
  },
  {
    title: L("The Lieutenant's Duel", '副隊長的決鬥'),
    location: L('Prison-district watch', '監牢區哨站'),
    opening: L(
      'Maera’s lieutenant draws steel and demands the letter. Maera watches and will not stop a duel. Win it, and she opens the stair under the dragon chapel, where Orren is held.',
      '梅菈的副隊長拔劍，要那封信。梅菈在旁看著，不會阻止決鬥。贏了，她就打開龍殿下的樓梯，奧倫被關在下面。',
    ),
    objective: L('Win the duel and make Maera open the chapel.', '贏得決鬥，讓梅菈打開龍殿。'),
    prompt: L('The lieutenant salutes with the point. How do you answer?', '副隊長用劍尖行禮。你怎麼回？'),
    npc: 'ash-maera',
    cleared: L(
      'The lieutenant yields. Maera unlocks the chapel stair.',
      '副隊長認輸。梅菈打開了龍殿的樓梯。',
    ),
    setback: L(
      'You are cut. Maera opens the stair anyway, because her lieutenant cannot.',
      '你受了傷。梅菈還是打開樓梯，因為她的副隊長做不到。',
    ),
    moves: {
      might: { label: L('Accept the duel', '接受決鬥'), risk: 'strain', target: 12 },
      agility: { label: L('Beat the blade aside', '格開劍刃'), risk: 'strain', target: 12 },
      insight: { label: L('See that he fears Maera, not you', '看穿他怕的是梅菈'), risk: 'pressure', target: 12 },
      presence: { label: L("Offer Maera the letter's true name", '把信上的真名交給梅菈'), risk: 'trust', target: 8 },
    },
  },
  {
    title: L('The Chapel Knight', '龍殿騎士'),
    location: L('Chapel undercroft', '龍殿下窖'),
    opening: L(
      'A knight in house steel stands over Orren, bound and alive. He will not step aside. Break him and get Orren up the stair. Both houses are already drawing steel in the gallery above.',
      '一名穿家族鋼甲的騎士站在還活著、被綁住的奧倫面前。他不會讓路。擊倒他，把奧倫帶上樓梯。你們頭上的長廊裡，兩大家族已經在拔劍。',
    ),
    objective: L('Free Orren and carry his truth up to the gallery.', '救出奧倫，把他的真相帶上長廊。'),
    prompt: L('The knight sets his feet. Who challenges him?', '騎士站穩了。誰向他挑戰？'),
    npc: 'ash-orren',
    cleared: L(
      'The knight falls. Orren speaks the altered line. The gallery above is already shouting for blood.',
      '騎士倒下。奧倫說出被改的那一系。上面的長廊已經在喊著要血。',
    ),
    setback: L(
      'You drag Orren out from under a dying knight. He still tells you the line was forged. The gallery is about to charge.',
      '你們從瀕死的騎士身下拖出奧倫。他仍然告訴你們譜系是偽造的。長廊即將衝鋒。',
    ),
    moves: {
      might: { label: L('Break the knight', '擊倒騎士'), risk: 'strain', target: 16 },
      agility: { label: L("Cut Orren free under the guard", '在防守下割開奧倫的繩子'), risk: 'strain', target: 12 },
      insight: { label: L('Match the forged names', '對上被偽造的名字'), risk: 'pressure', target: 12 },
      presence: { label: L("Demand the knight's oath", '要求騎士的誓言'), risk: 'trust', target: 12 },
    },
  },
  {
    title: L('The First Charge', '第一衝鋒'),
    location: L('Inner court gallery', '內廷長廊'),
    opening: L(
      'Both houses charge, and Vesper is in one of the lines still reaching for the letter. Raise the letter and join the attack, and the city will call this night a disclosure. Step between the blades and force a halt, and it will call it a negotiation. Either way the fight ends on the bell-tower stair.',
      '兩大家族同時衝鋒，薇絲珀還在其中一邊伸手要那封信。舉起信加入進攻，這一夜就叫揭發。站進刀鋒之間逼他們停下，這一夜就叫談判。無論哪一條，這一架都會在鐘樓樓梯上結束。',
    ),
    objective: L(
      'Choose the charge or the halt, and live long enough to reach the tower.',
      '選擇衝鋒或喝停，並活著抵達鐘樓。',
    ),
    prompt: L('Steel is one step away. Which way do you commit?', '刀就在一步之外。你押哪一條？'),
    npc: 'ash-maera',
    cleared: L(
      'The gallery breaks around your choice. The bell-tower stair is open.',
      '長廊順著你們的選擇裂開。鐘樓的樓梯開了。',
    ),
    setback: L(
      'The fight carries you instead of the other way around. The stair still takes you up, bloodier.',
      '是戰鬥拖著你們走，不是你們帶著戰鬥走。樓梯仍把你們送上去，只是更血。',
    ),
    moves: {
      might: { label: L('Raise the letter and charge', '舉起信衝鋒'), risk: 'strain', target: 12 },
      agility: { label: L('Flank with the charging house', '跟著衝鋒的家族側擊'), risk: 'strain', target: 12 },
      insight: { label: L('Name the forged line aloud', '當眾說出偽造的譜系'), risk: 'pressure', target: 12 },
      presence: { label: L('Order both lines to stop', '喝令雙方停步'), risk: 'trust', target: 12 },
    },
  },
  {
    title: L('The Champion on the Stair', '樓梯上的冠軍'),
    location: L('Bell tower', '鐘樓'),
    opening: L(
      'The usurper’s champion blocks the last stair as the bell starts. This is the last fight. Beat him before it ends, or the war starts under you. The choice you already made in the gallery — disclosure or negotiation — is the name the city will give this night.',
      '篡位者的冠軍擋住最後一段樓梯，鐘開始響。這是最後一架。在鐘聲結束前打倒他，否則戰爭就在你們腳下開始。你們在長廊已經做的選擇——揭發或談判——就是這座城給今夜的名字。',
    ),
    objective: L('Finish the champion before the bell ends.', '在鐘聲結束前解決冠軍。'),
    prompt: L('The champion fills the stair. What is your last action?', '冠軍擋住樓梯。你最後的行動是什麼？'),
    npc: 'ash-maera',
    cleared: L(
      'The champion drops as the bell rings. The city hears the ending you chose.',
      '鐘響時冠軍倒下。整座城聽見你們選的那個結局。',
    ),
    setback: L(
      'The champion stands. The bell rings anyway, and the ending is the worse one.',
      '冠軍還站著。鐘還是響了，結局是較壞的那一個。',
    ),
    moves: {
      might: { label: L('Duel the champion', '和冠軍決鬥'), risk: 'strain', target: 16 },
      agility: { label: L('Reach the bell rope', '搶到鐘繩'), risk: 'strain', target: 12 },
      insight: { label: L("Use Orren's forged names", '用奧倫的偽造之名'), risk: 'pressure', target: 12 },
      presence: { label: L('Make Maera stop both houses', '讓梅菈制止兩家'), risk: 'trust', target: 12 },
    },
  },
];

function approachFor(index: number, attribute: Attribute): ApproachDefinition {
  const beat = BEATS[index]!;
  const move = beat.moves[attribute];
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
    label: move.label,
    intentExamples: [move.label],
    attribute,
    target: move.target,
    risk: move.risk,
    npcId: attribute === 'presence' ? beat.npc : undefined,
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
  const beat = BEATS[index]!;
  const act = index <= 1 ? 1 : index <= 5 ? 2 : 3;
  const suggestions = (['might', 'agility', 'insight'] as const).map((attribute) => ({
    text: beat.moves[attribute].label,
    approachId: `ash-s${index}-${attribute}`,
  }));
  return {
    id: `ash-scene-${index}`,
    index,
    act,
    title: beat.title,
    location: beat.location,
    opening: beat.opening,
    objective: beat.objective,
    prompt: beat.prompt,
    suggestions,
    challengeId: `ash-challenge-${index}`,
    approaches: ATTRIBUTES.map((attribute) => approachFor(index, attribute)),
    availableNpcIds: ['ash-orren', 'ash-tavi', 'ash-maera'],
    publicFactsOnEntry: index === 0 ? ['ash-messenger-missing'] : [],
    clearedTransition: beat.cleared,
    setbackTransition: beat.setback,
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
      `${name.en} has the letter. The sellsword is already through the door.`,
      `${name['zh-Hant']} 拿著信。傭兵已經進門。`,
    ),
    suggestions: [
      {
        text: L('Hold the door', '頂住店門'),
        approachId: 'ash-s0-might',
      },
      {
        text: L('Drag the courier out the kitchen', '從廚房拖走信差'),
        approachId: 'ash-s0-agility',
      },
      {
        text: L('Rip the letter free and read the seal', '搶下信並辨認封蠟'),
        approachId: 'ash-s0-insight',
      },
    ],
  };
}

export const ashenThrones: WorldPack = {
  id: 'ashen-thrones',
  contentVersion: 1,
  title: L('Ashen Thrones', '權鬥王座'),
  premise: L(
    'The king of Crowkeep has been dead three nights. At the last bell two houses start the succession war, unless you carry the true heir’s letter through a city that is already drawing steel.',
    '鴉堡的王死了三夜。最後一聲鐘響時，兩大家族就會開戰，除非你們把真繼承人的信帶過這座已經拔刀的城。',
  ),
  tone: L(
    'Rain, steel, and short fights. Every scene ends by leaving for a named place. Wounds stay on the body. The war does not wait for a conversation.',
    '雨、鋼、短促的戰鬥。每一場都結束在前往下一個指名之地的路上。傷留在身上。戰爭不會等一場對話。',
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
        'The dead king’s letter names a living heir, and sellswords are already killing for it.',
        '已死國王的信寫著一位還活著的繼承人，傭兵已經在為它殺人。',
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
    ...[
      L('The letter is still in your hands after the inn fight. The north road is next.', '客棧一架之後信還在你們手上。下一站是北境大路。'),
      L('The lance charge is broken. Crowkeep’s gate is the next door.', '長槍衝鋒被撕開。下一扇門是鴉堡城門。'),
      L('You are inside the walls. The archive loft is the next fight.', '你們進了城牆。下一架在檔案閣樓。'),
      L('The rewritten margin is yours. Maera’s watch is down the stair.', '被改寫的欄外是你們的了。梅菈的哨站在樓下。'),
      L('The duel is over. The chapel stair is open, and Orren is below.', '決鬥結束。龍殿樓梯開了，奧倫在下面。'),
      L('Orren is with you. Both houses are drawing steel in the gallery above.', '奧倫跟著你們。兩大家族正在上面的長廊拔劍。'),
      L('The gallery has chosen disclosure or negotiation. The bell tower is the last fight.', '長廊已經選了揭發或談判。鐘樓是最後一架。'),
      L('The bell has rung on the champion. The night has a name.', '鐘在冠軍身上響完。這一夜有了名字。'),
    ].map((text, index) => ({
      id: `ash-clue-${index}`,
      text,
      secret: false,
      revealGate: { sceneId: `ash-scene-${index}`, on: 'either' as const },
    })),
    ...[
      L('Tavi will drop the bar if someone stands with him.', '只要有人跟他一起站，塔維就會落下門栓。'),
      L('Tavi lives if someone pulls him out of the hooves.', '有人把他拉出馬蹄，塔維就活得過。'),
      L('One name spoken at the gate is enough to move a frightened guard.', '在城門說出一個名字，就夠讓害怕的守衛讓路。'),
      L('Tavi can keep a person breathing while the assassin is handled.', '處理刺客時，塔維能讓一個人繼續呼吸。'),
      L('Maera opens doors for the person who tells her the letter’s true name.', '把信上的真名告訴梅菈的人，她會為之開門。'),
      L('Orren will speak the forged line once the knight is no longer the loudest thing in the room.', '只要騎士不再是屋子裡最響的東西，奧倫就會說出偽造的那一系。'),
      L('Maera can hold one line if someone orders both houses to stop.', '只要有人喝令兩家停下，梅菈就能壓住其中一邊。'),
      L('Maera on the stair can still stop a house that has not yet killed its champion.', '樓梯上的梅菈仍能制止一個還沒殺死冠軍的家族。'),
    ].map((text, index) => ({
      id: `ash-unlock-${index}`,
      text,
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
            ? 'The champion falls and the forged line is read over his body. The charge that would have started the purge breaks in the bell yard.'
            : kind === 'compromise'
              ? 'The champion yields, but one house still has steel in hand. The purge does not start tonight. It has a name for tomorrow.'
              : 'The champion cuts you down as the letter is shouted wrong. The bell starts the war.'
          : kind === 'success'
            ? 'You and Maera hold the stair until both houses lower their points. Orren lives, and the last bell rings over a halt instead of a charge.'
            : kind === 'compromise'
              ? 'One house steps back. The other does not. The bell buys a night, not a peace, and Orren leaves under guard.'
              : 'The halt fails. The champion throws you off the line, and the two houses meet on the stair as the bell ends.',
        routeId === 'ash-disclose'
          ? kind === 'success'
            ? '冠軍倒下，偽造的譜系在他身上被宣讀。原本要開始清洗的衝鋒在鐘樓下碎掉。'
            : kind === 'compromise'
              ? '冠軍讓步，但仍有一家刀未入鞘。清洗今夜沒有開始。它有了明天的名字。'
              : '信被喊錯的同時，冠軍把你們砍倒。鐘聲開戰。'
          : kind === 'success'
            ? '你們和梅菈守住樓梯，直到兩家放下劍尖。奧倫活著，最後的鐘響在停步之上，不在衝鋒之上。'
            : kind === 'compromise'
              ? '一家退了。另一家沒有。鐘聲買到一夜，不是和平。奧倫在看守下離開。'
              : '喝停失敗。冠軍把你們甩出隊列，鐘聲結束時兩家在樓梯上相遇。',
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

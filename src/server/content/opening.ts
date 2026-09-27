import type { WorldPack } from '@/server/content/types';
import { localized } from '@/server/content/types';
import type { Locale } from '@/shared/schemas';

const L = localized;

const BACKGROUND = L(
  'The king of Crowkeep has been dead three nights and left no heir who can be read aloud. When the last bell rings, two houses will go to war for the throne. The missing courier Orren carries a letter sealed in grey wax; inside it is the name of someone still alive. Tavi travelled with Orren, and he is on your side.',
  '鴉堡的王死了三夜，沒有留下能當眾宣讀的繼承人。最後一聲鐘響，城裡兩大家族就會為王位開戰。失蹤信使奧倫帶著一封灰翼封蠟的信，裡面是一個還活著的真名。塔維是奧倫的同伴，他站在你們這邊。',
);

const GOAL = L(
  'The story asks one thing: can this letter be heard before the bell? Each scene is a short fight. When it ends, you leave for the next named place. The war will not wait out a debate.',
  '故事只問一件事：這封信能不能在鐘響之前被聽見。每一場都是一架短戰鬥，打完就離開，前往下一個指名的地方。戰爭不會等你們商量完。',
);

const CAST: Record<string, ReturnType<typeof L>> = {
  'ash-knight': L(
    '{name}, exiled escort, once rode with Orren and wants the charge that banished him named.',
    '{name}是被放逐的護衛，曾護送奧倫，要洗清那樁不能公開的指控。',
  ),
  'ash-scholar': L(
    '{name}, dragon historian, knows this grey seal and means to keep the forbidden genealogy.',
    '{name}是龍語學者，認得這枚灰翼封蠟，要保住被禁的族譜。',
  ),
  'ash-envoy': L(
    '{name}, house envoy, has eaten at both rival tables and wants the succession war talked down.',
    '{name}是家族使節，兩家的席都坐過，想把繼承戰爭談下來。',
  ),
  'ash-scout': L(
    '{name}, border ranger, knows the forest road and means to keep the purge off the villages.',
    '{name}是邊境巡林者，熟林道，要擋住沖向村子的刀。',
  ),
};

const DUTY: Record<string, ReturnType<typeof L>> = {
  'ash-knight': L('{name} guards the letter', '{name}護信'),
  'ash-scholar': L('{name} reads the seal', '{name}讀蠟'),
  'ash-envoy': L('{name} talks the knives down', '{name}把刀談開'),
  'ash-scout': L('{name} finds a road that still exists', '{name}找還能走的路'),
};

function withName(template: string, name: string): string {
  return template.replaceAll('{name}', name);
}

export function openingParagraphs(
  pack: WorldPack,
  party: Array<{ characterId: string; displayName: string }>,
  locale: Locale,
  sceneOpening: string,
): string[] {
  if (pack.id !== 'ashen-thrones') {
    return [sceneOpening];
  }
  const seated = party.flatMap((member) => {
    const line = CAST[member.characterId];
    const duty = DUTY[member.characterId];
    if (!line || !duty) return [];
    const character = pack.characters.find((entry) => entry.id === member.characterId);
    const name = member.displayName.trim() || character?.name[locale] || member.characterId;
    return [{ name, line: withName(line[locale], name), duty: withName(duty[locale], name) }];
  });
  const names = seated.map((member) => member.name).join(locale === 'zh-Hant' ? '、' : ', ');
  const who =
    locale === 'zh-Hant'
      ? `這一席是${names}。${seated.map((member) => member.line).join('')}`
      : `At this table: ${names}. ${seated.map((member) => member.line).join(' ')}`;
  const bond =
    seated.length > 1
      ? locale === 'zh-Hant'
        ? `${seated.map((member) => member.duty).join('，')}。你們認得彼此，這一夜只帶同一封信。`
        : `${seated.map((member) => member.duty).join('; ')}. You know each other, and tonight you carry one letter.`
      : locale === 'zh-Hant'
        ? `這一夜，信在${names}手上。`
        : `Tonight the letter is in ${names}'s hands.`;
  return [BACKGROUND[locale], `${who}${bond}`, GOAL[locale], sceneOpening];
}

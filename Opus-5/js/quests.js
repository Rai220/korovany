// Задания: командир дворца приказывает, старейшина эльфов просит,
// а Злой… сам себе командир.
import { randInt } from './util.js';

const LISTS = {
  elf: [
    { kind: 'rob', need: 1, title: 'Ограбить корован',
      text: 'Через наши земли на дворец идёт корован. Возьми, что нам должны.', gold: 260 },
    { kind: 'kill', faction: 'guard', need: 6, title: 'Прогнать солдат дворца',
      text: 'Солдаты дворца набигают на лес. Убей шестерых.', gold: 300 },
    { kind: 'kill', faction: 'villain', need: 5, title: 'Отбиться от слуг Злого',
      text: 'Из гор лезут слуги Злого… Проредите их.', gold: 320 },
    { kind: 'rob', need: 2, title: 'Большой налёт на корованы',
      text: 'Два корована подряд — и мы отстроим деревню заново.', gold: 520 },
  ],
  guard: [
    { kind: 'defend', need: 6, title: 'Защищать дворец',
      text: 'Шпионы и партизаны эльфов у стен. Держать дворец!', gold: 280 },
    { kind: 'kill', faction: 'elf', need: 7, title: 'Набег на лес эльфов',
      text: 'Пойдёшь на набег: эльфийские партизаны должны понести потери.', gold: 340 },
    { kind: 'escort', need: 1, title: 'Довести корован до дворца',
      text: 'Корован должен дойти целым. Головой отвечаешь.', gold: 300 },
    { kind: 'kill', faction: 'villain', need: 6, title: 'Вылазка в горы',
      text: 'Злой… собирает войско в старом форте. Проредить.', gold: 380 },
  ],
  villain: [
    { kind: 'recruit', need: 6, title: 'Собрать войско',
      text: 'Сам себе командир: собери в форте шестерых слуг (F у костра).', gold: 150 },
    { kind: 'rob', need: 1, title: 'Отнять корован у императора',
      text: 'Корован везёт золото во дворец. Оно нужнее тебе.', gold: 300 },
    { kind: 'kill', faction: 'guard', need: 12, title: 'Штурм дворца',
      text: 'Прикажи войскам (T) и веди их на дворец. Двенадцать гвардейцев.', gold: 700 },
    { kind: 'kill', faction: 'elf', need: 5, title: 'Наказать партизан',
      text: 'Эльфийские партизаны шалят у форта. Убей пятерых.', gold: 260 },
  ],
};

export function makeQuest(faction, index) {
  const list = LISTS[faction] || LISTS.elf;
  const src = list[index % list.length];
  const bonus = Math.floor(index / list.length);
  return {
    ...src,
    id: `${faction}_${index}`,
    index,
    need: src.need + bonus,
    gold: src.gold + bonus * 160,
    have: 0,
    done: false,
  };
}

export function questLine(q) {
  if (!q) return 'Заданий нет. Делай что хочешь.';
  const tail = q.done ? ' — ВЫПОЛНЕНО, вернись за наградой' : ` (${q.have}/${q.need})`;
  return `${q.title}${tail}`;
}

/** Событие мира двигает задание. Возвращает true, если задание только что выполнено. */
export function questEvent(q, type, data = {}) {
  if (!q || q.done) return false;
  let hit = false;
  if (q.kind === 'kill' && type === 'kill' && data.faction === q.faction) hit = true;
  if (q.kind === 'defend' && type === 'kill' && data.nearPalace) hit = true;
  if (q.kind === 'rob' && type === 'rob') hit = true;
  if (q.kind === 'escort' && type === 'caravan_arrived') hit = true;
  if (q.kind === 'recruit' && type === 'recruit') hit = true;
  if (!hit) return false;
  q.have = Math.min(q.need, q.have + 1);
  if (q.have >= q.need) { q.done = true; return true; }
  return false;
}

export const RANKS = {
  elf: ['Лесной следопыт', 'Ловчий', 'Хранитель чащи', 'Владыка леса'],
  guard: ['Рядовой стражи', 'Десятник', 'Сотник', 'Воевода дворца'],
  villain: ['Злой… (никто не знает)', 'Злой… (о нём шепчутся)', 'Злой… (его боятся)', 'Злой… (имя всё ещё не придумано)'],
};

export function rankName(faction, rank) {
  const r = RANKS[faction] || RANKS.elf;
  return r[Math.min(rank, r.length - 1)] + (rank >= r.length ? ` +${rank - r.length + 1}` : '');
}

export function randomTaunt(faction) {
  const t = {
    elf: ['Лес всё видит.', 'Стрела быстрее слова.', 'Корован не уйдёт.'],
    guard: ['За императора!', 'Стоять насмерть!', 'Шпиона взять живым!'],
    villain: ['Тьма идёт.', 'Имя мне ещё не придумали.', 'Дворец падёт.'],
  }[faction] || ['...'];
  return t[randInt(0, t.length - 1)];
}

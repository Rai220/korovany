// Константы мира: зоны, фракции, предметы, лавки.

export const MAP_HALF = 1000;           // мир от -1000 до 1000 по X и Z
export const VIEW_DIST = 300;

/** Всего в игре 4 зоны. */
export const ZONES = {
  human:   { id: 'human',   name: 'Земли людей',      sub: 'нейтралы, торг, лекарь', x: -600, z:  600, r: 430 },
  elf:     { id: 'elf',     name: 'Лес эльфов',       sub: 'густой лес, домики деревяные', x: -600, z: -600, r: 460 },
  palace:  { id: 'palace',  name: 'Земли императора', sub: 'дворец и его охрана', x:  600, z: -600, r: 420 },
  villain: { id: 'villain', name: 'Горы Злого…',      sub: 'там есть старый форт', x:  600, z:  600, r: 450 },
  wild:    { id: 'wild',    name: 'Ничейные пустоши', sub: 'дороги и корованы', x: 0, z: 0, r: 0 },
};

export const ZONE_LIST = [ZONES.human, ZONES.elf, ZONES.palace, ZONES.villain];

/** Базы фракций — точки возрождения и быстрого перемещения. */
export const BASES = {
  elf:     { x: -600, z: -600, name: 'Эльфийская деревня' },
  guard:   { x:  560, z: -600, name: 'Дворец императора' },
  villain: { x:  600, z:  600, name: 'Старый форт' },
  human:   { x: -600, z:  600, name: 'Людской городок' },
};

/**
 * Дороги. Главная — людской городок → дворец, по ней и ходят корованы.
 * Тракт нарочно ведёт вдоль южной опушки эльфийского леса: иначе эльфам
 * до корована бежать через полкарты и грабить некого.
 */
export const ROADS = [
  { id: 'trade', path: [[-600, 690], [-560, 330], [-390, -40], [-120, -300], [170, -450], [420, -560], [560, -600]] },
  { id: 'elfroad', path: [[-600, 600], [-680, 180], [-640, -240], [-600, -560]] },
  { id: 'darkroad', path: [[600, -560], [720, -200], [700, 200], [620, 560]] },
];
export const TRADE_ROAD = ROADS[0];

export const FACTIONS = {
  elf:     { id: 'elf',     name: 'Лесные эльфы',   color: 0x3f7a3a, accent: 0xb8d18a, title: 'эльф' },
  guard:   { id: 'guard',   name: 'Охрана дворца',  color: 0x2f4f86, accent: 0xd6c064, title: 'гвардеец' },
  villain: { id: 'villain', name: 'Злой…',          color: 0x3a2530, accent: 0x8d2b2b, title: 'слуга Злого' },
  human:   { id: 'human',   name: 'Люди',           color: 0x7a6242, accent: 0xc9b184, title: 'человек' },
};

const HOSTILE = {
  elf:     { guard: true, villain: true, human: false, elf: false },
  guard:   { elf: true, villain: true, human: false, guard: false },
  villain: { elf: true, guard: true, human: false, villain: false },
  human:   { elf: false, guard: false, villain: false, human: false },
};

export function isHostile(a, b) {
  if (!a || !b || a === b) return false;
  return !!(HOSTILE[a] && HOSTILE[a][b]);
}

/** Предметы. Оружие, броня, лекарства и протезы — покупается как в Daggerfall. */
export const ITEMS = {
  fists:      { name: 'Кулаки', cat: 'weapon', kind: 'melee', dmg: 9, rate: 0.42, reach: 2.4, dis: 0.0, price: 0, noSell: true, desc: 'Совсем ничего нет.' },
  dagger:     { name: 'Кинжал', cat: 'weapon', kind: 'melee', dmg: 22, rate: 0.34, reach: 2.6, dis: 0.10, price: 70, desc: 'Быстрый, но короткий.' },
  sword:      { name: 'Меч', cat: 'weapon', kind: 'melee', dmg: 34, rate: 0.55, reach: 3.2, dis: 0.20, price: 190, desc: 'Надёжный клинок.' },
  axe:        { name: 'Секира', cat: 'weapon', kind: 'melee', dmg: 54, rate: 0.95, reach: 3.4, dis: 0.45, price: 460, desc: 'Отрубает руки и ноги.' },
  bow:        { name: 'Эльфийский лук', cat: 'weapon', kind: 'ranged', dmg: 40, rate: 0.75, dis: 0.14, price: 320, speed: 105, ammo: 'arrow', desc: 'Бьёт далеко и тихо.' },
  crossbow:   { name: 'Арбалет', cat: 'weapon', kind: 'ranged', dmg: 62, rate: 1.5, dis: 0.24, price: 560, speed: 140, ammo: 'bolt', desc: 'Долго заряжать, зато насквозь.' },
  darkstaff:  { name: 'Посох Злого…', cat: 'weapon', kind: 'ranged', dmg: 52, rate: 0.9, dis: 0.34, price: 820, speed: 62, ammo: null, desc: 'Плюётся тьмой, стрел не надо.' },

  arrow:      { name: 'Стрелы (20 шт.)', cat: 'ammo', price: 30, amount: 20, stack: true, desc: 'Для лука.' },
  bolt:       { name: 'Болты (20 шт.)', cat: 'ammo', price: 42, amount: 20, stack: true, desc: 'Для арбалета.' },

  bandage:    { name: 'Бинты', cat: 'med', price: 25, stack: true, desc: 'Останавливают кровотечение (R).' },
  potion:     { name: 'Зелье лечения', cat: 'med', price: 55, heal: 50, stack: true, desc: 'Возвращает 50 здоровья (Q).' },

  armor_leather: { name: 'Кожаный доспех', cat: 'armor', armor: 0.15, price: 210, desc: 'Снимает 15% урона.' },
  armor_chain:   { name: 'Кольчуга', cat: 'armor', armor: 0.30, price: 620, desc: 'Снимает 30% урона.' },
  armor_plate:   { name: 'Латы императора', cat: 'armor', armor: 0.45, price: 1500, desc: 'Снимает 45% урона.' },

  prosth_arm: { name: 'Протез руки', cat: 'prosth', price: 650, stack: true, desc: 'Ставится вместо отрубленной руки.' },
  prosth_leg: { name: 'Протез ноги', cat: 'prosth', price: 800, stack: true, desc: 'Самое хорошее — снова ходить.' },
  glass_eye:  { name: 'Стеклянный глаз', cat: 'prosth', price: 340, stack: true, desc: 'Видно хуже, но видно.' },
  wheelchair: { name: 'Коляска', cat: 'prosth', price: 280, stack: true, desc: 'Без ног — хоть котаться.' },

  pelt:       { name: 'Трофейная шкура', cat: 'loot', price: 40, stack: true, desc: 'Продать скупщику.' },
  silk:       { name: 'Корованский шёлк', cat: 'loot', price: 110, stack: true, desc: 'Из ограбленного корована.' },
  spice:      { name: 'Пряности', cat: 'loot', price: 85, stack: true, desc: 'Пахнут дорого.' },
  crown:      { name: 'Императорская печать', cat: 'loot', price: 400, stack: true, desc: 'Очень дорогая вещица.' },
};

/** Услуги лекаря — не предметы, а действия. */
export const SERVICES = {
  heal:    { name: 'Перевязка и лечение', price: 60, desc: 'Полное здоровье, кровь остановят.' },
  attach:  { name: 'Приставить протез', price: 120, desc: 'Нужен купленный протез.' },
};

export const SHOPS = {
  armorer: { name: 'Оружейник', stock: ['dagger', 'sword', 'axe', 'bow', 'crossbow', 'arrow', 'bolt', 'armor_leather', 'armor_chain'] },
  healer:  { name: 'Лекарь-протезист', stock: ['bandage', 'potion', 'prosth_arm', 'prosth_leg', 'glass_eye', 'wheelchair'], services: ['heal', 'attach'] },
  trader:  { name: 'Торговец', stock: ['bandage', 'potion', 'arrow', 'bolt'], buysLoot: true },
  elfquart: { name: 'Эльфийский оружейник', stock: ['bow', 'arrow', 'dagger', 'bandage', 'armor_leather'] },
  darkquart: { name: 'Кузнец Злого…', stock: ['axe', 'darkstaff', 'potion', 'armor_chain', 'armor_plate'] },
  palacequart: { name: 'Дворцовый арсенал', stock: ['sword', 'crossbow', 'bolt', 'armor_chain', 'armor_plate', 'bandage'] },
};

/** Стартовое снаряжение по фракциям. */
export const STARTS = {
  elf: {
    weapon: 'bow', gold: 140,
    inv: { bow: 1, dagger: 1, arrow: 40, bandage: 3, potion: 1 },
    armor: 'armor_leather',
    obj: 'Иди к Старейшине в деревне — он расскажет, какой корован грабить.',
  },
  guard: {
    weapon: 'sword', gold: 120,
    inv: { sword: 1, crossbow: 1, bolt: 20, bandage: 3 },
    armor: 'armor_chain',
    obj: 'Явись к командиру у дворца и слушайся приказов.',
  },
  villain: {
    weapon: 'axe', gold: 220,
    inv: { axe: 1, darkstaff: 1, bandage: 4, potion: 2 },
    armor: 'armor_chain',
    obj: 'Ты сам себе командир. Собери войско в форте (F) и веди его на дворец (T).',
  },
};

export const SAVE_KEY = 'korovany_opus5_save_v1';

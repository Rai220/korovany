// Общие данные игры: фракции, предметы, география.
export const MODEL_NAME = 'Fable 5.2';
export const GAME_TITLE = 'КОРОВАНЫ: джва года спустя';
export const SAVE_KEY = 'korovany-fable-5.2-save';

export const WORLD = 1200;          // размер карты
export const HALF = WORLD / 2;

// Общее изменяемое состояние игры. Модули складывают сюда свои объекты.
export const G = {
  running: false, paused: true, time: 0,
  dayTime: 0.3, day: 1,
  npcs: [], caravans: [], projectiles: [], corpses: [],
  leadersDead: { elf: false, empire: false, evil: false },
  evilOrder: 'hold',
  mission: null,
  stats: { kills: 0, robbed: 0 },
  won: false,
};

export const FACTIONS = {
  elf:    { name: 'Лесные эльфы',  short: 'эльфы',   color: 0x4fc45a, css: '#4fc45a' },
  empire: { name: 'Охрана дворца', short: 'империя', color: 0x4f86e8, css: '#4f86e8' },
  evil:   { name: 'Войско Злого',  short: 'Злой',    color: 0xb04fe0, css: '#b04fe0' },
  human:  { name: 'Вольные люди',  short: 'люди',    color: 0xe0b860, css: '#e0b860' },
};
export const WAR = ['elf', 'empire', 'evil'];

// Опорные точки четырёх зон.
export const SITES = {
  human:  { x: -300, z: 300,  r: 95, h: 2.5, name: 'Город людей' },
  empire: { x: 310,  z: 310,  r: 105, h: 3.5, name: 'Императорский дворец' },
  elf:    { x: -310, z: -310, r: 75, h: 5,   name: 'Деревня эльфов' },
  evil:   { x: 320,  z: -320, r: 62, h: 46,  name: 'Старый форт' },
  hub:    { x: 0,    z: 0,    r: 26, h: 3,   name: 'Перекрёсток' },
};
export const ZONE_NAMES = {
  human: 'Земли людей (нейтральная зона)',
  empire: 'Зона Императора',
  elf: 'Лес эльфов',
  evil: 'Горы Злого',
};
export function zoneAt(x, z) {
  if (x < 0) return z < 0 ? 'elf' : 'human';
  return z < 0 ? 'evil' : 'empire';
}

// Дороги: от базы к перекрёстку. Путь между базами = дорога A + обратная дорога B.
export const ROADS = {
  human:  [[-300, 300], [-262, 262], [-150, 160], [-60, 50], [0, 0]],
  empire: [[278, 310], [248, 310], [225, 290], [150, 160], [60, 50], [0, 0]],
  elf:    [[-310, -310], [-270, -272], [-160, -150], [-60, -70], [0, 0]],
  evil:   [[320, -320], [288, -292], [232, -238], [150, -130], [60, -40], [0, 0]],
};
// Южный торговый тракт: город — дворец напрямую.
export const SOUTH_ROAD = [[-300, 300], [-240, 335], [-120, 362], [0, 350], [120, 345], [205, 322], [248, 310], [278, 310]];

export function pathBetween(a, b) {
  const p = ROADS[a].map(q => ({ x: q[0], z: q[1] }));
  const back = ROADS[b].slice(0, -1).reverse().map(q => ({ x: q[0], z: q[1] }));
  return p.concat(back);
}
export function pathToHub(a) { return ROADS[a].map(q => ({ x: q[0], z: q[1] })); }

export const ITEMS = {
  dagger:     { name: 'Кинжал',            type: 'melee',  dmg: 9,  speed: 1.5,  range: 2.3, price: 30 },
  sword:      { name: 'Меч',               type: 'melee',  dmg: 14, speed: 1.15, range: 2.8, price: 90 },
  longsword:  { name: 'Длинный меч',       type: 'melee',  dmg: 19, speed: 1.0,  range: 3.1, price: 220 },
  axe:        { name: 'Секира',            type: 'melee',  dmg: 26, speed: 0.75, range: 2.9, price: 270 },
  blackblade: { name: 'Чёрный клинок',     type: 'melee',  dmg: 23, speed: 1.1,  range: 3.0, price: 480 },
  bow:        { name: 'Лук',               type: 'ranged', dmg: 13, price: 80 },
  longbow:    { name: 'Эльфийский лук',    type: 'ranged', dmg: 19, price: 240 },
  staff:      { name: 'Посох тьмы',        type: 'ranged', dmg: 17, magic: true, price: 420 },
  arrow:      { name: 'Стрелы',            type: 'ammo',   price: 1 },
  leather:    { name: 'Кожаная куртка',    type: 'armor',  def: 0.12, price: 70 },
  chain:      { name: 'Кольчуга',          type: 'armor',  def: 0.25, price: 230 },
  plate:      { name: 'Латы',              type: 'armor',  def: 0.4,  price: 560 },
  potion:     { name: 'Зелье лечения',     type: 'use',    heal: 50, price: 35 },
  bandage:    { name: 'Бинт',              type: 'use',    price: 12 },
  bread:      { name: 'Хлеб',              type: 'use',    heal: 15, price: 4 },
  hook:       { name: 'Протез руки (крюк)',     type: 'prosthesis', part: 'arm', price: 150 },
  pegleg:     { name: 'Протез ноги (деревяшка)', type: 'prosthesis', part: 'leg', price: 140 },
  crystaleye: { name: 'Хрустальный глаз',       type: 'prosthesis', part: 'eye', price: 200 },
  wheelchair: { name: 'Коляска',           type: 'gear',   price: 90 },
  silk:       { name: 'Шёлк',              type: 'loot',   price: 45 },
  spice:      { name: 'Пряности',          type: 'loot',   price: 60 },
  gem:        { name: 'Самоцвет',          type: 'loot',   price: 130 },
  ore:        { name: 'Руда',              type: 'loot',   price: 25 },
  ear:        { name: 'Трофейное ухо',     type: 'loot',   price: 8 },
};

export const SHOPS = {
  smith:   { title: 'Оружейник', stock: ['dagger', 'sword', 'longsword', 'axe', 'bow', 'arrow'] },
  armorer: { title: 'Бронник', stock: ['leather', 'chain', 'plate'] },
  alch:    { title: 'Лекарь-алхимик', stock: ['potion', 'bandage', 'bread'], healer: true },
  prosth:  { title: 'Мастер протезов', stock: ['hook', 'pegleg', 'crystaleye', 'wheelchair', 'bandage'], healer: true },
  trader:  { title: 'Купец', stock: ['bread', 'bandage', 'arrow', 'leather', 'silk', 'spice'] },
  tavern:  { title: 'Трактирщик', stock: ['bread', 'potion'], rest: true },
  elfshop: { title: 'Травница эльфов', stock: ['potion', 'bandage', 'bread', 'longbow', 'arrow', 'dagger', 'leather', 'pegleg', 'hook', 'crystaleye'], healer: true },
  quarter: { title: 'Интендант дворца', stock: ['sword', 'longsword', 'bow', 'arrow', 'chain', 'plate', 'bandage', 'potion', 'wheelchair'] },
  medic:   { title: 'Придворный лекарь', stock: ['potion', 'bandage', 'hook', 'pegleg', 'crystaleye', 'wheelchair'], healer: true },
  dealer:  { title: 'Барыга форта', stock: ['axe', 'blackblade', 'staff', 'bow', 'arrow', 'chain', 'bread', 'potion'] },
  bones:   { title: 'Костоправ', stock: ['bandage', 'potion', 'hook', 'pegleg', 'crystaleye', 'wheelchair'], healer: true },
};

export const BODY_PARTS = {
  armL: 'левая рука', armR: 'правая рука',
  legL: 'левая нога', legR: 'правая нога',
  eyeL: 'левый глаз', eyeR: 'правый глаз',
};

export const rnd = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
export const rndInt = (a, b) => Math.floor(rnd(a, b + 1));
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const dist2 = (ax, az, bx, bz) => { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; };
export function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }

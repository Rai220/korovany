'use strict';

/* =========================================================================
   КОРОВАНЫ: ЧЕТЫРЕ ЗЕМЛИ
   Модель запуска: deepseek-v4.1-flash-1017
   Самодостаточный браузерный 3D-экшен на Canvas 2D (перспективная проекция).
   ========================================================================= */

const MODEL_NAME = 'deepseek-v4.1-flash-1017';
const SAVE_KEY = 'korovany_four_lands_' + MODEL_NAME + '_save_v1';
const TAU = Math.PI * 2;
const WORLD = { w: 1800, h: 1400 };
const NEAR = 0.24;
const TREE_LOD_DISTANCE = 53;
const FOG_COLOR = '#9caea9';

const ZONES = [
  { id: 'human', name: 'Вольная Марка', sub: 'Нейтральная зона людей', x: 450, z: 1050, r: 520, color: '#6f7d47', ground: '#52603c' },
  { id: 'empire', name: 'Империя', sub: 'Зона императора и дворца', x: 1350, z: 1050, r: 520, color: '#b38d45', ground: '#5f6740' },
  { id: 'elf', name: 'Лесное княжество', sub: 'Густой лес лесных эльфов', x: 450, z: 350, r: 540, color: '#4d8256', ground: '#344d35' },
  { id: 'villain', name: 'Мглистые горы', sub: 'Зона злодея и старого форта', x: 1350, z: 350, r: 520, color: '#7a678c', ground: '#4d4a45' }
];

const ZONE_BY_ID = Object.fromEntries(ZONES.map(z => [z.id, z]));

const FACTIONS = {
  elf: {
    id: 'elf', side: 'elf', name: 'Лесной эльф', title: 'Эльф-охотник',
    glyph: '⌁', color: '#62a96f',
    start: { x: 485, z: 520, yaw: Math.PI },
    intro: 'Деревянные дома княжества горят от факелов империи. Отбейте набег, а потом вспомните, что караваны людей всегда везли слишком много золота.'
  },
  guard: {
    id: 'guard', side: 'empire', name: 'Стража дворца', title: 'Стражник дворца',
    glyph: '♜', color: '#d4a84e',
    start: { x: 1380, z: 1245, yaw: Math.PI },
    intro: 'Командир Арден ждёт у южных ворот. Дворцу угрожают шпионы Морвейна и партизаны эльфов. Приказ командира — не пожелание.'
  },
  villain: {
    id: 'villain', side: 'villain', name: 'Злодей Морвейн', title: 'Морвейн, владыка форта',
    glyph: '♞', color: '#a675c7',
    start: { x: 1360, z: 520, yaw: Math.PI },
    intro: 'Старый форт снова под вашей рукой. Соберите отряд, отдайте приказ и покажите империи, что стены не спасают от воли.'
  }
};

const SIDE_TO_CHOICE = { elf: 'elf', empire: 'guard', villain: 'villain' };

const PALETTES = {
  elf: { cloth: '#385c40', cloth2: '#547750', leather: '#6d4b2c', metal: '#aeb8a8', skin: '#d2a77a', accent: '#d8b96a', dark: '#1d3023' },
  empire: { cloth: '#7f3032', cloth2: '#a94a43', leather: '#4a3526', metal: '#aab1ad', skin: '#c9946c', accent: '#d8b04d', dark: '#30191a' },
  villain: { cloth: '#3f2b50', cloth2: '#624071', leather: '#332a2a', metal: '#777b80', skin: '#a9826b', accent: '#b2423f', dark: '#1d1424' },
  human: { cloth: '#6e5a3b', cloth2: '#8d7752', leather: '#4b3929', metal: '#9d9a8d', skin: '#c69268', accent: '#c4a25e', dark: '#2b241b' }
};

const ROLE_DEFS = {
  merchant: { name: 'Торговец', faction: 'human', hp: 90, speed: 2.0, dmg: [0, 0], peaceful: true, detect: 0, gold: 40, scale: 0.95 },
  villager: { name: 'Поселянин', faction: 'human', hp: 45, speed: 1.7, dmg: [2, 4], peaceful: true, detect: 0, gold: 3, scale: 0.94 },
  imperial_commander: { name: 'Командир Арден', faction: 'empire', hp: 260, speed: 2.5, dmg: [12, 17], peaceful: true, detect: 12, gold: 30, scale: 1.05, elite: true },
  imperial_guard: { name: 'Стражник дворца', faction: 'empire', hp: 72, speed: 3.25, dmg: [6, 10], peaceful: false, detect: 20, gold: 9, scale: 1.0 },
  imperial_soldier: { name: 'Солдат империи', faction: 'empire', hp: 58, speed: 3.05, dmg: [5, 8], peaceful: false, detect: 22, gold: 7, scale: 0.98 },
  imperial_raider: { name: 'Имперский каратель', faction: 'empire', hp: 62, speed: 3.25, dmg: [6, 9], peaceful: false, detect: 25, gold: 10, scale: 1.0, raid: true },
  elf_guard: { name: 'Страж леса', faction: 'elf', hp: 66, speed: 3.4, dmg: [6, 9], peaceful: false, detect: 21, gold: 8, scale: 0.97 },
  elf_partisan: { name: 'Партизан-эльф', faction: 'elf', hp: 56, speed: 3.55, dmg: [6, 9], peaceful: false, detect: 24, gold: 9, scale: 0.95 },
  elf_spy: { name: 'Эльфийский шпион', faction: 'elf', hp: 48, speed: 3.8, dmg: [7, 11], peaceful: false, detect: 26, gold: 13, scale: 0.93 },
  elf_elder: { name: 'Старейшина Лиэн', faction: 'elf', hp: 150, speed: 2.1, dmg: [4, 7], peaceful: true, detect: 8, gold: 20, scale: 0.98, elite: true },
  villain_soldier: { name: 'Воитель Морвейна', faction: 'villain', hp: 68, speed: 3.15, dmg: [6, 10], peaceful: false, detect: 22, gold: 9, scale: 1.0 },
  villain_raider: { name: 'Налётчик', faction: 'villain', hp: 62, speed: 3.5, dmg: [7, 11], peaceful: false, detect: 25, gold: 11, scale: 1.0, raid: true },
  villain_spy: { name: 'Лазутчик Морвейна', faction: 'villain', hp: 50, speed: 3.9, dmg: [8, 12], peaceful: false, detect: 27, gold: 14, scale: 0.93 },
  villain_warlord: { name: 'Воевода Грим', faction: 'villain', hp: 240, speed: 2.7, dmg: [13, 18], peaceful: true, detect: 10, gold: 35, scale: 1.06, elite: true },
  caravan_guard: { name: 'Охранник каравана', faction: 'human', hp: 54, speed: 3.1, dmg: [5, 8], peaceful: true, detect: 7, gold: 6, scale: 0.97 },
  bandit: { name: 'Дорожный разбойник', faction: 'human', hp: 52, speed: 3.3, dmg: [6, 9], peaceful: false, detect: 24, gold: 16, scale: 0.97, outlaw: true }
};

const ROADS = [
  { a: { x: 900, z: 700 }, b: { x: 470, z: 1050 } },
  { a: { x: 900, z: 700 }, b: { x: 1380, z: 1050 } },
  { a: { x: 900, z: 700 }, b: { x: 470, z: 350 } },
  { a: { x: 900, z: 700 }, b: { x: 1360, z: 330 } },
  { a: { x: 470, z: 1050 }, b: { x: 1380, z: 1050 } },
  { a: { x: 470, z: 350 }, b: { x: 1360, z: 330 } }
];

const BASE_ENEMIES = {
  empire: ['elf', 'villain'],
  elf: ['empire', 'villain'],
  villain: ['empire', 'elf'],
  human: []
};

const SHOP_ITEMS = [
  { id: 'bandage', name: 'Бинт', price: 12, desc: 'Останавливает кровотечение и возвращает 15 HP. Не отращивает конечности.', icon: '✚' },
  { id: 'potion', name: 'Эликсир лечения', price: 32, desc: 'Восстанавливает 55 HP даже в бою.', icon: '◒' },
  { id: 'prostheticArm', name: 'Протез руки', price: 260, desc: 'Возвращает силу удара и снимает кровотечение.', icon: '⚒' },
  { id: 'prostheticEye', name: 'Протез глаза', price: 180, desc: 'Убирает слепую половину экрана.', icon: '◉' },
  { id: 'prostheticLeg', name: 'Протез ноги', price: 320, desc: 'Возвращает бег и прыжки. Коляска больше не нужна.', icon: 'ϟ' },
  { id: 'wheelchair', name: 'Боевая коляска', price: 140, desc: 'Позволяет передвигаться без ноги. Прыжки недоступны.', icon: '⊙' },
  { id: 'eyepatch', name: 'Кожаная повязка', price: 30, desc: 'Прикрывает пустую глазницу. Слепая зона остаётся, но темнее лишь наполовину.', icon: '◐' },
  { id: 'sword', name: 'Клеймора пограничья', price: 220, desc: '+8 к урону. Один раз.', icon: '†' },
  { id: 'armor', name: 'Дублёная броня', price: 180, desc: '-25% входящего урона. Один раз.', icon: '▣' }
];

/* ------------------------------- utils ---------------------------------- */

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const dist2d = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const distSq = (ax, az, bx, bz) => (ax - bx) * (ax - bx) + (az - bz) * (az - bz);
const angleWrap = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
const dot2 = (ax, az, bx, bz) => ax * bx + az * bz;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function hash2(x, z) {
  let h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

function pointSegmentDistance(px, pz, ax, az, bx, bz) {
  const abx = bx - ax, abz = bz - az;
  const len = abx * abx + abz * abz;
  const t = len ? clamp(((px - ax) * abx + (pz - az) * abz) / len, 0, 1) : 0;
  return dist2d(px, pz, ax + abx * t, az + abz * t);
}

function roadDistance(x, z) {
  let best = 1e9;
  for (const road of ROADS) best = Math.min(best, pointSegmentDistance(x, z, road.a.x, road.a.z, road.b.x, road.b.z));
  return best;
}

function nearestZone(x, z) {
  let best = ZONES[0], bd = 1e18;
  for (const zone of ZONES) {
    const d = distSq(x, z, zone.x, zone.z);
    if (d < bd) { bd = d; best = zone; }
  }
  return best;
}

function parseHex(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbHex(r, g, b) {
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
function shadeHex(hex, factor) {
  const c = parseHex(hex);
  return rgbHex(clamp(Math.round(c.r * factor), 0, 255), clamp(Math.round(c.g * factor), 0, 255), clamp(Math.round(c.b * factor), 0, 255));
}
function mixHex(a, b, t) {
  const ca = parseHex(a), cb = parseHex(b);
  return rgbHex(
    Math.round(lerp(ca.r, cb.r, t)),
    Math.round(lerp(ca.g, cb.g, t)),
    Math.round(lerp(ca.b, cb.b, t))
  );
}

function xp(actor) { return actor?.x || 0; }
function zp(actor) { return actor?.z || 0; }

/* --------------------------- dom and canvas ----------------------------- */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const minimapCanvas = document.getElementById('minimap');
const minimapCtx = minimapCanvas.getContext('2d');
const bigMapCanvas = document.getElementById('big-map');
const bigMapCtx = bigMapCanvas.getContext('2d');
const DOM = {
  hud: document.getElementById('hud'),
  startScreen: document.getElementById('start-screen'),
  continueBtn: document.getElementById('continue-btn'),
  healthText: document.getElementById('health-text'),
  healthFill: document.getElementById('health-fill'),
  staminaText: document.getElementById('stamina-text'),
  staminaFill: document.getElementById('stamina-fill'),
  bleedBar: document.getElementById('bleed-bar'),
  bleedFill: document.getElementById('bleed-fill'),
  goldText: document.getElementById('gold-text'),
  playerLabel: document.getElementById('player-label'),
  injuryChips: document.getElementById('injury-chips'),
  zoneName: document.getElementById('zone-name'),
  zoneSub: document.getElementById('zone-sub'),
  compass: document.getElementById('compass'),
  mapCoords: document.getElementById('map-coords'),
  questTitle: document.getElementById('quest-title'),
  questDesc: document.getElementById('quest-desc'),
  questProgress: document.querySelector('#quest-progress > i'),
  toastStack: document.getElementById('toast-stack'),
  interaction: document.getElementById('interaction'),
  interactionText: document.getElementById('interaction-text'),
  screenHint: document.getElementById('screen-hint'),
  crosshair: document.getElementById('crosshair'),
  fpsTag: document.getElementById('fps-tag'),
  shopModal: document.getElementById('shop-modal'),
  shopTitle: document.getElementById('shop-title'),
  shopGold: document.getElementById('shop-gold'),
  shopGrid: document.getElementById('shop-grid'),
  healBtn: document.getElementById('heal-btn'),
  inventoryModal: document.getElementById('inventory-modal'),
  invSubtitle: document.getElementById('inv-subtitle'),
  bodyLines: document.getElementById('body-lines'),
  inventoryRows: document.getElementById('inventory-rows'),
  useBandage: document.getElementById('use-bandage'),
  usePotion: document.getElementById('use-potion'),
  toggleChair: document.getElementById('toggle-chair'),
  commandModal: document.getElementById('command-modal'),
  commandGrid: document.getElementById('command-grid'),
  commandNote: document.getElementById('command-note'),
  mapModal: document.getElementById('map-modal'),
  pauseScreen: document.getElementById('pause-screen'),
  deathScreen: document.getElementById('death-screen'),
  deathText: document.getElementById('death-text'),
  damageFlash: document.getElementById('damage-flash'),
  eyeBlind: document.getElementById('eye-blind'),
  selftestResults: document.getElementById('selftest-results')
};

let W = 1, H = 1, DPR = 1, FOCAL = 800;

function resizeCanvas() {
  DPR = Math.min(window.devicePixelRatio || 1, 1.75);
  W = Math.max(1, window.innerWidth);
  H = Math.max(1, window.innerHeight);
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  FOCAL = H * 0.84;
}
window.addEventListener('resize', resizeCanvas);

/* ------------------------------ game state ------------------------------ */

const G = {
  mode: 'menu',
  preview: false,
  faction: 'guard',
  side: 'empire',
  selectedFaction: null,
  time: 0,
  worldTime: 0,
  hour: 16.2,
  player: null,
  actors: [],
  corpses: [],
  trees: [],
  rocks: [],
  buildings: [],
  fires: [],
  caravans: [],
  particles: [],
  labels: [],
  items: [],
  camera: { yaw: 0.2, pitch: -0.16, dist: 8.8, shake: 0 },
  quest: null,
  questChain: [],
  rep: { elf: 0, empire: 0, villain: 0, human: 0 },
  loyalty: 55,
  nextRaid: 95,
  nextCaravan: 0,
  lastCombat: 0,
  lastSave: 0,
  stats: { kills: 0, robbed: 0, deaths: 0, orders: 0 },
  messages: [],
  armyOrder: 'follow',
  alliesSpawned: 0,
  paused: false,
  currentZone: 'human',
  interaction: null,
  uiTime: 0,
  fps: 0,
  frameCount: 0,
  fpsTime: 0,
  testMode: false
};

const keys = Object.create(null);
let nextActorId = 1;
let nextParticleId = 1;
let lastFrame = performance.now();

/* --------------------------- terrain generation ------------------------- */

function addBuilding(type, x, z, w, d, h, yaw = 0, opts = {}) {
  const building = {
    type, x, z, w, d, h, yaw,
    solid: opts.solid !== false,
    label: opts.label || '',
    wood: opts.wood || '#5b4028',
    roof: opts.roof || '#34462f',
    stone: opts.stone || '#77756d',
    accent: opts.accent || '#a57c3f',
    banner: opts.banner || '#7f3032'
  };
  G.buildings.push(building);
  return building;
}

function buildTerrain() {
  G.trees = [];
  G.rocks = [];
  G.buildings = [];
  G.fires = [];

  /* --- эльфийская деревня: деревянные дома --- */
  addBuilding('hut', 318, 270, 9, 7, 4.0, 0.16, { label: 'Дом Лиэна', roof: '#3a5534', wood: '#62422b' });
  addBuilding('hut', 520, 285, 8.5, 7.5, 4.2, -0.25, { label: 'Дом Талии', roof: '#405e37', wood: '#563a27' });
  addBuilding('hut', 292, 432, 8, 6.5, 3.7, 0.33, { label: 'Коптильня', roof: '#354b32', wood: '#68482f' });
  addBuilding('hut', 540, 432, 9.5, 7, 4.4, -0.12, { label: 'Дом Совета', roof: '#46643c', wood: '#5f3e28' });
  addBuilding('hut', 420, 505, 8, 6, 3.8, 0.02, { label: 'Охотничий склад', roof: '#3b5234', wood: '#6c4a30' });
  addBuilding('well', 410, 360, 3.2, 3.2, 2.2, 0, { solid: true, stone: '#6d6c64', roof: '#413a2c' });

  /* --- люди: Вольная Марка --- */
  addBuilding('shop', 430, 1000, 11, 8, 5.0, 0, { label: 'Лавка Тобиаса', roof: '#6d4c2e', wood: '#715033', accent: '#d3ad5d' });
  addBuilding('tavern', 567, 1090, 14, 10, 5.6, 0, { label: 'Пьяный тракт', roof: '#61422e', wood: '#64452d', accent: '#c58e40' });
  addBuilding('house', 349, 1125, 9, 7, 4.2, 0, { label: 'Дом мельника', roof: '#5c432c', wood: '#674930' });
  addBuilding('house', 612, 982, 8.5, 7, 4.1, 0, { label: 'Дом кожевника', roof: '#65472d', wood: '#754f31' });
  addBuilding('house', 300, 975, 8, 6, 3.8, 0, { label: 'Амбар', roof: '#4f3c2a', wood: '#5b422b' });
  addBuilding('well', 480, 1064, 3.1, 3.1, 2.0, 0, { stone: '#77746a', roof: '#4a3b29' });
  addBuilding('tent', 884, 755, 7, 7, 4.0, 0.2, { solid: false, roof: '#8a6c43', wood: '#725636', label: 'Придорожный торг' });

  /* --- дворец императора --- */
  addBuilding('wall', 1226, 1034, 20, 252, 7.5, 0, { stone: '#8d877b' });
  addBuilding('wall', 1534, 1034, 20, 252, 7.5, 0, { stone: '#8d877b' });
  addBuilding('wall', 1380, 922, 328, 20, 7.5, 0, { stone: '#8d877b' });
  addBuilding('wall', 1270, 1150, 100, 20, 7.5, 0, { stone: '#8d877b' });
  addBuilding('wall', 1490, 1150, 100, 20, 7.5, 0, { stone: '#8d877b' });
  addBuilding('tower', 1226, 922, 24, 24, 18, 0, { stone: '#969083', accent: '#8b3032' });
  addBuilding('tower', 1534, 922, 24, 24, 18, 0, { stone: '#969083', accent: '#8b3032' });
  addBuilding('tower', 1226, 1150, 24, 24, 16, 0, { stone: '#969083', accent: '#8b3032' });
  addBuilding('tower', 1534, 1150, 24, 24, 16, 0, { stone: '#969083', accent: '#8b3032' });
  addBuilding('tower', 1322, 1150, 19, 19, 14, 0, { stone: '#8f897d', accent: '#9b3835' });
  addBuilding('tower', 1438, 1150, 19, 19, 14, 0, { stone: '#8f897d', accent: '#9b3835' });
  addBuilding('keep', 1380, 1022, 104, 82, 24, 0, { stone: '#9b9487', roof: '#785d35', accent: '#9f3436', label: 'Императорский дворец' });
  addBuilding('house', 1285, 1060, 13, 8, 5.5, 0, { stone: '#847d71', roof: '#6c5132', label: 'Казарма' });
  addBuilding('house', 1474, 1062, 12, 8, 5.2, 0, { stone: '#847d71', roof: '#6c5132', label: 'Оружейная' });

  /* --- старый форт Морвейна --- */
  addBuilding('wall', 1218, 326, 18, 226, 7.8, 0, { stone: '#65615c' });
  addBuilding('wall', 1502, 326, 18, 226, 7.8, 0, { stone: '#65615c' });
  addBuilding('wall', 1360, 215, 302, 18, 7.8, 0, { stone: '#65615c' });
  addBuilding('wall', 1267, 432, 80, 18, 7.8, 0, { stone: '#65615c' });
  addBuilding('wall', 1453, 432, 80, 18, 7.8, 0, { stone: '#65615c' });
  addBuilding('tower', 1218, 215, 25, 25, 19, 0, { stone: '#6d6964', accent: '#7e3d4d' });
  addBuilding('tower', 1502, 215, 25, 25, 19, 0, { stone: '#6d6964', accent: '#7e3d4d' });
  addBuilding('tower', 1218, 432, 22, 22, 16, 0, { stone: '#6d6964', accent: '#7e3d4d' });
  addBuilding('tower', 1502, 432, 22, 22, 16, 0, { stone: '#6d6964', accent: '#7e3d4d' });
  addBuilding('tower', 1320, 432, 18, 18, 13, 0, { stone: '#625e59', accent: '#7e3d4d' });
  addBuilding('tower', 1400, 432, 18, 18, 13, 0, { stone: '#625e59', accent: '#7e3d4d' });
  addBuilding('keep', 1360, 300, 88, 68, 21, 0, { stone: '#716c65', roof: '#3d3534', accent: '#7f3443', label: 'Старый форт' });
  addBuilding('house', 1262, 305, 12, 8, 4.8, 0, { stone: '#67625c', roof: '#45383a', label: 'Казарма форта' });
  addBuilding('house', 1460, 305, 12, 8, 4.8, 0, { stone: '#67625c', roof: '#45383a', label: 'Пыточная' });

  /* --- руины у перекрёстка --- */
  addBuilding('tower', 940, 642, 10, 10, 8, 0, { solid: true, stone: '#6f6a5d', accent: '#5f5747', label: 'Старая башня' });

  /* --- костры --- */
  G.fires.push({ x: 410, z: 405 }, { x: 482, z: 1032 }, { x: 1380, z: 1205 }, { x: 902, z: 704 }, { x: 1360, z: 470 });

  generateTrees();
  generateRocks();
}

function clearOfBuildings(x, z, pad) {
  for (const b of G.buildings) {
    if (b.type === 'tent') continue;
    const hw = b.w * 0.5 + pad, hd = b.d * 0.5 + pad;
    if (Math.abs(x - b.x) < hw && Math.abs(z - b.z) < hd) return false;
  }
  return true;
}

function generateTrees() {
  const rng = mulberry32(1017);
  const counts = { elf: 430, empire: 105, human: 120, villain: 48 };
  const clearings = [
    { x: 430, z: 370, r: 28 }, { x: 480, z: 1040, r: 24 },
    { x: 1380, z: 1080, r: 30 }, { x: 1360, z: 360, r: 28 }, { x: 900, z: 700, r: 20 }
  ];
  const starts = Object.values(FACTIONS).map(f => f.start);

  for (const zone of ZONES) {
    const count = counts[zone.id] || 80;
    let placed = 0, guard = 0;
    while (placed < count && guard++ < count * 8) {
      const ang = rng() * TAU;
      const rad = Math.sqrt(rng()) * zone.r;
      const x = clamp(zone.x + Math.cos(ang) * rad, 25, WORLD.w - 25);
      const z = clamp(zone.z + Math.sin(ang) * rad, 25, WORLD.h - 25);
      if (roadDistance(x, z) < 13) continue;
      if (!clearOfBuildings(x, z, 6)) continue;
      if (clearings.some(c => dist2d(x, z, c.x, c.z) < c.r)) continue;
      if (starts.some(s => dist2d(x, z, s.x, s.z) < 12)) continue;
      if (G.trees.some(t => distSq(x, z, t.x, t.z) < 20)) continue;
      const size = 0.72 + rng() * 0.8;
      G.trees.push({
        x, z, size,
        h: (7.5 + rng() * 4.8) * size,
        variant: Math.floor(rng() * 3),
        lean: (rng() - 0.5) * 0.12,
        zone: zone.id
      });
      placed++;
    }
  }

  // Лесная кайма по краям карты.
  for (let i = 0; i < 130; i++) {
    const side = i % 4;
    let x, z;
    if (side === 0) { x = 20 + rng() * (WORLD.w - 40); z = 18 + rng() * 52; }
    else if (side === 1) { x = 20 + rng() * (WORLD.w - 40); z = WORLD.h - 18 - rng() * 52; }
    else if (side === 2) { x = 18 + rng() * 52; z = 20 + rng() * (WORLD.h - 40); }
    else { x = WORLD.w - 18 - rng() * 52; z = 20 + rng() * (WORLD.h - 40); }
    if (roadDistance(x, z) < 12) continue;
    G.trees.push({ x, z, size: 0.9 + rng() * 0.65, h: 9 + rng() * 5, variant: Math.floor(rng() * 3), lean: 0, zone: 'edge' });
  }
}

function generateRocks() {
  const rng = mulberry32(7101);
  for (let i = 0; i < 54; i++) {
    const ang = rng() * TAU;
    const rad = 90 + rng() * 470;
    const x = clamp(1350 + Math.cos(ang) * rad, 35, WORLD.w - 35);
    const z = clamp(350 + Math.sin(ang) * rad, 35, WORLD.h - 35);
    if (roadDistance(x, z) < 16 || !clearOfBuildings(x, z, 5)) continue;
    const size = 0.7 + rng() * 2.1;
    G.rocks.push({ x, z, size, h: size * (0.6 + rng() * 0.7), yaw: rng() * TAU });
  }
}

/* ------------------------------- actors --------------------------------- */

function makeActor(role, x, z, opts = {}) {
  const def = ROLE_DEFS[role] || ROLE_DEFS.imperial_soldier;
  const faction = opts.faction || def.faction;
  const hp = opts.hp || def.hp;
  return {
    id: nextActorId++,
    role,
    faction,
    name: opts.name || def.name,
    x, z, y: 0,
    homeX: x, homeZ: z,
    yaw: opts.yaw !== undefined ? opts.yaw : Math.random() * TAU,
    hp, maxHp: hp,
    speed: opts.speed || def.speed,
    damage: def.dmg,
    detect: opts.detect !== undefined ? opts.detect : def.detect,
    peaceful: opts.peaceful !== undefined ? opts.peaceful : def.peaceful,
    scale: def.scale || 1,
    elite: !!def.elite,
    raid: !!def.raid || !!opts.raid,
    outlaw: !!def.outlaw,
    gold: opts.gold !== undefined ? opts.gold : def.gold,
    aggroPlayer: false,
    aggroActorId: null,
    attackCd: 0.3 + Math.random() * 0.6,
    walkPhase: Math.random() * TAU,
    state: 'idle',
    dead: false,
    deadTime: 0,
    moving: false,
    targetX: x, targetZ: z,
    wanderCd: Math.random() * 4,
    raidTarget: opts.raidTarget || null,
    follow: !!opts.follow,
    caravanId: opts.caravanId || null,
    looted: false,
    commander: !!opts.commander,
    notable: !!opts.notable
  };
}

function circleBlocked(x, z, radius = 0.38) {
  if (x < 14 + radius || x > WORLD.w - 14 - radius || z < 14 + radius || z > WORLD.h - 14 - radius) return true;
  for (const b of G.buildings) {
    if (!b.solid) continue;
    if (Math.abs(x - b.x) < b.w * 0.5 + radius && Math.abs(z - b.z) < b.d * 0.5 + radius) return true;
  }
  for (const t of G.trees) {
    if (Math.abs(x - t.x) > 1.5 || Math.abs(z - t.z) > 1.5) continue;
    if (distSq(x, z, t.x, t.z) < (0.44 * t.size + radius) ** 2) return true;
  }
  for (const r of G.rocks) {
    if (Math.abs(x - r.x) > 3 || Math.abs(z - r.z) > 3) continue;
    if (distSq(x, z, r.x, r.z) < (r.size * 0.58 + radius) ** 2) return true;
  }
  return false;
}

function actorPalette(actor) {
  return PALETTES[actor.faction] || PALETTES.human;
}

function playerSide() {
  return G.side;
}

function factionsEnemy(a, b) {
  if (!a || !b || a === b) return false;
  return (BASE_ENEMIES[a] || []).includes(b);
}

function isHostileToPlayer(actor) {
  if (!actor || actor.dead || !G.player) return false;
  if (actor.aggroPlayer) return true;
  if (actor.faction === G.side) return false;
  if (actor.outlaw) return true;
  if (actor.peaceful) return false;
  return factionsEnemy(actor.faction, G.side);
}

function isAllyOfPlayer(actor) {
  return actor && !actor.dead && actor.faction === G.side;
}

function findNearestHostileActor(actor, maxDist) {
  let best = null, bestD = maxDist * maxDist;
  for (const other of G.actors) {
    if (other === actor || other.dead || other.faction === actor.faction) continue;
    if (!factionsEnemy(actor.faction, other.faction)) continue;
    if (other.peaceful && !other.aggroPlayer && !other.aggroActorId) continue;
    const d = distSq(actor.x, actor.z, other.x, other.z);
    if (d < bestD) { bestD = d; best = other; }
  }
  return best;
}

function moveActorToward(actor, tx, tz, dt, stopDist = 1.7) {
  const dx = tx - actor.x, dz = tz - actor.z;
  const d = Math.hypot(dx, dz);
  if (d <= stopDist) { actor.moving = false; return d; }
  const speed = actor.speed;
  const nx = clamp(actor.x + dx / d * speed * dt, 22, WORLD.w - 22);
  const nz = clamp(actor.z + dz / d * speed * dt, 22, WORLD.h - 22);
  if (!circleBlocked(nx, actor.z, 0.27)) actor.x = nx;
  if (!circleBlocked(actor.x, nz, 0.27)) actor.z = nz;
  actor.yaw = Math.atan2(dx, dz);
  actor.walkPhase += dt * 9;
  actor.moving = true;
  return d;
}

function damageActor(actor, amount, source = 'player') {
  if (!actor || actor.dead) return;
  actor.hp -= amount;
  actor.aggroPlayer = source === 'player';
  if (actor.hp <= 0) {
    actor.hp = 0;
    actor.dead = true;
    actor.deadTime = 0;
    actor.moving = false;
    G.stats.kills++;
    if (source === 'player' && G.player) {
      const loot = actor.gold || 0;
      actor.looted = true;
      G.player.gold += loot;
      toast(actor.name + ' повержен. Добыча: ' + loot + ' ¤', 'gold');
      if (loot) spawnBurst(actor.x, 1.1, actor.z, '#dfb85d', 13, 2.6);
      progressQuest('kill', actor);
      if (actor.role === 'imperial_guard' || actor.role === 'imperial_soldier' || actor.role === 'imperial_commander') {
        if (G.faction === 'guard') changeLoyalty(-18, 'Вы подняли руку на своих.');
      }
    }
    spawnBurst(actor.x, 1.0, actor.z, '#8f2822', 18, 2.2);
  } else {
    spawnBurst(actor.x, 1.1, actor.z, '#a52f28', 8, 1.6);
  }
}

function injurePlayer(part, cause = 'удар') {
  const p = G.player;
  if (!p || p.dead) return false;
  const injury = p.injuries;
  if (part === 'arm' && !injury.arm) {
    injury.arm = true;
    p.bleeding = Math.max(p.bleeding, 1.2);
    p.prosthetics.arm = false;
    toast('Рука отрублена! ' + cause + '. Нужен бинт, лекарь или протез.', 'bad');
  } else if (part === 'eye' && !injury.eye) {
    injury.eye = true;
    p.bleeding = Math.max(p.bleeding, 0.22);
    p.prosthetics.eye = false;
    toast('Глаз выколот. Половина мира исчезла.', 'bad');
  } else if (part === 'leg' && !injury.leg) {
    injury.leg = true;
    p.bleeding = Math.max(p.bleeding, 0.9);
    p.prosthetics.leg = false;
    p.wheelchairOut = p.wheelchairOwned;
    toast('Нога перебита! Вы можете ползти или сесть в коляску (клавиша 3).', 'bad');
  } else {
    return false;
  }
  p.health = Math.max(1, p.health - 4);
  G.camera.shake = 0.7;
  fluidFlash();
  updateInjuryUI();
  updateHUD();
  return true;
}

function harmPlayer(amount, attacker) {
  const p = G.player;
  if (!p || p.dead || G.mode !== 'playing') return;
  let dmg = amount;
  if (p.blocking && !p.injuries.arm && p.stamina > 3) {
    dmg *= 0.25;
    p.stamina = Math.max(0, p.stamina - 7);
    spawnBurst(p.x, 1.3, p.z, '#d8cfb1', 5, 1.2);
  }
  if (p.armor) dmg *= 0.75;
  dmg = Math.max(1, Math.round(dmg));
  p.health -= dmg;
  p.lastHit = G.time;
  G.lastCombat = G.time;
  G.camera.shake = Math.max(G.camera.shake, 0.45);
  fluidFlash();
  spawnBurst(p.x, 1.1, p.z, '#9e2d25', 6, 1.4);

  const roll = Math.random();
  const injuryChance = attacker && attacker.elite ? 0.17 : 0.085;
  if (roll < injuryChance * 0.42) injurePlayer('eye', 'осколок');
  else if (roll < injuryChance * 1.45) injurePlayer('arm', 'клинок');
  else if (roll < injuryChance * 2.3) injurePlayer('leg', 'тяжёлый удар');

  if (p.health <= 0) die();
  updateHUD();
}

function die() {
  const p = G.player;
  if (!p || p.dead) return;
  p.dead = true;
  p.health = 0;
  G.mode = 'dead';
  G.stats.deaths++;
  releasePointer();
  DOM.deathText.textContent = p.bleeding > 0
    ? 'Кровотечение оказалось сильнее. Бинт, лекарь или протез могли бы сохранить вам жизнь.'
    : 'Раны оказались сильнее. Империя, лес и горы продолжают жить без вас.';
  DOM.deathScreen.hidden = false;
  DOM.hud.style.opacity = '0.35';
  updateHUD();
}

function changeLoyalty(delta, reason) {
  G.loyalty = clamp(G.loyalty + delta, 0, 100);
  if (reason) toast(reason + ' Верность: ' + G.loyalty + '%', delta < 0 ? 'bad' : 'good');
}

/* ------------------------------ caravans -------------------------------- */

const CARAVAN_ROUTES = [
  [{ x: 480, z: 1050 }, { x: 690, z: 860 }, { x: 900, z: 700 }, { x: 1120, z: 865 }, { x: 1270, z: 1040 }, { x: 1460, z: 1050 }, { x: 1380, z: 1120 }, { x: 1000, z: 1080 }, { x: 690, z: 1120 }, { x: 480, z: 1050 }],
  [{ x: 470, z: 380 }, { x: 650, z: 520 }, { x: 900, z: 700 }, { x: 930, z: 1050 }, { x: 700, z: 1140 }, { x: 480, z: 1050 }, { x: 650, z: 800 }, { x: 470, z: 380 }],
  [{ x: 1320, z: 465 }, { x: 1110, z: 585 }, { x: 900, z: 700 }, { x: 1050, z: 1120 }, { x: 1300, z: 1120 }, { x: 1460, z: 1000 }, { x: 1120, z: 865 }, { x: 1320, z: 465 }]
];

function makeCaravan(routeIndex, startIndex = 0, opts = {}) {
  const route = CARAVAN_ROUTES[routeIndex];
  const start = route[startIndex];
  const caravan = {
    id: 'caravan_' + routeIndex + '_' + Math.floor(Math.random() * 10000),
    x: start.x + (Math.random() - 0.5) * 8,
    z: start.z + (Math.random() - 0.5) * 8,
    route, routeIndex: (startIndex + 1) % route.length,
    speed: 2.1 + routeIndex * 0.12,
    yaw: 0, gold: 55 + routeIndex * 15,
    robbed: false, smoke: 0,
    guards: []
  };
  G.caravans.push(caravan);
  for (let i = 0; i < 2; i++) {
    const angle = i * Math.PI;
    const guard = makeActor('caravan_guard', caravan.x + Math.cos(angle) * 3.5, caravan.z + Math.sin(angle) * 3.5, {
      caravanId: caravan.id,
      name: 'Охранник каравана'
    });
    guard.followCaravan = true;
    G.actors.push(guard);
    caravan.guards.push(guard.id);
  }
  return caravan;
}

function updateCaravans(dt) {
  for (const c of G.caravans) {
    if (c.robbed) {
      c.smoke += dt;
      if (Math.random() < dt * 2.8) {
        spawnParticle(c.x + (Math.random() - 0.5) * 2.5, 1.5 + Math.random(), c.z + (Math.random() - 0.5) * 2, 0, 0.4, 0, '#554d47', 1.5, 1.1);
      }
      continue;
    }
    const target = c.route[c.routeIndex];
    const dx = target.x - c.x, dz = target.z - c.z;
    const d = Math.hypot(dx, dz);
    if (d < 2.2) {
      c.routeIndex = (c.routeIndex + 1) % c.route.length;
    } else {
      c.yaw = Math.atan2(dx, dz);
      c.x += dx / d * c.speed * dt;
      c.z += dz / d * c.speed * dt;
    }
    for (const gid of c.guards) {
      const guard = G.actors.find(a => a.id === gid);
      if (guard && !guard.dead && !guard.aggroPlayer) {
        const dg = dist2d(guard.x, guard.z, c.x, c.z);
        if (dg > 4.5) moveActorToward(guard, c.x, c.z, dt, 3.4);
        else guard.moving = false;
      }
    }
  }
}

/* --------------------------- initial world spawn ------------------------ */

function makePlayer(choice) {
  const info = FACTIONS[choice];
  return {
    x: info.start.x, z: info.start.z, y: 0, vy: 0,
    yaw: info.start.yaw,
    health: 100, maxHealth: 100, stamina: 100,
    gold: 38,
    injuries: { arm: false, eye: false, leg: false },
    prosthetics: { arm: false, eye: false, leg: false },
    eyepatch: false,
    wheelchairOwned: false,
    wheelchairOut: false,
    bleeding: 0,
    bandages: 1, potions: 0,
    armor: false, swordBonus: 0,
    attackCd: 0, attackAnim: 0, blocking: false,
    moving: false, walkPhase: 0,
    lastHit: -99, dead: false, rodeCaravan: false
  };
}

function spawnInitialActors() {
  G.actors = [];
  G.corpses = [];
  G.caravans = [];

  // Торговцы и мирные жители.
  G.actors.push(makeActor('merchant', 437, 1028, { name: 'Тобиас, торговец', notable: true, yaw: 0.3 }));
  G.actors.push(makeActor('merchant', 886, 742, { name: 'Придорожный торговец', notable: true, yaw: -0.4 }));
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * TAU;
    G.actors.push(makeActor('villager', 485 + Math.cos(a) * (26 + i * 2), 1045 + Math.sin(a) * (18 + i), { name: 'Поселянин' }));
  }
  G.actors.push(makeActor('imperial_commander', 1380, 1196, { name: 'Командир Арден', commander: true, notable: true, yaw: Math.PI, peaceful: true }));
  G.actors.push(makeActor('elf_elder', 404, 462, { name: 'Старейшина Лиэн', notable: true, yaw: 0.2, peaceful: true }));
  G.actors.push(makeActor('villain_warlord', 1360, 468, { name: 'Воевода Грим', notable: true, yaw: Math.PI, peaceful: true }));

  // Постоянные гарнизоны.
  const guards = [
    [1300, 1105], [1460, 1105], [1300, 980], [1460, 980], [1380, 1115], [1370, 960]
  ];
  for (const [x, z] of guards) G.actors.push(makeActor('imperial_guard', x, z, { yaw: Math.random() * TAU }));

  const elfGuards = [[350, 350], [515, 350], [345, 470], [520, 480]];
  for (const [x, z] of elfGuards) G.actors.push(makeActor('elf_guard', x, z, { yaw: Math.random() * TAU }));

  const villainGuards = [[1300, 350], [1430, 350], [1300, 390], [1420, 395]];
  for (const [x, z] of villainGuards) G.actors.push(makeActor('villain_soldier', x, z, { yaw: Math.random() * TAU }));

  // Патрули и дорожные угрозы.
  G.actors.push(makeActor('imperial_soldier', 720, 845, { yaw: 1.1 }));
  G.actors.push(makeActor('imperial_soldier', 760, 875, { yaw: 1.1 }));
  G.actors.push(makeActor('elf_partisan', 650, 465, { yaw: 0.7 }));
  G.actors.push(makeActor('elf_partisan', 690, 440, { yaw: 0.7 }));
  G.actors.push(makeActor('villain_raider', 1110, 570, { yaw: 2.2 }));
  G.actors.push(makeActor('villain_raider', 1150, 600, { yaw: 2.2 }));
  G.actors.push(makeActor('bandit', 850, 420, { yaw: 0.4 }));
  G.actors.push(makeActor('bandit', 1030, 1010, { yaw: 2.6 }));

  makeCaravan(0, 0);
  makeCaravan(1, 2);
  makeCaravan(2, 1);
}

function spawnFactionOpening(choice) {
  if (choice === 'elf') {
    const x = 360, z = 585;
    G.actors.push(makeActor('imperial_raider', x, z, { raidTarget: { x: 430, z: 400 }, aggroPlayer: true, name: 'Имперский каратель' }));
    G.actors.push(makeActor('imperial_raider', x + 14, z + 9, { raidTarget: { x: 430, z: 400 }, aggroPlayer: true, name: 'Имперский каратель' }));
    G.actors.push(makeActor('imperial_soldier', x - 17, z + 5, { raidTarget: { x: 430, z: 400 }, aggroPlayer: true, name: 'Солдат империи' }));
  } else if (choice === 'guard') {
    G.actors.push(makeActor('villain_spy', 1280, 1185, { raidTarget: { x: 1380, z: 1080 }, name: 'Лазутчик Морвейна' }));
    G.actors.push(makeActor('villain_spy', 1480, 1195, { raidTarget: { x: 1380, z: 1080 }, name: 'Лазутчик Морвейна' }));
    G.actors.push(makeActor('elf_partisan', 1220, 1220, { raidTarget: { x: 1380, z: 1080 }, name: 'Партизан-эльф' }));
  } else {
    G.actors.push(makeActor('elf_spy', 1300, 535, { raidTarget: { x: 1360, z: 360 }, name: 'Эльфийский шпион' }));
    G.actors.push(makeActor('elf_spy', 1430, 540, { raidTarget: { x: 1360, z: 360 }, name: 'Эльфийский шпион' }));
    G.actors.push(makeActor('elf_partisan', 1500, 600, { raidTarget: { x: 1360, z: 360 }, name: 'Партизан-эльф' }));
  }
}

/* ------------------------------- quests --------------------------------- */

const QUEST_CHAINS = {
  elf: [
    { id: 'elf_1', title: 'Щит леса', desc: 'Имперские каратели идут к деревянной деревне. Убейте 3 врагов у дома.', type: 'kill', target: 'empire', need: 3, reward: 70 },
    { id: 'elf_2', title: 'Хлеб и золото', desc: 'Ограбьте караван людей: подойдите к повозке и нажмите E.', type: 'rob', need: 1, reward: 90 },
    { id: 'elf_3', title: 'Тень над фортом', desc: 'Налётчики Морвейна жгут лес. Убейте 4 злодеев.', type: 'kill', target: 'villain', need: 4, reward: 130 },
    { id: 'elf_free', title: 'Вольный лес', desc: 'Защищайте княжество. Любой враг у деревни — законная цель.', type: 'kill', target: 'any', need: 6, reward: 120, repeat: true }
  ],
  guard: [
    { id: 'guard_1', title: 'Голос командира', desc: 'Подойдите к командиру Ардену у ворот дворца и получите приказ (E).', type: 'talk', need: 1, reward: 0 },
    { id: 'guard_free', title: 'Служба империи', desc: 'Командир ждёт у ворот. Получите новый приказ (E) или защищайте дворец.', type: 'talk', need: 1, reward: 0, repeat: true }
  ],
  villain: [
    { id: 'vill_1', title: 'Своя воля', desc: 'Откройте военный совет (V) и отдайте первый приказ войску.', type: 'command', need: 1, reward: 40 },
    { id: 'vill_2', title: 'Железо и пламя', desc: 'Ведите отряд на дворец. Убейте 5 имперских стражей.', type: 'kill', target: 'empire', need: 5, reward: 170 },
    { id: 'vill_3', title: 'Лесная кара', desc: 'Эльфы смеются над старым фортом. Убейте 4 эльфов.', type: 'kill', target: 'elf', need: 4, reward: 150 },
    { id: 'vill_free', title: 'Владыка пограничья', desc: 'Делайте что хотите: грабьте караваны, жгите посты, берите золото.', type: 'kill', target: 'any', need: 8, reward: 160, repeat: true }
  ]
};

const COMMANDER_ORDERS = [
  { title: 'Саботаж у дворца', desc: 'Лазутчики Морвейна замечены у южной стены. Убейте 3 врагов.', type: 'kill', target: 'villain', need: 3, reward: 80, spawn: { role: 'villain_spy', x: 1300, z: 1215, count: 4, tx: 1380, tz: 1080 } },
  { title: 'Эльфийские партизаны', desc: 'Партизаны перерезали дорогу к дворцу. Убейте 3 эльфов.', type: 'kill', target: 'elf', need: 3, reward: 85, spawn: { role: 'elf_partisan', x: 1190, z: 1110, count: 4, tx: 1380, tz: 1080 } },
  { title: 'Набег на лес', desc: 'Командир приказал наказать лесное княжество. Убейте 3 эльфов у деревни.', type: 'kill', target: 'elf', need: 3, reward: 95, spawn: { role: 'elf_guard', x: 600, z: 530, count: 3, tx: 460, tz: 380 } }
];

function cloneQuest(q) {
  return Object.assign({}, q, { progress: 0, complete: false });
}

function selectFactionQuest(choice) {
  G.questChain = QUEST_CHAINS[choice].map(cloneQuest);
  G.quest = G.questChain.shift() || null;
  updateQuestUI();
}

function setQuest(quest) {
  G.quest = quest ? cloneQuest(quest) : null;
  updateQuestUI();
}

function progressQuest(kind, actor) {
  const q = G.quest;
  if (!q || q.complete) return;
  let matches = false;
  if (q.type === kind) {
    if (kind === 'kill') {
      if (q.target === 'any') matches = actor && actor.faction !== G.side && !actor.peaceful;
      else matches = actor && actor.faction === q.target;
    } else {
      matches = true;
    }
  }
  if (!matches) return;
  q.progress = (q.progress || 0) + 1;
  if (q.progress >= q.need) completeQuest();
  else {
    updateQuestUI();
    toast('Прогресс: ' + q.progress + ' / ' + q.need, 'good');
  }
}

function completeQuest() {
  const q = G.quest;
  if (!q || q.complete) return;
  q.complete = true;
  G.player.gold += q.reward || 0;
  G.rep[G.side] = clamp((G.rep[G.side] || 0) + 2, -100, 100);
  if (G.faction === 'guard') changeLoyalty(9, 'Приказ выполнен.');
  toast('Поручение выполнено: ' + q.title + (q.reward ? ' · +' + q.reward + ' ¤' : ''), 'gold');
  updateHUD();
  const next = G.questChain.shift();
  if (next) {
    G.quest = next;
    updateQuestUI();
    toast('Новое поручение: ' + next.title, 'good');
  } else {
    G.quest = null;
    updateQuestUI();
    toast('Свободная игра. Карта открыта, караваны едут.', 'good');
  }
  autoSave();
}

function updateQuestUI() {
  const q = G.quest;
  if (!q) {
    DOM.questTitle.textContent = 'Свободная игра';
    DOM.questDesc.textContent = 'Границы открыты. Ищите приключения, торговцев и добычу.';
    DOM.questProgress.style.width = '0%';
    return;
  }
  DOM.questTitle.textContent = q.title;
  DOM.questDesc.textContent = q.desc;
  DOM.questProgress.style.width = Math.min(100, (q.progress || 0) / q.need * 100) + '%';
}

/* --------------------------- spawn helpers ------------------------------ */

function spawnBurst(x, y, z, color, count = 10, power = 2) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * TAU, up = Math.random() * power;
    spawnParticle(x, y, z, Math.cos(a) * power * (0.3 + Math.random()), up, Math.sin(a) * power * (0.3 + Math.random()), color, 0.35 + Math.random() * 0.6, 0.045 + Math.random() * 0.06);
  }
}

function spawnParticle(x, y, z, vx, vy, vz, color, life = 0.7, size = 0.08) {
  G.particles.push({ id: nextParticleId++, x, y, z, vx, vy, vz, color, life, maxLife: life, size });
  if (G.particles.length > 340) G.particles.shift();
}

function spawnRaid() {
  if (G.mode !== 'playing' || !G.player) return;
  let role, count, targetX, targetZ, message;
  if (G.faction === 'elf') {
    role = Math.random() < 0.55 ? 'imperial_raider' : 'villain_raider';
    count = 3; targetX = 430; targetZ = 380;
    message = 'Тревога! На деревню идёт набег.';
  } else if (G.faction === 'guard') {
    role = Math.random() < 0.58 ? 'villain_spy' : 'elf_partisan';
    count = 3; targetX = 1380; targetZ = 1080;
    message = 'Тревога! Шпионы и партизаны у дворца.';
  } else {
    role = Math.random() < 0.62 ? 'elf_partisan' : 'imperial_soldier';
    count = 3; targetX = 1360; targetZ = 380;
    message = 'Тревога! К форту подбирается вражеский отряд.';
  }
  const angle = Math.random() * TAU;
  const sx = clamp(targetX + Math.cos(angle) * 41, 40, WORLD.w - 40);
  const sz = clamp(targetZ + Math.sin(angle) * 41, 40, WORLD.h - 40);
  for (let i = 0; i < count; i++) {
    G.actors.push(makeActor(role, sx + (Math.random() - 0.5) * 12, sz + (Math.random() - 0.5) * 12, {
      raidTarget: { x: targetX, z: targetZ },
      name: role === 'imperial_raider' ? 'Имперский каратель' : role === 'villain_spy' ? 'Лазутчик Морвейна' : role === 'elf_partisan' ? 'Партизан-эльф' : 'Налётчик'
    }));
  }
  toast(message, 'bad');
  G.nextRaid = 100 + Math.random() * 55;
}

function spawnOrderEnemies(order) {
  if (!order || !order.spawn) return;
  const s = order.spawn;
  for (let i = 0; i < s.count; i++) {
    G.actors.push(makeActor(s.role, s.x + (Math.random() - 0.5) * 15, s.z + (Math.random() - 0.5) * 15, {
      raidTarget: { x: s.tx ?? 1380, z: s.tz ?? 1080 },
      name: ROLE_DEFS[s.role].name
    }));
  }
}

/* ----------------------------- setup world ------------------------------ */

function resetWorld(choice, preview = false) {
  G.faction = choice;
  G.side = FACTIONS[choice].side;
  G.selectedFaction = choice;
  G.preview = preview;
  G.time = 0;
  G.worldTime = 0;
  G.hour = 16.2;
  G.player = makePlayer(choice);
  G.mode = preview ? 'menu' : 'playing';
  G.paused = false;
  G.particles = [];
  G.labels = [];
  G.items = [];
  G.stats = { kills: 0, robbed: 0, deaths: 0, orders: 0 };
  G.loyalty = 55;
  G.nextRaid = 105;
  G.lastCombat = -99;
  G.lastSave = 0;
  G.armyOrder = 'follow';
  G.alliesSpawned = 0;
  G.rep = {
    elf: choice === 'elf' ? 35 : choice === 'guard' ? -15 : -25,
    empire: choice === 'guard' ? 35 : choice === 'elf' ? -20 : -35,
    villain: choice === 'villain' ? 35 : -20,
    human: choice === 'elf' ? 5 : choice === 'guard' ? 15 : -5
  };
  G.camera.yaw = G.player.yaw;
  G.camera.pitch = -0.16;
  G.camera.dist = 8.8;
  G.camera.shake = 0;

  buildTerrain();
  spawnInitialActors();
  if (!preview) {
    spawnFactionOpening(choice);
    selectFactionQuest(choice);
  } else {
    G.quest = null;
    selectFactionQuest(choice);
  }

  G.currentZone = nearestZone(G.player.x, G.player.z).id;
  updateHUD();
  updateInjuryUI();
  updateZoneUI(true);
}

function beginGame(choice, options = {}) {
  if (!FACTIONS[choice]) return;
  for (const k of Object.keys(keys)) keys[k] = false;
  resetWorld(choice, false);
  G.mode = 'playing';
  DOM.startScreen.hidden = true;
  DOM.deathScreen.hidden = true;
  DOM.pauseScreen.hidden = true;
  DOM.hud.style.opacity = '1';
  DOM.screenHint.textContent = '';
  if (!options.silent) {
    toast(FACTIONS[choice].intro, 'good');
    setTimeout(() => toast('WASD — движение. ЛКМ — удар. E — действие. Tab — состояние.', 'gold'), 650);
  }
  requestPointerLockSafe();
  setTimeout(() => {
    requestPointerLockSafe();
    if (G.mode === 'playing' && !G.paused && document.pointerLockElement !== canvas) {
      DOM.screenHint.textContent = 'КЛИК ПО ПОЛЮ — ЗАХВАТИТЬ МЫШЬ · ESC — ПАУЗА';
    }
  }, 700);
  updateHUD();
  updateInjuryUI();
  updateZoneUI(true);
}

function menuPreview() {
  resetWorld('guard', true);
  G.camera.yaw = 2.65;
  G.camera.pitch = -0.10;
  G.camera.dist = 12;
}

/* =========================================================================
   RENDERER: камера, небо, земля, объекты и мини-карта
   ========================================================================= */

const CAM = {
  pos: { x: 0, y: 4, z: 0 },
  right: { x: 1, y: 0, z: 0 },
  up: { x: 0, y: 1, z: 0 },
  forward: { x: 0, y: 0, z: 1 }
};

function vSub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function vDot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
function vCross(a, b) { return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }; }
function vNorm(a) {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
}

function updateCameraBasis() {
  const p = G.player;
  if (!p) return;
  const shake = G.camera.shake;
  const shakeX = (Math.random() - 0.5) * shake * 0.18;
  const shakeY = (Math.random() - 0.5) * shake * 0.14;
  const yaw = G.camera.yaw + shakeX;
  const pitch = clamp(G.camera.pitch + shakeY, -0.52, 0.30);
  const cp = Math.cos(pitch);
  const dist = G.camera.dist;
  const focus = {
    x: p.x + Math.sin(yaw) * 1.25,
    y: p.y + 1.34 - (p.wheelchairOut && p.injuries.leg ? 0.25 : 0),
    z: p.z + Math.cos(yaw) * 1.25
  };
  const look = { x: Math.sin(yaw) * cp, y: Math.sin(pitch), z: Math.cos(yaw) * cp };
  CAM.pos = {
    x: focus.x - look.x * dist,
    y: focus.y - look.y * dist,
    z: focus.z - look.z * dist
  };
  if (CAM.pos.y < 0.55) CAM.pos.y = 0.55;
  CAM.forward = vNorm(vSub(focus, CAM.pos));
  CAM.right = vNorm(vCross(CAM.forward, { x: 0, y: 1, z: 0 }));
  CAM.up = vNorm(vCross(CAM.right, CAM.forward));
  if (G.camera.shake > 0) G.camera.shake = Math.max(0, G.camera.shake - 0.035);
}

function toView(x, y, z) {
  const dx = x - CAM.pos.x, dy = y - CAM.pos.y, dz = z - CAM.pos.z;
  return {
    x: dx * CAM.right.x + dy * CAM.right.y + dz * CAM.right.z,
    y: dx * CAM.up.x + dy * CAM.up.y + dz * CAM.up.z,
    z: dx * CAM.forward.x + dy * CAM.forward.y + dz * CAM.forward.z
  };
}

function projectView(v) {
  if (v.z < NEAR) return null;
  return {
    x: W * 0.5 + v.x / v.z * FOCAL,
    y: H * 0.5 - v.y / v.z * FOCAL,
    z: v.z
  };
}

function projectWorld(x, y, z) {
  return projectView(toView(x, y, z));
}

function clipViewPolygon(points) {
  const out = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const a = points[i], b = points[(i + 1) % n];
    const ain = a.z >= NEAR, bin = b.z >= NEAR;
    if (ain) out.push(a);
    if (ain !== bin) {
      const t = (NEAR - a.z) / (b.z - a.z);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: NEAR });
    }
  }
  return out;
}

function fogMix(hex, depth, strength = 0.84) {
  const t = clamp((depth - 88) / 760, 0, 1) * strength;
  return mixHex(hex, FOG_COLOR, t);
}

function drawSkyAndGroundBase() {
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.72);
  sky.addColorStop(0, '#172632');
  sky.addColorStop(0.42, '#40545b');
  sky.addColorStop(0.74, '#8e8772');
  sky.addColorStop(1, '#d3a06b');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H * 0.72);

  // Солнце в мировом направлении.
  const sunDir = vNorm({ x: 0.55, y: 0.38, z: 0.74 });
  const svx = vDot(sunDir, { x: CAM.right.x, y: CAM.right.y, z: CAM.right.z });
  const svy = vDot(sunDir, { x: CAM.up.x, y: CAM.up.y, z: CAM.up.z });
  const svz = vDot(sunDir, { x: CAM.forward.x, y: CAM.forward.y, z: CAM.forward.z });
  if (svz > 0.04) {
    const sx = W * 0.5 + svx / svz * FOCAL;
    const sy = H * 0.5 - svy / svz * FOCAL;
    const glow = ctx.createRadialGradient(sx, sy, 4, sx, sy, Math.min(W, H) * 0.28);
    glow.addColorStop(0, 'rgba(255, 221, 150, 0.55)');
    glow.addColorStop(0.18, 'rgba(255, 186, 98, 0.18)');
    glow.addColorStop(1, 'rgba(255, 166, 80, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H * 0.82);
    ctx.beginPath();
    ctx.arc(sx, sy, Math.min(W, H) * 0.026, 0, TAU);
    ctx.fillStyle = 'rgba(255, 233, 181, 0.82)';
    ctx.fill();
  }

  // Горизонт.
  const hf = vNorm({ x: CAM.forward.x, y: 0, z: CAM.forward.z });
  let horizon = H * 0.46;
  const hp = projectWorld(CAM.pos.x + hf.x * 5000, CAM.pos.y, CAM.pos.z + hf.z * 5000);
  if (hp) horizon = clamp(hp.y, H * 0.24, H * 0.72);

  // Дальние горы — две полупрозрачные гряды с параллаксом от поворота камеры.
  const yawShift = G.camera.yaw;
  drawMountainLayer(horizon + 2, 52, 0.007, yawShift * 0.55, 'rgba(43, 58, 61, 0.43)', 0.24);
  drawMountainLayer(horizon + 10, 32, 0.012, yawShift * 0.92, 'rgba(31, 46, 46, 0.62)', 0.30);

  const ground = ctx.createLinearGradient(0, horizon, 0, H);
  ground.addColorStop(0, 'rgba(74, 81, 59, 0.84)');
  ground.addColorStop(0.35, '#46513a');
  ground.addColorStop(1, '#252f26');
  ctx.fillStyle = ground;
  ctx.fillRect(0, horizon, W, H - horizon);
  return horizon;
}

function drawMountainLayer(baseY, height, freq, shift, color, alpha) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-20, baseY + 10);
  for (let x = -20; x <= W + 40; x += 25) {
    const v = Math.sin(x * freq + shift * 4.3) * 0.48 + Math.sin(x * freq * 2.7 - shift * 2.1) * 0.28 + Math.sin(x * freq * 0.6 + 1.7) * 0.24;
    const y = baseY - height * (0.55 + v * 0.45) - 10;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W + 40, baseY + 10);
  ctx.closePath();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function groundColorAt(x, z) {
  const zone = nearestZone(x, z);
  const n = hash2(Math.floor(x / 47), Math.floor(z / 43));
  let col = shadeHex(zone.ground, 0.86 + n * 0.25);
  const rd = roadDistance(x, z);
  if (rd < 21) col = shadeHex('#79643f', 0.9 + hash2(x, z) * 0.2);
  else if (rd < 31) col = mixHex(col, '#69593c', 0.28);

  if (x > 1238 && x < 1522 && z > 936 && z < 1138) col = shadeHex('#7a766b', 0.88 + n * 0.17);
  if (x > 1230 && x < 1490 && z > 229 && z < 420) col = shadeHex('#69635b', 0.87 + n * 0.18);

  if (zone.id === 'elf' && n > 0.74) col = mixHex(col, '#455f39', 0.45);
  if (zone.id === 'villain' && n > 0.66) col = mixHex(col, '#5d5752', 0.35);
  return col;
}

function drawGroundTiles() {
  const step = 82;
  for (let z = 0; z < WORLD.h; z += step) {
    for (let x = 0; x < WORLD.w; x += step) {
      const cx = x + step * 0.5, cz = z + step * 0.5;
      const vc = toView(cx, 0, cz);
      if (vc.z < NEAR || vc.z > 900) continue;
      const pts = [
        toView(x, 0, z), toView(x + step, 0, z),
        toView(x + step, 0, z + step), toView(x, 0, z + step)
      ];
      const clipped = clipViewPolygon(pts);
      if (clipped.length < 3) continue;
      const spts = clipped.map(projectView);
      if (spts.some(p => !p)) continue;
      ctx.beginPath();
      ctx.moveTo(spts[0].x, spts[0].y);
      for (let i = 1; i < spts.length; i++) ctx.lineTo(spts[i].x, spts[i].y);
      ctx.closePath();
      const color = fogMix(groundColorAt(cx, cz), vc.z, 0.77);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }
}

function drawGroundShadow(x, z, radius, alpha = 0.23) {
  const p = projectWorld(x, 0.025, z);
  if (!p) return;
  const s = FOCAL * radius / p.z;
  if (s < 0.5) return;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, s, s * 0.36, 0, 0, TAU);
  ctx.fillStyle = 'rgba(4, 9, 7, ' + alpha + ')';
  ctx.fill();
}

/* --------------------------- face generators ---------------------------- */

function localPoint(x, z, yaw, lx, ly, lz) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return { x: x + lx * c + lz * s, y: ly, z: z - lx * s + lz * c };
}

function addBox(faces, x, y, z, w, h, d, yaw, color) {
  const hw = w * 0.5, hh = h * 0.5, hd = d * 0.5;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const pts = [
    localPoint(x, z, yaw, -hw, y - hh, -hd),
    localPoint(x, z, yaw, hw, y - hh, -hd),
    localPoint(x, z, yaw, hw, y - hh, hd),
    localPoint(x, z, yaw, -hw, y - hh, hd),
    localPoint(x, z, yaw, -hw, y + hh, -hd),
    localPoint(x, z, yaw, hw, y + hh, -hd),
    localPoint(x, z, yaw, hw, y + hh, hd),
    localPoint(x, z, yaw, -hw, y + hh, hd)
  ];
  faces.push(
    { pts: [pts[4], pts[5], pts[6], pts[7]], color: shadeHex(color, 1.13) },
    { pts: [pts[0], pts[1], pts[5], pts[4]], color: shadeHex(color, 0.93) },
    { pts: [pts[3], pts[2], pts[6], pts[7]], color: shadeHex(color, 0.87) },
    { pts: [pts[0], pts[3], pts[7], pts[4]], color: shadeHex(color, 0.73) },
    { pts: [pts[1], pts[2], pts[6], pts[5]], color: shadeHex(color, 0.82) },
    { pts: [pts[0], pts[1], pts[2], pts[3]], color: shadeHex(color, 0.58) }
  );
}

function addPrismRoof(faces, x, baseY, z, w, d, h, yaw, color, overhang = 1.08) {
  const hw = w * 0.5 * overhang, hd = d * 0.5 * overhang;
  const a = localPoint(x, z, yaw, -hw, baseY, -hd);
  const b = localPoint(x, z, yaw, hw, baseY, -hd);
  const c = localPoint(x, z, yaw, hw, baseY, hd);
  const dpt = localPoint(x, z, yaw, -hw, baseY, hd);
  const r1 = localPoint(x, z, yaw, 0, baseY + h, -hd);
  const r2 = localPoint(x, z, yaw, 0, baseY + h, hd);
  faces.push(
    { pts: [a, dpt, r2, r1], color: shadeHex(color, 0.98) },
    { pts: [b, c, r2, r1], color: shadeHex(color, 0.72) },
    { pts: [a, b, r1], color: shadeHex(color, 0.83) },
    { pts: [dpt, c, r2], color: shadeHex(color, 0.68) }
  );
}

function addCone(faces, x, baseY, z, radius, height, segments, color, yaw = 0) {
  const ring = [];
  for (let i = 0; i < segments; i++) {
    const a = yaw + i / segments * TAU;
    ring.push({ x: x + Math.cos(a) * radius, y: baseY, z: z + Math.sin(a) * radius });
  }
  const apex = { x, y: baseY + height, z };
  for (let i = 0; i < segments; i++) {
    const p1 = ring[i], p2 = ring[(i + 1) % segments];
    const shade = 0.72 + (i % 3) * 0.11;
    faces.push({ pts: [apex, p1, p2], color: shadeHex(color, shade) });
  }
  faces.push({ pts: ring.slice().reverse(), color: shadeHex(color, 0.52) });
}

function addFlatQuad(faces, x, z, w, d, y, color) {
  const hw = w * 0.5, hd = d * 0.5;
  faces.push({ pts: [
    { x: x - hw, y, z: z - hd }, { x: x + hw, y, z: z - hd },
    { x: x + hw, y, z: z + hd }, { x: x - hw, y, z: z + hd }
  ], color });
}

function addBattlementRing(faces, x, baseY, z, w, d, color) {
  const step = 10;
  for (let lx = -w * 0.5 + 2; lx <= w * 0.5 - 2; lx += step) {
    addBox(faces, x + lx, baseY + 0.65, z - d * 0.5 + 1.4, 3.3, 1.3, 2.8, 0, color);
    addBox(faces, x + lx, baseY + 0.65, z + d * 0.5 - 1.4, 3.3, 1.3, 2.8, 0, color);
  }
  for (let lz = -d * 0.5 + 10; lz <= d * 0.5 - 10; lz += step) {
    addBox(faces, x - w * 0.5 + 1.4, baseY + 0.65, z + lz, 2.8, 1.3, 3.3, 0, color);
    addBox(faces, x + w * 0.5 - 1.4, baseY + 0.65, z + lz, 2.8, 1.3, 3.3, 0, color);
  }
}

function buildingFaces(b) {
  if (b._faceCache) return b._faceCache;
  const faces = [];
  const x = b.x, z = b.z, yaw = b.yaw || 0;
  if (b.type === 'hut' || b.type === 'house' || b.type === 'shop' || b.type === 'tavern') {
    addBox(faces, x, b.h * 0.5 + 0.25, z, b.w, b.h, b.d, yaw, b.wood);
    addBox(faces, x, 0.26, z, b.w + 0.4, 0.52, b.d + 0.4, yaw, shadeHex(b.stone, 0.82));
    addPrismRoof(faces, x, b.h + 0.42, z, b.w, b.d, Math.max(2.1, b.w * 0.28), yaw, b.roof, 1.13);
    const door = localPoint(x, z, yaw, 0, 0, b.d * 0.5 + 0.04);
    addBox(faces, door.x, 1.2, door.z, 1.15, 2.3, 0.14, yaw, '#2f2118');
    const win1 = localPoint(x, z, yaw, -b.w * 0.31, 0, b.d * 0.5 + 0.055);
    const win2 = localPoint(x, z, yaw, b.w * 0.31, 0, b.d * 0.5 + 0.055);
    addBox(faces, win1.x, b.h * 0.66, win1.z, 1.0, 1.0, 0.11, yaw, '#d6a85c');
    addBox(faces, win2.x, b.h * 0.66, win2.z, 1.0, 1.0, 0.11, yaw, '#d6a85c');
    if (b.type === 'shop' || b.type === 'tavern') {
      addBox(faces, win1.x, b.h + 1.85, win1.z, 2.8, 1.25, 0.18, yaw, b.accent);
    }
    if (b.type === 'tavern') {
      addBox(faces, x, b.h + 2.95, z, 0.7, 1.5, 0.7, yaw, '#4b3927');
    }
  } else if (b.type === 'wall') {
    addBox(faces, x, b.h * 0.5, z, b.w, b.h, b.d, yaw, b.stone);
    if (b.w > b.d) addBattlementRing(faces, x, b.h, z, b.w, b.d + 0.5, shadeHex(b.stone, 0.92));
    else {
      for (let lz = -b.d * 0.5 + 4; lz <= b.d * 0.5 - 4; lz += 11) {
        addBox(faces, x - b.w * 0.5 + 1.4, b.h + 0.6, z + lz, 2.6, 1.2, 3.2, 0, shadeHex(b.stone, 0.95));
        addBox(faces, x + b.w * 0.5 - 1.4, b.h + 0.6, z + lz, 2.6, 1.2, 3.2, 0, shadeHex(b.stone, 0.9));
      }
    }
  } else if (b.type === 'tower') {
    addBox(faces, x, b.h * 0.5, z, b.w, b.h, b.d, yaw, b.stone);
    addBattlementRing(faces, x, b.h, z, b.w, b.d, shadeHex(b.stone, 0.96));
    const banner = localPoint(x, z, yaw, 0, 0, b.d * 0.5 + 0.08);
    addBox(faces, banner.x, b.h * 0.58, banner.z, b.w * 0.33, b.h * 0.38, 0.12, yaw, b.accent);
    addBox(faces, x, b.h * 0.38, z, b.w * 0.55, 0.55, b.d * 0.55, yaw, b.stone);
  } else if (b.type === 'keep') {
    addBox(faces, x, b.h * 0.5, z, b.w, b.h, b.d, yaw, b.stone);
    addBox(faces, x, 0.4, z, b.w + 1.4, 0.8, b.d + 1.4, yaw, shadeHex(b.stone, 0.68));
    addPrismRoof(faces, x, b.h, z, b.w * 0.83, b.d * 0.82, 5.2, yaw, b.roof, 1.1);
    addBattlementRing(faces, x, b.h + 0.1, z, b.w, b.d, shadeHex(b.stone, 0.98));
    const door = localPoint(x, z, yaw, 0, 0, b.d * 0.5 + 0.08);
    addBox(faces, door.x, 2.1, door.z, 2.0, 4.2, 0.16, yaw, '#2b2018');
    for (let i = -1; i <= 1; i++) {
      const wpos = localPoint(x, z, yaw, i * b.w * 0.27, 0, b.d * 0.5 + 0.08);
      addBox(faces, wpos.x, b.h * 0.65, wpos.z, 1.2, 1.7, 0.14, yaw, '#d3a255');
    }
    for (const side of [-1, 1]) {
      const banner = localPoint(x, z, yaw, side * b.w * 0.39, 0, b.d * 0.5 + 0.12);
      addBox(faces, banner.x, b.h * 0.62, banner.z, 1.1, b.h * 0.43, 0.12, yaw, b.accent);
    }
  } else if (b.type === 'well') {
    addBox(faces, x, 0.55, z, b.w, 1.1, b.d, yaw, b.stone);
    addBox(faces, x, 1.15, z, b.w * 0.72, 0.24, b.d * 0.72, yaw, '#242b26');
    addBox(faces, x - b.w * 0.38, 1.7, z, 0.18, 2.1, 0.18, yaw, '#4f3927');
    addBox(faces, x + b.w * 0.38, 1.7, z, 0.18, 2.1, 0.18, yaw, '#4f3927');
    addPrismRoof(faces, x, 2.7, z, b.w * 1.05, b.d * 0.95, 0.9, yaw, b.roof, 1.2);
  } else if (b.type === 'tent') {
    addCone(faces, x, 0, z, b.w * 0.55, b.h, 8, b.roof, 0.2);
    addBox(faces, x, 0.6, z, 0.16, 1.2, 0.16, 0, '#5c432c');
    addBox(faces, x + 2.2, 1.2, z - 1.4, 2.3, 0.9, 0.1, 0.2, b.accent);
  }
  b._faceCache = faces;
  return faces;
}

/* ------------------------------ tree LOD -------------------------------- */

const TREE_SPRITES = [];

function createTreeSprite(variant) {
  const c = document.createElement('canvas');
  c.width = 180; c.height = 300;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 180, 300);
  if (variant === 0) {
    g.fillStyle = '#4a3424'; g.fillRect(82, 200, 17, 93);
    g.fillStyle = '#1c3328';
    for (let i = 0; i < 5; i++) {
      const y = 54 + i * 35, w = 44 + i * 16;
      g.beginPath(); g.moveTo(90, y - 48); g.lineTo(90 - w, y + 40); g.lineTo(90 + w, y + 40); g.closePath(); g.fill();
    }
    g.fillStyle = 'rgba(92, 132, 83, 0.52)';
    for (let i = 0; i < 5; i++) {
      const y = 54 + i * 35, w = 31 + i * 12;
      g.beginPath(); g.moveTo(90, y - 43); g.lineTo(90 - w, y + 28); g.lineTo(90 + 3, y + 28); g.closePath(); g.fill();
    }
  } else if (variant === 1) {
    g.fillStyle = '#503928'; g.fillRect(81, 205, 20, 89);
    g.fillStyle = '#294431';
    for (const [cx, cy, r] of [[90, 116, 54], [58, 151, 43], [123, 153, 45], [83, 178, 46], [43, 192, 34], [137, 199, 36], [90, 75, 38]]) {
      g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
    }
    g.fillStyle = 'rgba(96, 142, 83, 0.52)';
    for (const [cx, cy, r] of [[77, 98, 31], [48, 139, 24], [113, 135, 28], [79, 162, 24]]) {
      g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
    }
  } else {
    g.fillStyle = '#b9b3a0'; g.fillRect(82, 190, 15, 104);
    g.fillStyle = '#3a5238';
    for (const [cx, cy, r] of [[90, 105, 48], [62, 143, 36], [120, 144, 39], [90, 171, 42], [52, 184, 29], [133, 187, 28]]) {
      g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
    }
    g.fillStyle = 'rgba(124, 158, 90, 0.62)';
    for (const [cx, cy, r] of [[77, 91, 28], [58, 132, 19], [112, 126, 22], [87, 153, 20]]) {
      g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
    }
    g.fillStyle = 'rgba(36, 31, 25, 0.45)';
    for (let i = 0; i < 6; i++) g.fillRect(79 + (i * 7) % 20, 209 + i * 13, 4, 2);
  }
  return c;
}

function initTreeSprites() {
  TREE_SPRITES.length = 0;
  for (let i = 0; i < 3; i++) TREE_SPRITES.push(createTreeSprite(i));
}

function addTreeFaces(faces, t) {
  const s = t.size;
  const trunkH = t.h * 0.36;
  const trunkW = 0.55 * s;
  addBox(faces, t.x, trunkH * 0.5, t.z, trunkW, trunkH, trunkW, t.lean, t.variant === 2 ? '#9a927e' : '#4a3424');
  if (t.variant === 0) {
    for (let i = 0; i < 4; i++) {
      const base = trunkH * 0.72 + i * t.h * 0.17;
      const rad = (2.6 - i * 0.48) * s;
      addCone(faces, t.x, base, t.z, rad, t.h * 0.34, 8, i % 2 ? '#294a32' : '#203d2b', i * 0.5);
    }
  } else if (t.variant === 1) {
    addCone(faces, t.x, trunkH * 0.8, t.z, 2.8 * s, t.h * 0.43, 9, '#31523a', 0.3);
    addCone(faces, t.x, trunkH * 0.8 + t.h * 0.22, t.z, 2.15 * s, t.h * 0.40, 8, '#3d6142', 1.1);
    addCone(faces, t.x, trunkH * 0.8 + t.h * 0.42, t.z, 1.4 * s, t.h * 0.32, 7, '#486d49', 2.2);
  } else {
    addCone(faces, t.x, trunkH * 0.85, t.z, 2.4 * s, t.h * 0.52, 9, '#415d3d', 0.8);
    addCone(faces, t.x, trunkH * 0.85 + t.h * 0.3, t.z, 1.7 * s, t.h * 0.37, 8, '#58774a', 2.1);
  }
}

function drawTreeBillboard(t) {
  const p = projectWorld(t.x, 0, t.z);
  if (!p) return;
  const hpx = t.h * FOCAL / p.z;
  if (hpx < 2.2) return;
  const sprite = TREE_SPRITES[t.variant % TREE_SPRITES.length];
  const wpx = hpx * 0.60;
  const fog = smoothstep(70, 760, p.z);
  ctx.globalAlpha = 1 - fog * 0.72;
  ctx.drawImage(sprite, p.x - wpx * 0.5, p.y - hpx, wpx, hpx);
  ctx.globalAlpha = 1;
}

function drawFaces(faces) {
  if (!faces || !faces.length) return;
  const prepared = [];
  for (const face of faces) {
    const vs = [];
    let allBehind = true;
    for (const pt of face.pts) {
      const v = toView(pt.x, pt.y, pt.z);
      vs.push(v);
      if (v.z >= NEAR) allBehind = false;
    }
    if (allBehind) continue;
    const clipped = clipViewPolygon(vs);
    if (clipped.length < 3) continue;
    const projected = clipped.map(projectView);
    if (projected.some(p => !p)) continue;
    let depth = 0;
    for (const v of clipped) depth += v.z;
    depth /= clipped.length;
    prepared.push({ pts: projected, color: face.color, depth, opacity: face.opacity === undefined ? 1 : face.opacity });
  }
  prepared.sort((a, b) => b.depth - a.depth);
  for (const f of prepared) {
    const col = fogMix(f.color, f.depth, 0.72);
    ctx.globalAlpha = f.opacity;
    ctx.beginPath();
    ctx.moveTo(f.pts[0].x, f.pts[0].y);
    for (let i = 1; i < f.pts.length; i++) ctx.lineTo(f.pts[i].x, f.pts[i].y);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
    if (f.depth < 210) {
      ctx.strokeStyle = 'rgba(8, 12, 12, 0.18)';
      ctx.lineWidth = 0.55;
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

function addActorFaces(faces, a) {
  const pal = actorPalette(a);
  const s = a.scale || 1;
  const y = a.y || 0;
  const yaw = a.yaw || 0;
  const walk = a.moving ? Math.sin(a.walkPhase) : 0;
  if (a.dead) {
    addFlatQuad(faces, a.x, a.z, 2.0, 1.45, 0.035, '#4e1918');
    addBox(faces, a.x, 0.24, a.z, 0.56, 0.27, 1.02, yaw + Math.PI * 0.5, pal.cloth);
    const head = localPoint(a.x, a.z, yaw + Math.PI * 0.5, 0.68 * s, 0.22, 0);
    addBox(faces, head.x, 0.22, head.z, 0.34, 0.32, 0.34, yaw, pal.skin);
    addBox(faces, a.x - 0.23, 0.18, a.z + 0.45, 0.95, 0.17, 0.18, yaw + 0.8, pal.cloth2);
    addBox(faces, a.x + 0.26, 0.18, a.z - 0.48, 0.9, 0.17, 0.18, yaw - 1.1, pal.cloth2);
    addBox(faces, a.x - 0.28, 0.14, a.z + 0.48, 0.16, 0.14, 0.82, yaw + 0.2, pal.leather);
    addBox(faces, a.x + 0.31, 0.14, a.z - 0.46, 0.16, 0.14, 0.82, yaw - 0.4, pal.leather);
    addBox(faces, a.x + 0.55, 0.09, a.z + 0.68, 0.08, 0.05, 0.95, yaw + 0.8, pal.metal);
    return;
  }

  const swing = walk * 0.28;
  const attack = a.attackAnim || 0;
  const torsoY = y + 1.15 * s;
  const offset = a.raid && a.faction === 'villain' ? 0.03 : 0;

  // Ноги.
  const legY = y + 0.44 * s;
  addBox(faces, a.x - 0.18 * s, legY, a.z + swing * 0.22, 0.2 * s, 0.8 * s, 0.24 * s, yaw, shadeHex(pal.leather, 0.92));
  addBox(faces, a.x + 0.18 * s, legY, a.z - swing * 0.22, 0.2 * s, 0.8 * s, 0.24 * s, yaw, shadeHex(pal.leather, 0.86));
  addBox(faces, a.x - 0.18 * s, y + 0.07, a.z + swing * 0.25, 0.24 * s, 0.14 * s, 0.36 * s, yaw, '#2f241c');
  addBox(faces, a.x + 0.18 * s, y + 0.07, a.z - swing * 0.25, 0.24 * s, 0.14 * s, 0.36 * s, yaw, '#2f241c');

  // Торс и пояс.
  addBox(faces, a.x, torsoY, a.z, 0.58 * s, 0.74 * s, 0.37 * s, yaw, pal.cloth);
  addBox(faces, a.x, torsoY - 0.31 * s, a.z, 0.61 * s, 0.14 * s, 0.4 * s, yaw, pal.leather);
  if (a.elite) {
    const cape = localPoint(a.x, a.z, yaw, 0, 0, -0.25);
    addBox(faces, cape.x, y + 1.08 * s, cape.z, 0.72 * s, 1.08 * s, 0.08, yaw, shadeHex(pal.accent, 0.72));
  }

  // Руки.
  const armY = torsoY + 0.05 * s;
  const rightLunge = attack > 0 ? 0.42 : 0;
  const leftX = localPoint(a.x, a.z, yaw, -0.42 * s, armY, swing * 0.20);
  const rightX = localPoint(a.x, a.z, yaw, 0.42 * s, armY, -swing * 0.20 + rightLunge);
  addBox(faces, leftX.x, leftX.y, leftX.z, 0.17 * s, 0.62 * s, 0.18 * s, yaw, pal.cloth2);
  addBox(faces, rightX.x, rightX.y, rightX.z, 0.17 * s, 0.62 * s, 0.18 * s, yaw, pal.cloth2);
  if (a.role === 'imperial_guard' || a.role === 'imperial_commander') {
    const shield = localPoint(a.x, a.z, yaw, -0.57 * s, armY, 0.16);
    addBox(faces, shield.x, shield.y, shield.z, 0.46 * s, 0.64 * s, 0.10, yaw, pal.metal);
    addBox(faces, shield.x, shield.y, shield.z, 0.22 * s, 0.28 * s, 0.12, yaw, pal.accent);
  }

  // Голова, шлем и лицо.
  addBox(faces, a.x, y + 1.77 * s, a.z, 0.34 * s, 0.35 * s, 0.34 * s, yaw, pal.skin);
  if (a.faction === 'elf') {
    addBox(faces, a.x, y + 1.86 * s, a.z, 0.39 * s, 0.16 * s, 0.39 * s, yaw, shadeHex(pal.cloth, 0.72));
    const hood = localPoint(a.x, a.z, yaw, 0, 0, -0.03);
    addBox(faces, hood.x, y + 1.92 * s, hood.z, 0.3 * s, 0.25 * s, 0.3 * s, yaw, pal.dark);
  } else if (a.elite) {
    addBox(faces, a.x, y + 1.94 * s, a.z, 0.38 * s, 0.12 * s, 0.38 * s, yaw, pal.accent);
    addBox(faces, a.x, y + 2.08 * s, a.z, 0.12 * s, 0.27 * s, 0.11, yaw, pal.metal);
  } else {
    addBox(faces, a.x, y + 1.9 * s, a.z, 0.37 * s, 0.14 * s, 0.37 * s, yaw, shadeHex(pal.metal, 0.74));
  }
  const face = localPoint(a.x, a.z, yaw, 0.075, y + 1.78 * s, 0.18 * s);
  addBox(faces, face.x, face.y, face.z, 0.055, 0.04, 0.03, yaw, '#241b16');
  const face2 = localPoint(a.x, a.z, yaw, -0.075, y + 1.78 * s, 0.18 * s);
  addBox(faces, face2.x, face2.y, face2.z, 0.055, 0.04, 0.03, yaw, '#241b16');

  // Оружие.
  const weaponHand = localPoint(a.x, a.z, yaw, 0.52 * s, y + 1.06 * s, 0.25 + rightLunge);
  const weaponColor = a.faction === 'villain' ? '#8b8b86' : '#c0c5c1';
  if (a.faction === 'villain') {
    addBox(faces, weaponHand.x, weaponHand.y, weaponHand.z, 0.09, 0.92, 0.09, yaw, '#5a3c2b');
    addBox(faces, weaponHand.x, weaponHand.y + 0.48, weaponHand.z, 0.38, 0.28, 0.08, yaw, weaponColor);
  } else {
    addBox(faces, weaponHand.x, weaponHand.y, weaponHand.z, 0.065, 1.05, 0.065, yaw, weaponColor);
    addBox(faces, weaponHand.x, weaponHand.y - 0.52, weaponHand.z, 0.28, 0.07, 0.09, yaw, '#a9894f');
    addBox(faces, weaponHand.x, weaponHand.y + 0.55, weaponHand.z, 0.12, 0.20, 0.04, yaw, weaponColor);
  }
}

function addPlayerFaces(faces, p) {
  const pal = PALETTES[G.side] || PALETTES.empire;
  const y = p.y || 0;
  const yaw = p.yaw || 0;
  const walk = p.moving ? Math.sin(p.walkPhase) : 0;
  const attack = p.attackAnim || 0;
  const missingLeg = p.injuries.leg && !p.prosthetics.leg;
  const chair = missingLeg && p.wheelchairOut;
  const crawl = missingLeg && !p.wheelchairOut;
  const missingArm = p.injuries.arm && !p.prosthetics.arm;

  if (p.dead) {
    addFlatQuad(faces, p.x, p.z, 2.1, 1.5, 0.04, '#4e1918');
    addBox(faces, p.x, 0.25, p.z, 0.58, 0.28, 1.02, yaw + Math.PI * 0.5, pal.cloth);
    addBox(faces, p.x + 0.68, 0.23, p.z, 0.34, 0.32, 0.34, yaw, pal.skin);
    return;
  }

  if (chair) {
    // Боевая коляска: сиденье, спинка и два больших колеса.
    addBox(faces, p.x, y + 0.46, p.z, 0.86, 0.16, 0.82, yaw, '#4c4032');
    const back = localPoint(p.x, p.z, yaw, 0, y + 0.85, -0.37);
    addBox(faces, back.x, back.y, back.z, 0.84, 0.92, 0.12, yaw, '#5b4b39');
    for (const side of [-1, 1]) {
      const wheel = localPoint(p.x, p.z, yaw, side * 0.55, y + 0.48, 0);
      addBox(faces, wheel.x, wheel.y, wheel.z, 0.10, 1.05, 0.10, yaw + (side > 0 ? 0.2 : -0.2), '#9aa09b');
      addBox(faces, wheel.x, wheel.y, wheel.z, 0.08, 0.72, 0.08, yaw, '#373a38');
    }
  } else if (crawl) {
    addBox(faces, p.x, y + 0.34, p.z, 0.62, 0.34, 0.84, yaw + 0.1, pal.cloth);
    const crutch = localPoint(p.x, p.z, yaw, 0.45, y + 0.62, 0.25);
    addBox(faces, crutch.x, crutch.y, crutch.z, 0.09, 1.15, 0.09, yaw, '#6e5637');
  } else {
    const legY = y + 0.44;
    addBox(faces, p.x - 0.18, legY, p.z + walk * 0.22, 0.21, 0.8, 0.25, yaw, shadeHex(pal.leather, 0.92));
    if (!missingLeg) addBox(faces, p.x + 0.18, legY, p.z - walk * 0.22, 0.21, 0.8, 0.25, yaw, shadeHex(pal.leather, 0.86));
    else if (p.prosthetics.leg) addBox(faces, p.x + 0.18, legY, p.z - walk * 0.22, 0.16, 0.78, 0.18, yaw, '#a7ada6');
    addBox(faces, p.x - 0.18, y + 0.07, p.z + walk * 0.25, 0.25, 0.15, 0.37, yaw, '#2f241c');
    if (!missingLeg || p.prosthetics.leg) addBox(faces, p.x + 0.18, y + 0.07, p.z - walk * 0.25, 0.25, 0.15, 0.37, yaw, '#2f241c');
  }

  const torsoY = crawl ? y + 0.58 : y + 1.15;
  addBox(faces, p.x, torsoY, p.z, 0.62, 0.76, 0.4, yaw, pal.cloth);
  addBox(faces, p.x, torsoY - 0.31, p.z, 0.65, 0.14, 0.43, yaw, pal.leather);
  addBox(faces, p.x, torsoY + 0.25, p.z, 0.54, 0.18, 0.43, yaw, pal.accent);

  const armY = torsoY + 0.04;
  const lunge = attack > 0 ? 0.42 : 0;
  if (!missingArm) {
    const right = localPoint(p.x, p.z, yaw, 0.43, armY, lunge);
    addBox(faces, right.x, right.y, right.z, 0.18, 0.64, 0.19, yaw, p.prosthetics.arm ? '#a9b0aa' : pal.cloth2);
  } else {
    const stump = localPoint(p.x, p.z, yaw, 0.38, armY + 0.18, 0);
    addBox(faces, stump.x, stump.y, stump.z, 0.22, 0.24, 0.22, yaw, '#5e1d1a');
  }
  const left = localPoint(p.x, p.z, yaw, -0.43, armY, walk * 0.18);
  addBox(faces, left.x, left.y, left.z, 0.18, 0.64, 0.19, yaw, pal.cloth2);
  if (p.blocking && !missingArm) {
    const shield = localPoint(p.x, p.z, yaw, -0.58, armY + 0.05, 0.22);
    addBox(faces, shield.x, shield.y, shield.z, 0.53, 0.7, 0.12, yaw, pal.metal);
  }

  const headY = crawl ? y + 1.08 : y + 1.77;
  addBox(faces, p.x, headY, p.z, 0.35, 0.36, 0.35, yaw, pal.skin);
  addBox(faces, p.x, headY + 0.12, p.z, 0.39, 0.16, 0.39, yaw, pal.dark);
  if (p.injuries.eye && !p.prosthetics.eye) {
    const patch = localPoint(p.x, p.z, yaw, 0.10, headY + 0.02, 0.19);
    addBox(faces, patch.x, patch.y, patch.z, 0.22, 0.11, 0.025, yaw, '#171313');
  } else if (p.prosthetics.eye) {
    const eye = localPoint(p.x, p.z, yaw, 0.10, headY + 0.02, 0.19);
    addBox(faces, eye.x, eye.y, eye.z, 0.08, 0.045, 0.03, yaw, '#e5b95d');
  }

  const weaponHand = localPoint(p.x, p.z, yaw, 0.53, armY - 0.04, 0.26 + lunge);
  addBox(faces, weaponHand.x, weaponHand.y, weaponHand.z, 0.07, 1.08 + p.swordBonus * 0.015, 0.07, yaw, p.swordBonus ? '#e1d5b1' : '#c3c9c5');
  addBox(faces, weaponHand.x, weaponHand.y - 0.55, weaponHand.z, 0.3, 0.07, 0.1, yaw, '#b18c4f');
}

function drawPlayerItem() {
  const p = G.player;
  if (!p) return;
  const faces = [];
  addPlayerFaces(faces, p);
  drawFaces(faces);
}

function drawActorItem(a) {
  const faces = [];
  addActorFaces(faces, a);
  drawFaces(faces);
  if (!a.dead) queueActorLabel(a);
}

function queueActorLabel(a) {
  const d = dist2d(a.x, a.z, G.player.x, G.player.z);
  const hostile = isHostileToPlayer(a);
  if (!hostile && !a.notable && !a.elite && a.hp >= a.maxHp && d > 19) return;
  if (d > 42) return;
  G.labels.push({
    x: a.x, y: (a.y || 0) + 2.28 * (a.scale || 1), z: a.z,
    text: a.name,
    hp: a.hp / a.maxHp,
    color: hostile ? '#e28a78' : a.faction === G.side ? '#a9d5a7' : '#ddd0b1',
    bar: hostile || a.hp < a.maxHp,
    depth: toView(a.x, 1.7, a.z).z
  });
}

function drawActorLabels() {
  if (!G.labels.length) return;
  G.labels.sort((a, b) => b.depth - a.depth);
  for (const l of G.labels) {
    const p = projectWorld(l.x, l.y, l.z);
    if (!p || p.z > 120) continue;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = '10px "Trebuchet MS", sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,.7)';
    ctx.fillText(l.text, p.x + 1, p.y + 1);
    ctx.fillStyle = l.color;
    ctx.fillText(l.text, p.x, p.y);
    if (l.bar) {
      const w = 46;
      ctx.fillStyle = 'rgba(0,0,0,.62)';
      ctx.fillRect(p.x - w * 0.5, p.y + 3, w, 4);
      ctx.fillStyle = l.hp > 0.45 ? '#b7483e' : '#8c2822';
      ctx.fillRect(p.x - w * 0.5 + 1, p.y + 4, (w - 2) * clamp(l.hp, 0, 1), 2);
    }
    ctx.restore();
  }
}

function caravanFaces(c) {
  const faces = [];
  const yaw = c.yaw;
  const y = 0;
  addBox(faces, c.x, 0.83, c.z, 2.55, 0.42, 4.4, yaw, '#664526');
  addBox(faces, c.x, 1.28, c.z, 2.35, 0.52, 4.05, yaw, c.robbed ? '#4b3930' : '#77562f');
  for (const side of [-1, 1]) {
    for (const fz of [-1.45, 1.45]) {
      const wheel = localPoint(c.x, c.z, yaw, side * 1.35, 0.48, fz);
      addBox(faces, wheel.x, wheel.y, wheel.z, 0.16, 0.96, 0.96, yaw + Math.PI * 0.5, '#3f3126');
      addBox(faces, wheel.x, wheel.y, wheel.z, 0.18, 0.38, 0.38, yaw, '#887455');
    }
  }
  if (c.robbed) {
    addBox(faces, c.x, 1.52, c.z, 2.25, 0.13, 3.9, yaw, '#2f2723');
    addBox(faces, c.x, 0.72, c.z + 2.35, 0.45, 0.3, 0.45, yaw, '#2d211c');
  } else {
    // Полог и тюки.
    addBox(faces, c.x, 1.95, c.z, 2.4, 0.52, 3.9, yaw, '#b0a17e');
    addPrismRoof(faces, c.x, 2.15, c.z, 2.55, 3.98, 0.56, yaw, '#8d8062', 1.02);
    addBox(faces, c.x - 0.52, 1.42, c.z - 1.15, 0.7, 0.45, 0.9, yaw, '#7c5b34');
    addBox(faces, c.x + 0.58, 1.42, c.z + 0.7, 0.78, 0.45, 0.9, yaw, '#6e4e2d');
  }
  // Лошадь впереди.
  const horse = localPoint(c.x, c.z, yaw, 0, 0, 3.4);
  addBox(faces, horse.x, 1.05, horse.z, 0.62, 0.58, 1.45, yaw, '#5a3d2a');
  const head = localPoint(horse.x, horse.z, yaw, 0, 0, 0.9);
  addBox(faces, head.x, 1.38, head.z, 0.42, 0.42, 0.7, yaw, '#624531');
  for (const sx of [-0.21, 0.21]) for (const sz of [-0.45, 0.45]) {
    const leg = localPoint(horse.x, horse.z, yaw, sx, 0.4, sz);
    addBox(faces, leg.x, 0.4, leg.z, 0.14, 0.8, 0.14, yaw, '#4b3224');
  }
  return faces;
}

function drawCaravanItem(c) {
  if (dist2d(c.x, c.z, G.player.x, G.player.z) < 35) {
    G.labels.push({
      x: c.x, y: 2.9, z: c.z, text: c.robbed ? 'Разграбленный караван' : 'Караван', hp: 1,
      color: c.robbed ? '#a59b87' : '#dfc27a', bar: false, depth: toView(c.x, 2, c.z).z
    });
  }
  drawFaces(caravanFaces(c));
}

function drawRockItem(r) {
  const faces = [];
  addCone(faces, r.x, 0, r.z, r.size, r.h, 6, shadeHex('#69645c', 0.8 + r.size * 0.12), r.yaw);
  addCone(faces, r.x + r.size * 0.4, 0, r.z + r.size * 0.18, r.size * 0.55, r.h * 0.65, 5, '#5b5750', r.yaw + 1.2);
  drawFaces(faces);
}

function drawFireItem(f) {
  const faces = [];
  const flick = 0.82 + Math.sin(G.time * 9.5 + f.x) * 0.18;
  addBox(faces, f.x, 0.18, f.z, 1.3, 0.28, 0.7, 0.3, '#3e2d20');
  addCone(faces, f.x, 0.24, f.z, 0.55, 1.65 * flick, 7, '#c44a1e', 0.1);
  addCone(faces, f.x + 0.1, 0.26, f.z - 0.05, 0.35, 1.25 * flick, 6, '#ef8731', 1.2);
  addCone(faces, f.x - 0.12, 0.27, f.z + 0.04, 0.2, 0.78 * flick, 5, '#f5cb58', 2.4);
  drawFaces(faces);
  const p = projectWorld(f.x, 1.0, f.z);
  if (p && p.z < 75) {
    const radius = FOCAL * 1.2 / p.z;
    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
    glow.addColorStop(0, 'rgba(246, 145, 52, 0.24)');
    glow.addColorStop(1, 'rgba(246, 145, 52, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(p.x - radius, p.y - radius, radius * 2, radius * 2);
  }
}

/* --------------------------- render collection -------------------------- */

function treeLodIs3D(distance) { return distance < TREE_LOD_DISTANCE; }

function collectRenderItems() {
  const items = [];
  const p = G.player;
  if (!p) { G.items = items; return; }

  for (const t of G.trees) {
    const v = toView(t.x, t.h * 0.5, t.z);
    if (v.z < NEAR || v.z > 820) continue;
    const near = distSq(t.x, t.z, p.x, p.z) < TREE_LOD_DISTANCE * TREE_LOD_DISTANCE;
    items.push({ kind: near ? 'tree3d' : 'treeBillboard', obj: t, depth: v.z });
  }
  for (const r of G.rocks) {
    const v = toView(r.x, r.h * 0.5, r.z);
    if (v.z >= NEAR && v.z < 780) items.push({ kind: 'rock', obj: r, depth: v.z });
  }
  for (const b of G.buildings) {
    const v = toView(b.x, b.h * 0.5, b.z);
    if (v.z >= NEAR && v.z < 980) items.push({ kind: 'building', obj: b, depth: v.z });
  }
  for (const f of G.fires) {
    const v = toView(f.x, 0.9, f.z);
    if (v.z >= NEAR && v.z < 760) items.push({ kind: 'fire', obj: f, depth: v.z });
  }
  for (const a of G.actors) {
    const v = toView(a.x, (a.y || 0) + 1.1, a.z);
    if (v.z >= NEAR && v.z < 790) items.push({ kind: 'actor', obj: a, depth: v.z });
  }
  for (const c of G.caravans) {
    const v = toView(c.x, 1.2, c.z);
    if (v.z >= NEAR && v.z < 780) items.push({ kind: 'caravan', obj: c, depth: v.z });
  }
  const pv = toView(p.x, 1.1, p.z);
  if (pv.z >= NEAR) items.push({ kind: 'player', obj: p, depth: pv.z });
  items.sort((a, b) => b.depth - a.depth);
  G.items = items;
}

function drawAllShadows() {
  const p = G.player;
  if (!p) return;
  for (const t of G.trees) {
    if (distSq(t.x, t.z, p.x, p.z) < 120 * 120) drawGroundShadow(t.x + 0.7, t.z + 0.7, t.size * 0.9, 0.18);
  }
  for (const a of G.actors) {
    if (a.dead) continue;
    if (distSq(a.x, a.z, p.x, p.z) < 105 * 105) drawGroundShadow(a.x, a.z, 0.56 * (a.scale || 1), 0.29);
  }
  for (const c of G.caravans) {
    if (distSq(c.x, c.z, p.x, p.z) < 100 * 100) drawGroundShadow(c.x, c.z, 1.8, 0.27);
  }
  if (!p.dead) drawGroundShadow(p.x, p.z, 0.72, 0.32);
}

function drawParticles() {
  if (!G.particles.length) return;
  for (const p of G.particles) {
    const v = toView(p.x, p.y, p.z);
    if (v.z < NEAR) continue;
    const sp = projectView(v);
    if (!sp) continue;
    const size = clamp(FOCAL * p.size / v.z, 0.6, 9);
    const alpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.globalAlpha = alpha * 0.8;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, size, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function renderScene() {
  if (!G.player) return;
  updateCameraBasis();
  drawSkyAndGroundBase();
  drawGroundTiles();
  drawAllShadows();
  collectRenderItems();
  G.labels = [];
  for (const item of G.items) {
    switch (item.kind) {
      case 'tree3d': {
        const faces = [];
        addTreeFaces(faces, item.obj);
        drawFaces(faces);
        break;
      }
      case 'treeBillboard': drawTreeBillboard(item.obj); break;
      case 'rock': drawRockItem(item.obj); break;
      case 'building': drawFaces(buildingFaces(item.obj)); break;
      case 'fire': drawFireItem(item.obj); break;
      case 'actor': drawActorItem(item.obj); break;
      case 'caravan': drawCaravanItem(item.obj); break;
      case 'player': drawPlayerItem(); break;
    }
  }
  drawActorLabels();
  drawParticles();
}

/* ------------------------------- world map ------------------------------ */

function drawMapInto(g, cw, ch, big = false) {
  g.clearRect(0, 0, cw, ch);
  const bg = g.createLinearGradient(0, 0, cw, ch);
  bg.addColorStop(0, '#1d2825');
  bg.addColorStop(1, '#111816');
  g.fillStyle = bg;
  g.fillRect(0, 0, cw, ch);
  const pad = big ? 42 : 10;
  const scale = Math.min((cw - pad * 2) / WORLD.w, (ch - pad * 2) / WORLD.h);
  const ox = (cw - WORLD.w * scale) * 0.5;
  const oz = (ch - WORLD.h * scale) * 0.5;
  const X = x => ox + x * scale;
  const Z = z => oz + z * scale;

  // Сетка.
  g.strokeStyle = 'rgba(229,185,93,.055)';
  g.lineWidth = 1;
  for (let x = 0; x <= WORLD.w; x += 150) {
    g.beginPath(); g.moveTo(X(x), Z(0)); g.lineTo(X(x), Z(WORLD.h)); g.stroke();
  }
  for (let z = 0; z <= WORLD.h; z += 150) {
    g.beginPath(); g.moveTo(X(0), Z(z)); g.lineTo(X(WORLD.w), Z(z)); g.stroke();
  }

  // Зоны.
  for (const zone of ZONES) {
    g.beginPath();
    g.arc(X(zone.x), Z(zone.z), zone.r * scale, 0, TAU);
    g.fillStyle = zone.color + (big ? '34' : '22');
    g.fill();
    g.strokeStyle = zone.color + '88';
    g.lineWidth = big ? 1.6 : 1;
    g.stroke();
    if (big) {
      g.font = '600 15px Georgia, serif';
      g.textAlign = 'center';
      g.fillStyle = '#ded1b4';
      g.fillText(zone.name, X(zone.x), Z(zone.z) - zone.r * scale * 0.45);
      g.font = '10px "Trebuchet MS", sans-serif';
      g.fillStyle = 'rgba(220,211,190,.62)';
      g.fillText(zone.sub, X(zone.x), Z(zone.z) - zone.r * scale * 0.45 + 16);
    }
  }

  // Дороги.
  g.strokeStyle = big ? 'rgba(190,154,91,.63)' : 'rgba(190,154,91,.42)';
  g.lineWidth = big ? 4 : 2;
  g.lineCap = 'round';
  for (const road of ROADS) {
    g.beginPath();
    g.moveTo(X(road.a.x), Z(road.a.z));
    g.lineTo(X(road.b.x), Z(road.b.z));
    g.stroke();
  }

  // Здания.
  for (const b of G.buildings) {
    g.fillStyle = b.type === 'wall' ? 'rgba(164,159,144,.55)' : 'rgba(205,184,139,.66)';
    g.fillRect(X(b.x) - Math.max(1, b.w * scale * 0.5), Z(b.z) - Math.max(1, b.d * scale * 0.5), Math.max(2, b.w * scale), Math.max(2, b.d * scale));
  }

  // Костры.
  for (const f of G.fires) {
    g.fillStyle = '#e58a38';
    g.beginPath(); g.arc(X(f.x), Z(f.z), big ? 4 : 2.2, 0, TAU); g.fill();
  }

  // Караваны.
  for (const c of G.caravans) {
    g.fillStyle = c.robbed ? '#6b6255' : '#b4874c';
    g.fillRect(X(c.x) - 3, Z(c.z) - 3, 6, 6);
  }

  // Акторы.
  for (const a of G.actors) {
    if (a.dead) continue;
    const hostile = isHostileToPlayer(a);
    const ally = a.faction === G.side;
    g.fillStyle = hostile ? '#d46354' : ally ? '#74b67c' : '#a6a18f';
    g.beginPath();
    g.arc(X(a.x), Z(a.z), a.notable || a.elite ? (big ? 5 : 2.5) : (big ? 3 : 1.6), 0, TAU);
    g.fill();
  }

  // Игрок.
  if (G.player && !G.player.dead) {
    const px = X(G.player.x), pz = Z(G.player.z);
    g.save();
    g.translate(px, pz);
    g.rotate(-G.player.yaw);
    g.beginPath();
    g.moveTo(0, -(big ? 10 : 6));
    g.lineTo(big ? 6 : 4, big ? 7 : 4);
    g.lineTo(0, big ? 3 : 2);
    g.lineTo(-(big ? 6 : 4), big ? 7 : 4);
    g.closePath();
    g.fillStyle = '#f2d580';
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,.7)';
    g.lineWidth = 1;
    g.stroke();
    g.restore();
  }

  if (big) {
    g.font = '11px "SFMono-Regular", Consolas, monospace';
    g.textAlign = 'right';
    g.fillStyle = 'rgba(229,185,93,.55)';
    g.fillText('deepseek-v4.1-flash-1017 · карта мира', cw - 20, ch - 16);
  }
}

function drawMinimap() {
  drawMapInto(minimapCtx, minimapCanvas.width, minimapCanvas.height, false);
  if (!G.player) return;
  DOM.mapCoords.textContent = Math.round(G.player.x) + ' / ' + Math.round(G.player.z);
}

function drawBigMap() {
  drawMapInto(bigMapCtx, bigMapCanvas.width, bigMapCanvas.height, true);
}

function updateZoneUI(force = false) {
  if (!G.player) return;
  const zone = nearestZone(G.player.x, G.player.z);
  DOM.zoneName.textContent = zone.name;
  DOM.zoneSub.textContent = zone.sub;
  if (zone.id !== G.currentZone || force) {
    if (!force && G.mode === 'playing') toast('Вы вошли: ' + zone.name, 'good');
    G.currentZone = zone.id;
  }
  const bearing = (180 - G.camera.yaw * 180 / Math.PI + 360) % 360;
  const dirs = ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ'];
  const d = dirs[Math.round(bearing / 45) % 8];
  DOM.compass.textContent = d + ' · ' + Math.round(bearing) + '° · СВОБОДНЫЙ МИР';
}

/* =========================================================================
   СИМУЛЯЦИЯ, ИНТЕРФЕЙС, ВВОД, СОХРАНЕНИЯ
   ========================================================================= */

function toast(text, type = '', duration = 3800) {
  if (!DOM.toastStack) return;
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = text;
  DOM.toastStack.appendChild(el);
  while (DOM.toastStack.children.length > 5) DOM.toastStack.firstChild.remove();
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(-4px)';
    el.style.transition = 'opacity .3s, transform .3s';
    setTimeout(() => el.remove(), 330);
  }, duration);
}

function fluidFlash() {
  DOM.damageFlash.style.opacity = '0.78';
  setTimeout(() => { DOM.damageFlash.style.opacity = '0'; }, 95);
}

function updateInjuryUI() {
  const p = G.player;
  if (!p) return;
  const chips = [];
  if (p.bleeding > 0) chips.push(['КРОВОТЕЧЕНИЕ', false]);
  if (p.injuries.arm) chips.push([p.prosthetics.arm ? 'ПРОТЕЗ РУКИ' : 'РУКА ОТРУБЛЕНА', !!p.prosthetics.arm]);
  if (p.injuries.eye) chips.push([p.prosthetics.eye ? 'ПРОТЕЗ ГЛАЗА' : p.eyepatch ? 'ГЛАЗ ПОД ПОВЯЗКОЙ' : 'ГЛАЗ ВЫКОЛОТ', !!p.prosthetics.eye]);
  if (p.injuries.leg) chips.push([p.prosthetics.leg ? 'ПРОТЕЗ НОГИ' : p.wheelchairOut ? 'В КОЛЯСКЕ' : 'НОГА ПЕРЕБИТА', !!p.prosthetics.leg]);
  if (!chips.length) chips.push(['ТЕЛО ЦЕЛО', true]);
  DOM.injuryChips.innerHTML = '';
  for (const [text, ok] of chips) {
    const span = document.createElement('span');
    span.className = 'chip' + (ok ? ' ok' : '');
    span.textContent = text;
    DOM.injuryChips.appendChild(span);
  }
  const blind = p.injuries.eye && !p.prosthetics.eye;
  DOM.eyeBlind.style.opacity = blind ? (p.eyepatch ? '0.51' : '0.94') : '0';
  DOM.prostheticArm = p.prosthetics.arm;
}

function updateHUD() {
  const p = G.player;
  if (!p) return;
  const hp = clamp(p.health / p.maxHealth, 0, 1);
  DOM.healthFill.style.width = (hp * 100) + '%';
  DOM.healthText.textContent = Math.max(0, Math.ceil(p.health)) + ' / ' + p.maxHealth;
  DOM.staminaFill.style.width = clamp(p.stamina, 0, 100) + '%';
  DOM.staminaText.textContent = Math.round(p.stamina);
  DOM.goldText.textContent = p.gold;
  DOM.playerLabel.textContent = FACTIONS[G.faction].title + (G.faction === 'guard' ? ' · верность ' + G.loyalty + '%' : '');
  DOM.bleedBar.classList.toggle('visible', p.bleeding > 0);
  DOM.bleedFill.style.width = clamp(p.bleeding / 2.4 * 100, 8, 100) + '%';
  updateInjuryUI();
  updateQuestUI();
}

function jumpPlayer() {
  const p = G.player;
  if (!p || p.dead || G.mode !== 'playing' || G.paused) return false;
  const legLocked = p.injuries.leg && !p.prosthetics.leg;
  if (legLocked) {
    toast(p.wheelchairOut ? 'Из коляски не прыгнуть.' : 'С перебитой ногой вы можете только ползти.', 'bad');
    return false;
  }
  if (p.y > 0.02) return false;
  if (p.stamina < 7) return false;
  p.vy = 6.9;
  p.stamina -= 7;
  return true;
}

function playerAttack() {
  const p = G.player;
  if (!p || p.dead || G.mode !== 'playing' || G.paused) return;
  if (p.attackCd > 0) return;
  if (p.stamina < 4) return;
  p.attackCd = p.prosthetics.arm || !p.injuries.arm ? 0.55 : 0.82;
  p.attackAnim = 0.30;
  p.stamina = Math.max(0, p.stamina - 7);
  p.yaw = G.camera.yaw;
  G.camera.shake = Math.max(G.camera.shake, 0.16);

  const fx = Math.sin(G.camera.yaw), fz = Math.cos(G.camera.yaw);
  let best = null, bestScore = -1;
  for (const a of G.actors) {
    if (a.dead) continue;
    const dx = a.x - p.x, dz = a.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d > 3.45 + (a.scale || 1) * 0.22) continue;
    const dot = (dx * fx + dz * fz) / (d || 1);
    if (dot < 0.16) continue;
    const score = dot * 2 - d * 0.08;
    if (score > bestScore) { bestScore = score; best = a; }
  }
  if (!best) {
    spawnBurst(p.x + fx * 1.4, 1.15, p.z + fz * 1.4, '#d8cba7', 3, 0.6);
    return;
  }
  let dmg = 20 + p.swordBonus + Math.random() * 8;
  if (p.injuries.arm && !p.prosthetics.arm) dmg *= 0.37;
  dmg = Math.round(dmg);
  DOM.crosshair.classList.add('hit');
  setTimeout(() => DOM.crosshair.classList.remove('hit'), 120);
  if (best.faction === G.side) {
    if (G.faction === 'guard') changeLoyalty(-16, 'Удар по союзнику подрывает дисциплину.');
    else toast('Вы ударили союзника. Это не останется незамеченным.', 'bad');
  } else if (best.faction === 'human') {
    G.rep.human = clamp(G.rep.human - 2, -100, 100);
  }
  damageActor(best, dmg, 'player');
}

function updatePlayer(dt) {
  const p = G.player;
  if (!p || p.dead) return;
  p.attackCd = Math.max(0, p.attackCd - dt);
  p.attackAnim = Math.max(0, p.attackAnim - dt);

  const forward = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  const strafe = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const len = Math.hypot(forward, strafe);
  const legLost = p.injuries.leg && !p.prosthetics.leg;
  const crawl = legLost && !p.wheelchairOut;
  const chair = legLost && p.wheelchairOut;
  let baseSpeed = 6.15;
  if (crawl) baseSpeed = 1.32;
  else if (chair) baseSpeed = 3.65;
  if (p.blocking) baseSpeed *= 0.52;
  if (keys.ShiftLeft || keys.ShiftRight) {
    if (!legLost && !p.blocking && p.stamina > 1) {
      baseSpeed *= 1.42;
      p.stamina -= 17 * dt;
    }
  }
  p.stamina = clamp(p.stamina + (keys.ShiftLeft || keys.ShiftRight ? 2 : 12) * dt, 0, 100);
  p.blocking = !!keys.MouseRight && !p.injuries.arm && p.stamina > 2;

  if (len > 0) {
    const nx = strafe / len, nz = forward / len;
    const fx = Math.sin(G.camera.yaw), fz = Math.cos(G.camera.yaw);
    const rx = Math.cos(G.camera.yaw), rz = -Math.sin(G.camera.yaw);
    const mx = fx * nz + rx * nx;
    const mz = fz * nz + rz * nx;
    const step = baseSpeed * dt;
    const nextX = p.x + mx * step;
    const nextZ = p.z + mz * step;
    if (!circleBlocked(nextX, p.z, 0.42)) p.x = nextX;
    if (!circleBlocked(p.x, nextZ, 0.42)) p.z = nextZ;
    p.x = clamp(p.x, 18, WORLD.w - 18);
    p.z = clamp(p.z, 18, WORLD.h - 18);
    p.yaw = Math.atan2(mx, mz);
    p.walkPhase += dt * (chair ? 5 : crawl ? 4 : 10.5);
    p.moving = true;
  } else {
    p.moving = false;
  }

  // Прыжок и гравитация.
  p.vy -= 18.5 * dt;
  p.y += p.vy * dt;
  if (p.y <= 0) { p.y = 0; p.vy = 0; }

  // Кровотечение и восстановление.
  if (p.bleeding > 0) {
    p.health -= p.bleeding * dt;
    if (Math.random() < dt * 6) spawnParticle(p.x + (Math.random() - 0.5) * 0.6, 1.0, p.z + (Math.random() - 0.5) * 0.5, 0, -0.2, 0, '#861f1a', 0.6, 0.045);
    if (p.health <= 0) { p.health = 0; die(); return; }
  } else if (G.time - G.lastCombat > 6 && p.health < p.maxHealth) {
    p.health = Math.min(p.maxHealth, p.health + 1.25 * dt);
  }

  // Камера с клавиатуры.
  if (keys.ArrowLeft) G.camera.yaw -= 1.65 * dt;
  if (keys.ArrowRight) G.camera.yaw += 1.65 * dt;
  if (keys.ArrowUp) G.camera.pitch = clamp(G.camera.pitch + 0.75 * dt, -0.52, 0.30);
  if (keys.ArrowDown) G.camera.pitch = clamp(G.camera.pitch - 0.75 * dt, -0.52, 0.30);

  if (keys.MouseLeft) playerAttack();
}

function updateActors(dt) {
  const p = G.player;
  if (!p) return;
  for (const a of G.actors) {
    if (a.dead) {
      a.deadTime += dt;
      continue;
    }
    a.attackCd = Math.max(0, a.attackCd - dt);
    a.attackAnim = Math.max(0, (a.attackAnim || 0) - dt);
    a.walkPhase += a.moving ? dt * 1.4 : 0;

    const dPlayer = dist2d(a.x, a.z, p.x, p.z);
    let targetPlayer = false;
    let targetActor = null;

    if (!p.dead && (a.aggroPlayer || (!a.peaceful && isHostileToPlayer(a) && dPlayer < a.detect))) {
      if (dPlayer < 52) targetPlayer = true;
    }

    if (!targetPlayer) {
      if (a.aggroActorId) {
        targetActor = G.actors.find(o => o.id === a.aggroActorId && !o.dead) || null;
        if (targetActor && dist2d(a.x, a.z, targetActor.x, targetActor.z) > 38) targetActor = null;
      }
      if (!targetActor) targetActor = findNearestHostileActor(a, a.detect);
    }

    if (a.followCaravan && !a.aggroPlayer) {
      // Караванные охранники держатся повозки; логика движения уже в updateCaravans.
      a.moving = false;
      continue;
    }

    if (targetPlayer) {
      a.state = 'chase';
      const d = moveActorToward(a, p.x, p.z, dt, 1.8);
      if (d < 2.35 && a.attackCd <= 0) {
        a.attackCd = 1.0 + Math.random() * 0.65;
        a.attackAnim = 0.28;
        const dmg = a.damage[0] + Math.random() * (a.damage[1] - a.damage[0]);
        harmPlayer(dmg, a);
      }
    } else if (targetActor) {
      a.state = 'fight';
      const d = moveActorToward(a, targetActor.x, targetActor.z, dt, 1.55);
      if (d < 2.1 && a.attackCd <= 0) {
        a.attackCd = 1.15 + Math.random() * 0.7;
        a.attackAnim = 0.26;
        const dmg = a.damage[0] + Math.random() * (a.damage[1] - a.damage[0]);
        damageActor(targetActor, dmg, 'npc');
        targetActor.aggroActorId = a.id;
      }
    } else if (a.follow) {
      a.state = 'follow';
      if (dPlayer > 4.2) moveActorToward(a, p.x, p.z, dt, 3.6);
      else { a.moving = false; a.yaw = Math.atan2(p.x - a.x, p.z - a.z); }
    } else if (a.raidTarget) {
      a.state = 'raid';
      const d = dist2d(a.x, a.z, a.raidTarget.x, a.raidTarget.z);
      if (d > 4.5) moveActorToward(a, a.raidTarget.x, a.raidTarget.z, dt, 4.2);
      else { a.raidTarget = null; a.wanderCd = 0; }
    } else {
      a.state = 'idle';
      a.wanderCd -= dt;
      if (a.wanderCd <= 0) {
        a.wanderCd = 3 + Math.random() * 6;
        const ang = Math.random() * TAU;
        const r = 3 + Math.random() * 10;
        a.targetX = clamp(a.homeX + Math.cos(ang) * r, 25, WORLD.w - 25);
        a.targetZ = clamp(a.homeZ + Math.sin(ang) * r, 25, WORLD.h - 25);
        a.wanderMoving = true;
      }
      if (a.wanderMoving && dist2d(a.x, a.z, a.targetX, a.targetZ) > 1) {
        moveActorToward(a, a.targetX, a.targetZ, dt * 0.55, 0.8);
      } else {
        a.wanderMoving = false;
        a.moving = false;
      }
    }
  }
}

function updateParticles(dt) {
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const p = G.particles[i];
    p.life -= dt;
    if (p.life <= 0) { G.particles.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.vy -= 5.5 * dt;
    if (p.y < 0.03) { p.y = 0.03; p.vy = 0; p.vx *= 0.8; p.vz *= 0.8; }
  }
}

function updateFires(dt) {
  for (const f of G.fires) {
    if (Math.random() < dt * 2.1 && G.particles.length < 300) {
      spawnParticle(f.x + (Math.random() - 0.5) * 0.35, 1.1, f.z + (Math.random() - 0.5) * 0.35, (Math.random() - 0.5) * 0.2, 0.5 + Math.random() * 0.5, (Math.random() - 0.5) * 0.2, Math.random() < 0.35 ? '#d67b32' : '#5d5048', 0.8 + Math.random() * 0.6, 0.035 + Math.random() * 0.04);
    }
  }
}

function updateInteractionPrompt() {
  if (G.mode !== 'playing' || G.paused) {
    DOM.interaction.classList.remove('visible');
    G.interaction = null;
    return;
  }
  const found = findInteraction();
  G.interaction = found;
  if (found) {
    DOM.interactionText.textContent = found.text;
    DOM.interaction.classList.add('visible');
  } else {
    DOM.interaction.classList.remove('visible');
  }
}

function findInteraction() {
  const p = G.player;
  if (!p) return null;
  const candidates = [];
  const addActorCandidate = (a, text) => {
    const d = dist2d(p.x, p.z, a.x, a.z);
    if (d < 4.2) candidates.push({ kind: 'actor', target: a, text, d });
  };
  for (const a of G.actors) {
    if (a.dead) {
      const d = dist2d(p.x, p.z, a.x, a.z);
      if (d < 3.0 && !a.looted) candidates.push({ kind: 'corpse', target: a, text: 'Обыскать тело', d });
      continue;
    }
    if (a.commander && G.faction === 'guard') addActorCandidate(a, 'Приказ командира Ардена');
    else if (a.role === 'merchant') addActorCandidate(a, 'Торговать с ' + a.name);
    else if (a.role === 'villain_warlord' && G.faction === 'villain') addActorCandidate(a, 'Созвать военный совет');
    else if (a.role === 'elf_elder' && G.faction === 'elf') addActorCandidate(a, 'Поговорить со старейшиной');
  }
  for (const c of G.caravans) {
    if (!c.robbed) {
      const d = dist2d(p.x, p.z, c.x, c.z);
      if (d < 5.7) candidates.push({ kind: 'caravan', target: c, text: 'Ограбить караван (+' + c.gold + ' ¤)', d });
    }
  }
  for (const f of G.fires) {
    const d = dist2d(p.x, p.z, f.x, f.z);
    if (d < 3.4) candidates.push({ kind: 'fire', target: f, text: 'Отдохнуть у костра', d });
  }
  candidates.sort((a, b) => a.d - b.d);
  return candidates[0] || null;
}

function performInteraction() {
  if (G.mode !== 'playing' || G.paused) return;
  const found = G.interaction || findInteraction();
  if (!found) {
    toast('Рядом нет ничего, с чем можно взаимодействовать.', '');
    return;
  }
  if (found.kind === 'actor') {
    const a = found.target;
    if (a.role === 'merchant') openShop(a.name);
    else if (a.commander && G.faction === 'guard') giveCommanderOrder();
    else if (a.role === 'villain_warlord' && G.faction === 'villain') openCommandModal();
    else if (a.role === 'elf_elder' && G.faction === 'elf') elderTalk();
  } else if (found.kind === 'caravan') {
    robCaravan(found.target);
  } else if (found.kind === 'corpse') {
    if (!found.target.looted) {
      const gold = Math.max(1, Math.round((found.target.gold || 2) * 0.75));
      found.target.looted = true;
      G.player.gold += gold;
      toast('На теле найдено ' + gold + ' ¤', 'gold');
      updateHUD();
    }
  } else if (found.kind === 'fire') {
    const enemiesNear = G.actors.some(a => !a.dead && isHostileToPlayer(a) && dist2d(a.x, a.z, G.player.x, G.player.z) < 17);
    if (enemiesNear) toast('Не время отдыхать: рядом враги.', 'bad');
    else {
      G.player.health = Math.min(G.player.maxHealth, G.player.health + 22);
      G.player.stamina = 100;
      toast('Короткий отдых у огня: +22 HP.', 'good');
      updateHUD();
    }
  }
}

function robCaravan(c) {
  if (!c || c.robbed) return false;
  c.robbed = true;
  c.gold = c.gold || 60;
  G.player.gold += c.gold;
  G.stats.robbed++;
  G.player.rodeCaravan = true;
  for (const gid of c.guards) {
    const guard = G.actors.find(a => a.id === gid);
    if (guard) { guard.aggroPlayer = true; guard.peaceful = false; }
  }
  G.rep.human = clamp(G.rep.human - 14, -100, 100);
  if (G.faction === 'guard') changeLoyalty(-12, 'Стража не грабит торговцев.');
  toast('Караван ограблен: +' + c.gold + ' ¤. Охранники в ярости.', 'gold');
  spawnBurst(c.x, 1.4, c.z, '#e3bb65', 18, 2.6);
  progressQuest('rob', null);
  updateHUD();
  autoSave();
  return true;
}

function elderTalk() {
  if (G.faction !== 'elf') return;
  if (G.quest && G.quest.type === 'talk') {
    progressQuest('talk', null);
  }
  const lines = [
    'Старейшина Лиэн: «Империя рубит наш лес, а Морвейн скупает пепел. Деревья помнят всё».',
    'Лиэн: «Караваны людей идут через перекрёсток. Их золото прокормит наши дома».',
    'Лиэн: «Если потеряешь руку или глаз — иди к торговцу. Протез лучше, чем медленная смерть».'
  ];
  toast(lines[Math.floor(Math.random() * lines.length)], 'good', 5200);
}

function giveCommanderOrder() {
  if (G.faction !== 'guard') {
    toast('Командир Арден смотрит на вас с подозрением.', '');
    return;
  }
  const order = COMMANDER_ORDERS[G.stats.orders % COMMANDER_ORDERS.length];
  G.stats.orders++;
  if (G.quest && G.quest.type === 'talk') progressQuest('talk', null);
  spawnOrderEnemies(order);
  G.quest = cloneQuest({
    id: 'order_' + G.stats.orders, title: order.title, desc: order.desc,
    type: order.type, target: order.target, need: order.need, reward: order.reward
  });
  updateQuestUI();
  changeLoyalty(4);
  toast('Приказ Ардена: ' + order.title + '. ' + order.desc, 'gold', 6200);
}

function rallyElves() {
  if (G.faction !== 'elf') return;
  const count = G.actors.filter(a => a.faction === 'elf' && a.follow && !a.dead).length;
  if (count >= 4) {
    toast('Партизаны уже рядом. Ведите их в бой.', 'good');
    return;
  }
  for (let i = 0; i < 2; i++) {
    G.actors.push(makeActor('elf_partisan', G.player.x + (Math.random() - 0.5) * 5, G.player.z + (Math.random() - 0.5) * 5, {
      follow: true, name: 'Партизан-эльф'
    }));
  }
  toast('Два лесных партизана присоединились к вам. V — снова позвать.', 'good');
}

function spawnVillainAllies(count) {
  let existing = G.actors.filter(a => a.faction === 'villain' && a.follow && !a.dead).length;
  const room = Math.max(0, 10 - existing);
  const n = Math.min(count, room);
  for (let i = 0; i < n; i++) {
    const a = makeActor('villain_soldier', G.player.x + (Math.random() - 0.5) * 7, G.player.z + (Math.random() - 0.5) * 7, {
      follow: true, name: 'Воитель Морвейна'
    });
    G.actors.push(a);
  }
  return n;
}

function openCommandModal() {
  if (G.mode !== 'playing' || G.paused) return;
  if (G.faction !== 'villain') return;
  G.paused = true;
  releasePointer();
  DOM.commandModal.hidden = false;
  DOM.commandGrid.innerHTML = '';
  const commands = [
    { id: 'palace', title: 'Штурм дворца', desc: 'Собрать воинов и идти к южным воротам. Убить 5 имперских стражей.', tag: 'ВОЙНА' },
    { id: 'elf', title: 'Набег на эльфов', desc: 'Вести отряд в лесное княжество и убить 4 эльфов.', tag: 'ЛЕС' },
    { id: 'caravan', title: 'Грабить караваны', desc: 'Отряд прикроет вас, пока вы берёте чужое золото.', tag: 'ЗОЛОТО' },
    { id: 'fort', title: 'Держать форт', desc: 'Собрать войско у старого форта и уничтожить любого врага.', tag: 'ОБОРОНА' }
  ];
  for (const cmd of commands) {
    const b = document.createElement('button');
    b.className = 'command-card';
    b.innerHTML = '<strong>' + cmd.title + '</strong><span>' + cmd.desc + '</span><span style="color:#b48dd0;font:9px monospace;letter-spacing:.16em;margin-top:7px">' + cmd.tag + '</span>';
    b.addEventListener('click', () => issueArmyOrder(cmd.id));
    DOM.commandGrid.appendChild(b);
  }
  DOM.commandNote.textContent = 'Войско Морвейна слушается только вас. Приказы можно менять сколько угодно раз.';
}

function issueArmyOrder(type) {
  if (G.faction !== 'villain') return;
  closeModal('command-modal');
  G.armyOrder = type;
  G.stats.orders++;
  const spawned = spawnVillainAllies(4);
  if (G.quest && G.quest.type === 'command') progressQuest('command', null);

  let q;
  if (type === 'palace') {
    q = { id: 'assault_palace', title: 'Штурм дворца', desc: 'Ведите отряд к дворцу и убейте 5 имперских стражей.', type: 'kill', target: 'empire', need: 5, reward: 180 };
    toast('Приказ: штурм дворца! ' + spawned + ' воинов идут за вами.', 'gold', 6000);
  } else if (type === 'elf') {
    q = { id: 'raid_elf', title: 'Набег на эльфов', desc: 'Ведите отряд в лес и убейте 4 эльфов.', type: 'kill', target: 'elf', need: 4, reward: 150 };
    toast('Приказ: набег на эльфов! ' + spawned + ' воинов идут за вами.', 'bad', 6000);
  } else if (type === 'caravan') {
    q = { id: 'raid_caravan', title: 'Чужое золото', desc: 'Ограбьте караван людей (E рядом с повозкой).', type: 'rob', need: 1, reward: 120 };
    toast('Приказ: грабить караваны. ' + spawned + ' воинов прикроют вас.', 'gold', 6000);
  } else {
    q = { id: 'hold_fort', title: 'Держать форт', desc: 'Защищайте старый форт и уничтожьте 4 врагов рядом с ним.', type: 'kill', target: 'any', need: 4, reward: 120 };
    toast('Приказ: держать форт. ' + spawned + ' воинов остаются с вами.', 'good', 6000);
  }
  setQuest(q);
  updateHUD();
  autoSave();
}

/* ------------------------------- shop ----------------------------------- */

let activeShop = null;

function openShop(name = 'Торговец') {
  if (G.mode !== 'playing' || G.paused) return;
  G.paused = true;
  releasePointer();
  activeShop = name;
  DOM.shopTitle.textContent = name;
  DOM.shopModal.hidden = false;
  refreshShop();
}

function refreshShop() {
  if (!G.player) return;
  DOM.shopGold.textContent = G.player.gold;
  DOM.shopGrid.innerHTML = '';
  for (const item of SHOP_ITEMS) {
    const available = shopItemAvailable(item.id);
    const div = document.createElement('article');
    div.className = 'shop-item' + (available ? '' : ' unavailable');
    div.innerHTML = '<h3>' + item.icon + ' ' + item.name + '</h3><div class="price">' + item.price + ' ¤</div><p>' + item.desc + '</p>';
    const btn = document.createElement('button');
    btn.className = 'btn small';
    btn.textContent = available ? 'Купить' : 'Недоступно';
    btn.disabled = !available || G.player.gold < item.price;
    btn.addEventListener('click', () => buyItem(item.id));
    div.appendChild(btn);
    DOM.shopGrid.appendChild(div);
  }
  DOM.healBtn.disabled = G.player.gold < 25 || (G.player.health >= G.player.maxHealth && G.player.bleeding <= 0);
}

function shopItemAvailable(id) {
  const p = G.player;
  if (!p) return false;
  if (id === 'prostheticArm') return p.injuries.arm && !p.prosthetics.arm;
  if (id === 'prostheticEye') return p.injuries.eye && !p.prosthetics.eye;
  if (id === 'prostheticLeg') return p.injuries.leg && !p.prosthetics.leg;
  if (id === 'wheelchair') return p.injuries.leg && !p.prosthetics.leg && !p.wheelchairOwned;
  if (id === 'eyepatch') return p.injuries.eye && !p.prosthetics.eye && !p.eyepatch;
  if (id === 'sword') return p.swordBonus === 0;
  if (id === 'armor') return !p.armor;
  return true;
}

function buyItem(id) {
  const item = SHOP_ITEMS.find(i => i.id === id);
  const p = G.player;
  if (!item || !p || !shopItemAvailable(id)) return false;
  if (p.gold < item.price) {
    toast('Не хватает золота: нужно ' + item.price + ' ¤.', 'bad');
    return false;
  }
  p.gold -= item.price;
  if (id === 'bandage') p.bandages++;
  else if (id === 'potion') p.potions++;
  else if (id === 'prostheticArm') {
    p.injuries.arm = false; p.prosthetics.arm = true; p.bleeding = 0;
    toast('Железная рука закреплена. Сила удара восстановлена.', 'good');
  } else if (id === 'prostheticEye') {
    p.injuries.eye = false; p.prosthetics.eye = true; p.eyepatch = false;
    toast('Стеклянный глаз вставлен. Слепая зона исчезла.', 'good');
  } else if (id === 'prostheticLeg') {
    p.injuries.leg = false; p.prosthetics.leg = true; p.wheelchairOut = false; p.bleeding = 0;
    toast('Деревянно-стальной протез ноги. Можно снова бегать и прыгать.', 'good');
  } else if (id === 'wheelchair') {
    p.wheelchairOwned = true; p.wheelchairOut = true;
    toast('Боевая коляска собрана. Клавиша 3 — сложить или разложить.', 'good');
  } else if (id === 'eyepatch') {
    p.eyepatch = true;
    toast('Повязка прикрывает глазницу. Мир всё ещё наполовину темен.', 'good');
  } else if (id === 'sword') {
    p.swordBonus = 8;
    toast('Клеймора пограничья: +8 к урону.', 'good');
  } else if (id === 'armor') {
    p.armor = true;
    toast('Дублёная броня: входящий урон снижен на 25%.', 'good');
  }
  if (!['bandage', 'potion', 'prostheticArm', 'prostheticEye', 'prostheticLeg', 'wheelchair', 'eyepatch', 'sword', 'armor'].includes(id)) {
    toast('Покупка совершена.', 'good');
  }
  updateHUD();
  updateInjuryUI();
  refreshShop();
  if (!DOM.inventoryModal.hidden) refreshInventory();
  autoSave();
  return true;
}

function healAtShop() {
  const p = G.player;
  if (!p || p.gold < 25) return;
  p.gold -= 25;
  p.health = p.maxHealth;
  p.bleeding = 0;
  toast('Лекарь промыл раны и остановил кровь. HP восстановлено.', 'good');
  updateHUD();
  refreshShop();
  autoSave();
}

/* ----------------------------- inventory -------------------------------- */

function openInventory() {
  if (G.mode !== 'playing' || G.paused) return;
  G.paused = true;
  releasePointer();
  DOM.inventoryModal.hidden = false;
  refreshInventory();
}

function refreshInventory() {
  const p = G.player;
  if (!p) return;
  const injuryText = (lost, prosthetic, other = '') => prosthetic ? 'протез' : lost ? 'потеряна' : other || 'цела';
  const lines = [
    ['Здоровье', Math.max(0, Math.ceil(p.health)) + ' / ' + p.maxHealth, p.health < 40 ? 'bad' : 'good'],
    ['Кровотечение', p.bleeding > 0 ? 'сильное (' + p.bleeding.toFixed(1) + '/с)' : 'нет', p.bleeding > 0 ? 'bad' : 'good'],
    ['Рука', injuryText(p.injuries.arm, p.prosthetics.arm), p.injuries.arm && !p.prosthetics.arm ? 'bad' : 'good'],
    ['Глаз', injuryText(p.injuries.eye, p.prosthetics.eye, p.eyepatch ? 'под повязкой' : 'цел'), p.injuries.eye && !p.prosthetics.eye ? 'bad' : 'good'],
    ['Нога', injuryText(p.injuries.leg, p.prosthetics.leg, p.wheelchairOut ? 'коляска' : 'цела'), p.injuries.leg && !p.prosthetics.leg ? 'bad' : 'good'],
    ['Броня', p.armor ? 'дублёная кожа' : 'нет', p.armor ? 'good' : ''],
    ['Клеймора', p.swordBonus ? '+' + p.swordBonus + ' урона' : 'обычный клинок', p.swordBonus ? 'good' : '']
  ];
  DOM.bodyLines.innerHTML = lines.map(([k, v, cls]) => '<div class="status-line"><span>' + k + '</span><strong class="' + cls + '">' + v + '</strong></div>').join('');
  const rows = [
    ['Золото', p.gold + ' ¤'],
    ['Бинты', p.bandages],
    ['Эликсиры', p.potions],
    ['Коляска', p.wheelchairOwned ? (p.wheelchairOut ? 'разложена' : 'сложена') : 'нет'],
    ['Протез руки', p.prosthetics.arm ? 'есть' : 'нет'],
    ['Протез глаза', p.prosthetics.eye ? 'есть' : 'нет'],
    ['Протез ноги', p.prosthetics.leg ? 'есть' : 'нет']
  ];
  DOM.inventoryRows.innerHTML = rows.map(([k, v]) => '<div class="inv-row"><span>' + k + '</span><b>' + v + '</b></div>').join('');
  DOM.invSubtitle.textContent = FACTIONS[G.faction].title + ' · ' + FACTIONS[G.faction].name;
  DOM.useBandage.disabled = p.bandages <= 0 || p.dead;
  DOM.usePotion.disabled = p.potions <= 0 || p.dead;
  DOM.toggleChair.disabled = !p.wheelchairOwned || !p.injuries.leg || p.prosthetics.leg;
}

function useBandage() {
  const p = G.player;
  if (!p || p.bandages <= 0) return;
  p.bandages--;
  p.bleeding = 0;
  p.health = Math.min(p.maxHealth, p.health + 15);
  toast('Бинт наложен. Кровотечение остановлено, +15 HP.', 'good');
  updateHUD();
  refreshInventory();
}

function usePotion() {
  const p = G.player;
  if (!p || p.potions <= 0) return;
  p.potions--;
  p.health = Math.min(p.maxHealth, p.health + 55);
  toast('Эликсир выпит: +55 HP.', 'good');
  updateHUD();
  refreshInventory();
}

function toggleWheelchair() {
  const p = G.player;
  if (!p || !p.wheelchairOwned || !p.injuries.leg || p.prosthetics.leg) {
    toast('Коляска сейчас бесполезна.', '');
    return;
  }
  p.wheelchairOut = !p.wheelchairOut;
  if (p.wheelchairOut) p.y = 0;
  toast(p.wheelchairOut ? 'Коляска разложена. Скорость выше, прыжок недоступен.' : 'Коляска сложена. Вы ползёте.', 'good');
  updateHUD();
  refreshInventory();
}

/* --------------------------- modal management --------------------------- */

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.hidden = true;
  const anyOpen = ['shop-modal', 'inventory-modal', 'command-modal', 'map-modal', 'pause-screen'].some(mid => {
    const el = document.getElementById(mid);
    return el && !el.hidden;
  });
  if (!anyOpen && G.mode === 'playing') {
    G.paused = false;
    requestPointerLockSafe();
  }
}

function closeAllModals() {
  for (const id of ['shop-modal', 'inventory-modal', 'command-modal', 'map-modal']) {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  }
}

function togglePause() {
  if (G.mode !== 'playing') return;
  if (G.paused) {
    DOM.pauseScreen.hidden = true;
    G.paused = false;
    requestPointerLockSafe();
  } else {
    closeAllModals();
    G.paused = true;
    releasePointer();
    DOM.pauseScreen.hidden = false;
  }
}

function requestPointerLockSafe() {
  if (!canvas || document.pointerLockElement === canvas) return;
  try {
    const result = canvas.requestPointerLock();
    if (result && typeof result.catch === 'function') result.catch(() => {});
  } catch (e) { /* браузер может запретить без клика */ }
}

function releasePointer() {
  if (document.pointerLockElement) {
    try { document.exitPointerLock(); } catch (e) {}
  }
}

function returnToMenu() {
  closeAllModals();
  DOM.pauseScreen.hidden = true;
  DOM.deathScreen.hidden = true;
  G.mode = 'menu';
  G.paused = false;
  releasePointer();
  DOM.hud.style.opacity = '0';
  DOM.startScreen.hidden = false;
  menuPreview();
  refreshContinueButton();
}

function refreshContinueButton() {
  try {
    const has = !!localStorage.getItem(SAVE_KEY);
    DOM.continueBtn.disabled = !has;
    DOM.continueBtn.textContent = has ? 'Загрузить сохранение' : 'Сохранения нет';
  } catch (e) {
    DOM.continueBtn.disabled = true;
  }
}

/* ----------------------------- save / load ------------------------------ */

function saveGame(silent = false) {
  if (!G.player || G.mode === 'dead') return false;
  try {
    const data = {
      version: 1,
      savedAt: Date.now(),
      faction: G.faction,
      side: G.side,
      player: JSON.parse(JSON.stringify(G.player)),
      actors: JSON.parse(JSON.stringify(G.actors)),
      caravans: JSON.parse(JSON.stringify(G.caravans)),
      quest: G.quest ? JSON.parse(JSON.stringify(G.quest)) : null,
      questChain: JSON.parse(JSON.stringify(G.questChain)),
      rep: { ...G.rep },
      loyalty: G.loyalty,
      stats: { ...G.stats },
      armyOrder: G.armyOrder,
      nextRaid: G.nextRaid,
      worldTime: G.worldTime,
      hour: G.hour,
      currentZone: G.currentZone
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    G.lastSave = 0;
    if (!silent) toast('Игра сохранена.', 'good');
    refreshContinueButton();
    return true;
  } catch (e) {
    if (!silent) toast('Не удалось сохранить: браузер запретил localStorage.', 'bad');
    return false;
  }
}

function loadGame(silent = false) {
  let data;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      if (!silent) toast('Сохранение не найдено.', 'bad');
      return false;
    }
    data = JSON.parse(raw);
  } catch (e) {
    if (!silent) toast('Сохранение повреждено.', 'bad');
    return false;
  }
  if (!data || !FACTIONS[data.faction]) return false;
  resetWorld(data.faction, false);
  G.player = Object.assign(makePlayer(data.faction), data.player || {});
  G.player.injuries = Object.assign({ arm: false, eye: false, leg: false }, data.player?.injuries || {});
  G.player.prosthetics = Object.assign({ arm: false, eye: false, leg: false }, data.player?.prosthetics || {});
  if (Array.isArray(data.actors)) G.actors = data.actors;
  if (Array.isArray(data.caravans)) G.caravans = data.caravans;
  G.quest = data.quest ? Object.assign({}, data.quest) : null;
  G.questChain = Array.isArray(data.questChain) ? data.questChain : [];
  if (data.rep) G.rep = Object.assign(G.rep, data.rep);
  G.loyalty = data.loyalty ?? G.loyalty;
  G.stats = Object.assign(G.stats, data.stats || {});
  G.armyOrder = data.armyOrder || 'follow';
  G.nextRaid = data.nextRaid ?? 105;
  G.worldTime = data.worldTime || 0;
  G.hour = data.hour || 16.2;
  G.currentZone = data.currentZone || nearestZone(G.player.x, G.player.z).id;
  G.mode = 'playing';
  G.paused = false;
  G.particles = [];
  nextActorId = G.actors.reduce((m, a) => Math.max(m, a.id || 0), 0) + 1;
  DOM.startScreen.hidden = true;
  DOM.deathScreen.hidden = true;
  DOM.pauseScreen.hidden = true;
  closeAllModals();
  DOM.hud.style.opacity = '1';
  updateHUD();
  updateInjuryUI();
  updateQuestUI();
  updateZoneUI(true);
  const z = ZONE_BY_ID[G.currentZone] || nearestZone(G.player.x, G.player.z);
  DOM.zoneName.textContent = z.name;
  DOM.zoneSub.textContent = z.sub;
  toast('Сохранение загружено: ' + FACTIONS[G.faction].name + '.', 'good');
  requestPointerLockSafe();
  return true;
}

function autoSave() {
  if (G.mode === 'playing') saveGame(true);
}

/* ----------------------------- run update ------------------------------- */

function updateGame(dt) {
  G.time += dt;
  G.worldTime += dt;
  G.hour = (16.2 + G.worldTime / 240) % 24;
  updatePlayer(dt);
  updateActors(dt);
  updateCaravans(dt);
  updateParticles(dt);
  updateFires(dt);
  updateZoneUI();
  G.nextRaid -= dt;
  if (G.nextRaid <= 0) spawnRaid();

  const active = G.actors.filter(a => !a.dead).length;
  if (active > 88) {
    const victim = G.actors.find(a => a.dead && a.deadTime > 20);
    if (victim) G.actors.splice(G.actors.indexOf(victim), 1);
  }

  G.uiTime += dt;
  if (G.uiTime > 0.12) {
    G.uiTime = 0;
    updateHUD();
    updateInteractionPrompt();
    drawMinimap();
  }
  G.lastSave += dt;
  if (G.lastSave > 28) {
    G.lastSave = 0;
    autoSave();
  }
}

function updateMenuPreview(dt) {
  G.time += dt;
  G.worldTime += dt;
  G.camera.yaw += dt * 0.035;
  updateParticles(dt);
  updateFires(dt);
}

/* ------------------------------- input ---------------------------------- */

const gameKeys = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'Space',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyE', 'KeyV', 'KeyM',
  'Tab', 'Escape', 'KeyP', 'F6', 'F9', 'Digit1', 'Digit2', 'Digit3'
]);

window.addEventListener('keydown', e => {
  if (gameKeys.has(e.code)) e.preventDefault();
  keys[e.code] = true;
  if (e.repeat) return;

  if (e.code === 'Escape') {
    if (!DOM.shopModal.hidden) { closeModal('shop-modal'); return; }
    if (!DOM.inventoryModal.hidden) { closeModal('inventory-modal'); return; }
    if (!DOM.commandModal.hidden) { closeModal('command-modal'); return; }
    if (!DOM.mapModal.hidden) { closeModal('map-modal'); return; }
    if (G.mode === 'playing') togglePause();
    return;
  }
  if (G.mode !== 'playing') return;
  if (e.code === 'Tab') {
    e.preventDefault();
    if (!DOM.inventoryModal.hidden) closeModal('inventory-modal');
    else if (!G.paused) openInventory();
    return;
  }
  if (e.code === 'KeyM') {
    if (G.paused) return;
    G.paused = true;
    releasePointer();
    drawBigMap();
    DOM.mapModal.hidden = false;
    return;
  }
  if (G.paused) return;
  if (e.code === 'KeyE') performInteraction();
  else if (e.code === 'KeyV') {
    if (G.faction === 'villain') openCommandModal();
    else if (G.faction === 'elf') rallyElves();
    else toast('Приказы отдаёт командир Арден. Подойдите к нему у ворот.', '');
  } else if (e.code === 'Space') jumpPlayer();
  else if (e.code === 'F6') {
    if (saveGame()) { /* toast внутри */ }
  } else if (e.code === 'F9') {
    loadGame();
  } else if (e.code === 'Digit1') useBandage();
  else if (e.code === 'Digit2') usePotion();
  else if (e.code === 'Digit3') toggleWheelchair();
  else if (e.code === 'KeyP') togglePause();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

canvas.addEventListener('mousedown', e => {
  if (G.mode !== 'playing' || G.paused) return;
  if (e.button === 0) {
    keys.MouseLeft = true;
    DOM.screenHint.textContent = '';
    if (document.pointerLockElement !== canvas) requestPointerLockSafe();
  } else if (e.button === 2) {
    keys.MouseRight = true;
  }
});
window.addEventListener('mouseup', e => {
  if (e.button === 0) keys.MouseLeft = false;
  if (e.button === 2) keys.MouseRight = false;
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('blur', () => {
  for (const k of Object.keys(keys)) keys[k] = false;
});
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas && G.mode === 'playing') {
    DOM.screenHint.textContent = '';
  } else if (G.mode === 'playing' && !G.paused && document.querySelector('.modal-backdrop:not([hidden])') === null) {
    DOM.screenHint.textContent = 'КЛИК ПО ПОЛЮ — ВЕРНУТЬ МЫШЬ · ESC — ПАУЗА';
  }
});
document.addEventListener('mousemove', e => {
  if (document.pointerLockElement !== canvas || G.mode !== 'playing' || G.paused) return;
  G.camera.yaw += e.movementX * 0.00215;
  G.camera.pitch = clamp(G.camera.pitch - e.movementY * 0.00145, -0.52, 0.30);
});
canvas.addEventListener('wheel', e => {
  if (G.mode !== 'playing') return;
  G.camera.dist = clamp(G.camera.dist + Math.sign(e.deltaY) * 0.65, 4.8, 15);
  e.preventDefault();
}, { passive: false });

/* ------------------------------ UI bindings ----------------------------- */

for (const btn of document.querySelectorAll('.faction-card')) {
  btn.addEventListener('click', () => beginGame(btn.dataset.faction));
}
DOM.continueBtn.addEventListener('click', () => loadGame());
document.getElementById('help-btn').addEventListener('click', showHelpOverlay);
for (const btn of document.querySelectorAll('[data-close]')) {
  btn.addEventListener('click', () => closeModal(btn.dataset.close));
}
DOM.healBtn.addEventListener('click', healAtShop);
document.getElementById('use-bandage').addEventListener('click', useBandage);
document.getElementById('use-potion').addEventListener('click', usePotion);
document.getElementById('toggle-chair').addEventListener('click', toggleWheelchair);
document.getElementById('inv-save').addEventListener('click', () => {
  if (saveGame()) { closeModal('inventory-modal'); }
});
document.getElementById('inv-load').addEventListener('click', () => loadGame());
document.getElementById('inv-menu').addEventListener('click', returnToMenu);
document.getElementById('resume-btn').addEventListener('click', togglePause);
document.getElementById('pause-save').addEventListener('click', () => saveGame());
document.getElementById('pause-load').addEventListener('click', () => loadGame());
document.getElementById('pause-menu').addEventListener('click', returnToMenu);
document.getElementById('death-load').addEventListener('click', () => loadGame());
document.getElementById('death-restart').addEventListener('click', () => beginGame(G.faction || 'guard'));
document.getElementById('death-menu').addEventListener('click', returnToMenu);

function showHelpOverlay() {
  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  back.style.zIndex = '55';
  back.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-head">
        <div><h2>Управление</h2><p>Мышь захватывается кликом по игровому полю. Esc освобождает её.</p></div>
        <button class="btn small" data-help-close>Закрыть</button>
      </div>
      <div class="modal-body">
        <div class="status-line"><span>Движение</span><strong>W A S D</strong></div>
        <div class="status-line"><span>Обзор</span><strong>мышь / ← → ↑ ↓</strong></div>
        <div class="status-line"><span>Атака</span><strong>ЛКМ (удерживать)</strong></div>
        <div class="status-line"><span>Блок</span><strong>ПКМ (удерживать)</strong></div>
        <div class="status-line"><span>Прыжок</span><strong>Space</strong></div>
        <div class="status-line"><span>Действие / торговля / приказ</span><strong>E</strong></div>
        <div class="status-line"><span>Военный совет злодея</span><strong>V</strong></div>
        <div class="status-line"><span>Состояние и сумка</span><strong>Tab</strong></div>
        <div class="status-line"><span>Карта мира</span><strong>M</strong></div>
        <div class="status-line"><span>Бинт / эликсир / коляска</span><strong>1 / 2 / 3</strong></div>
        <div class="status-line"><span>Сохранить / загрузить</span><strong>F6 / F9</strong></div>
        <div class="status-line"><span>Пауза</span><strong>P или Esc</strong></div>
        <p style="color:#9f9887;font-size:10px;line-height:1.6;margin-top:14px">Модель запуска: <span style="color:#d8c38d">deepseek-v4.1-flash-1017</span>. Все объекты и лес отрисовываются собственным Canvas-3D-рендерером без внешних библиотек.</p>
      </div>
    </div>`;
  document.getElementById('app').appendChild(back);
  const close = () => back.remove();
  back.querySelector('[data-help-close]').addEventListener('click', close);
  back.addEventListener('click', e => { if (e.target === back) close(); });
}

/* ------------------------------- main loop ------------------------------ */

function frame(now) {
  const rawDt = (now - lastFrame) / 1000;
  lastFrame = now;
  const dt = clamp(rawDt, 0, 0.05);

  if (G.mode === 'playing' && !G.paused) updateGame(dt);
  else if (G.mode === 'menu') updateMenuPreview(dt);
  else updateParticles(dt * 0.3);

  renderScene();

  G.frameCount++;
  G.fpsTime += rawDt;
  if (G.fpsTime >= 0.65) {
    G.fps = Math.round(G.frameCount / G.fpsTime);
    DOM.fpsTag.textContent = 'canvas3d · ' + G.fps + ' fps · LOD ' + (G.trees.length ? 'on' : '—');
    G.frameCount = 0;
    G.fpsTime = 0;
  }
  requestAnimationFrame(frame);
}

/* ------------------------------ self-test ------------------------------- */

function runSelfTest() {
  const results = [];
  let failed = 0;
  const check = (name, condition, detail = '') => {
    const ok = !!condition;
    if (!ok) failed++;
    results.push((ok ? 'PASS' : 'FAIL') + ' · ' + name + (detail ? ' — ' + detail : ''));
  };
  try {
    beginGame('guard', { silent: true });
    check('четыре игровые зоны', ZONES.length === 4 && new Set(ZONES.map(z => z.id)).size === 4);
    check('густой лес сгенерирован', G.trees.length > 500, G.trees.length + ' деревьев');
    check('три спрайта дальнего леса', TREE_SPRITES.length === 3);
    check('LOD: ближнее дерево — 3D, дальнее — спрайт', treeLodIs3D(12) && !treeLodIs3D(160), 'порог ' + TREE_LOD_DISTANCE + ' м');
    check('актёры и караваны существуют', G.actors.length > 20 && G.caravans.length >= 3, G.actors.length + ' актёров');

    // Ближний бой, смерть, труп и добыча.
    const p = G.player;
    p.x = 900; p.z = 700; p.health = 100; p.bleeding = 0;
    const goldBefore = p.gold;
    const enemy = makeActor('villain_raider', 901, 702, { gold: 17 });
    G.actors.push(enemy);
    damageActor(enemy, 999, 'player');
    const corpseFaces = [];
    addActorFaces(corpseFaces, enemy);
    check('враг убит и остался 3D-трупом', enemy.dead && enemy.deadTime === 0 && corpseFaces.length >= 8, corpseFaces.length + ' 3D-граней');
    check('за убийство начислено золото', p.gold === goldBefore + 17, 'было ' + goldBefore + ', стало ' + p.gold);

    // Ранения и протезы.
    p.health = 100; p.bleeding = 0;
    injurePlayer('arm', 'тест');
    check('рука отрублена и началось кровотечение', p.injuries.arm && p.bleeding > 0);
    p.gold = 2000;
    buyItem('prostheticArm');
    check('протез руки восстановил конечность', !p.injuries.arm && p.prosthetics.arm);
    injurePlayer('eye', 'тест');
    check('выколот глаз включает слепую зону', p.injuries.eye && !p.prosthetics.eye);
    buyItem('prostheticEye');
    check('протез глаза убирает слепую зону', !p.injuries.eye && p.prosthetics.eye);
    injurePlayer('leg', 'тест');
    check('перебита нога', p.injuries.leg && !p.prosthetics.leg);
    buyItem('wheelchair');
    check('коляска куплена и разложена', p.wheelchairOwned && p.wheelchairOut);
    buyItem('prostheticLeg');
    check('протез ноги вернул прыжок', !p.injuries.leg && p.prosthetics.leg);

    // Задание.
    setQuest({ id: 'test_kill', title: 'Тест', desc: '', type: 'kill', target: 'villain', need: 2, reward: 0 });
    const e2 = makeActor('villain_raider', 902, 704, { gold: 1 });
    G.actors.push(e2);
    damageActor(e2, 999, 'player');
    check('прогресс задания засчитан', G.quest.progress === 1, 'прогресс ' + G.quest.progress);

    // ИИ: враг должен приблизиться и нанести урон.
    p.x = 900; p.z = 700; p.y = 0;
    p.health = 100; p.bleeding = 0;
    p.injuries = { arm: false, eye: false, leg: false };
    p.prosthetics = { arm: false, eye: false, leg: false };
    p.wheelchairOut = false;
    const aiEnemy = makeActor('villain_raider', 903, 700, { aggroPlayer: true, gold: 0 });
    aiEnemy.attackCd = 0.05;
    G.actors.push(aiEnemy);
    for (let i = 0; i < 110; i++) updateActors(1 / 60);
    check('ИИ преследует и атакует игрока', p.health < 100, 'HP ' + Math.ceil(p.health));
    aiEnemy.dead = true;
    p.health = 100; p.bleeding = 0;
    p.injuries = { arm: false, eye: false, leg: false };
    p.prosthetics = { arm: false, eye: false, leg: false };

    // Караван.
    const caravan = G.caravans[0];
    p.x = caravan.x; p.z = caravan.z;
    const beforeRob = p.gold;
    robCaravan(caravan);
    check('караван ограблен, золото начислено', caravan.robbed && p.gold > beforeRob);

    // Сохранение и загрузка.
    p.gold = 777;
    const savedOk = saveGame(true);
    p.gold = 1;
    const loadedOk = loadGame(true);
    check('сохранение в localStorage', savedOk);
    check('загрузка восстановила золото', loadedOk && G.player.gold === 777, 'золото ' + G.player.gold);

    // Приказ командира стражи.
    beginGame('guard', { silent: true });
    const actorsBeforeOrder = G.actors.length;
    giveCommanderOrder();
    check('командир выдаёт приказ и высылает цель', G.quest && G.quest.id.indexOf('order_') === 0 && G.actors.length >= actorsBeforeOrder + 3, G.actors.length - actorsBeforeOrder + ' новых врагов');

    // Команды злодея и союзники.
    beginGame('villain', { silent: true });
    const alliesBefore = G.actors.filter(a => a.faction === 'villain' && a.follow && !a.dead).length;
    issueArmyOrder('palace');
    const alliesAfter = G.actors.filter(a => a.faction === 'villain' && a.follow && !a.dead).length;
    check('злодей отдаёт приказ и получает отряд', alliesAfter > alliesBefore && G.armyOrder === 'palace');
    check('приказ сформировал цель штурма', G.quest && G.quest.id === 'assault_palace');

    check('прыжок доступен здоровому герою', jumpPlayer() === true, 'vy=' + G.player.vy.toFixed(1));
  } catch (err) {
    failed++;
    results.push('FAIL · исключение: ' + (err && err.stack ? err.stack : err));
  }
  const summary = (failed === 0 ? 'SELFTEST OK' : 'SELFTEST FAILED') + ' · ' + (results.length - failed) + '/' + results.length + ' проверок пройдено · модель ' + MODEL_NAME;
  DOM.selftestResults.style.display = 'block';
  DOM.selftestResults.textContent = summary + '\n\n' + results.join('\n');
  window.__SELFTEST__ = { ok: failed === 0, failed, total: results.length, results, summary };
  console.log(summary);
  console.log(results.join('\n'));
}

/* ------------------------------- bootstrap ------------------------------ */

function bootstrap() {
  resizeCanvas();
  initTreeSprites();

  // Контейнер уведомлений должен быть виден поверх модальных окон.
  const app = document.getElementById('app');
  app.appendChild(DOM.toastStack);
  DOM.toastStack.style.zIndex = '65';

  refreshContinueButton();
  menuPreview();
  DOM.hud.style.opacity = '0';
  DOM.startScreen.hidden = false;

  const params = new URLSearchParams(location.search);
  const auto = params.get('autostart');
  if (auto && FACTIONS[auto]) beginGame(auto, { silent: params.has('silent') });
  if (params.has('selftest')) {
    setTimeout(runSelfTest, 120);
  }

  // Публичный API для отладки и проверки механик.
  window.KOROVANY = {
    G, beginGame, loadGame, saveGame, playerAttack, jumpPlayer, injurePlayer, buyItem,
    damageActor, robCaravan, setQuest, issueArmyOrder, runSelfTest,
    zones: ZONES, model: MODEL_NAME
  };

  requestAnimationFrame(frame);
}

try {
  bootstrap();
} catch (err) {
  console.error('Не удалось запустить игру:', err);
  if (typeof window.__showKorovanyError === 'function') {
    window.__showKorovanyError(err && (err.stack || err.message) ? (err.stack || err.message) : err);
  }
}

// Глобальное состояние игры, шина событий и настройки.
// Все модули импортируют G и работают с ним (единый контекст, без DI-цирка).
const SETTINGS_KEY = 'korovany_ds41_settings_v1';

export const G = {
  // --- three ---
  scene: null, camera: null, renderer: null, canvas: null, clock: null, sun: null, sky: null,
  // --- meta ---
  version: '1.0', started: false, running: false, paused: false, uiOpen: false, gameOver: false,
  loading: true, seed: 1, seedRaw: '', faction: 'elf', difficulty: 'normal', tutorial: true,
  // --- entities ---
  player: null, entities: [], projectiles: [], gore: [], corpses: [], droppedItems: [], containers: [],
  caravans: [], particles: null, decals: [], lights: [],
  // --- world refs ---
  world: null, ui: null, audio: null, factions: null, economy: null, quests: null, save: null,
  colliders: [], zones: [], places: [], roadPoints: [], waterY: 0,
  // --- time & weather ---
  time: { seconds: 8 * 3600, day: 1, speed: 40 }, weather: { rain: 0, fog: 1, wind: 0.6 },
  // --- stats/session ---
  stats: { kills: 0, severed: 0, caravansRobbed: 0, deaths: 0, playtime: 0, questsDone: 0, goldEarned: 0 },
  messages: [],
  // --- helpers injected at runtime ---
  now: 0,
};

export const SETTINGS = {
  viewDist: 900, fov: 75, sens: 1, volume: 0.7, shadows: true, grass: true,
  invertY: false, blood: true, music: true, hints: true, quality: 'high',
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) Object.assign(SETTINGS, JSON.parse(raw));
  } catch (e) { /* пусто */ }
  return SETTINGS;
}
export function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(SETTINGS)); } catch (e) { /* пусто */ }
}

// ------------------------- шина событий -------------------------
const listeners = new Map();
export function on(evt, fn) {
  if (!listeners.has(evt)) listeners.set(evt, []);
  listeners.get(evt).push(fn);
  return () => off(evt, fn);
}
export function off(evt, fn) {
  const arr = listeners.get(evt);
  if (arr) { const i = arr.indexOf(fn); if (i >= 0) arr.splice(i, 1); }
}
export function emit(evt, data) {
  const arr = listeners.get(evt);
  if (!arr) return;
  for (let i = 0; i < arr.length; i++) {
    try { arr[i](data); } catch (e) { console.error('[event]', evt, e); }
  }
}

export const notify = (text, kind = '') => emit('notify', { text, kind });
export const say = (who, text) => emit('subtitle', { who, text });
export const banner = (text) => emit('banner', { text });

// Множество «мёртвых» сущностей, чтобы не возрождались после загрузки.
export function entityById(id) { return G.entities.find((e) => e.id === id) || null; }
export function playerPos() {
  return G.player ? G.player.pos : { x: 0, y: 0, z: 0 };
}
export function isNight() {
  const h = (G.time.seconds / 3600) % 24;
  return h < 5.5 || h > 21;
}
export function timeOfDay01() { return ((G.time.seconds / 86400) % 1 + 1) % 1; }

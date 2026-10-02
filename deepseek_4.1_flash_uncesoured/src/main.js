// Точка входа: загрузка мира, меню, игровой цикл, связка всех систем.
import * as THREE from 'three';
import { G, SETTINGS, loadSettings, on, emit, notify, say, banner } from './core/state.js';
import { clamp, dist2D, formatClock } from './core/mathutil.js';
import { Input } from './core/input.js';
import { AudioSys } from './core/audio.js';
import { makeWorldSeed, Rand } from './core/rng.js';
import { buildTerrain, updateWater, heightAt, zoneAt, placeNear, groundMaterial, terrainHeight } from './world/terrain.js';
import { buildForest, updateForest, updateForestColors, resolveTreeCollision, forestStats } from './world/forest.js';
import { buildProps, updateProps, propFog } from './world/props.js';
import { buildSettlements, updateSettlements, SPAWNS, LANDMARKS } from './world/settlements.js';
import { buildColliderGrid, clearColliders, surfaceHeight, resolveCollisions } from './world/collision.js';
import { initSky, updateSky, skyLightFactor } from './world/sky.js';
import { createPlayer, updatePlayer, respawnPlayer, addXP, gainGold, damagePlayer, severPlayerPart, installProsthetic } from './entities/player.js';
import { spawnNPC, spawnInitialPopulation, updateEntities, updateRaids, updateSpies, updateSquads, despawnFar, createSquad, fillSquad, spawnRaid, commandSquad } from './systems/npc.js';
import { initCombat, initArrows, updateArrows, updateGore, meleeSwing, spawnArrow, bloodBurst, isHostileToPlayer } from './systems/combat.js';
import { initEconomy, dailyInterest } from './systems/economy.js';
import { initQuests } from './systems/quests.js';
import { initSave } from './systems/save.js';
import { spawnCaravan, updateCaravans, aggroCaravan, caravanAftermath, despawnCaravans } from './systems/caravan.js';
import { initHUD, updateHUD, showDeathScreen, hitMarker, addNotification } from './ui/hud.js';
import { initPanels, showScreen, closeAllPanels, anyPanelOpen, openPanel, travelTo } from './ui/panels.js';

const LOAD_TIPS = [
  'Отрубленную руку перевязывают бинтом [F], иначе кровь уносит жизнь.',
  'Протезы продаёт костоправ — в Тихом Броде, во дворце и в Луннолесье.',
  'Коляска [G] быстрее ползания, если потерял обе ноги.',
  'Вдали деревья — картинки; подойдёшь ближе — станут объёмными.',
  'Корованы идут по тракту между Тихим Бродом и дворцом. Грабь.',
  'Стражник слушается капитана Ратмира: приказы дают золото и звание.',
  'Дрегар сам себе командир: найми отряд в форте и веди на дворец.',
  'Эльфам в лесу помогает гуща: стреляй из-за стволов.',
];

let root = null;
let started = false;
let autosaveTimer = 120;
let fpsAcc = 0, fpsCount = 0, fps = 60, lowFpsTime = 0;
const clock = new THREE.Clock();
let pendingSeed = null;

// ------------------------- загрузка -------------------------
function setupRenderer() {
  const canvas = document.getElementById('game-canvas');
  G.canvas = canvas;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = SETTINGS.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  G.renderer = renderer;
  G.camera = new THREE.PerspectiveCamera(SETTINGS.fov, window.innerWidth / window.innerHeight, 0.08, 3200);
  G.camera.rotation.order = 'YXZ';
  G.scene = new THREE.Scene();
  G.clock = clock;
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    G.camera.aspect = window.innerWidth / window.innerHeight;
    G.camera.updateProjectionMatrix();
  });
}

const frame = () => new Promise((r) => requestAnimationFrame(() => r()));

async function buildWorld(seedRaw, onProgress = () => {}) {
  if (root) {
    G.scene.remove(root);
    root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    clearColliders();
    for (const e of G.entities) if (e.group.parent) e.group.parent.remove(e.group);
    G.entities.length = 0;
    G.containers.length = 0;
    G.corpses.length = 0;
    despawnCaravans();
  }
  G.seedRaw = seedRaw;
  G.seed = makeWorldSeed(seedRaw);
  root = new THREE.Group();
  root.name = 'world';
  G.scene.add(root);

  onProgress(0.05, 'поднимаем горы и реки…');
  buildTerrain(root);
  await frame();
  onProgress(0.28, 'выравниваем дороги и мосты…');
  await frame();
  onProgress(0.35, 'проращиваем густой лес…');
  buildForest(root);
  await frame();
  onProgress(0.62, 'разбрасываем камни и травы…');
  buildProps(root);
  await frame();
  onProgress(0.74, 'строим дворец и деревни…');
  buildSettlements(root);
  await frame();
  buildColliderGrid();
  onProgress(0.9, 'заселяем земли…');
  await frame();
  const settlements = await import('./world/settlements.js');
  G.worldShops = settlements.SHOPS;
  G.worldBeds = settlements.BEDS;
  G.landmarks = LANDMARKS;
  G.zoneAt = zoneAt;
  G.surfaceHeight = surfaceHeight;
  G.placeName = () => (placeNear(G.player ? G.player.pos.x : 0, G.player ? G.player.pos.z : 0) || { name: '—' }).name;
  G.discovered = G.discovered || new Set();
  spawnInitialPopulation();
  onProgress(1, 'готово');
  await frame();
}

function applyDifficulty() {
  const d = G.difficulty;
  const p = G.player;
  if (d === 'easy') { p.hpMax *= 1.25; p.hp = p.hpMax; p.dmgMul = 1.15; }
  else if (d === 'hard') { p.hpMax *= 0.85; p.hp = p.hpMax; }
  else if (d === 'ironman') { p.hpMax *= 0.9; p.hp = p.hpMax; }
  for (const e of G.entities) {
    if (d === 'easy') { e.hpMax *= 0.85; e.hp = e.hpMax; e.dmg *= 0.85; }
    else if (d === 'hard') { e.hpMax *= 1.2; e.hp = e.hpMax; e.dmg *= 1.25; }
    else if (d === 'ironman') { e.hpMax *= 1.35; e.hp = e.hpMax; e.dmg *= 1.4; }
  }
}

async function startGame(opts) {
  const faction = opts.faction || 'elf';
  const seedRaw = opts.seed || G.seedRaw || 'random';
  showLoading();
  await buildWorld(seedRaw, setProgress);
  G.faction = faction;
  G.difficulty = opts.difficulty || 'normal';
  G.tutorial = opts.tutorial !== false;
  G.stats = { kills: 0, severed: 0, caravansRobbed: 0, deaths: 0, playtime: 0, questsDone: 0, goldEarned: 0 };
  G.discovered = new Set();
  G.victoryShown = false;
  G.throneCaptured = false;
  const p = createPlayer(faction);
  G.player = p;
  G.scene.add(p.group);
  applyDifficulty();
  // стартовые локации открыты
  const home = faction === 'elf' ? ['elfvillage', 'grove', 'elfcamp', 'crossroad', 'bridge_n'] : faction === 'guard' ? ['palace', 'barracks', 'crossroad', 'village', 'bridge_e'] : ['fort', 'slavemarket', 'pass', 'crossroad'];
  for (const id of home) G.discovered.add(id);
  // корованы
  spawnCaravan('trade');
  spawnCaravan('spice');
  spawnCaravan('forest');
  // задания
  if (G.quests) {
    G.quests.list.length = 0;
    G.quests.start(faction === 'elf' ? 'elf_main' : faction === 'guard' ? 'guard_main' : 'villain_main');
  }
  G.running = true;
  G.paused = false;
  G.gameOver = false;
  G.started = true;
  hideLoading();
  document.getElementById('screen-start').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  Input.requestLock();
  AudioSys.init();
  AudioSys.resume();
  // приветствие по фракции
  setTimeout(() => {
    const hello = {
      elf: ['Старейшина', 'Ты вернулся, охотник. Империя топчет наши тропы, а Дрегар шлёт тени. Смотри: лес укроет, но стрелы береги.'],
      guard: ['Капитан Ратмир', 'Встань в строй! Эльфы жгут хутора, шпионы Дрегара лезут в казармы. Служи — и дослужишься.'],
      villain: ['Владыка Дрегар', 'Ну вот ты и здесь. Легион ждёт вождя: грабь корованы, найми свору и веди её на Златоверхий дворец.'],
    }[faction];
    say(hello[0], hello[1]);
    if (G.tutorial) startTutorial(faction);
  }, 900);
  if (opts.loaded) notify('Мир восстановлен из сохранения.', 'good');
  emit('game:started', { faction });
  started = true;
}

// ------------------------- обучение -------------------------
function startTutorial(faction) {
  const hints = [
    'W A S D — идти, мышь — обзор, Shift — бег, Space — прыжок.',
    'ЛКМ — удар, ПКМ — блок. R — сменить оружие, 1–4 — быстрые слоты.',
    'E — говорить, обыскивать, открывать. F — перевязать рану.',
    `Твоя цель: ${faction === 'elf' ? 'защитить Луннолесье и покарать Дрегара' : faction === 'guard' ? 'служить капитану и защищать дворец' : 'собрать легион и взять Златоверхий дворец'}. Журнал — J, карта — M.`,
    'Esc — пауза и сохранение. F5 — быстрое сохранение.',
  ];
  hints.forEach((h, i) => setTimeout(() => addNotification('Обучение: ' + h, ''), i * 4200));
}

// ------------------------- загрузочный экран -------------------------
function setProgress(v, text) {
  const fill = document.getElementById('load-fill');
  if (fill) fill.style.width = `${Math.round(v * 100)}%`;
  const t = document.getElementById('load-text');
  if (t && text) t.textContent = text;
}
function showLoading() {
  document.getElementById('screen-loading').classList.remove('hidden');
  document.getElementById('load-tip').textContent = LOAD_TIPS[Math.floor(Math.random() * LOAD_TIPS.length)];
}
function hideLoading() { document.getElementById('screen-loading').classList.add('hidden'); }

// ------------------------- связка боя и мира -------------------------
function wireEvents() {
  on('combat:playerswing', (d) => {
    const p = G.player;
    if (!p) return;
    const heavy = d.dmg > 26;
    const hit = meleeSwing(p, { range: d.range, arc: 1.1, dmg: d.dmg, aimPitch: d.aimPitch, multi: 2, bleed: 0.3, sever: heavy });
    if (hit) hitMarker();
    // коснулись корована — охрана в ярость
    for (const c of G.caravans) {
      if (c.robbed || !c.pos) continue;
      const d2 = dist2D(p.pos.x, p.pos.z, c.pos.x, c.pos.z);
      if (d2 < 22 && c.guards.some((g) => !g.dead && g.ai.target === p)) aggroCaravan(c, p);
    }
  });
  on('combat:playerarrow', (d) => {
    const p = G.player;
    if (!p) return;
    const yaw = p.yaw, pitch = p.pitch;
    const ox = p.pos.x - Math.sin(yaw) * Math.cos(pitch) * 0.7;
    const oy = p.pos.y + p.eyeHeight - 0.1;
    const oz = p.pos.z - Math.cos(yaw) * Math.cos(pitch) * 0.7;
    spawnArrow(p, ox, oy, oz, yaw, pitch + 0.02, d.dmg, { speed: 40 + d.draw * 26, bleed: 0.25 });
  });
  on('gore:limb', ({ mesh, dir, pos, color }) => { G.gore.limb(mesh, dir, pos, color); });
  on('npc:death', ({ entity }) => {
    G.corpses.push({ entity, pos: entity.group.position, looted: false });
    if (G.corpses.length > 45) {
      const old = G.corpses.shift();
      if (old && old.entity.group.parent) old.entity.group.parent.remove(old.entity.group);
    }
    const idx = G.entities.indexOf(entity);
    if (idx >= 0) G.entities.splice(idx, 1);
    for (const c of G.caravans) if (c.guards.includes(entity)) caravanAftermath(c);
    if (entity.ai && entity.ai.squad && entity.ai.squad.leader && entity.ai.squad.leader.isPlayer) emit('squad:changed', {});
  });
  on('npc:bleed', ({ entity }) => { if (dist2D(entity.pos.x, entity.pos.z, G.player.pos.x, G.player.pos.z) < 30) bloodBurst({ x: entity.pos.x, y: entity.pos.y + entity.height * 0.6, z: entity.pos.z }, { x: 0, y: 0.3, z: 0 }, 0.4); });
  on('bark', ({ entity, text }) => { if (dist2D(entity.pos.x, entity.pos.z, G.player.pos.x, G.player.pos.z) < 26) say(entity.name, text); });
  on('spy:near', ({ entity }) => say(entity.name, 'Тише… я тут по делу.'));
  on('caravan:aggro', ({ caravan }) => say('Купец', `${caravan.name}: «Грабят! Стража, ко мне!»`));
  on('game:newday', () => dailyInterest());
  on('game:quicksave', () => { if (G.running) G.save.save('auto'); });
  on('game:quickload', () => { if (G.save.load('auto')) resumeFromLoad(); });
  on('game:save', ({ slot }) => { if (slot === 'new') { const free = ['1', '2', '3', '4'].find((s) => !localStorage.getItem('korovany_ds41_save_' + s)) || '1'; G.save.save(free); } else G.save.save(slot); });
  on('game:load', ({ slot }) => { if (G.save.load(slot)) resumeFromLoad(); });
  on('game:respawn', () => {
    const p = G.player;
    const lost = Math.round(p.gold * 0.15);
    gainGold(-lost);
    respawnPlayer();
    G.paused = false;
    closeAllPanels();
    Input.requestLock();
    if (lost) notify(`Лекарь взял ${lost} золота за спасение.`, 'bad');
  });
  on('game:tomenu', () => {
    G.running = false;
    G.paused = false;
    started = false;
    document.getElementById('hud').classList.add('hidden');
    closeAllPanels();
    document.getElementById('screen-start').classList.remove('hidden');
    Input.releaseLock();
  });
  on('squad:hireRequest', ({ role }) => hireSquadMember(role));
  on('player:sever', ({ part }) => { hitMarker(true); });
  on('settings:changed', () => {
    G.renderer.shadowMap.enabled = SETTINGS.shadows;
    G.camera.fov = SETTINGS.fov;
    G.camera.updateProjectionMatrix();
    AudioSys.setVolume(SETTINGS.volume);
  });
  on('player:death', () => { G.paused = true; showDeathScreen(G.lastDeathCause || 'default'); });
  on('time:day', ({ day }) => notify(`Наступил день ${day}.`, ''));
  on('caravan:robbed', () => addNotification('Корован ограблен — добро в телегах.', 'good'));
  window.addEventListener('keydown', (e) => {
    if (!G.running || anyPanelOpen()) return;
    if (e.code === 'KeyY') { const p = G.player; if (p && p.squad && p.squad.length) import('./ui/panels.js').then((m) => m.issueOrder('attack')); }
    if (e.code === 'KeyH') { const p = G.player; if (p && p.squad && p.squad.length) import('./ui/panels.js').then((m) => m.issueOrder('hold')); }
    if (e.code === 'F3') { G.debugOn = !G.debugOn; }
  });
}

function hireSquadMember(role) {
  const p = G.player;
  const cost = { legion: 120, dark_archer: 150, brute: 220 }[role] || 120;
  if (p.gold < cost) { notify(`Нужно ${cost} золота.`, 'bad'); return; }
  if (!p.squad) p.squad = createSquad('villain', p);
  if (p.squad.filter((e) => !e.dead).length >= 8) { notify('Отряд полон.', 'bad'); return; }
  gainGold(-cost);
  const a = Math.random() * 6.28;
  const e = spawnNPC({ role, faction: 'villain', x: p.pos.x + Math.cos(a) * 4, z: p.pos.z + Math.sin(a) * 4, homeR: 400, squad: p.squad, aiRole: 'squad' });
  e.ai.command = 'follow';
  emit('squad:hired', { entity: e });
  notify(`${e.name} (${role}) вступил в отряд. Всего: ${p.squad.length}`, 'good');
}

function resumeFromLoad() {
  G.paused = false;
  G.running = true;
  G.gameOver = false;
  closeAllPanels();
  document.getElementById('screen-start').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  Input.requestLock();
}

// ------------------------- игровой цикл -------------------------
function loop() {
  requestAnimationFrame(loop);
  const dtRaw = Math.min(clock.getDelta(), 0.06);
  try {
    if (!G.running) { render(dtRaw); return; }
    if (G.paused || anyPanelOpen()) {
      // в панелях мир замирает, но небо рисуется
      if (!G.paused) updateSky(dtRaw * 0.2);
      render(dtRaw);
      Input.endFrame();
      return;
    }
    G.now += dtRaw;
    G.stats.playtime += dtRaw;
    updateSky(dtRaw);
    updatePlayer(dtRaw);
    updateEntities(dtRaw);
    updateArrows(dtRaw);
    updateGore(dtRaw);
    updateForest(dtRaw);
    updateProps(dtRaw);
    updateWater(dtRaw);
    updateSettlements(dtRaw);
    updateCaravans(dtRaw);
    updateRaids(dtRaw);
    updateSpies(dtRaw);
    updateSquads(dtRaw);
    if (G.quests) G.quests.update(dtRaw);
    AudioSys.update(dtRaw);
    AudioSys.setZone(zoneAt(G.player.pos.x, G.player.pos.z).id);
    updateHUD(dtRaw);
    // туман и свет для шейдеров растительности
    const lf = skyLightFactor();
    if (G.fogColor) { updateForestColors(G.fogColor, G.fogDensity, lf); propFog(G.fogColor, G.fogDensity, lf); }
    // автосейв
    autosaveTimer -= dtRaw;
    if (autosaveTimer <= 0) { autosaveTimer = 150; if (!G.gameOver) G.save.autosave(); }
    if (Math.random() < 0.002) despawnFar(230);
    render(dtRaw);
    Input.endFrame();
    trackFps();
  } catch (err) {
    console.error('[loop]', err);
    window.__lastError = String(err && err.stack || err);
  }
}
function render() {
  G.renderer.render(G.scene, G.camera);
}
let lastFpsAt = 0;
function trackFps() {
  const now = performance.now();
  fpsCount++;
  if (!lastFpsAt) lastFpsAt = now;
  if (now - lastFpsAt > 1000) {
    fps = Math.round((fpsCount * 1000) / (now - lastFpsAt));
    fpsCount = 0;
    lastFpsAt = now;
    fpsAcc = 0;
    if (fps < 40) {
      lowFpsTime += 1;
      if (lowFpsTime > 4) {
        lowFpsTime = 0;
        if (SETTINGS.shadows) { SETTINGS.shadows = false; G.renderer.shadowMap.enabled = false; notify('Тени отключены для производительности.'); }
        else if (SETTINGS.viewDist > 450) { SETTINGS.viewDist -= 150; notify('Дальность обзора уменьшена.'); }
      }
    } else lowFpsTime = 0;
  }
}

// ------------------------- меню -------------------------
function initMenu() {
  document.querySelectorAll('.faction-card').forEach((card) => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.faction-card').forEach((c) => c.classList.remove('sel'));
      card.classList.add('sel');
      G.faction = card.dataset.faction;
      const kit = {
        elf: 'Лук, кинжал, 40 золотых, бинты. Ты — партизан Луннолесья.',
        guard: 'Палаш, щит, кольчуга, 25 золотых. Ты — гвардеец Империи.',
        villain: 'Двуручник «Грызло», латы, 250 золотых, кристаллы. Ты — Владыка Дрегар.',
      }[G.faction];
      document.getElementById('start-hint').textContent = kit;
    });
  });
  const elfCard = document.querySelector('.faction-card[data-faction="elf"]');
  if (elfCard) elfCard.click();
  document.getElementById('btn-start').addEventListener('click', () => {
    AudioSys.init(); AudioSys.resume();
    const diff = document.getElementById('opt-difficulty').value;
    const seedSel = document.getElementById('opt-seed').value;
    const seed = seedSel === '0' ? 'r' + Math.floor(Math.random() * 1e9) : seedSel;
    const tut = document.getElementById('opt-tutorial').checked;
    startGame({ faction: G.faction, difficulty: diff, seed, tutorial: tut });
  });
  document.getElementById('btn-continue').addEventListener('click', () => {
    AudioSys.init(); AudioSys.resume();
    const meta = G.save.list().find((s) => s.slot === 'auto');
    if (!meta || !localStorage.getItem('korovany_ds41_save_auto')) { notify('Автосейвов нет — начни новую игру.', 'bad'); return; }
    const data = JSON.parse(localStorage.getItem('korovany_ds41_save_auto'));
    (async () => {
      showLoading();
      await buildWorld(data.seedRaw || String(data.seed), setProgress);
      G.faction = data.faction;
      G.difficulty = data.difficulty || 'normal';
      const p = createPlayer(data.faction);
      G.player = p;
      G.scene.add(p.group);
      G.quests.list.length = 0;
      G.save.load('auto');
      G.running = true;
      hideLoading();
      document.getElementById('screen-start').classList.add('hidden');
      document.getElementById('hud').classList.remove('hidden');
      Input.requestLock();
    })();
  });
  document.getElementById('btn-controls').addEventListener('click', () => showScreen('screen-controls'));
  document.getElementById('btn-about').addEventListener('click', () => showScreen('screen-about'));
  document.querySelectorAll('[data-close]').forEach((b) => {
    if (b.dataset.close === 'screen-controls' || b.dataset.close === 'screen-about') {
      b.addEventListener('click', () => document.getElementById(b.dataset.close).classList.add('hidden'));
    }
  });
}

// ------------------------- запуск -------------------------
async function boot() {
  loadSettings();
  setupRenderer();
  initHUD();
  initPanels();
  initEconomy();
  initSave();
  initSky(G.scene);
  initCombat(G.scene);
  initArrows(G.scene);
  Input.init(G.canvas);
  wireEvents();
  showLoading();
  await buildWorld('korovany', setProgress);
  initQuests();
  G.paused = true;
  hideLoading();
  document.getElementById('screen-start').classList.remove('hidden');
  initMenu();
  window.__ready = true;
  // появление травы и леса только когда игрок есть
  loop();
}

// ------------------------- отладочные хуки -------------------------
window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => window.__errors.push(String(e.reason)));

G.debugInfo = () => ({
  fps: Math.round(fps),
  pos: `${Math.round(G.player.pos.x)}, ${Math.round(G.player.pos.z)}`,
  zone: zoneAt(G.player.pos.x, G.player.pos.z).short,
  entities: G.entities.length,
  corpses: G.corpses.length,
  trees: G.treeCount || 0,
  'trees3d': G._trees3d || 0,
  draws: G.renderer.info.render.calls,
  tris: G.renderer.info.render.triangles,
  hp: Math.round(G.player.hp),
  day: G.time.day,
  time: formatClock(G.time.seconds),
});

window.__korovany = {
  G, SETTINGS, Input, startGame, buildWorld, travelTo,
  api: {
    start: (opts) => startGame(opts || { faction: 'elf', seed: 'test' }),
    teleport: (x, z) => { G.player.pos.set(x, surfaceHeight(x, z, 1e4), z); },
    give: (id, qty) => { G.economy && import('./entities/player.js').then((m) => m.addItem(id, qty)); },
    gold: (n) => gainGold(n),
    damage: (n, part) => damagePlayer(n, part || 'torso', {}),
    sever: (part) => severPlayerPart(part || 'armR', { x: 1, y: 1, z: 0 }),
    heal: () => { G.player.hp = G.player.hpMax; G.player.bleeding = 0; },
    spawn: (role, faction, x, z) => spawnNPC({ role, faction, x: x ?? G.player.pos.x + 3, z: z ?? G.player.pos.z, homeR: 20 }),
    raid: (faction, place, n) => spawnRaid(faction, place, n || 5),
    caravan: () => spawnCaravan('trade'),
    squad: (role, n) => { for (let i = 0; i < (n || 3); i++) hireSquadMember(role || 'legion'); },
    save: (slot) => G.save.save(slot || 'auto'),
    load: (slot) => { G.save.load(slot || 'auto'); resumeFromLoad(); },
    quests: () => (G.quests ? G.quests.list.map((q) => ({ t: q.title, s: q.state, o: q.objectives.map((o) => `${o.text}:${o.progress || 0}/${o.count || 1}${o.done ? '✔' : ''}`) })) : []),
    finishQuest: () => { const q = G.quests.list.find((x) => x.state === 'active'); if (q) q.objectives.forEach((o) => { o.progress = o.count || 1; }); },
    stats: () => ({ entities: G.entities.length, corpses: G.corpses.length, trees: G.treeCount, fps: Math.round(fps), player: { hp: G.player.hp, gold: G.player.gold, missing: G.player.missing } }),
    openPanel: (id) => openPanel(id),
    nearestEnemy: () => {
      let best = null, bd = 1e9;
      for (const e of G.entities) { if (e.dead) continue; const d = dist2D(G.player.pos.x, G.player.pos.z, e.pos.x, e.pos.z); if (d < bd) { bd = d; best = { name: e.name, role: e.role, d: Math.round(d), hostile: isHostileToPlayer(e) }; } }
      return best;
    },
    setTime: (h) => { G.time.seconds = h * 3600; },
    press: (code) => { Input.pressedSet.add(code); },
    hold: (code, on = true) => { if (on) Input.down.add(code); else Input.down.delete(code); },
    releaseAll: () => Input.clear(),
    lookAt: (x, z) => { G.player.yaw = Math.atan2(-(x - G.player.pos.x), -(z - G.player.pos.z)); },
    waitGame: (sec) => new Promise((res) => {
      const target = G.now + (sec || 1);
      const step = () => { if (G.now >= target) res(true); else requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }),
    frames: (n) => new Promise((res) => { let k = 0; const step = () => { if (++k >= (n || 1)) res(true); else requestAnimationFrame(step); }; requestAnimationFrame(step); }),
    panel: (id) => openPanel(id),
    closePanel: (id) => import('./ui/panels.js').then((m) => m.closePanel(id)),
    interact: () => import('./entities/player.js').then((m) => m.doInteract()),
    target: () => { const t = (window.__korovany.__it = null); return null; },
    state: () => ({
      hp: Math.round(G.player.hp), gold: G.player.gold, missing: G.player.missing,
      prosthetics: G.player.prosthetics, bleeding: +G.player.bleeding.toFixed(2), crawling: G.player.crawling,
      inChair: G.player.inChair, weapon: G.player.weapon, inventory: G.player.inventory.map((i) => i.id + 'x' + i.qty),
      quest: (G.quests.list.find((q) => q.state === 'active') || {}).title || null,
      place: G.placeName ? G.placeName() : '', corpses: G.corpses.length, entities: G.entities.length,
    }),
    god: () => { G.godMode = !G.godMode; },
    errors: () => window.__errors,
  },
};

boot();
void terrainHeight; void generateTmp();
function generateTmp() { return 0; }
void groundMaterial; void resolveTreeCollision; void resolveCollisions; void forestStats; void updateSettlements;
void SETTINGS; void showDeathScreen; void banner; void clamp; void Rand; void fillSquad; void commandSquad; void addXP; void installProsthetic; void SPAWNS;

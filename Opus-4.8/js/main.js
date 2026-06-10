// КОРОВАНЫ — вариант Opus 4.8. Точка входа: сцена, свет, игровой цикл,
// состояния (меню / игра / пауза) и связывание всех систем.
import * as THREE from 'three';
import { skyTexture } from './textures.js';
import { World, ZONES } from './world.js';
import { Forest } from './trees.js';
import { Player } from './player.js';
import { NPCManager } from './npc.js';
import { Factions } from './factions.js';
import { UI } from './ui.js';
import { Save } from './save.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);

const scene = new THREE.Scene();
const SKY = 0xbcd2e2;
scene.background = skyTexture('#6f9ec6', '#cfe0ec');
scene.fog = new THREE.Fog(SKY, 70, 360);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 1400);
camera.position.set(ZONES.elf.x, 1.7, ZONES.elf.z);
scene.add(camera);

// свет
scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x40502a, 0.95));
const sun = new THREE.DirectionalLight(0xfff2d0, 1.0);
sun.position.set(120, 220, 60);
scene.add(sun);

// системы
const world = new World(scene).build();
const forest = new Forest(scene);
forest.build([
  { x: ZONES.elf.x, z: ZONES.elf.z, r: 150, count: 380 },
  { x: ZONES.elf.x + 120, z: ZONES.elf.z - 60, r: 90, count: 90 },
  { x: ZONES.human.x, z: ZONES.human.z, r: 140, count: 50 },
  { x: ZONES.villain.x, z: ZONES.villain.z, r: 120, count: 70 },
  { x: 0, z: 0, r: 460, count: 180 },
]);
world.forest = forest;

const ui = new UI();
const player = new Player(camera, canvas);
player.world = world; player.ui = ui;
const npc = new NPCManager(scene, world);
npc.scene = scene;
const factions = new Factions(world, npc, player, ui);

player.onAttack = info => npc.handlePlayerAttack(info);
forest.onFirstMaterialize = () =>
  ui.log('🌲 Дальние деревья были «картинкой», вблизи стали 3D — это LOD-лес из ТЗ!', 'good');

// ---------- состояния ----------
let state = 'menu'; // menu | playing | paused

function resumePlay() {
  state = 'playing';
  ui.hidePause(); ui.closeShop(); ui.closeInv(); ui.hideDeath();
  ui.showGameHUD();
  player.controlEnabled = true;
  player.lock();
}
function openPause() {
  state = 'paused';
  player.controlEnabled = false;
  ui.showPause('Сохранение пишется в этот браузер (localStorage).');
}
function openShop() {
  state = 'paused';
  player.controlEnabled = false;
  ui.openShop(player);
  player.unlock();
}
function openInventory() {
  state = 'paused';
  player.controlEnabled = false;
  ui.openInventory(player);
  player.unlock();
}
function quitToMenu() {
  state = 'menu';
  player.controlEnabled = false; player.unlock();
  ui.hidePause(); ui.closeShop(); ui.closeInv(); ui.hideDeath();
  ui.showMenu(Save.has());
}

function beginGame(faction, saved) {
  npc.clear();
  // сброс счётчиков фракции
  Object.assign(factions, {
    robbed: 0, killCounts: { soldier: 0, elf: 0, villain: 0, human: 0 },
    orderIndex: 0, assault: false, raidActive: false, raidTimer: 22, followTimer: 0,
  });
  npc.rally = null;
  factions.populate();

  if (saved) { player.deserialize(saved.player); player.faction = saved.player.faction; }
  else { player.spawn(faction, world.getSpawn(faction)); }

  ui.setFactionBadge(player.faction);
  if (saved) factions.deserialize(saved.factions);
  else factions.start(player.faction);

  ui.hideMenu();
  resumePlay();
  introLog(player.faction);
}

function introLog(f) {
  ui.log('«Здраствуйте. Я, Кирилл…» — добро пожаловать в игру по легендарному ТЗ.');
  if (f === 'elf') ui.log('🏹 Ты — лесной эльф. Грабь корованы, защищай домики от набегов.', 'good');
  if (f === 'guard') ui.log('🛡️ Ты — охрана дворца. Слушай командира и защищай дворец.', 'good');
  if (f === 'villain') ui.log('💀 Ты — злодей. Нажми F, чтобы поднять войско и штурмовать дворец.', 'good');
  ui.log('E — лавка (рядом с золотой крышей у людей). I — инвентарь. Esc — пауза.');
}

function doSave() {
  const ok = Save.write({ v: 1, player: player.serialize(), factions: factions.serialize() });
  ui.log(ok ? '💾 Игра сохранена.' : 'Не удалось сохранить.', ok ? 'good' : 'bad');
}
function respawnPlayer() {
  const sp = world.getSpawn(player.faction);
  player.pos.set(sp.x, 0, sp.z); player.yaw = sp.yaw; player.vy = 0;
  player.hp = player.maxHp; player.bleeding = false; player.alive = true;
  document.getElementById('blood-overlay').style.opacity = '0';
  ui.hideDeath();
  resumePlay();
  ui.log('Ты возродился у родной зоны. Увечья остались — загляни к торговцу за протезами.', 'bad');
}

player.onDeath = (reason) => {
  state = 'paused'; player.controlEnabled = false;
  ui.showDeath(reason);
};
player.onPointerUnlock = () => {
  if (state === 'playing' && !ui.anyOverlayOpen()) openPause();
};

// ---------- ввод верхнего уровня ----------
let nearShop = false;
addEventListener('keydown', (e) => {
  if (state === 'menu') return;
  switch (e.code) {
    case 'KeyE':
      if (!document.getElementById('shop').classList.contains('hidden')) { ui.closeShop(); resumePlay(); }
      else if (state === 'playing' && nearShop) openShop();
      break;
    case 'KeyI':
      if (!document.getElementById('inventory').classList.contains('hidden')) { ui.closeInv(); resumePlay(); }
      else if (state === 'playing') openInventory();
      break;
    case 'KeyF':
      if (state === 'playing') factions.command();
      break;
    case 'KeyQ': // быстрая перевязка
      if (state === 'playing') player.useBandage();
      break;
    case 'KeyH': // быстрое зелье
      if (state === 'playing') player.usePotion();
      break;
    case 'Escape':
      if (!document.getElementById('shop').classList.contains('hidden')) { ui.closeShop(); resumePlay(); }
      else if (!document.getElementById('inventory').classList.contains('hidden')) { ui.closeInv(); resumePlay(); }
      else if (!document.getElementById('pause').classList.contains('hidden')) resumePlay();
      break;
  }
});

ui.handlers = {
  selectFaction: (f) => beginGame(f, null),
  continue: () => { const s = Save.read(); if (s) beginGame(s.player.faction, s); },
  resume: resumePlay,
  save: doSave,
  load: () => { const s = Save.read(); if (s) beginGame(s.player.faction, s); else ui.log('Нет сохранения.', 'bad'); },
  quit: quitToMenu,
  closeShop: () => { ui.closeShop(); resumePlay(); },
  closeInv: () => { ui.closeInv(); resumePlay(); },
  respawn: respawnPlayer,
};

// подсказки рядом с лавкой / корованом
function updatePrompts() {
  const L = world.landmarks;
  const dShop = Math.hypot(player.pos.x - L.shop.x, player.pos.z - L.shop.z);
  let hint = null;
  if (dShop < 8) { nearShop = true; hint = '🏪 E — лавка торговца'; }
  else nearShop = false;
  if (!hint && (player.faction === 'elf' || player.faction === 'villain')) {
    for (const c of npc.corovans) {
      if (c.looted) continue;
      if (Math.hypot(player.pos.x - c.pos.x, player.pos.z - c.pos.y) < 9) { hint = '💰 ЛКМ — грабить корован!'; break; }
    }
  }
  if (hint) ui.showHint(hint); else ui.hideHint();
}

// ---------- цикл ----------
const clock = new THREE.Clock();
let loopErrored = false;
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  try {
    if (state === 'playing') {
      player.update(dt);
      npc.update(dt, player);
      forest.update(dt, camera.position);
      factions.update(dt);
      ui.updateHUD(player);
      ui.updateCompass(player);
      updatePrompts();
    } else {
      // в меню/паузе всё равно крутим LOD относительно камеры, чтобы лес был живой
      forest.update(dt, camera.position);
    }
    renderer.render(scene, camera);
  } catch (err) {
    if (!loopErrored) { loopErrored = true; console.error('KOROVANY_LOOP_ERROR', err); }
  }
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// старт
ui.hideLoading();
ui.showMenu(Save.has());
animate();

// Deep-link: ?play=elf|guard|villain — сразу начать за фракцию (удобно и для отладки).
// Мышь всё равно захватится после первого клика по экрану.
const playParam = new URLSearchParams(location.search).get('play');
if (['elf', 'guard', 'villain'].includes(playParam)) {
  beginGame(playParam, null);
  console.log('KOROVANY_STARTED', playParam);
}

// Небольшой отладочный хук (не влияет на игру).
window.__KOROVANY__ = { player, npc, factions, world, forest, getState: () => state };

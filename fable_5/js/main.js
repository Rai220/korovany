// КОРОВАНЫ — 3Д-экшон. Суть такова...
// Точка входа: рендер, цикл, ввод, меню, склейка всех систем.
import * as THREE from 'three';
import { World } from './world.js';
import { Player } from './player.js';
import { NPCManager } from './npc.js';
import { Quests } from './quests.js';
import { UI, SFX } from './ui.js';
import * as SAVE from './save.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 900);
camera.rotation.order = 'YXZ';
scene.add(camera);

const G = {
  scene, camera, renderer,
  keys: {},
  state: 'menu', // menu | playing | dialog | paused | dead | victory
  faction: null,
  villainName: 'Злодеус Тёмный',
  timeOfDay: 0.32,
  dayLength: 300,
  flags: { palaceCaptured: false },
  stats: { kills: 0, caravans: 0, waves: 0, orders: 0, playTime: 0 },
  projectiles: [],
  gibs: [],
  world: null, player: null, npcs: null, quests: null,
  expectUnlock: false,
  firstKill: false,
};
G.sfx = new SFX();
G.ui = new UI(G);
window.G = G; // для отладки

// ---------- pointer lock helpers ----------
G.lock = () => {
  if (G.state === 'playing' && document.pointerLockElement !== canvas) {
    try {
      const p = canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* захватим по следующему клику */ }
  }
};
G.unlockFor = () => {
  if (document.pointerLockElement) { G.expectUnlock = true; document.exitPointerLock(); }
};
G.resumePlay = () => {
  G.ui.closeAll();
  G.state = 'playing';
  G.lock();
};

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  if (!locked && G.state === 'playing' && !G.expectUnlock) openPause();
  G.expectUnlock = false;
});

function openPause() {
  if (G.state !== 'playing') return;
  G.state = 'paused';
  document.getElementById('btn-load2').disabled = !SAVE.hasSave();
  G.ui.showScreen('pause');
}

// ---------- запуск игры ----------
function clearTransient() {
  for (const p of G.projectiles) scene.remove(p.mesh);
  for (const g of G.gibs) scene.remove(g.mesh);
  G.projectiles = [];
  G.gibs = [];
}

function startGame(faction, data = null) {
  G.faction = faction;
  if (!G.world) G.world = new World(G);
  clearTransient();
  if (G.npcs) G.npcs.clearAll();
  G.npcs = new NPCManager(G);
  G.flags = { palaceCaptured: false };
  G.stats = { kills: 0, caravans: 0, waves: 0, orders: 0, playTime: 0 };
  G.timeOfDay = 0.32;
  G.firstKill = false;
  if (!G.player) G.player = new Player(G);
  G.player.reset(faction);
  G.quests = new Quests(G);
  if (data) {
    G.villainName = data.villainName || G.villainName;
    G.flags = Object.assign({ palaceCaptured: false }, data.flags);
    G.stats = Object.assign(G.stats, data.stats);
    G.timeOfDay = data.timeOfDay ?? G.timeOfDay;
    G.quests.deserialize(data.quests);
    G.player.deserialize(data.player);
  }
  G.quests.start();
  G.ui.applyEyes();
  G.ui.lastLimbSig = '';
  ['menu', 'namemodal', 'pause', 'death', 'victory', 'shop', 'dialog'].forEach(id => G.ui.hideScreen(id));
  G.ui.showScreen('hud');
  G.state = 'playing';
  G.lock();

  const intros = {
    elf: ['Вы — лесной эльф. Лес густой[1], домики деревянные.',
      'Скоро НАБИГУТ солдаты дворца или Злодей — защищайте лес!',
      'Корованы ходят по дороге на юге. Их можно грабить. Лавка — в деревне людей.'],
    guard: ['Вы — охрана дворца. Слушайтесь командира — он выдаёт приказы [E].',
      'Защищайте дворец от Злодея (имя не придумано), шпионов и партизан эльфов.',
      'За службу платят жалование. Лавка и лекарь — в деревне людей на западе.'],
    villain: [`Вы — ${G.villainName}. Вы сами себе командир: делайте что хотите.`,
      '[T] — войско за мной, [G] — охранять форт, [Y] — ШТУРМ ДВОРЦА!',
      'Бойцов нанимайте у знамени форта. Берегитесь партизан эльфов.'],
  };
  const titles = { elf: 'ЛЕСНЫЕ ЭЛЬФЫ', guard: 'ОХРАНА ДВОРЦА', villain: G.villainName.toUpperCase() };
  G.ui.banner(titles[faction]);
  (data ? ['Игра загружена. Гарнизоны мира восстановлены.'] : intros[faction]).forEach((m, i) => {
    setTimeout(() => G.ui.msg(m), 400 + i * 1600);
  });
}

// ---------- конец игры / победа ----------
G.over = (cause) => {
  G.state = 'dead';
  G.unlockFor();
  G.sfx.death();
  document.getElementById('btn-death-load').disabled = !SAVE.hasSave();
  G.ui.showDeath(cause);
};

G.victoryShow = (text) => {
  G.state = 'victory';
  G.unlockFor();
  G.sfx.fanfare();
  G.ui.showVictory(text);
};

// ---------- взаимодействие [E] ----------
function interactScan() {
  if (!G.player || G.player.dead) return null;
  const p = G.player.pos;
  let best = null, bd = 1e9;
  const consider = (x, z, r, obj) => {
    const d = Math.hypot(x - p.x, z - p.z);
    if (d < r && d < bd) { bd = d; best = obj; }
  };
  for (const it of G.world.interactables) {
    let label = it.label;
    if (it.type === 'recruit' && G.faction !== 'villain') continue;
    if (it.type === 'fortThrone') label = G.faction === 'villain' ? 'Трон Злодея: отдохнуть' : 'Трон Злодея (страшно)';
    if (it.type === 'palaceThrone') label = G.faction === 'villain' || G.faction === 'elf' ? 'Сесть на трон Императора' : 'Трон Императора';
    consider(it.x, it.z, it.r, { type: it.type, label });
  }
  const cm = G.quests.commander;
  if (G.faction === 'guard' && cm && !cm.dead) {
    const cp = cm.group.position;
    consider(cp.x, cp.z, 3.5, { type: 'commander', label: 'Командир: доложить' });
  }
  for (const c of G.npcs.caravans) {
    if (c.robbable()) consider(c.pos.x, c.pos.z, 4.5, { type: 'rob', label: 'ОГРАБИТЬ КОРОВАН', c });
  }
  return best;
}

function doInteract() {
  const it = interactScan();
  if (!it) return;
  switch (it.type) {
    case 'shop': G.ui.openShop(); break;
    case 'healer': openHealer(); break;
    case 'palaceThrone': G.quests.thronePalace(); break;
    case 'fortThrone': G.quests.fortThrone(); break;
    case 'recruit': G.quests.recruit(); break;
    case 'commander': G.quests.commanderTalk(); break;
    case 'rob': {
      const gold = it.c.rob();
      G.player.gold += gold;
      G.quests.onCaravanRobbed();
      G.ui.banner('ВЫ ОГРАБИЛИ КОРОВАН!');
      G.ui.msg(`+${gold} золота из корована!`, 'gold');
      G.sfx.coin();
      break;
    }
  }
}

function openHealer() {
  const p = G.player;
  const lostLimb = Object.values(p.limbs).some(v => v === 0);
  const txt = '«Чем помочь, бедолага?»' + (lostLimb
    ? '\n\n«Пришить отрубленное обратно? Нет, я лекарь, а не чудотворец. Протезы продают в лавке по соседству.»'
    : '');
  G.ui.openDialog({
    title: 'Лекарь',
    text: txt,
    buttons: [
      {
        label: 'Лечение — 30з',
        fn: () => {
          if (p.gold < 30) { G.ui.msg('Не хватает золота.', 'bad'); return; }
          p.gold -= 30; p.hp = p.maxHp; p.bleeding = 0;
          G.sfx.potion();
          G.ui.msg('Лекарь вас подлатал. Здоровье восстановлено, кровь остановлена.', 'good');
          G.ui.closeDialog(); G.resumePlay();
        },
      },
      {
        label: 'Перевязка — 15з',
        fn: () => {
          if (p.gold < 15) { G.ui.msg('Не хватает золота.', 'bad'); return; }
          p.gold -= 15; p.bleeding = 0;
          G.sfx.potion();
          G.ui.msg('Кровотечение остановлено.', 'good');
          G.ui.closeDialog(); G.resumePlay();
        },
      },
      { label: 'Уйти', fn: () => { G.ui.closeDialog(); G.resumePlay(); } },
    ],
  });
}

// ---------- снаряды и куски ----------
function updateProjectiles(dt) {
  for (let i = G.projectiles.length - 1; i >= 0; i--) {
    const a = G.projectiles[i];
    a.t += dt;
    if (a.stuck) {
      if (a.t > 10) { scene.remove(a.mesh); G.projectiles.splice(i, 1); }
      continue;
    }
    a.vel.y -= 11 * dt;
    a.mesh.position.addScaledVector(a.vel, dt);
    a.mesh.lookAt(a.mesh.position.clone().add(a.vel));
    let hit = false;
    for (const n of G.npcs.npcs) {
      if (n.dead) continue;
      const np = n.group.position;
      const dx = np.x - a.mesh.position.x;
      const dy = (np.y + 1.1) - a.mesh.position.y;
      const dz = np.z - a.mesh.position.z;
      if (dx * dx + dy * dy + dz * dz < 0.9) {
        n.takeDamage(34 + Math.random() * 8, G.player);
        G.sfx.hit();
        scene.remove(a.mesh);
        G.projectiles.splice(i, 1);
        hit = true;
        break;
      }
    }
    if (hit) continue;
    const gr = G.world.height(a.mesh.position.x, a.mesh.position.z);
    if (a.mesh.position.y <= gr + 0.05) { a.stuck = true; a.t = 0; }
    else if (a.t > 6) { scene.remove(a.mesh); G.projectiles.splice(i, 1); }
  }
}

function updateGibs(dt) {
  for (let i = G.gibs.length - 1; i >= 0; i--) {
    const g = G.gibs[i];
    g.t += dt;
    if (!g.rest) {
      g.vel.y -= 22 * dt;
      g.mesh.position.addScaledVector(g.vel, dt);
      g.mesh.rotation.x += g.av * dt;
      g.mesh.rotation.z += g.av * 0.7 * dt;
      const gr = G.world.height(g.mesh.position.x, g.mesh.position.z) + 0.1;
      if (g.mesh.position.y <= gr) { g.mesh.position.y = gr; g.rest = true; }
    }
    if (g.t > 40 || (G.gibs.length > 24 && i === 0)) {
      scene.remove(g.mesh);
      G.gibs.splice(i, 1);
    }
  }
}

// ---------- ввод ----------
addEventListener('keydown', (e) => {
  G.keys[e.code] = true;
  if (e.code === 'Space') e.preventDefault();
  if (G.state === 'playing') {
    switch (e.code) {
      case 'KeyE': doInteract(); break;
      case 'KeyQ': G.player.usePotion(); break;
      case 'KeyB': G.player.useBandage(); break;
      case 'Digit1': G.player.setWeapon('melee'); break;
      case 'Digit2': G.player.setWeapon('bow'); break;
      case 'KeyH': G.ui.toggleHelp(); break;
      case 'KeyT': G.quests.troopOrder('follow'); break;
      case 'KeyG': G.quests.troopOrder('hold'); break;
      case 'KeyY': G.quests.troopOrder('assault'); break;
      case 'KeyK':
        if (SAVE.saveGame(G)) G.ui.msg('Игра сохранена.', 'good');
        else G.ui.msg('Не удалось сохранить.', 'bad');
        break;
      case 'Escape': openPause(); break;
    }
  } else if (G.state === 'dialog' && e.code === 'Escape') {
    G.resumePlay();
  }
});
addEventListener('keyup', (e) => { G.keys[e.code] = false; });

canvas.addEventListener('click', () => {
  G.sfx.ensure();
  if (G.state === 'playing') G.lock();
});
canvas.addEventListener('mousedown', (e) => {
  if (G.state === 'playing' && document.pointerLockElement === canvas && e.button === 0) {
    G.player.attack();
  }
});
addEventListener('mousemove', (e) => {
  if (G.state === 'playing' && document.pointerLockElement === canvas) {
    G.player.yaw -= e.movementX * 0.0022;
    G.player.pitch = Math.max(-1.45, Math.min(1.45, G.player.pitch - e.movementY * 0.0022));
  }
});
canvas.addEventListener('contextmenu', e => e.preventDefault());

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- меню ----------
const FACTION_RU = { elf: 'Лесные эльфы', guard: 'Охрана дворца', villain: 'Злодей' };

function refreshMenu() {
  const has = SAVE.hasSave();
  document.getElementById('btn-load').disabled = !has;
  const info = document.getElementById('save-info');
  if (has) {
    const d = SAVE.loadSave();
    const date = new Date(d.savedAt).toLocaleString('ru-RU');
    info.textContent = `Сохранение: ${FACTION_RU[d.faction] || d.faction}${d.faction === 'villain' ? ` (${d.villainName})` : ''}, ${date}`;
  } else {
    info.textContent = 'Сохранений нет';
  }
}

document.getElementById('btn-elf').onclick = () => { G.sfx.ensure(); startGame('elf'); };
document.getElementById('btn-guard').onclick = () => { G.sfx.ensure(); startGame('guard'); };
document.getElementById('btn-villain').onclick = () => {
  G.sfx.ensure();
  G.ui.hideScreen('menu');
  G.ui.showScreen('namemodal');
  document.getElementById('villain-name-input').focus();
};
document.getElementById('btn-name-ok').onclick = () => {
  const v = document.getElementById('villain-name-input').value.trim();
  G.villainName = v || 'Злодеус Тёмный';
  startGame('villain');
};
document.getElementById('btn-load').onclick = () => {
  const d = SAVE.loadSave();
  if (d) { G.sfx.ensure(); startGame(d.faction, d); }
};
document.getElementById('btn-resume').onclick = () => G.resumePlay();
document.getElementById('btn-save').onclick = () => {
  if (SAVE.saveGame(G)) G.ui.msg('Игра сохранена.', 'good');
  G.resumePlay();
};
document.getElementById('btn-load2').onclick = () => {
  const d = SAVE.loadSave();
  if (d) startGame(d.faction, d);
};
document.getElementById('btn-exit').onclick = () => location.reload();
document.getElementById('btn-death-load').onclick = () => {
  const d = SAVE.loadSave();
  if (d) startGame(d.faction, d);
};
document.getElementById('btn-death-menu').onclick = () => location.reload();
document.getElementById('btn-victory-continue').onclick = () => G.resumePlay();
document.getElementById('btn-shop-close').onclick = () => G.resumePlay();
refreshMenu();

// ---------- цикл ----------
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (G.state === 'playing') {
    G.stats.playTime += dt;
    G.player.update(dt);
    if (G.player.dead) { renderer.render(scene, camera); return; }
    G.npcs.update(dt);
    G.quests.update(dt);
    updateProjectiles(dt);
    updateGibs(dt);
    G.world.updateDayNight(dt);
    G.ui.updateHUD();
    G.ui.updateMinimap();
    const it = interactScan();
    G.ui.prompt(it ? '[E] ' + it.label : null);
  }
  renderer.render(scene, camera);
}
requestAnimationFrame(loop);

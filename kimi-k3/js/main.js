// main.js — загрузка, игрок (3-е лицо), ввод, состояния игры, главный цикл.
import * as THREE from 'three';
import { initWorld, heightAt, zoneAt, ZONE_NAMES, SITES } from './world.js';
import { initUI } from './ui.js';
import { makeHumanoid, animateHumanoid, updateFx, damageUnit, resolveColliders, spawnBlood } from './units.js';
import { startCampaign, saveGame, loadSaveData, applySave } from './game.js';

const G = {
  units: [], particles: [], debris: [], caravans: [], npcs: {}, colliders: [],
  state: 'loading',
};
window.G = G; // для отладки

// ---------- рендер ----------
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
G.renderer = renderer;

G.scene = new THREE.Scene();
G.camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 1400);

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  G.camera.aspect = innerWidth / innerHeight;
  G.camera.updateProjectionMatrix();
});

initUI(G);
initWorld(G);

// ---------- состояния / оверлеи ----------
function lockPointer() {
  if (document.pointerLockElement === canvas) return;
  try {
    const r = canvas.requestPointerLock();
    if (r && r.catch) r.catch(() => {});
  } catch (e) { /* headless или запрет браузера — игра продолжается без захвата */ }
}
G.openOverlay = (kind) => {
  G.state = kind;
  if (document.pointerLockElement) document.exitPointerLock();
  if (kind === 'map') { G.ui.show('mapOverlay'); G.ui.drawMap(); }
};
G.closeOverlay = () => {
  G.ui.show(null);
  G.state = 'playing';
  lockPointer();
};
function pause() {
  if (G.state !== 'playing') return;
  G.state = 'paused';
  G.ui.show('pauseMenu');
  if (document.pointerLockElement) document.exitPointerLock();
}
function resume() {
  G.ui.show(null);
  G.state = 'playing';
  lockPointer();
}
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && G.state === 'playing') pause();
});

G.showVictory = (text) => {
  G.campaign.victory = true;
  G.state = 'victory';
  document.getElementById('victoryText').textContent = text;
  G.ui.show('victoryScreen');
  if (document.pointerLockElement) document.exitPointerLock();
  G.saveGame();
};

// ---------- золото ----------
G.addGold = (n, reason) => {
  G.player.gold += n;
  G.ui.toast(`+${n} золота — ${reason}`, 'gold');
  G.ui.sfx('coin');
  G.ui.updateHUD();
};
G.saveGame = () => saveGame(G);

// ---------- игрок ----------
const SPAWNS = {
  elf:     { x: SITES.forest.x + 10, z: SITES.forest.z + 10 },
  guard:   { x: SITES.palace.x - 38, z: SITES.palace.z + 4 },
  villain: { x: SITES.fort.x,        z: SITES.fort.z + 16 },
};

function createPlayer(faction) {
  const parts = makeHumanoid(faction);
  const p = {
    faction, parts, mesh: parts.group,
    pos: parts.group.position,
    yaw: 0, pitch: 0.28, vy: 0, onGround: true,
    hp: 100, maxHp: 100, dmg: 16, gold: 30, alive: true,
    injuries: { arm: false, eye: false, leg: false },
    prosthesis: { arm: false, eye: false, leg: false },
    wheelchair: false, bleeding: false,
    items: { bandage: 1, elixir: 0 },
    armor: false, swordUpgraded: false,
    phase: 0, moving: 0, swingT: -1, cool: 0, crawl: false,
    _wheels: null,
  };
  const s = SPAWNS[faction];
  p.pos.set(s.x, heightAt(s.x, s.z), s.z);
  G.scene.add(p.mesh);
  G.player = p;
  return p;
}

G.applyPlayerVisuals = () => {
  const p = G.player;
  p.parts.armR.visible = !p.injuries.arm || p.prosthesis.arm;
  p.parts.legR.visible = !p.injuries.leg || p.prosthesis.leg;
  p.crawl = p.injuries.leg && !p.prosthesis.leg && !p.wheelchair;
  p.dmg = (p.swordUpgraded ? 24 : 16) * (p.injuries.arm && !p.prosthesis.arm ? 0.5 : 1);
  G.ui.setEye(p.injuries.eye && !p.prosthesis.eye);
  // колёса коляски
  if (p._wheels) { for (const w of p._wheels) p.mesh.remove(w); p._wheels = null; }
  if (p.wheelchair && p.injuries.leg && !p.prosthesis.leg) {
    const geo = new THREE.CylinderGeometry(0.42, 0.42, 0.08, 10);
    const m = new THREE.MeshLambertMaterial({ color: 0x3a2a14 });
    p._wheels = [];
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(geo, m);
      w.rotation.z = Math.PI / 2;
      w.position.set(s * 0.5, 0.42, 0);
      p.mesh.add(w);
      p._wheels.push(w);
    }
  }
  G.ui.updateHUD();
};

const INJURY_TEXT = {
  arm: 'Вам ОТРУБИЛИ РУКУ! Урон вдвое меньше. Кровотечение убьёт — перевяжитесь (H) или к лекарю. Протез — в лавке.',
  eye: 'Вам ВЫБИЛИ ГЛАЗ! Половина экрана темна. Стеклянный глаз — в лавке.',
  leg: 'Вам ОТРУБИЛИ НОГУ! Вы ползёте. Коляска или протез — в лавке.',
};

G.damagePlayer = (dmg, attacker) => {
  const p = G.player;
  if (!p.alive || G.state !== 'playing') return;
  if (p.armor) dmg *= 0.7;
  p.hp -= dmg;
  G.ui.damageFlash();
  G.ui.sfx('hurt');
  spawnBlood(G, p.pos.x, p.pos.y + 1.1, p.pos.z, 5);
  if (p.hp > 0 && Math.random() < 0.13) {
    const options = ['arm', 'eye', 'leg'].filter(k => !p.injuries[k]);
    if (options.length) {
      const kind = options[(Math.random() * options.length) | 0];
      p.injuries[kind] = true;
      p.bleeding = true;
      G.ui.setBleeding(true);
      G.applyPlayerVisuals();
      G.ui.toast(INJURY_TEXT[kind], 'bad');
      G.ui.sfx('injury');
    }
  }
  if (p.hp <= 0) playerDie('Враг оказался сильнее. Труп, кстати, тоже 3D.');
  G.ui.updateHUD();
};

function playerDie(text) {
  const p = G.player;
  if (!p.alive) return;
  p.alive = false;
  G.ui.sfx('death');
  G.ui.setBleeding(false);
  document.getElementById('deathText').textContent = text + ' Потеряно 15% золота при возрождении.';
  G.state = 'dead';
  G.ui.show('deathScreen');
  if (document.pointerLockElement) document.exitPointerLock();
}

function respawn() {
  const p = G.player;
  const s = SPAWNS[p.faction];
  p.pos.set(s.x, heightAt(s.x, s.z), s.z);
  p.hp = p.maxHp;
  p.bleeding = false;
  p.vy = 0;
  p.gold = Math.floor(p.gold * 0.85);
  p.alive = true;
  G.ui.setBleeding(false);
  G.applyPlayerVisuals();
  G.closeOverlay();
}

// ---------- ввод ----------
const keys = {};
let mouseDX = 0, mouseDY = 0;
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'Escape') {
    if (G.state === 'paused') resume();
    else if (G.state === 'map' || G.state === 'dialog' || G.state === 'shop') G.closeOverlay();
  }
  if (G.state === 'playing') {
    if (e.code === 'KeyM') G.openOverlay('map');
    if (e.code === 'KeyH') useHeal();
    if (e.code === 'KeyE' && currentInteract) currentInteract.action();
  } else if (G.state === 'map' && e.code === 'KeyM') {
    G.closeOverlay();
  }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === canvas) {
    mouseDX += e.movementX;
    mouseDY += e.movementY;
  }
});
addEventListener('mousedown', (e) => {
  if (e.button === 0 && G.state === 'playing' && document.pointerLockElement === canvas)
    playerAttack();
});
addEventListener('contextmenu', (e) => e.preventDefault());

function useHeal() {
  const p = G.player;
  if (p.bleeding && p.items.bandage > 0) {
    p.items.bandage--;
    p.bleeding = false;
    G.ui.setBleeding(false);
    p.hp = Math.min(p.maxHp, p.hp + 25);
    G.ui.healFlash(); G.ui.sfx('heal');
    G.ui.toast('Перевязка: кровь остановлена, +25 HP', 'good');
  } else if (p.items.elixir > 0 && p.hp < p.maxHp) {
    p.items.elixir--;
    p.hp = p.maxHp;
    p.bleeding = false;
    G.ui.setBleeding(false);
    G.ui.healFlash(); G.ui.sfx('heal');
    G.ui.toast('Эликсир выпит: здоровье полное', 'good');
  } else if (p.items.bandage > 0 && p.hp < p.maxHp) {
    p.items.bandage--;
    p.hp = Math.min(p.maxHp, p.hp + 25);
    G.ui.healFlash(); G.ui.sfx('heal');
    G.ui.toast('+25 HP', 'good');
  } else {
    G.ui.toast('Нечем лечиться — бинты и эликсиры в лавке у деревни', 'bad');
  }
  G.ui.updateHUD();
}

function playerAttack() {
  const p = G.player;
  if (p.cool > 0 || !p.alive) return;
  p.cool = 0.55;
  p.swingT = 0;
  p._hitDone = false;
  G.ui.sfx('swing');
}

function playerAttackHit() {
  const p = G.player;
  const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
  let hit = false;
  for (const u of G.units) {
    if (u.state === 'dead') continue;
    const dx = u.pos.x - p.pos.x, dz = u.pos.z - p.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 2.6) continue;
    if ((dx * fx + dz * fz) / (d || 1e-6) < 0.5) continue;
    damageUnit(G, p, u, p.dmg);
    hit = true;
  }
  for (const c of G.world.crates) {
    if (c.dead) continue;
    const dx = c.x - p.pos.x, dz = c.z - p.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 2.6) continue;
    if ((dx * fx + dz * fz) / (d || 1e-6) < 0.4) continue;
    c.hp--;
    hit = true;
    if (c.hp <= 0) {
      c.dead = true;
      G.scene.remove(c.group);
      G.onCrateBroken && G.onCrateBroken(c.tag);
    } else {
      G.ui.toast('Бьёте склад...', '');
    }
  }
  if (hit) G.ui.sfx('hit');
}

// ---------- обновление игрока ----------
let currentInteract = null;
let lastZone = 0;

function playerUpdate(dt) {
  const p = G.player;
  if (!p.alive) return;

  p.yaw -= mouseDX * 0.0026;
  p.pitch = Math.max(-0.4, Math.min(1.05, p.pitch + mouseDY * 0.0022));
  mouseDX = mouseDY = 0;

  p.cool -= dt;

  // взмах мечом
  if (p.swingT >= 0) {
    p.swingT += dt / 0.45;
    if (p.swingT >= 0.5 && !p._hitDone) { p._hitDone = true; playerAttackHit(); }
    if (p.swingT >= 1) p.swingT = -1;
  }

  const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
  const rx = -fz, rz = fx;
  let mx = 0, mz = 0;
  if (keys['KeyW']) { mx += fx; mz += fz; }
  if (keys['KeyS']) { mx -= fx; mz -= fz; }
  if (keys['KeyD']) { mx += rx; mz += rz; }
  if (keys['KeyA']) { mx -= rx; mz -= rz; }
  const mLen = Math.hypot(mx, mz);
  p.moving = mLen > 0 ? 1 : 0;

  let speed = 5.4;
  const sprint = keys['ShiftLeft'] || keys['ShiftRight'];
  if (p.crawl) speed = 1.5;
  else if (p.wheelchair && p.injuries.leg && !p.prosthesis.leg) speed = 5.6;
  else if (sprint && p.moving) speed = 8.4;

  if (mLen > 0) {
    mx /= mLen; mz /= mLen;
    p.pos.x += mx * speed * dt;
    p.pos.z += mz * speed * dt;
    p.phase += dt * speed * 2.0;
  }
  resolveColliders(G, p.pos);

  // прыжок и гравитация
  const groundY = heightAt(p.pos.x, p.pos.z) + (p.crawl ? 0.5 : 0);
  if (p.onGround && keys['Space'] && !p.crawl && !(p.wheelchair && p.injuries.leg && !p.prosthesis.leg)) {
    p.vy = 7.5;
    p.onGround = false;
  }
  p.vy -= 22 * dt;
  p.pos.y += p.vy * dt;
  if (p.pos.y <= groundY) { p.pos.y = groundY; p.vy = 0; p.onGround = true; }

  // кровотечение
  if (p.bleeding) {
    p.hp -= 1.5 * dt;
    if (Math.random() < dt * 3) spawnBlood(G, p.pos.x, p.pos.y + 0.9, p.pos.z, 1);
    if (p.hp <= 0) {
      playerDie('Вы истекли кровью. Перевязывайтесь вовремя (H) или бегите к лекарю.');
      return;
    }
    if (Math.random() < dt * 0.5) G.ui.updateHUD();
  }

  p.mesh.rotation.y = p.yaw;
  animateHumanoid(p.parts, {
    moving: p.moving, phase: p.phase,
    swing: p.swingT >= 0 ? Math.min(1, p.swingT) : null,
    crawl: p.crawl,
  });

  // камера
  const dist = 4.8;
  const cy = Math.max(
    heightAt(p.pos.x - fx * dist, p.pos.z - fz * dist) + 0.4,
    p.pos.y + 1.7 + Math.sin(p.pitch) * dist
  );
  G.camera.position.set(p.pos.x - fx * dist * Math.cos(p.pitch), cy, p.pos.z - fz * dist * Math.cos(p.pitch));
  G.camera.lookAt(p.pos.x, p.pos.y + 1.5, p.pos.z);

  // зона
  const z = zoneAt(p.pos.x, p.pos.z);
  if (z !== lastZone) {
    lastZone = z;
    G.ui.zoneBanner(ZONE_NAMES[z]);
    G.ui.updateHUD();
  }

  // взаимодействие
  currentInteract = G.campaign ? G.campaign.getInteract() : null;
  G.ui.interactPrompt(currentInteract ? currentInteract.label : null);

  // расстояние до цели
  if (G.world.beaconPos) {
    const d = Math.hypot(p.pos.x - G.world.beaconPos.x, p.pos.z - G.world.beaconPos.z);
    G.ui.setQuestDist(`Цель: ${Math.round(d)} м`);
  } else {
    G.ui.setQuestDist('');
  }
}

// ---------- запуск партии ----------
function startGame(faction, saveData) {
  const f = faction || saveData.faction;
  createPlayer(f);
  startCampaign(G);
  if (saveData) applySave(G, saveData);
  G.applyPlayerVisuals();
  const names = { elf: 'Лесной эльф', guard: 'Стражник дворца', villain: 'Злой' };
  G.ui.toast(`Вы — ${names[f]}. Удачи, Кирилл доволен.`, 'good');
  G.ui.zoneBanner(ZONE_NAMES[zoneAt(G.player.pos.x, G.player.pos.z)]);
  G.ui.show(null);
  G.state = 'playing';
  lockPointer();
}

// ---------- меню ----------
document.querySelectorAll('.fbtn').forEach(btn => {
  btn.addEventListener('click', () => startGame(btn.dataset.faction, null));
});
const saveData0 = loadSaveData();
if (saveData0) {
  const bc = document.getElementById('btnContinue');
  bc.classList.remove('hidden');
  bc.addEventListener('click', () => startGame(null, saveData0));
}
document.getElementById('btnResume').addEventListener('click', resume);
document.getElementById('btnSave').addEventListener('click', () => { G.saveGame(); });
document.getElementById('btnHelp').addEventListener('click', () => {
  document.getElementById('helpBox').classList.toggle('hidden');
});
document.getElementById('btnToMenu').addEventListener('click', () => { G.saveGame(); location.reload(); });
document.getElementById('btnRespawn').addEventListener('click', respawn);
document.getElementById('btnLoadDeath').addEventListener('click', () => {
  const d = loadSaveData();
  if (d) {
    const p = G.player;
    p.alive = true;
    p.bleeding = false;
    G.ui.setBleeding(false);
    applySave(G, d);
    G.closeOverlay();
  }
  else G.ui.toast('Сохранения нет', 'bad');
});
document.getElementById('btnFreeplay').addEventListener('click', () => G.closeOverlay());
document.getElementById('btnVictoryMenu').addEventListener('click', () => location.reload());
document.getElementById('btnShopClose').addEventListener('click', () => G.closeOverlay());

// ---------- главный цикл ----------
let last = performance.now();
let menuT = 0, mapT = 0;

function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (G.state === 'playing') {
    playerUpdate(dt);
    if (G.campaign) G.campaign.update(dt);
    for (let i = G.units.length - 1; i >= 0; i--) {
      const u = G.units[i];
      u.update(G, dt);
      if (u.removeMe) G.units.splice(i, 1);
    }
    updateFx(G, dt);
  } else if (G.state === 'menu' || G.state === 'loading') {
    // фон меню: камера медленно кружит над деревней
    menuT += dt;
    const a = menuT * 0.06;
    G.camera.position.set(Math.cos(a) * 70, 30, Math.sin(a) * 70);
    G.camera.lookAt(0, 2, 0);
    for (const u of G.units) u.update(G, dt);
    updateFx(G, dt);
  } else if (G.state === 'map') {
    mapT += dt;
    if (mapT > 0.25) { mapT = 0; G.ui.drawMap(); }
  }

  G.world.update(dt, G.camera.position);
  renderer.render(G.scene, G.camera);
}

G.ui.show('menu');
document.getElementById('loading').classList.add('hidden');
requestAnimationFrame(tick);

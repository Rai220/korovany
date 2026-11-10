// Точка входа: рендер, цикл, ввод, меню, сохранение, звук.
import * as THREE from '../lib/three.min.js';
import { G, MODEL_NAME, GAME_TITLE, SAVE_KEY, SITES, ITEMS, clamp } from './data.js';
import { initWorld, updateTrees, updateSky, heightAt, treeStats } from './world.js';
import { initEntities, updateEntities, clearEntities } from './entities.js';
import { initPlayer, updatePlayer, newPlayer, serializePlayer, loadPlayer, findInteract, addItem, input, injure, useItem } from './player.js';
import { populate, updateDirector, talk, serializeWorld, loadWorld, resetWorld, launchRaid, giveOrder, applyEvilOrder } from './director.js';
import { initUI, updateUI } from './ui.js';

const $ = id => document.getElementById(id);
const P = G.player;
const canvas = $('game');
G.testMode = new URLSearchParams(location.search).has('test');
document.title = `${GAME_TITLE} — ${MODEL_NAME}`;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 1500);
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

// ---------- звук (синтез WebAudio, без файлов) ----------
let actx = null, master = null;
function audio() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); master = actx.createGain(); master.gain.value = 0.5; master.connect(actx.destination); } catch (e) { return null; } }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
function tone(f, dur, type, vol, f2, delay = 0) {
  const a = actx, o = a.createOscillator(), g = a.createGain(), t = a.currentTime + delay;
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
let noiseBuf = null;
function noise(dur, vol, freq, q = 1) {
  const a = actx;
  if (!noiseBuf) { noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(), t = a.currentTime;
  s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 0.5, dur + 0.02);
}
G.sfx = function (name, pos) {
  if (!actx || actx.state !== 'running') return;
  let v = 1;
  if (pos) { const d = Math.hypot(pos.x - P.pos.x, pos.z - P.pos.z); v = clamp(1 - d / 50, 0, 1); v *= v; if (v < 0.02) return; }
  switch (name) {
    case 'hit': noise(0.12, 0.5 * v, 900, 0.8); tone(140, 0.1, 'square', 0.12 * v, 60); break;
    case 'swing': noise(0.16, 0.22 * v, 1800, 2); break;
    case 'bow': tone(420, 0.12, 'triangle', 0.25 * v, 140); noise(0.08, 0.12 * v, 3000, 1); break;
    case 'magic': tone(300, 0.35, 'sawtooth', 0.14 * v, 900); tone(600, 0.3, 'sine', 0.12 * v, 150); break;
    case 'hurt': tone(190, 0.22, 'sawtooth', 0.28, 80); noise(0.1, 0.3, 500, 1); break;
    case 'block': tone(1300, 0.09, 'square', 0.14, 700); noise(0.07, 0.3, 4200, 3); break;
    case 'maim': noise(0.3, 0.6 * v, 400, 0.7); tone(90, 0.4, 'sawtooth', 0.3 * v, 40); break;
    case 'die': tone(220, 0.5, 'sawtooth', 0.16 * v, 55); break;
    case 'coin': tone(1320, 0.09, 'sine', 0.2); tone(1760, 0.14, 'sine', 0.2, 0, 0.08); break;
    case 'heal': tone(440, 0.2, 'sine', 0.2, 880); break;
    case 'level': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.18, 0, i * 0.1)); break;
    case 'quest': tone(660, 0.15, 'triangle', 0.18); tone(880, 0.25, 'triangle', 0.18, 0, 0.14); break;
    case 'horn': tone(146, 1.1, 'sawtooth', 0.16, 150); tone(220, 0.9, 'sawtooth', 0.1, 218, 0.2); break;
    case 'jump': tone(200, 0.1, 'sine', 0.08, 320); break;
  }
};

// ---------- мир ----------
initWorld(scene);
initEntities(scene);
initPlayer(scene, camera);
initUI(camera);
$('loading').textContent = `Мир построен: деревьев в лесах — ${G.treeCount}.`;

// ---------- сохранение ----------
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
function save(silent) {
  if (!G.running || !P.alive) return false;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, model: MODEL_NAME, at: Date.now(), player: serializePlayer(), world: serializeWorld() }));
    if (!silent) G.ui.msg('Игра сохранена.', 'good'); else G.ui.msg('Автосохранение.');
    return true;
  } catch (e) { G.ui.msg('Не удалось сохранить (localStorage недоступен).', 'bad'); return false; }
}
function load() {
  let data;
  try { data = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { data = null; }
  if (!data) { if (G.ui) G.ui.msg('Сохранений нет.', 'bad'); return false; }
  clearEntities(); loadWorld(data.world); loadPlayer(data.player);
  populate(); begin();
  G.ui.msg('Игра загружена. Мир ожил заново, а увечья и добыча — при тебе.', 'good');
  return true;
}
function startGame(faction) {
  clearEntities(); resetWorld(); newPlayer(faction); populate(); begin();
  const hello = {
    elf: 'Ты — лесной эльф. Лес густ, домики деревяны, враги набигают. Владыка ждёт у Великого древа.',
    empire: 'Ты — стражник дворца. Слушайся командира Бронислава: приказы появятся справа.',
    evil: 'Ты — Злой. Старый форт твой. Нажми T, чтобы приказывать войску.',
  };
  G.ui.msg(hello[faction], 'info');
  G.ui.msg('Подсказка: Esc — пауза и управление, M — карта, F5 — сохранить.');
}
function begin() {
  G.running = true; G.modal = false; autosaveT = 150;
  $('menu').classList.add('hidden'); $('death').classList.add('hidden'); $('panel').classList.add('hidden'); $('hud').classList.remove('hidden');
  $('log').innerHTML = ''; G.ui.resetZone(); updateTrees(camera.position.set(P.pos.x, P.pos.y, P.pos.z), true);
  audio(); G.requestLock();
}
function toMenu() {
  G.running = false; if (document.pointerLockElement) document.exitPointerLock();
  $('menu').classList.remove('hidden'); $('pause').classList.add('hidden'); $('death').classList.add('hidden'); $('hud').classList.add('hidden'); $('panel').classList.add('hidden'); G.modal = false;
  $('btnContinue').classList.toggle('hidden', !hasSave());
}
G.onPlayerDeath = cause => {
  if (document.pointerLockElement) document.exitPointerLock();
  setTimeout(() => {
    if (P.alive) return;
    $('deathCause').textContent = cause; $('death').classList.remove('hidden'); $('panel').classList.add('hidden'); G.modal = false;
    $('btnDeathLoad').classList.toggle('hidden', !hasSave());
  }, 1800);
};
function respawn() {
  const s = SITES[P.faction];
  P.alive = true; P.hp = Math.round(P.maxHp * 0.6); P.bleed = 0; P.gold = Math.floor(P.gold / 2); P.injuryCd = 20;
  P.pos.set(s.x + (P.faction === 'empire' ? -44 : 10), 0, s.z + 8); P.pos.y = heightAt(P.pos.x, P.pos.z);
  $('death').classList.add('hidden');
  G.ui.msg('Свои вытащили тебя с того света. Кровь остановили, но отрубленное не приросло.', 'info');
  G.requestLock();
}

// ---------- ввод ----------
G.requestLock = () => { if (G.testMode) return; const p = canvas.requestPointerLock && canvas.requestPointerLock(); if (p && p.catch) p.catch(() => { }); };
const locked = () => document.pointerLockElement === canvas;
addEventListener('keydown', e => {
  if (e.code === 'F5' || e.code === 'F9' || e.code === 'Tab') e.preventDefault();
  if (!G.running) return;
  if (e.code === 'F5') return save();
  if (e.code === 'F9') return load();
  if (G.modal) {
    const k = G.ui.kind;
    if (e.code === 'Escape' || (e.code === 'KeyE' && (k === 'shop' || k === 'dialog')) || (e.code === 'KeyI' && k === 'inv') || (e.code === 'KeyM' && k === 'map') || (e.code === 'KeyT' && k === 'dialog')) G.ui.close();
    return;
  }
  if (!locked() && !G.testMode) return;
  if (e.repeat) return;
  input.keys[e.code] = true; input.pressed[e.code] = true;
  if (e.code === 'Space') e.preventDefault();
  if (!P.alive) return;
  if (e.code === 'KeyI') G.ui.inventory();
  else if (e.code === 'KeyM') G.ui.bigMap();
  else if (e.code === 'KeyT') G.ui.orders();
});
addEventListener('keyup', e => { input.keys[e.code] = false; });
addEventListener('blur', () => { input.keys = {}; input.lmb = input.rmb = false; });
addEventListener('mousemove', e => { if (locked()) { input.mx += e.movementX; input.my += e.movementY; } });
canvas.addEventListener('mousedown', e => {
  audio();
  if (!G.running || G.modal) return;
  if (!locked() && !G.testMode) { G.requestLock(); return; }
  if (e.button === 0) input.lmb = true; else if (e.button === 2) input.rmb = true;
});
addEventListener('mouseup', e => { if (e.button === 0) input.lmb = false; else if (e.button === 2) input.rmb = false; });
addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('pointerlockchange', () => { if (!locked()) { input.keys = {}; input.lmb = input.rmb = false; } });

for (const c of document.querySelectorAll('.fcard')) c.querySelector('button').addEventListener('click', () => startGame(c.dataset.f));
$('btnContinue').addEventListener('click', load);
$('btnResume').addEventListener('click', () => G.requestLock());
$('btnSave').addEventListener('click', () => save());
$('btnLoad').addEventListener('click', load);
$('btnMenu').addEventListener('click', toMenu);
$('btnDeathLoad').addEventListener('click', load);
$('btnRespawn').addEventListener('click', respawn);
$('btnDeathMenu').addEventListener('click', toMenu);
$('btnContinue').classList.toggle('hidden', !hasSave());

function interact() {
  const it = findInteract();
  if (!it) return;
  if (it.type === 'talk') talk(it.obj);
  else if (it.type === 'corpse') {
    const c = it.obj, L = c.loot; c.loot = null;
    P.gold += L.gold;
    const parts = [`${L.gold} зол.`];
    for (const id in L.items) { addItem(id, L.items[id]); parts.push(`${ITEMS[id].name} ×${L.items[id]}`); }
    G.ui.msg(`Обыскан труп: ${parts.join(', ')}`); G.sfx('coin');
  } else if (it.type === 'caravan') {
    const c = it.obj;
    if (c.faction === P.faction) return G.ui.msg('Это корован твоей фракции — свои не поймут.');
    const g = c.guardsAlive();
    if (g > 0) {
      G.ui.msg(`Охрана корована ещё жива (${g})! Сначала разберись с ней.`, 'bad');
      if (c.faction === 'human') for (const n of c.guards) if (n.alive && !n.provoked) { G.provoke(n); break; }
      return;
    }
    G.onRob(c);
  }
}

// ---------- цикл ----------
let last = performance.now(), autosaveT = 150, fpsAcc = 0, fpsN = 0;
G.fps = 60;
function step(dt) {
  G.time += dt;
  updatePlayer(dt);
  if (P.alive && input.pressed.KeyE) interact();
  updateEntities(dt);
  updateDirector(dt);
  autosaveT -= dt;
  if (autosaveT <= 0) { autosaveT = 150; if (P.alive && P.lastHurt > 8) save(true); }
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  fpsAcc += dt; fpsN++; if (fpsAcc > 0.5) { G.fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
  const active = G.running && !G.modal && (locked() || G.testMode);
  $('pause').classList.toggle('hidden', !(G.running && !G.modal && !locked() && !G.testMode && P.alive));
  if (active) step(dt);
  else if (!G.running) {       // облёт мира в главном меню
    const t = now / 1000 * 0.05, r = 150;
    const cx = -230 + Math.cos(t) * r, cz = -200 + Math.sin(t) * r;
    camera.position.set(cx, heightAt(cx, cz) + 26, cz); camera.lookAt(-310, 12, -310);
  }
  if (G.running || active) { updateSky(active ? dt : 0, camera.position); }
  else updateSky(0, camera.position);
  updateTrees(camera.position, false);
  if (G.running) updateUI(dt);
  input.pressed = {};
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

// Для отладки и автотестов (?test — игра без захвата мыши).
window.__game = { G, P, THREE, scene, camera, renderer, input, step, startGame, save, load, respawn, injure, useItem, addItem, launchRaid, giveOrder, applyEvilOrder, interact, treeStats, heightAt };

// HUD: полосы состояния, миникарта, силуэт тела, подсказки, уведомления.
import * as THREE from 'three';
import { G, SETTINGS, on, emit } from '../core/state.js';
import { clamp, dist2D, formatClock } from '../core/mathutil.js';
import { interactionTarget } from '../entities/player.js';
import { isHostileToPlayer } from '../systems/combat.js';
import { zoneAt, placeAt, ROADS, RIVER, MAP, WATER_Y } from '../world/terrain.js';
import { ZONES } from '../world/terrain.js';

const $ = (id) => document.getElementById(id);
let ui = null;
const minimapCtx = () => $('minimap').getContext('2d');
let silhouetteCtx = null;
let promptText = '';
let msgs = [];

export function initHUD() {
  ui = {
    health: $('bar-health'), stamina: $('bar-stamina'), blood: $('bar-blood'),
    numHealth: $('num-health'), numStamina: $('num-stamina'), numBlood: $('num-blood'),
    wound: $('status-wound'), gold: $('gold-num'), weapon: $('weapon-name'),
    ammo: $('ammo-line'), ammoNum: $('ammo-num'), quickbar: $('quickbar'),
    stance: $('stance-line'), zone: $('zone-name'), clockTime: $('clock-time'), clockDay: $('clock-day'),
    qt: $('quest-tracker'), qtText: $('qt-text'), qtSub: $('qt-sub'),
    squadPanel: $('squad-panel'), squadList: $('squad-list'),
    crosshair: $('crosshair'), hitmarker: $('hitmarker'),
    enemyHp: $('enemy-hp'), enemyHpName: $('enemy-hp-name'), enemyHpFill: $('enemy-hp-fill'),
    prompt: $('prompt'), subtitles: $('subtitles'), notifications: $('notifications'),
    killfeed: $('killfeed'), banner: $('banner'), objective: $('objective-toast'),
    lux: $('lux-indicator'), debug: $('debug'),
    eyeL: $('eye-left'), eyeR: $('eye-right'), hitFlash: $('hit-flash'),
    bloodVignette: $('blood-vignette'), lowhp: $('lowhp-flash'),
    injuryList: $('injury-list'), bodyPanel: $('body-panel'),
  };
  silhouetteCtx = $('body-silhouette').getContext('2d');
  G.ui = ui;
  // события
  on('notify', ({ text, kind }) => addNotification(text, kind));
  on('subtitle', ({ who, text }) => showSubtitle(who, text));
  on('banner', ({ text }) => showBanner(text));
  on('npc:killed', ({ entity, killer }) => {
    if (!killer || !killer.isPlayer) return;
    addKill(`${entity.name} — повержен`);
  });
  on('player:hurt', ({ amount, part }) => {
    ui.hitFlash.style.opacity = clamp(amount / 40, 0.2, 0.75);
    setTimeout(() => { ui.hitFlash.style.opacity = 0; }, 90);
    if (part === 'head') addKill('Ранение в голову!');
  });
  on('player:eyes', ({ left, right, glassL, glassR }) => {
    ui.eyeL.style.opacity = left ? 0.98 : (glassL ? 0.42 : 0);
    ui.eyeR.style.opacity = right ? 0.98 : (glassR ? 0.42 : 0);
  });
  on('player:death', ({ cause }) => {
    emit('ui:death', { cause });
  });
  on('quest:new', () => renderQuest());
  on('quest:progress', () => renderQuest());
  on('quest:done', () => renderQuest());
  on('squad:changed', () => renderSquad());
  on('caravan:aggro', ({ caravan }) => { ui.objective.classList.remove('hidden'); ui.objective.textContent = `${caravan.name}: бой!`; setTimeout(() => ui.objective.classList.add('hidden'), 3000); });
  on('raid', ({ faction, place }) => addNotification(`Набег на ${placeName(place)} (${factionName(faction)})`, 'bad'));
  on('shop:changed', () => { /* панель обновится сама */ });
  on('player:prosthetic', () => drawSilhouette());
  on('player:injury', () => drawSilhouette());
  on('player:sever', () => drawSilhouette());
  renderQuickbar();
  on('player:inventory', () => { renderQuickbar(); });
  on('player:weapon', ({ kind }) => { ui.weapon.textContent = weaponTitle(kind); });
}

function placeName(id) { const p = G.places.find((x) => x.id === id); return p ? p.name : id; }
function factionName(f) { return { elves: 'эльфы', empire: 'Империя', villain: 'Дрегар', bandits: 'разбойники' }[f] || f; }
function weaponTitle(kind) {
  return { fists: 'Кулаки', sword: 'Клинок', bow: 'Лук', axe: 'Топор', greataxe: 'Секира', greatsword: 'Двуручник', spear: 'Копьё', dagger: 'Кинжал', staff: 'Посох' }[kind] || 'Кулаки';
}

export function addNotification(text, kind = '') {
  const div = document.createElement('div');
  div.className = 'notif ' + kind;
  div.textContent = text;
  ui.notifications.appendChild(div);
  setTimeout(() => { div.style.opacity = '0'; div.style.transition = 'opacity .5s'; }, 4200);
  setTimeout(() => div.remove(), 4900);
}
export function addKill(text) {
  const div = document.createElement('div');
  div.textContent = text;
  ui.killfeed.appendChild(div);
  setTimeout(() => div.remove(), 5200);
}
let subtitleTimer = 0;
export function showSubtitle(who, text) {
  ui.subtitles.textContent = '';
  if (who) {
    const s = document.createElement('span');
    s.className = 'who';
    s.textContent = who + ': ';
    ui.subtitles.appendChild(s);
  }
  ui.subtitles.appendChild(document.createTextNode(text));
  subtitleTimer = 4.5;
}
let bannerTimer = 0;
export function showBanner(text) {
  ui.banner.textContent = text;
  ui.banner.classList.add('on');
  bannerTimer = 2.6;
}
export function hitMarker(kill) {
  ui.hitmarker.classList.add('on');
  if (kill) ui.hitmarker.classList.add('kill');
  setTimeout(() => { ui.hitmarker.classList.remove('on'); ui.hitmarker.classList.remove('kill'); }, 140);
}

function renderQuest() {
  const q = G.quests && G.quests.list.find((x) => x.state === 'active');
  if (!q) { ui.qt.classList.add('hidden'); return; }
  ui.qt.classList.remove('hidden');
  ui.qtText.textContent = q.title;
  const obj = q.objectives.find((o) => !o.done) || q.objectives[q.objectives.length - 1];
  ui.qtSub.textContent = obj ? `${obj.text}${obj.count > 1 ? ` (${obj.progress || 0}/${obj.count})` : ''}` : '';
}
function renderSquad() {
  const p = G.player;
  if (!p || !p.squad || !p.squad.length) { ui.squadPanel.classList.add('hidden'); return; }
  ui.squadPanel.classList.remove('hidden');
  ui.squadList.innerHTML = p.squad.map((e) => {
    const hp = clamp(e.hp / e.hpMax, 0, 1);
    return `<div>${e.name} <span style="color:#8d8465">${roleShort(e.role)}</span> <span style="color:${hp > 0.5 ? '#79b465' : '#d84b4b'}">${'▮'.repeat(Math.max(1, Math.round(hp * 5)))}</span></div>`;
  }).join('');
}
function roleShort(r) {
  return { legion: 'легионер', brute: 'громила', dark_archer: 'лучник', guard: 'гвардеец', archer: 'лучник', spy: 'шпион', captain: 'капитан' }[r] || r;
}
function renderQuickbar() {
  const p = G.player;
  if (!p) return;
  ui.quickbar.innerHTML = '';
  p.quick.forEach((id, i) => {
    const slot = document.createElement('div');
    slot.className = 'qslot' + (id ? '' : ' empty');
    const qty = id ? p.inventory.filter((x) => x.id === id).reduce((a, b) => a + b.qty, 0) : 0;
    slot.innerHTML = `${id ? itemIcon(id) : '·'}<span class="qty">${i + 1}</span>${qty ? `<span class="qty" style="left:2px;right:auto">${qty}</span>` : ''}`;
    ui.quickbar.appendChild(slot);
  });
}
function itemIcon(id) {
  return (G.economy && G.economy.items[id] && G.economy.items[id].icon) || '❔';
}

// ---------------- миникарта ----------------
let mapRotate = true;
function drawMinimap() {
  const p = G.player;
  if (!p) return;
  const ctx = minimapCtx();
  const W = 220, H = 220;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0a0d07';
  ctx.fillRect(0, 0, W, H);
  const scale = 0.55; // пикселей на метр (обзор ~400 м)
  ctx.save();
  ctx.translate(W / 2, H / 2);
  if (mapRotate) ctx.rotate(p.yaw);
  const wx = p.pos.x, wz = p.pos.z;
  const toMap = (x, z) => [(x - wx) * scale, (z - wz) * scale];
  // зоны
  for (const [dx, dz, color] of [[-1, 1, '#2f3a20'], [1, 1, '#3a3a20'], [-1, -1, '#1f3a20'], [1, -1, '#33283a']]) {
    const cx = dx * 1024, cz = dz * 1024;
    const [mx, mz] = toMap(cx * 0.5 + dx * -512 + (dx > 0 ? 512 : -512) * 0, 0);
    void mx; void mz;
  }
  ctx.fillStyle = '#1b2415';
  for (const z of ZONES) {
    let x0 = 0, x1 = 0, z0 = 0, z1 = 0;
    if (z.id === 1) { x0 = -1024; x1 = 0; z0 = 0; z1 = 1024; }
    if (z.id === 2) { x0 = 0; x1 = 1024; z0 = 0; z1 = 1024; }
    if (z.id === 3) { x0 = -1024; x1 = 0; z0 = -1024; z1 = 0; }
    if (z.id === 4) { x0 = 0; x1 = 1024; z0 = -1024; z1 = 0; }
    const [ax, az] = toMap(x0, z0);
    ctx.fillStyle = z.id === 3 ? '#16240f' : z.id === 4 ? '#221b26' : z.id === 2 ? '#242412' : '#1d2413';
    ctx.fillRect(ax, az, (x1 - x0) * scale, (z1 - z0) * scale);
  }
  // река
  ctx.strokeStyle = '#2d4f5e';
  ctx.lineWidth = 6;
  ctx.beginPath();
  RIVER.pts.forEach(([x, z], i) => { const [mx, mz] = toMap(x, z); i ? ctx.lineTo(mx, mz) : ctx.moveTo(mx, mz); });
  ctx.stroke();
  // дороги
  ctx.strokeStyle = '#6b5a3e';
  ctx.lineWidth = 3;
  for (const key of Object.keys(ROADS)) {
    ctx.beginPath();
    ROADS[key].forEach(([x, z], i) => { const [mx, mz] = toMap(x, z); i ? ctx.lineTo(mx, mz) : ctx.moveTo(mx, mz); });
    ctx.stroke();
  }
  // места
  for (const pl of G.places) {
    const [mx, mz] = toMap(pl.x, pl.z);
    if (Math.abs(mx) > 180 || Math.abs(mz) > 180) continue;
    ctx.fillStyle = pl.kind === 'palace' ? '#d4af37' : pl.kind === 'elfvillage' ? '#79b465' : pl.kind === 'fort' ? '#c07ad0' : '#b8a878';
    ctx.beginPath(); ctx.arc(mx, mz, pl.kind === 'palace' || pl.kind === 'fort' ? 5 : 3, 0, 7); ctx.fill();
  }
  // корованы
  for (const c of G.caravans) {
    if (!c.pos) continue;
    const [mx, mz] = toMap(c.pos.x, c.pos.z);
    if (Math.abs(mx) > 180 || Math.abs(mz) > 180) continue;
    ctx.fillStyle = '#ffd76a';
    ctx.fillRect(mx - 2, mz - 2, 4, 4);
  }
  // враги/союзники
  for (const e of G.entities) {
    if (e.dead) continue;
    const d = dist2D(wx, wz, e.pos.x, e.pos.z);
    if (d > 320) continue;
    const [mx, mz] = toMap(e.pos.x, e.pos.z);
    const hostile = isHostileToPlayer(e);
    ctx.fillStyle = hostile ? '#e05a5a' : (e.faction === 'people' ? '#9fd0ff' : '#8fd07a');
    ctx.beginPath(); ctx.arc(mx, mz, 2.2, 0, 7); ctx.fill();
  }
  // трупы
  for (const c of G.corpses) {
    const [mx, mz] = toMap(c.pos.x, c.pos.z);
    if (Math.abs(mx) > 180 || Math.abs(mz) > 180) continue;
    ctx.fillStyle = '#7a6a6a';
    ctx.fillRect(mx - 1.5, mz - 1.5, 3, 3);
  }
  ctx.restore();
  // игрок
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.moveTo(W / 2, H / 2 - 6);
  ctx.lineTo(W / 2 - 4.5, H / 2 + 5);
  ctx.lineTo(W / 2 + 4.5, H / 2 + 5);
  ctx.closePath();
  ctx.fill();
  // рамка и север
  ctx.strokeStyle = '#5a5230';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);
  ctx.fillStyle = '#d4af37';
  ctx.font = '11px "Courier New", monospace';
  ctx.fillText('С', W / 2 - 4, 14);
  ctx.fillStyle = '#8d8465';
  ctx.font = '10px "Courier New", monospace';
  ctx.fillText('400 м', 6, H - 6);
}

// ---------------- силуэт тела ----------------
export function drawSilhouette() {
  const ctx = silhouetteCtx;
  const p = G.player;
  if (!ctx || !p) return;
  const W = 150, H = 230;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0b0e08cc';
  ctx.fillRect(0, 0, W, H);
  const cx = W / 2;
  const limbColor = (key, base) => {
    if (p.missing[key]) return p.prosthetics[key] ? '#9fd0ff' : '#d84b4b';
    if ((p.limbHp[key] || 1) < p.hpMax * 0.28) return '#e0a05a';
    return base;
  };
  const drawLimb = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
  // голова
  ctx.fillStyle = (p.missing.eyeL || p.missing.eyeR) ? '#e0a05a' : '#e8d8a0';
  ctx.fillRect(cx - 13, 12, 26, 26);
  ctx.fillStyle = p.missing.eyeR ? (p.prosthetics.eyeR ? '#9fd0ff' : '#d84b4b') : '#201810';
  ctx.fillRect(cx + 3, 22, 7, 5);
  ctx.fillStyle = p.missing.eyeL ? (p.prosthetics.eyeL ? '#9fd0ff' : '#d84b4b') : '#201810';
  ctx.fillRect(cx - 10, 22, 7, 5);
  // торс
  drawLimb(cx - 22, 42, 44, 66, (p.limbHp.torso || 1) < p.hpMax * 0.3 ? '#e0a05a' : '#c9b98a');
  // руки
  drawLimb(cx - 40, 46, 15, 54, limbColor('armL', '#c9b98a'));
  drawLimb(cx - 40, 100, 13, 42, limbColor('armL', '#c9b98a'));
  drawLimb(cx + 25, 46, 15, 54, limbColor('armR', '#c9b98a'));
  drawLimb(cx + 27, 100, 13, 42, limbColor('armR', '#c9b98a'));
  // ноги
  drawLimb(cx - 20, 108, 17, 56, limbColor('legL', '#a89a72'));
  drawLimb(cx - 19, 164, 15, 52, limbColor('legL', '#a89a72'));
  drawLimb(cx + 3, 108, 17, 56, limbColor('legR', '#a89a72'));
  drawLimb(cx + 4, 164, 15, 52, limbColor('legR', '#a89a72'));
  // подписи
  ctx.fillStyle = '#8d8465';
  ctx.font = '10px "Courier New", monospace';
  ctx.fillText('ТЕЛО', 6, 12);
  if (p.bleeding > 0.05) { ctx.fillStyle = '#d84b4b'; ctx.fillText(`КРОВЬ ${p.bleeding.toFixed(1)}`, 6, H - 8); }
  else if (p.inChair) { ctx.fillStyle = '#9fd0ff'; ctx.fillText('КОЛЯСКА', 6, H - 8); }
  else if (p.crawling) { ctx.fillStyle = '#e0a05a'; ctx.fillText('ПОЛЗКОМ', 6, H - 8); }
  // список травм
  const inj = [];
  for (const k of ['armL', 'armR', 'legL', 'legR']) {
    if (p.missing[k]) inj.push(`${k.startsWith('arm') ? 'рука' : 'нога'} ${k.endsWith('L') ? 'левая' : 'правая'}: ${p.prosthetics[k] ? 'протез' : 'нет'}`);
  }
  if (p.missing.eyeL) inj.push(`левый глаз: ${p.prosthetics.eyeL ? 'стеклянный' : 'выбит'}`);
  if (p.missing.eyeR) inj.push(`правый глаз: ${p.prosthetics.eyeR ? 'стеклянный' : 'выбит'}`);
  if (p.wheelchair && p.inChair) inj.push('едет в коляске');
  ui.injuryList.innerHTML = inj.map((t) => `<div>• ${t}</div>`).join('');
}

// ---------------- основной кадр ----------------
export function updateHUD(dt) {
  const p = G.player;
  if (!p || !ui) return;
  ui.health.style.width = `${clamp(p.hp / p.hpMax, 0, 1) * 100}%`;
  ui.stamina.style.width = `${clamp(p.stamina / p.staminaMax, 0, 1) * 100}%`;
  ui.blood.style.width = `${clamp(p.blood / 100, 0, 1) * 100}%`;
  ui.numHealth.textContent = Math.max(0, Math.round(p.hp));
  ui.numStamina.textContent = Math.round(p.stamina);
  ui.numBlood.textContent = `${Math.round(p.blood)}%`;
  ui.gold.textContent = p.gold;
  const kind = p.equip && p.equip.weapon ? (G.economy.items[p.equip.weapon] ? G.economy.items[p.equip.weapon].name : '') : 'Кулаки';
  ui.weapon.textContent = kind;
  const arrows = p.inventory.filter((i) => i.id === 'arrows').reduce((a, b) => a + b.qty, 0);
  const isBow = p.weapon === 'bow' || (p.equip.weapon && G.economy.items[p.equip.weapon] && G.economy.items[p.equip.weapon].kind === 'weapon' && /bow/.test(p.equip.weapon));
  ui.ammo.classList.toggle('hidden', !isBow);
  ui.ammoNum.textContent = arrows;
  // состояние
  const states = [];
  if (p.bleeding > 0.05) states.push(`<span style="color:#d84b4b">КРОВОТЕЧЕНИЕ ${p.bleeding.toFixed(1)}</span>`);
  if (p.crawling) states.push('ПОЛЗКОМ');
  if (p.inChair) states.push('КОЛЯСКА');
  if (p.crouching) states.push('ТИХО');
  if (p.hunger < 20) states.push('ГОЛОДЕН');
  if (p.downed) states.push('<span style="color:#e0a05a">ТЯЖЕЛО РАНЕН</span>');
  ui.stance.innerHTML = states.join(' · ');
  ui.wound.textContent = p.bleeding > 0.05 ? `КРОВОТЕЧЕНИЕ: ${p.bleeding.toFixed(1)}` : '';
  // зона и время
  const place = placeAt(p.pos.x, p.pos.z);
  const zone = zoneAt(p.pos.x, p.pos.z);
  ui.zone.textContent = place ? place.name : zone.name;
  ui.clockTime.textContent = formatClock(G.time.seconds);
  ui.clockDay.textContent = `день ${G.time.day}`;
  // виньетки
  const hpFrac = p.hp / p.hpMax;
  ui.lowhp.style.opacity = hpFrac < 0.33 && !p.dead ? '1' : '0';
  ui.bloodVignette.style.opacity = clamp(p.bleeding * 0.28 + (1 - p.blood / 100) * 0.5, 0, 0.9);
  if (subtitleTimer > 0) { subtitleTimer -= dt; if (subtitleTimer <= 0) ui.subtitles.textContent = ''; }
  if (bannerTimer > 0) { bannerTimer -= dt; if (bannerTimer <= 0) ui.banner.classList.remove('on'); }
  // подсказка взаимодействия
  const t = interactionTarget();
  const newPrompt = t ? `[E] ${t.text}` : '';
  if (newPrompt !== promptText) {
    promptText = newPrompt;
    if (promptText) { ui.prompt.textContent = promptText; ui.prompt.classList.remove('hidden'); }
    else ui.prompt.classList.add('hidden');
  }
  // прицел по врагу
  const enemy = enemyUnderCrosshair();
  ui.crosshair.classList.toggle('enemy', !!enemy);
  if (enemy) {
    ui.enemyHp.classList.remove('hidden');
    ui.enemyHpName.textContent = `${enemy.name} (${enemy.role})`;
    ui.enemyHpFill.style.width = `${clamp(enemy.hp / enemy.hpMax, 0, 1) * 100}%`;
  } else ui.enemyHp.classList.add('hidden');
  // миникарта (реже)
  G._mapTimer = (G._mapTimer || 0) - dt;
  if (G._mapTimer <= 0) { G._mapTimer = 0.1; drawMinimap(); drawSilhouette(); }
  // индикатор света
  const hour = (G.time.seconds / 3600) % 24;
  ui.lux.textContent = hour < 5 || hour > 21 ? '🌙 ночь' : hour < 8 ? '🌅 рассвет' : hour > 18 ? '🌇 закат' : '☀️ день';
  if (SETTINGS.hints === false) ui.prompt.classList.add('hidden');
  if (G.debugOn) {
    ui.debug.classList.remove('hidden');
    const info = G.debugInfo ? G.debugInfo() : {};
    ui.debug.textContent = Object.entries(info).map(([k, v]) => `${k}: ${v}`).join('\n');
  } else ui.debug.classList.add('hidden');
}

function enemyUnderCrosshair() {
  const p = G.player;
  const yaw = p.yaw, pitch = p.pitch;
  const dx = -Math.sin(yaw) * Math.cos(pitch), dy = Math.sin(pitch), dz = -Math.cos(yaw) * Math.cos(pitch);
  let best = null, bestT = 45;
  for (const e of G.entities) {
    if (e.dead || !isHostileToPlayer(e)) continue;
    const ex = e.pos.x - p.pos.x, ey = e.pos.y + e.height * 0.5 - (p.pos.y + p.eyeHeight), ez = e.pos.z - p.pos.z;
    const t = ex * dx + ey * dy + ez * dz;
    if (t < 1 || t > bestT) continue;
    const px = dx * t, py = dy * t, pz = dz * t;
    const off = Math.hypot(ex - px, ey - py, ez - pz);
    if (off < e.radius + 0.35) { bestT = t; best = e; }
  }
  return best;
}

export function showDeathScreen(cause) {
  const p = G.player;
  emit('ui:show', { id: 'screen-death' });
  const texts = {
    bleeding: 'Кровь ушла. Надо было перевязать рану (F) или дойти до лекаря.',
    default: 'Тебя достали. Мир КОРОВАНОВ не прощает беспечности.',
  };
  const el = document.getElementById('death-text');
  el.textContent = texts[cause] || texts.default;
  document.getElementById('death-stats').innerHTML = `
    <div><span class="k">Убито:</span> <span class="v">${p.stats.kills}</span></div>
    <div><span class="k">Отрублено конечностей:</span> <span class="v">${G.stats.severed}</span></div>
    <div><span class="k">Заданий выполнено:</span> <span class="v">${G.stats.questsDone}</span></div>
    <div><span class="k">Золота добыто:</span> <span class="v">${G.stats.goldEarned}</span></div>`;
  void MAP; void WATER_Y;
}
void THREE;

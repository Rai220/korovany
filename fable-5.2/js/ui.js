// Интерфейс: HUD, мини-карта, диалоги, лавки, инвентарь, карта мира.
import * as THREE from '../lib/three.min.js';
import { G, FACTIONS, ITEMS, SHOPS, SITES, ZONE_NAMES, BODY_PARTS, WORLD, HALF, zoneAt, clamp } from './data.js';
import { useItem, addItem, removeItem, findInteract, armCount, legCount } from './player.js';
import { EVIL_ORDERS, applyEvilOrder, hireMinion, evilTroops, rankName } from './director.js';

const $ = id => document.getElementById(id);
const P = G.player;
let camera, hudT = 0, mapT = 0, lastZone = '', bannerT = 0, callbacks = [], panelKind = null, panelRefresh = null;
const floats = [];
const _v = new THREE.Vector3(), _d = new THREE.Vector3();

export const HELP = `<b>WASD</b> — ходить, <b>мышь</b> — смотреть<br><b>Shift</b> — бег, <b>Пробел</b> — прыжок<br><b>ЛКМ</b> — удар / выстрел, <b>ПКМ</b> — блок<br><b>1 / 2</b> — ближнее / стрелковое оружие<br><b>E</b> — говорить, торговать, обыскать труп, ограбить корован<br><b>Q</b> — выпить зелье, <b>B</b> — перевязать рану<br><b>I</b> — рюкзак и персонаж, <b>M</b> — карта<br><b>T</b> — приказы войскам (Злой) / журнал<br><b>V</b> — вид от 3-го лица<br><b>F5</b> — сохранить, <b>F9</b> — загрузить, <b>Esc</b> — пауза`;

function msg(text, cls = '') {
  const log = $('log'), d = document.createElement('div');
  d.textContent = text; if (cls) d.className = cls;
  log.appendChild(d);
  while (log.children.length > 7) log.removeChild(log.firstChild);
  setTimeout(() => { d.style.opacity = 0; setTimeout(() => d.remove(), 1000); }, 7000);
}
function float(pos, text, color) {
  const d = document.createElement('div'); d.textContent = text; d.style.color = color || '#fff';
  $('floats').appendChild(d);
  floats.push({ d, x: pos.x, y: pos.y + 2.2, z: pos.z, t: 1.4 });
}
let hurtA = 0;
function flash(a) { hurtA = Math.min(1, hurtA + a); }
function banner(text) { const b = $('banner'); b.textContent = text; b.style.opacity = 1; bannerT = 3; }

// ---------- панели ----------
function open(kind, html, refresh) {
  panelKind = kind; panelRefresh = refresh || null; G.modal = true;
  $('panelBox').innerHTML = html; $('panel').classList.remove('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
}
function close() {
  if (!G.modal) return;
  G.modal = false; panelKind = null; $('panel').classList.add('hidden'); callbacks = [];
  if (G.running && P.alive && !G.testMode) G.requestLock();
}
function btn(label, fn, extra = '') { callbacks.push(fn); return `<button data-cb="${callbacks.length - 1}" ${extra}>${label}</button>`; }
function dialog(title, text, options) {
  callbacks = [];
  open('dialog', `<h2>${title}</h2><p>${text}</p><div class="opts">${options.map(o => btn(o.label, o.fn)).join('')}</div>`);
}
const priceBuy = id => id === 'arrow' ? 20 : ITEMS[id].price;
const priceSell = id => Math.max(1, Math.floor(ITEMS[id].price * 0.5));
function shop(id, npc) {
  const S = SHOPS[id];
  const render = () => {
    callbacks = [];
    let h = `<h2>${S.title}</h2><div class="row"><span>${npc.name}</span><span class="gold">Твоё золото: ${Math.floor(P.gold)}</span></div><div class="cols"><div><h3>Товары</h3>`;
    for (const it of S.stock) {
      const I = ITEMS[it], pr = priceBuy(it);
      h += `<div class="row"><span>${I.name}${it === 'arrow' ? ' ×20' : ''}${desc(it)}</span><span><span class="gold">${pr}</span>${btn('Купить', () => { if (P.gold < pr) return msg('Не хватает золота.', 'bad'); P.gold -= pr; addItem(it, it === 'arrow' ? 20 : 1); G.sfx('coin'); render(); }, P.gold < pr ? 'disabled' : '')}</span></div>`;
    }
    h += `<h3 style="margin-top:12px">Услуги</h3>`;
    let any = false;
    if (S.healer) {
      any = true;
      const cost = Math.ceil((P.maxHp - P.hp) * 0.5) + (P.bleed > 0 ? 10 : 0);
      h += `<div class="row"><span>Вылечить раны и остановить кровь</span><span><span class="gold">${cost}</span>${btn('Лечить', () => { if (P.gold < cost) return msg('Не хватает золота.', 'bad'); P.gold -= cost; P.hp = P.maxHp; P.bleed = 0; G.sfx('heal'); msg('Лекарь заштопал тебя как новенького.', 'good'); render(); }, cost <= 0 || P.gold < cost ? 'disabled' : '')}</span></div>`;
      h += `<div class="note">Протез ставится из рюкзака (I) — купи и нажми «Использовать». Сначала нужно остановить кровь.</div>`;
    }
    if (S.rest) { any = true; h += `<div class="row"><span>Комната до утра (полное здоровье)</span><span><span class="gold">15</span>${btn('Спать', () => { if (P.gold < 15) return msg('Не хватает золота.', 'bad'); P.gold -= 15; P.hp = P.maxHp; P.stamina = 100; if (P.bleed > 0) P.bleed = 0; G.dayTime = 0.28; G.day++; msg('Ты выспался. Наступило утро.', 'good'); render(); })}</span></div>`; }
    if (id === 'dealer' && P.faction === 'evil') { any = true; h += `<div class="row"><span>Нанять бойца в войско (сейчас: ${evilTroops()})</span><span><span class="gold">60</span>${btn('Нанять', () => { hireMinion(); render(); })}</span></div>`; }
    if (!any) h += `<div class="note">Услуг нет — только торговля.</div>`;
    h += `</div><div><h3>Твой рюкзак (продажа за полцены)</h3>`;
    const ids = Object.keys(P.inv);
    if (!ids.length) h += `<div class="note">Пусто.</div>`;
    for (const it of ids) {
      const n = P.inv[it], lot = it === 'arrow' ? Math.min(20, n) : 1, pr = it === 'arrow' ? Math.floor(lot / 2) : priceSell(it);
      h += `<div class="row"><span>${ITEMS[it].name} ×${n}${isEq(it) ? ' <span class="eq">(надето)</span>' : ''}</span><span><span class="gold">${pr}</span>${btn(it === 'arrow' ? 'Продать ×' + lot : 'Продать', () => { removeItem(it, lot); P.gold += pr; G.sfx('coin'); render(); })}</span></div>`;
    }
    h += `</div></div><div class="opts" style="margin-top:10px">${btn('Уйти (Esc / E)', close)}</div>`;
    open('shop', h);
  };
  render();
}
const isEq = id => P.equip.melee === id || P.equip.ranged === id || P.equip.armor === id;
function desc(id) {
  const I = ITEMS[id];
  if (I.type === 'melee') return ` <span class="dim">(урон ${I.dmg})</span>`;
  if (I.type === 'ranged') return ` <span class="dim">(урон ${I.dmg}${I.magic ? ', без стрел' : ''})</span>`;
  if (I.type === 'armor') return ` <span class="dim">(защита ${Math.round(I.def * 100)}%)</span>`;
  if (I.heal) return ` <span class="dim">(+${I.heal} здоровья)</span>`;
  return '';
}
const stName = { ok: 'цел', lost: 'ПОТЕРЯН', prosthesis: 'протез' };
function inventory() {
  const render = () => {
    callbacks = [];
    const f = FACTIONS[P.faction];
    let h = `<h2>Персонаж и рюкзак</h2><div class="cols"><div><h3>Персонаж</h3>
      <div class="row"><span>Фракция</span><span style="color:${f.css}">${P.faction === 'evil' ? 'Злой (сам себе командир)' : f.name}</span></div>
      ${P.faction === 'empire' ? `<div class="row"><span>Звание</span><span>${rankName()} (дисциплина ${P.discipline}/3)</span></div>` : ''}
      <div class="row"><span>Уровень</span><span>${P.level} (опыт ${Math.floor(P.xp)}/${P.level * 100})</span></div>
      <div class="row"><span>Здоровье</span><span>${Math.ceil(P.hp)} / ${P.maxHp}</span></div>
      <div class="row"><span>Золото</span><span class="gold">${Math.floor(P.gold)}</span></div>
      <div class="row"><span>Репутация у людей</span><span>${P.repHuman <= -20 ? 'ВРАГ' : P.repHuman < 0 ? 'подозрительный (' + P.repHuman + ')' : 'нейтральная'}</span></div>
      <div class="row"><span>Убито врагов / ограблено корованов</span><span>${G.stats.kills} / ${G.stats.robbed}</span></div>
      <h3 style="margin-top:10px">Характеристики ${P.points ? `<span class="gold">(очков: ${P.points})</span>` : ''}</h3>`;
    for (const [k, nm, d] of [['str', 'Сила', '+8% урона в ближнем бою'], ['agi', 'Ловкость', 'скорость, прыжок, стрельба'], ['end', 'Живучесть', '−3% получаемого урона']])
      h += `<div class="row"><span>${nm}: ${P.stats[k]} <span class="dim">— ${d}</span></span>${P.points ? btn('+', () => { P.stats[k]++; P.points--; render(); }) : ''}</div>`;
    h += `<h3 style="margin-top:10px">Тело</h3>`;
    for (const k in BODY_PARTS) h += `<div class="row"><span>${BODY_PARTS[k]}</span><span style="color:${P.body[k] === 'ok' ? '#9be08a' : P.body[k] === 'lost' ? '#ff5a4a' : '#7ec8ff'}">${stName[P.body[k]]}</span></div>`;
    h += `<div class="note">${P.bleed > 0 ? '🩸 Ты истекаешь кровью! ' : ''}Передвижение: ${P.mode === 'walk' ? 'пешком' : P.mode === 'chair' ? 'на коляске' : 'ползком'}.</div></div><div><h3>Рюкзак</h3>`;
    const ids = Object.keys(P.inv);
    if (!ids.length) h += `<div class="note">Пусто.</div>`;
    for (const it of ids) {
      const I = ITEMS[it];
      const lbl = I.type === 'melee' || I.type === 'ranged' ? 'В руку' : I.type === 'armor' ? 'Надеть' : I.type === 'loot' || I.type === 'ammo' ? null : I.type === 'prosthesis' ? 'Поставить' : I.type === 'gear' ? null : 'Использовать';
      h += `<div class="row"><span>${I.name} ×${P.inv[it]}${desc(it)}${isEq(it) ? ' <span class="eq">(надето)</span>' : ''}</span>${lbl && !isEq(it) ? btn(lbl, () => { useItem(it); render(); }) : ''}</div>`;
    }
    h += `</div></div><div class="opts" style="margin-top:10px">${btn('Закрыть (I / Esc)', close)}</div>`;
    open('inv', h);
  };
  render();
}
function orders() {
  if (P.faction === 'evil') {
    dialog('Приказы войску', `Ты — Злой, сам себе командир. Бойцов в строю: ${evilTroops()}.\nТекущий приказ: «${EVIL_ORDERS[G.evilOrder]}».\nНанять новых бойцов можно у барыги в форте.`,
      Object.keys(EVIL_ORDERS).map(k => ({ label: (k === G.evilOrder ? '● ' : '○ ') + EVIL_ORDERS[k], fn: () => { const c = applyEvilOrder(k); msg(`Приказ войску (${c} бойцов): ${EVIL_ORDERS[k]}`, 'info'); G.sfx('horn'); close(); } })).concat([{ label: 'Закрыть', fn: close }]));
  } else {
    const m = G.mission;
    const goal = P.faction === 'elf' ? 'Главная цель: убить Императора (дворец) и Злого (форт в горах).' : 'Главная цель империи: уничтожить Злого (форт в горах) и Владыку эльфов (деревня в лесу).';
    dialog('Журнал', `${goal}\n\n${m ? 'Текущее задание: ' + m.title + '\n' + m.desc : P.faction === 'empire' ? 'Приказов пока нет. Командир скоро что-нибудь придумает — жди у дворца или подойди к нему.' : 'Заданий нет. Поговори с Владыкой эльфов у Великого древа — или иди грабить корованы.'}`, [{ label: 'Закрыть', fn: close }]);
  }
}
function drawMapMarkers(ctx, sc, ox, oy, range) {
  const X = x => (x + HALF) * sc - ox, Z = z => (z + HALF) * sc - oy;
  for (const c of G.caravans) {
    if (range && Math.hypot(c.pos.x - P.pos.x, c.pos.z - P.pos.z) > range) continue;
    ctx.fillStyle = c.looted ? '#777' : '#ffd84a'; ctx.strokeStyle = '#000'; ctx.fillRect(X(c.pos.x) - 4, Z(c.pos.z) - 4, 8, 8); ctx.strokeRect(X(c.pos.x) - 4, Z(c.pos.z) - 4, 8, 8);
  }
  for (const n of G.npcs) {
    if (!n.alive) continue;
    const d = Math.hypot(n.pos.x - P.pos.x, n.pos.z - P.pos.z);
    if (range ? d > range : (n.faction !== P.faction && d > 130 && n.tag !== 'raid')) continue;
    ctx.fillStyle = n.hostileTo(P) ? '#ff4030' : FACTIONS[n.faction].css;
    ctx.beginPath(); ctx.arc(X(n.pos.x), Z(n.pos.z), n.kind === 'leader' ? 4 : n.role ? 3 : 2.2, 0, 7); ctx.fill();
    if (n.role || n.kind === 'leader') { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke(); }
  }
  const m = G.mission;
  if (m && m.target) {
    let tx = X(m.target.x), tz = Z(m.target.z);
    if (range) { const cx = range * sc, dx = tx - cx, dz = tz - cx, d = Math.hypot(dx, dz); if (d > cx - 8) { tx = cx + dx / d * (cx - 8); tz = cx + dz / d * (cx - 8); } }
    ctx.fillStyle = '#ffe14a'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
    ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 3.5 : 8; ctx[i ? 'lineTo' : 'moveTo'](tx + Math.cos(a) * r, tz + Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  // игрок
  const px = X(P.pos.x), pz = Z(P.pos.z);
  ctx.save(); ctx.translate(px, pz); ctx.rotate(-P.yaw + Math.PI);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(5.5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5.5, 6); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
}
function bigMap() {
  callbacks = [];
  open('map', `<h2>Карта четырёх земель</h2><canvas id="bigmap" width="620" height="620"></canvas>
    <div class="legend"><i style="background:#fff"></i>ты <i style="background:#ffd84a;border-radius:0"></i>корован <i style="background:#ff4030"></i>враги <i style="background:${FACTIONS[P.faction].css}"></i>свои <i style="background:#ffe14a"></i>цель задания</div>
    <div class="opts" style="margin-top:8px">${btn('Закрыть (M / Esc)', close)}</div>`);
  const cv = $('bigmap'), ctx = cv.getContext('2d'), sc = 620 / WORLD;
  ctx.imageSmoothingEnabled = true; ctx.drawImage(G.mapCanvas, 0, 0, 620, 620);
  ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(310, 0); ctx.lineTo(310, 620); ctx.moveTo(0, 310); ctx.lineTo(620, 310); ctx.stroke(); ctx.setLineDash([]);
  ctx.textAlign = 'center'; ctx.font = 'bold 15px Georgia'; ctx.lineWidth = 3; ctx.strokeStyle = '#000';
  const label = (t, x, z, col) => { ctx.strokeText(t, (x + HALF) * sc, (z + HALF) * sc); ctx.fillStyle = col; ctx.fillText(t, (x + HALF) * sc, (z + HALF) * sc); };
  label('3. ЛЕС ЭЛЬФОВ', -300, -520, '#8be08f'); label('4. ГОРЫ ЗЛОГО', 300, -520, '#d79cff'); label('1. ЗЕМЛИ ЛЮДЕЙ (нейтрал)', -300, 540, '#ffe0a0'); label('2. ЗОНА ИМПЕРАТОРА', 300, 540, '#a8c8ff');
  ctx.font = '13px Georgia';
  for (const k in SITES) label(SITES[k].name, SITES[k].x, SITES[k].z - (k === 'hub' ? 12 : 30), '#fff');
  drawMapMarkers(ctx, sc, 0, 0, 0);
}
function victory() {
  dialog('ПОБЕДА!', `Оба вражеских предводителя мертвы. ${P.faction === 'elf' ? 'Лес свободен: никто больше не набигает на деревяные домики.' : P.faction === 'empire' ? 'Империя торжествует, командир выписал тебе премию.' : 'Четыре земли лежат у твоих ног. Имя ты себе так и не придумал.'}\n\nУбито врагов: ${G.stats.kills}. Ограблено корованов: ${G.stats.robbed}. Дней прошло: ${G.day}.\n\nМожно продолжать играть — корованы всё ещё ходят.`, [{ label: 'Продолжить игру', fn: close }]);
}

// ---------- HUD ----------
function updateHud() {
  $('hpFill').style.width = clamp(P.hp / P.maxHp * 100, 0, 100) + '%';
  $('hpText').textContent = `${Math.max(0, Math.ceil(P.hp))} / ${P.maxHp}`;
  $('stFill').style.width = clamp(P.stamina, 0, 100) + '%';
  $('bleed').classList.toggle('hidden', P.bleed <= 0);
  const b = P.body, st = k => `<span class="${b[k] === 'ok' ? 'ok' : b[k] === 'lost' ? 'lost' : 'pro'}">${b[k] === 'ok' ? '✔' : b[k] === 'lost' ? '✘' : '⚙'}</span>`;
  $('bodyState').innerHTML = `Руки ${st('armL')}${st('armR')} · Ноги ${st('legL')}${st('legR')} · Глаза ${st('eyeL')}${st('eyeR')}${P.mode !== 'walk' ? ` · <span class="lost">${P.mode === 'chair' ? 'на коляске' : 'ползком'}</span>` : ''}`;
  const wid = P.slot === 'ranged' && P.equip.ranged ? P.equip.ranged : P.equip.melee;
  const W = ITEMS[wid];
  $('weapon').textContent = (armCount() === 0 ? 'Рук нет — только пинки' : W ? W.name : 'Кулаки') + (W && W.type === 'ranged' && !W.magic ? ` · стрел: ${P.inv.arrow || 0}` : '') + ` · зелий: ${P.inv.potion || 0} · бинтов: ${P.inv.bandage || 0}`;
  const z = zoneAt(P.pos.x, P.pos.z);
  if (z !== lastZone) { lastZone = z; banner(ZONE_NAMES[z]); }
  $('zone').textContent = ZONE_NAMES[z];
  $('info').innerHTML = `<span class="gold">Золото: ${Math.floor(P.gold)}</span> · Ур. ${P.level}${P.points ? ' <span class="gold">(+очки: I)</span>' : ''}${P.faction === 'empire' ? ' · ' + rankName() : ''}${P.faction === 'evil' ? ' · войско: ' + evilTroops() : ''}`;
  const hh = Math.floor(G.dayTime * 24), mm = Math.floor((G.dayTime * 24 - hh) * 60);
  $('clock').textContent = `День ${G.day}, ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  const m = G.mission, mb = $('mission');
  if (m) {
    let pr = '';
    if (m.type === 'defend') pr = `Осталось налётчиков: ${m.left ?? '?'}`;
    else if (m.goal) pr = `Прогресс: ${m.progress}/${m.goal}`;
    const tt = m.t !== undefined ? ` · ⏳ ${Math.floor(m.t / 60)}:${String(Math.floor(m.t % 60)).padStart(2, '0')}` : '';
    mb.innerHTML = `<b>${m.title}</b><br>${m.desc}<br><span class="gold">${pr}${tt}</span>`;
  } else if (P.faction === 'evil') mb.innerHTML = `<b>Ты — Злой</b><br>Приказ войску: «${EVIL_ORDERS[G.evilOrder]}» (T — сменить)<br>Цель: убить Императора и Владыку эльфов.<br>${leaders()}`;
  else if (P.faction === 'empire') mb.innerHTML = `<b>Служба во дворце</b><br>Жди приказа командира.<br>${leaders()}`;
  else mb.innerHTML = `<b>Вольный эльф</b><br>Возьми задание у Владыки, обороняй деревню или грабь корованы.<br>${leaders()}`;
  // цель под прицелом
  camera.getWorldDirection(_d);
  let best = null, bd = 45;
  for (const n of G.npcs) {
    if (!n.alive) continue;
    _v.set(n.pos.x - camera.position.x, n.pos.y + 1.1 - camera.position.y, n.pos.z - camera.position.z);
    const d = _v.length(); if (d > bd) continue;
    const ang = Math.acos(clamp(_v.dot(_d) / d, -1, 1));
    if (ang < Math.atan(0.9 / d) + 0.01) { bd = d; best = n; }
  }
  $('focus').classList.toggle('hidden', !best);
  if (best) {
    const hos = best.hostileTo(P);
    $('focusName').innerHTML = `<span style="color:${hos ? '#ff7060' : best.faction === P.faction ? '#9be08a' : '#f3e6c4'}">${best.name}</span> <span class="dim" style="font-size:12px">· ${FACTIONS[best.faction].short}</span>`;
    $('focusFill').style.width = clamp(best.hp / best.maxHp * 100, 0, 100) + '%';
  }
  const it = P.alive ? findInteract() : null;
  $('prompt').classList.toggle('hidden', !it);
  if (it) $('prompt').textContent = it.label;
  // глаза
  for (const [id, k] of [['eyeL', 'eyeL'], ['eyeR', 'eyeR']]) { const e = $(id); e.classList.toggle('hidden', b[k] === 'ok'); e.classList.toggle('crystal', b[k] === 'prosthesis'); }
}
const leaders = () => ['empire', 'elf', 'evil'].filter(f => f !== P.faction).map(f => `<span style="color:${G.leadersDead[f] ? '#888' : FACTIONS[f].css}">${G.leadersDead[f] ? '☠' : '♛'} ${f === 'empire' ? 'Император' : f === 'elf' ? 'Владыка эльфов' : 'Злой'}</span>`).join(' · ');
function updateMinimap() {
  const cv = $('minimap'), ctx = cv.getContext('2d'), R = 110, S = cv.width, sc = S / (R * 2);
  const ox = (P.pos.x + HALF - R) * sc, oy = (P.pos.z + HALF - R) * sc;
  ctx.fillStyle = '#10141c'; ctx.fillRect(0, 0, S, S);
  const k = G.mapCanvas.width / WORLD;
  ctx.drawImage(G.mapCanvas, (P.pos.x + HALF - R) * k, (P.pos.z + HALF - R) * k, R * 2 * k, R * 2 * k, 0, 0, S, S);
  if (G.daylight < 0.5) { ctx.fillStyle = `rgba(5,10,30,${0.45 * (1 - G.daylight * 2)})`; ctx.fillRect(0, 0, S, S); }
  drawMapMarkers(ctx, sc, ox, oy, R);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px Georgia'; ctx.textAlign = 'center'; ctx.fillText('С', S / 2, 12);
}

export function updateUI(dt) {
  hudT -= dt; mapT -= dt;
  if (hudT <= 0) { hudT = 0.1; updateHud(); }
  if (mapT <= 0) { mapT = 0.12; updateMinimap(); }
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').style.opacity = 0; }
  hurtA = Math.max(0, hurtA - dt * 0.9);
  const low = P.alive && P.hp < P.maxHp * 0.3 ? 0.35 + Math.sin(G.time * 5) * 0.12 : 0;
  $('hurt').style.opacity = Math.max(hurtA, low, P.bleed > 0 ? 0.25 : 0);
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i]; f.t -= dt; f.y += dt * 0.8;
    _v.set(f.x, f.y, f.z).project(camera);
    if (f.t <= 0 || _v.z > 1) { if (f.t <= 0) { f.d.remove(); floats.splice(i, 1); } else f.d.style.display = 'none'; continue; }
    f.d.style.display = ''; f.d.style.left = (_v.x * 0.5 + 0.5) * innerWidth + 'px'; f.d.style.top = (-_v.y * 0.5 + 0.5) * innerHeight + 'px'; f.d.style.opacity = Math.min(1, f.t * 2);
  }
}

export function initUI(cam) {
  camera = cam;
  $('panel').addEventListener('click', e => {
    const b = e.target.closest('button[data-cb]');
    if (b) { const fn = callbacks[+b.dataset.cb]; if (fn) fn(); }
  });
  $('menuHelp').innerHTML = HELP; $('pauseHelp').innerHTML = HELP;
  G.ui = { msg, float, flash, banner, dialog, shop, inventory, orders, bigMap, close, victory, get kind() { return panelKind; }, resetZone() { lastZone = ''; } };
}

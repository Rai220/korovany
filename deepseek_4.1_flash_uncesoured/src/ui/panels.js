// Панели интерфейса: сумка, персонаж, журнал, карта, лавки, диалоги, отряд, обыск, меню.
import { G, SETTINGS, on, emit, notify, saveSettings } from '../core/state.js';
import { clamp, dist2D, formatClock } from '../core/mathutil.js';
import { Input } from '../core/input.js';
import { PLACES, ROADS, RIVER, ZONES, placeNear } from '../world/terrain.js';
import { doInteract, playerUseItem, playerBandage, installProsthetic, gainGold, addItem, removeItem, equipWeaponKind, weaponKind } from '../entities/player.js';
import { squadAlive, commandSquad } from '../systems/npc.js';

const $ = (id) => document.getElementById(id);
const openPanels = [];
let currentShop = null;
let currentLoot = null;
let currentDialogueNpc = null;
let mapCtx = null;
let mapPlacesHit = [];

export function anyPanelOpen() { return openPanels.length > 0; }

export function initPanels() {
  mapCtx = $('worldmap').getContext('2d');
  // закрытие по крестикам
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => closePanel(b.dataset.close)));
  $('inv-list').addEventListener('click', onInvClick);
  $('inv-list').addEventListener('contextmenu', onInvRight);
  $('inv-equipped').addEventListener('click', onInvClick);
  $('inv-quick').addEventListener('click', onInvClick);
  $('shop-stock').addEventListener('click', (e) => shopClick(e, true));
  $('shop-mine').addEventListener('click', (e) => shopClick(e, false));
  $('shop-haggle').addEventListener('click', () => { if (currentShop) { G.economy.haggle(currentShop); renderShop(); } });
  $('loot-list').addEventListener('click', onLootClick);
  $('loot-mine').addEventListener('click', onLootMineClick);
  $('loot-take-all').addEventListener('click', takeAll);
  $('worldmap').addEventListener('click', onMapClick);
  $('dlg-options').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const idx = Number(btn.dataset.idx);
    const d = currentDialogueNpc;
    if (!d || !d.options[idx]) return;
    const act = d.options[idx].action;
    closePanel('panel-dialogue');
    if (act) act();
  });
  $('squad-body').addEventListener('click', onSquadClick);
  // события
  on('ui:shop', (shop) => openShop(shop));
  on('ui:talk', (npc) => openDialogue(npc));
  on('ui:closeDialogue', () => closePanel('panel-dialogue'));
  on('ui:lootContainer', (c) => openLoot(c, 'container'));
  on('ui:lootCorpse', (c) => openLoot(c, 'corpse'));
  on('ui:bed', (bed) => openBed(bed));
  on('ui:squad', () => openPanel('panel-squad'));
  on('ui:throne', () => captureThrone());
  on('ui:fortthrone', () => sitFortThrone());
  on('ui:death', ({ cause }) => { showDeath(cause); });
  on('ui:show', ({ id }) => { if (id) showScreen(id); });
  on('victory', ({ title, text }) => showVictory(title, text));
  on('player:place', ({ place }) => {
    if (!place) return;
    if (!G.discovered.has(place.id)) {
      G.discovered.add(place.id);
      notify(`Открыто место: ${place.name} (доступно на карте [M])`, 'good');
    }
  });
  on('quest:new', () => { if (isOpen('panel-journal')) renderJournal(); });
  on('quest:progress', () => { if (isOpen('panel-journal')) renderJournal(); });
  on('quest:done', () => { if (isOpen('panel-journal')) renderJournal(); });
  // кнопки меню
  $('btn-resume').addEventListener('click', () => closePanel('screen-pause'));
  $('btn-save').addEventListener('click', () => showScreen('screen-saves', { mode: 'save' }));
  $('btn-load').addEventListener('click', () => showScreen('screen-saves', { mode: 'load' }));
  $('btn-settings').addEventListener('click', () => showScreen('screen-settings'));
  $('btn-help').addEventListener('click', () => showScreen('screen-controls'));
  $('btn-tomenu').addEventListener('click', () => { closePanel('screen-pause'); emit('game:tomenu'); });
  $('btn-settings-back').addEventListener('click', () => { closePanel('screen-settings'); applySettingsFromUI(); if (G.running) showScreen('screen-pause'); });
  $('btn-saves-back').addEventListener('click', () => { closePanel('screen-saves'); if (G.running) showScreen('screen-pause'); });
  $('btn-respawn').addEventListener('click', () => { closePanel('screen-death'); emit('game:respawn'); });
  $('btn-load-death').addEventListener('click', () => { closePanel('screen-death'); showScreen('screen-saves', { mode: 'load' }); });
  $('btn-menu-death').addEventListener('click', () => { closePanel('screen-death'); emit('game:tomenu'); });
  $('btn-victory-continue').addEventListener('click', () => closePanel('screen-victory'));
  $('btn-victory-menu').addEventListener('click', () => { closePanel('screen-victory'); emit('game:tomenu'); });
  // настройки
  bindSettingsUI();
  // горячие клавиши
  window.addEventListener('keydown', onHotkey);
}

function onHotkey(e) {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
  if (!G.running) return;
  const code = e.code;
  if (code === 'Escape') {
    e.preventDefault();
    if (openPanels.length) { closePanel(openPanels[openPanels.length - 1]); return; }
    togglePause();
    return;
  }
  if (openPanels.length && code !== 'KeyI' && code !== 'KeyC' && code !== 'KeyJ' && code !== 'KeyM') {
    // в панелях работают только переключатели панелей
    if (code === 'Digit1' && isOpen('panel-dialogue')) {
      const btns = $('dlg-options').querySelectorAll('button');
      if (btns[0]) btns[0].click();
    }
    return;
  }
  if (code === 'KeyI') togglePanel('panel-inventory', renderInventory);
  else if (code === 'KeyC') togglePanel('panel-character', renderCharacter);
  else if (code === 'KeyJ') togglePanel('panel-journal', renderJournal);
  else if (code === 'KeyM') togglePanel('panel-map', renderMap);
  else if (code === 'KeyT') togglePanel('panel-squad', renderSquadPanel);
  else if (code === 'F5') { emit('game:quicksave'); }
  else if (code === 'F9') { emit('game:quickload'); }
  else if (code === 'KeyP') { emit('game:photo'); }
}

export function openPanel(id, after) {
  const el = $(id);
  if (!el) return;
  if (!openPanels.includes(id)) openPanels.push(id);
  el.classList.remove('hidden');
  G.uiOpen = true;
  Input.releaseLock();
  if (after) after();
  G.audio.play('ui_open');
}
export function closePanel(id) {
  const el = $(id);
  if (el) el.classList.add('hidden');
  const i = openPanels.indexOf(id);
  if (i >= 0) openPanels.splice(i, 1);
  if (!openPanels.length) {
    G.uiOpen = false;
    if (G.running && !G.paused && !G.gameOver) Input.requestLock();
  }
}
export function closeAllPanels() {
  for (const id of openPanels.slice()) closePanel(id);
}
export function isOpen(id) { return openPanels.includes(id) || !$(id).classList.contains('hidden'); }
function togglePanel(id, after) {
  if (isOpen(id)) closePanel(id);
  else openPanel(id, after);
}
export function showScreen(id, opts = {}) {
  closeAllPanels();
  $(id).classList.remove('hidden');
  openPanels.push(id);
  G.uiOpen = true;
  Input.releaseLock();
  if (id === 'screen-saves') renderSaves(opts.mode || 'load');
  if (id === 'screen-settings') syncSettingsUI();
}
function togglePause() {
  if (isOpen('screen-pause')) closePanel('screen-pause');
  else { G.paused = true; showScreen('screen-pause'); renderPause(); }
}

// ------------------------- сумка -------------------------
function renderInventory() {
  const p = G.player;
  const list = $('inv-list');
  const eq = $('inv-equipped');
  const q = $('inv-quick');
  const inv = p.inventory;
  const group = (kind) => inv.filter((i) => G.economy.items[i.id] && G.economy.items[i.id].kind === kind);
  const order = ['weapon', 'armor', 'shield', 'potion', 'food', 'tool', 'prosthetic', 'ammo', 'misc'];
  const names = { weapon: 'Оружие', armor: 'Броня', shield: 'Щиты', potion: 'Зелья', food: 'Еда', tool: 'Инструменты', prosthetic: 'Протезы', ammo: 'Припасы', misc: 'Разное' };
  list.innerHTML = order.map((kind) => {
    const items = group(kind);
    if (!items.length) return '';
    return `<h3>${names[kind]}</h3>` + items.map((it) => {
      const def = G.economy.items[it.id];
      const isEq = p.equip.weapon === it.id || p.equip.armor === it.id || (it.id === 'shield' && p.equip.shield);
      return `<div class="item-row${isEq ? ' eq' : ''}${def.rare ? ' rare' : ''}" data-id="${it.id}">
        <span class="ic">${def.icon}</span><span class="nm">${def.name}</span>
        ${it.qty > 1 ? `<span class="q">×${it.qty}</span>` : ''}
        <span class="pr">${G.economy.sellValue(it.id)} 🪙</span>
        <span class="tag" data-quick="${it.id}">в пояс</span></div>`;
    }).join('');
  }).join('') || '<div class="note">Сумка пуста.</div>';
  // надето
  const eqRows = [];
  if (p.equip.weapon) eqRows.push(rowFor(p.equip.weapon, 'в руке'));
  if (p.equip.armor) eqRows.push(rowFor(p.equip.armor, 'надето'));
  if (p.equip.shield) eqRows.push(rowFor('shield', 'в левой руке'));
  eq.innerHTML = eqRows.join('') || '<div class="note">Ничего не надето.</div>';
  // пояс
  q.innerHTML = p.quick.map((id, i) => id
    ? `<div class="slot" data-quick-slot="${i}" title="Слот ${i + 1}: ${G.economy.items[id]?.name}">${G.economy.items[id]?.icon || '?'}<span class="lbl">${i + 1}</span></div>`
    : `<div class="slot empty" data-quick-slot="${i}"><span class="lbl">${i + 1}</span></div>`).join('');
  $('inv-gold').textContent = `Золото: ${p.gold}`;
  $('inv-sub').textContent = `${p.name} · уровень ${p.level}`;
  $('inv-stats').innerHTML = `
    <div><span class="k">Урон:</span> <span class="v">${Math.round(p.dmg * (1 + p.skills.blade * 0.012))}</span></div>
    <div><span class="k">Броня:</span> <span class="v">${Math.round(armorTotal(p) * 100)}%</span></div>
    <div><span class="k">Вес:</span> <span class="v">${inv.reduce((a, b) => a + b.qty, 0)}</span></div>
    <div><span class="k">Голод:</span> <span class="v">${Math.round(p.hunger)}%</span></div>`;
  const inj = $('inv-injuries');
  const rows = [];
  for (const k of ['armL', 'armR', 'legL', 'legR']) if (p.missing[k]) rows.push(`<div>${k.startsWith('arm') ? 'Рука' : 'Нога'} ${k.endsWith('L') ? 'левая' : 'правая'}: ${p.prosthetics[k] ? '<span class="ok">протез</span>' : '<span class="bad">отсутствует</span>'}</div>`);
  if (p.missing.eyeL || p.missing.eyeR) rows.push(`<div>Глаз: ${(p.prosthetics.eyeL || p.prosthetics.eyeR) ? '<span class="ok">стеклянный</span>' : '<span class="bad">выбит</span>'}</div>`);
  if (p.bleeding > 0.05) rows.push(`<div class="bad">Кровотечение: ${p.bleeding.toFixed(1)} — нужен бинт [F]</div>`);
  inj.innerHTML = rows.join('') || '<div class="note">Ты цел.</div>';
  // кнопки установки протезов, лежащих в сумке
  for (const it of inv) {
    const def = G.economy.items[it.id];
    if (def && def.prosthetic) {
      const inst = $('#inv-injuries');
      inst.innerHTML += `<div class="note">Протез «${def.name}» — нажми, чтобы поставить</div>`;
    }
  }
}
function armorTotal(p) {
  let a = 0.05;
  if (p.equip.armor && G.economy.items[p.equip.armor]) a += G.economy.items[p.equip.armor].armor || 0;
  if (p.equip.helmet && G.economy.items[p.equip.helmet]) a += G.economy.items[p.equip.helmet].armor || 0;
  return clamp(a, 0, 0.8);
}
function rowFor(id, tag) {
  const def = G.economy.items[id];
  if (!def) return '';
  return `<div class="item-row eq" data-id="${id}"><span class="ic">${def.icon}</span><span class="nm">${def.name}</span><span class="tag">${tag}</span></div>`;
}
function onInvClick(e) {
  const quickBtn = e.target.closest('[data-quick]');
  if (quickBtn) {
    e.stopPropagation();
    const id = quickBtn.dataset.quick;
    const p = G.player;
    const idx = p.quick.indexOf(id);
    if (idx >= 0) p.quick[idx] = null;
    else {
      const empty = p.quick.indexOf(null);
      p.quick[empty >= 0 ? empty : 0] = id;
    }
    renderInventory();
    emit('player:inventory', {});
    return;
  }
  const slot = e.target.closest('[data-quick-slot]');
  if (slot) {
    const i = Number(slot.dataset.quickSlot);
    const p = G.player;
    p.quick[i] = p.quick[i] ? null : (p.inventory[0] ? p.inventory[0].id : null);
    renderInventory();
    emit('player:inventory', {});
    return;
  }
  const row = e.target.closest('[data-id]');
  if (!row) return;
  useItem(row.dataset.id);
}
function onInvRight(e) {
  const row = e.target.closest('[data-id]');
  if (!row) return;
  e.preventDefault();
  const id = row.dataset.id;
  const p = G.player;
  if (p.equip.weapon === id) { p.equip.weapon = null; equipWeaponKind('fists'); }
  if (p.equip.armor === id) { p.equip.armor = null; }
  removeItem(id, 1);
  notify(`Выброшено: ${G.economy.items[id]?.name}`);
  renderInventory();
}
export function useItem(id) {
  const p = G.player;
  const def = G.economy.items[id];
  if (!def) return;
  if (def.kind === 'weapon') { p.equip.weapon = id; equipWeaponKind(weaponKind(id)); notify(`В руке: ${def.name}`); }
  else if (def.kind === 'armor') {
    if (def.slot === 'helmet') { p.equip.helmet = id; notify(`Надет: ${def.name}`); }
    else { p.equip.armor = id; notify(`Надет: ${def.name}`); }
    p.armor = armorTotal(p);
  } else if (def.kind === 'shield') { p.equip.shield = !p.equip.shield; p.shield = p.equip.shield; notify(p.equip.shield ? 'Щит в руке' : 'Щит убран'); }
  else if (def.kind === 'prosthetic') {
    if (def.wheelchair) { p.wheelchair = true; notify('Коляска готова. Клавиша G — сесть.'); }
    else installProsthetic(def.prosthetic);
  } else if (def.kind === 'potion' || def.kind === 'food' || def.id === 'bandage') playerUseItem(id);
  else if (def.id === 'torch') { p.torch = !p.torch; }
  else notify(`${def.name}: ${def.desc}`);
  renderInventory();
  emit('player:inventory', {});
}

// ------------------------- персонаж -------------------------
function renderCharacter() {
  const p = G.player;
  $('char-name').textContent = `${p.name} — ${p.heroFaction === 'elf' ? 'лесной эльф' : p.heroFaction === 'guard' ? 'страж дворца' : 'Владыка Дрегар'}`;
  $('char-sub').textContent = `уровень ${p.level} · опыт ${p.xp}/${p.xpNext}`;
  const skills = Object.entries(p.skills);
  $('char-skills').innerHTML = skills.map(([k, v]) => `
    <div class="skill-row"><span class="snm">${G.economy.skillLabel(k)}</span>
      <span class="skill-bar"><i style="width:${clamp(v, 0, 100)}%"></i></span>
      <span class="v">${Math.round(v)}</span></div>`).join('');
  $('char-level').innerHTML = `
    <div><span class="k">Здоровье:</span> <span class="v">${Math.round(p.hp)}/${p.hpMax}</span></div>
    <div><span class="k">Сила:</span> <span class="v">${Math.round(p.stamina)}/${p.staminaMax}</span></div>
    <div><span class="k">Кровь:</span> <span class="v">${Math.round(p.blood)}%</span></div>
    <div><span class="k">Броня:</span> <span class="v">${Math.round(armorTotal(p) * 100)}%</span></div>
    <div><span class="k">Убито:</span> <span class="v">${p.stats.kills}</span></div>
    <div><span class="k">Отрублено:</span> <span class="v">${G.stats.severed}</span></div>
    <div><span class="k">Ограблено корованов:</span> <span class="v">${p.stats.caravans}</span></div>
    <div><span class="k">Играешь:</span> <span class="v">${formatClock(G.stats.playtime)}</span></div>
    ${p.heroFaction === 'guard' ? `<div><span class="k">Звание:</span> <span class="v">${['Рядовой', 'Капрал', 'Сержант', 'Сотник', 'Тысячник'][G.playerRank] || 'Рядовой'}</span></div>` : ''}`;
  const parts = [];
  const partName = { head: 'голова', torso: 'корпус', armL: 'левая рука', armR: 'правая рука', legL: 'левая нога', legR: 'правая нога' };
  for (const k of Object.keys(partName)) {
    const hp = k === 'torso' ? p.hp : (p.limbHp[k] || 0);
    const max = k === 'torso' ? p.hpMax : p.hpMax * 0.42;
    const frac = clamp(hp / max, 0, 1);
    const state = p.missing[k] ? (p.prosthetics[k] ? '<span class="ok">протез</span>' : '<span class="bad">ОТРУБЛЕНО</span>')
      : frac < 0.3 ? '<span class="bad">тяжёлое ранение</span>' : frac < 0.7 ? 'ссадина' : '<span class="ok">цело</span>';
    parts.push(`<div>${partName[k]}: ${state}</div>`);
  }
  if (p.missing.eyeL) parts.push(`<div>левый глаз: ${p.prosthetics.eyeL ? '<span class="ok">стеклянный</span>' : '<span class="bad">выбит</span>'}</div>`);
  if (p.missing.eyeR) parts.push(`<div>правый глаз: ${p.prosthetics.eyeR ? '<span class="ok">стеклянный</span>' : '<span class="bad">выбит</span>'}</div>`);
  if (p.bleeding > 0.05) parts.push(`<div class="bad">Кровотечение ${p.bleeding.toFixed(1)} — умрёшь, если не перевязать</div>`);
  $('char-body').innerHTML = parts.join('');
  const repNames = { people: 'Люди Тихого Брода', empire: 'Империя', elves: 'Луннолесье', villain: 'Легион Дрегара', bandits: 'Разбойники' };
  $('char-rep').innerHTML = Object.entries(repNames).map(([k, name]) => {
    const v = p.rep[k] || 0;
    const w = clamp(Math.abs(v), 0, 100);
    return `<div class="rep-row"><span style="width:150px">${name}</span>
      <span class="rep-bar"><i class="${v < 0 ? 'neg' : ''}" style="width:${w}%;${v < 0 ? 'right:0;left:auto' : ''}"></i></span>
      <span class="v" style="width:44px;text-align:right">${v > 0 ? '+' : ''}${Math.round(v)}</span></div>`;
  }).join('');
}

// ------------------------- журнал -------------------------
function renderJournal() {
  const list = G.quests ? G.quests.list : [];
  const active = list.filter((q) => q.state === 'active');
  const done = list.filter((q) => q.state !== 'active');
  const line = (q) => `<div class="journal-entry">
    <div class="jt">${q.title} ${q.main ? '<span class="tag">сюжет</span>' : ''}</div>
    <div class="jd">${q.desc}</div>
    ${q.objectives.map((o) => `<div class="jo">${o.done ? '✔' : '•'} ${o.text}${o.count > 1 ? ` (${o.progress || 0}/${o.count})` : ''}</div>`).join('')}
    ${q.reward && q.reward.gold ? `<div class="jd">Награда: ${q.reward.gold} золота, ${q.reward.xp || 0} опыта</div>` : ''}
  </div>`;
  $('journal-active').innerHTML = active.map(line).join('') || '<div class="note">Приказов нет. Поговори с командиром или старейшиной.</div>';
  $('journal-done').innerHTML = done.map(line).join('') || '<div class="note">Пока ничего.</div>';
}

// ------------------------- карта -------------------------
function renderMap() {
  const ctx = mapCtx;
  const W = 900, H = 900;
  ctx.fillStyle = '#080b06';
  ctx.fillRect(0, 0, W, H);
  const toPx = (x, z) => [(x + 1024) / 2048 * W, (z + 1024) / 2048 * H];
  // зоны
  for (const z of ZONES) {
    let x0 = 0, x1 = 0, z0 = 0, z1 = 0;
    if (z.id === 1) { x0 = -1024; x1 = 0; z0 = 0; z1 = 1024; }
    if (z.id === 2) { x0 = 0; x1 = 1024; z0 = 0; z1 = 1024; }
    if (z.id === 3) { x0 = -1024; x1 = 0; z0 = -1024; z1 = 0; }
    if (z.id === 4) { x0 = 0; x1 = 1024; z0 = -1024; z1 = 0; }
    const [ax, az] = toPx(x0, z0);
    ctx.fillStyle = z.id === 3 ? '#14240f' : z.id === 4 ? '#221b26' : z.id === 2 ? '#26260f' : '#1c2412';
    ctx.fillRect(ax, az, W / 2, H / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = 'bold 20px Georgia, serif';
    ctx.fillText(z.name, ax + 16, az + 34);
  }
  // река
  ctx.strokeStyle = '#2d5f73';
  ctx.lineWidth = 12;
  ctx.beginPath();
  RIVER.pts.forEach(([x, z], i) => { const [px, pz] = toPx(x, z); i ? ctx.lineTo(px, pz) : ctx.moveTo(px, pz); });
  ctx.stroke();
  // дороги
  ctx.strokeStyle = '#7a6844';
  ctx.lineWidth = 5;
  for (const key of Object.keys(ROADS)) {
    ctx.beginPath();
    ROADS[key].forEach(([x, z], i) => { const [px, pz] = toPx(x, z); i ? ctx.lineTo(px, pz) : ctx.moveTo(px, pz); });
    ctx.stroke();
  }
  // места
  mapPlacesHit = [];
  for (const pl of PLACES) {
    const [px, pz] = toPx(pl.x, pl.z);
    const known = G.discovered.has(pl.id);
    const color = pl.kind === 'palace' ? '#d4af37' : pl.kind === 'elfvillage' ? '#79b465' : pl.kind === 'fort' ? '#c07ad0' : '#b8a878';
    ctx.fillStyle = known ? color : '#5a5540';
    ctx.beginPath();
    ctx.arc(px, pz, pl.kind === 'palace' || pl.kind === 'fort' || pl.kind === 'elfvillage' ? 11 : 7, 0, 7);
    ctx.fill();
    ctx.strokeStyle = '#000a'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = known ? '#f0e2b4' : '#7a7458';
    ctx.font = '15px Georgia, serif';
    ctx.fillText(known ? pl.name : '?', px + 15, pz + 5);
    mapPlacesHit.push({ pl, px, pz, known });
  }
  // корованы
  for (const c of G.caravans) {
    if (!c.pos) continue;
    const [px, pz] = toPx(c.pos.x, c.pos.z);
    ctx.fillStyle = '#ffd76a';
    ctx.fillRect(px - 5, pz - 5, 10, 10);
  }
  // игрок
  const p = G.player;
  const [ppx, ppz] = toPx(p.pos.x, p.pos.z);
  ctx.fillStyle = '#fff2c0';
  ctx.beginPath(); ctx.arc(ppx, ppz, 9, 0, 7); ctx.fill();
  ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 3; ctx.stroke();
  $('map-legend').textContent = 'Клик по метке — быстрый переход (нужно открыть место)';
  $('map-places').innerHTML = PLACES.map((pl) => {
    const known = G.discovered.has(pl.id);
    const d = Math.round(dist2D(p.pos.x, p.pos.z, pl.x, pl.z));
    const inCombat = G.entities.some((e) => !e.dead && dist2D(p.pos.x, p.pos.z, e.pos.x, e.pos.z) < 22 && e.ai && e.ai.target === p);
    return `<div class="place ${known ? '' : 'dim'}" data-travel="${pl.id}"><span>${pl.name}</span><span class="pd">${known ? d + ' м' : 'не открыто'}</span></div>`;
  }).join('');
  $('map-places').querySelectorAll('[data-travel]').forEach((el) => el.addEventListener('click', () => travelTo(el.dataset.travel)));
  const combat = G.entities.some((e) => !e.dead && dist2D(p.pos.x, p.pos.z, e.pos.x, e.pos.z) < 22 && e.ai && e.ai.target === p);
  $('map-info').innerHTML = `
    <div><span class="k">Позиция:</span> <span class="v">${Math.round(p.pos.x)}, ${Math.round(p.pos.z)}</span></div>
    <div><span class="k">Зона:</span> <span class="v">${placeNear(p.pos.x, p.pos.z)?.name || '—'}</span></div>
    <div><span class="k">Время:</span> <span class="v">${formatClock(G.time.seconds)}, день ${G.time.day}</span></div>
    <div><span class="k">Бой:</span> <span class="v">${combat ? 'да — переход возможен' : 'нет'}</span></div>`;
}
function onMapClick(e) {
  const r = $('worldmap').getBoundingClientRect();
  const mx = (e.clientX - r.left) / r.width * 900;
  const my = (e.clientY - r.top) / r.height * 900;
  for (const hp of mapPlacesHit) {
    if (Math.hypot(hp.px - mx, hp.pz - my) < 20 && hp.known) { travelTo(hp.pl.id); return; }
  }
}
export function travelTo(placeId) {
  const p = G.player;
  const pl = PLACES.find((x) => x.id === placeId);
  if (!pl) return;
  if (!G.discovered.has(placeId)) { notify('Место ещё не открыто.', 'bad'); return; }
  const d = dist2D(p.pos.x, p.pos.z, pl.x, pl.z);
  if (d < 25) { notify('Ты уже здесь.'); return; }
  const goingTo = { x: pl.x + 8, z: pl.z + 8 };
  p.pos.set(goingTo.x, 0, goingTo.z);
  p.pos.y = (G.surfaceHeight ? G.surfaceHeight(goingTo.x, goingTo.z, 100) : 0) || 0;
  G.time.seconds += d * 0.7;
  emit('player:teleport', { place: pl });
  notify(`Быстрый переход: ${pl.name} (${Math.round(d)} м, время в пути ${Math.round(d * 0.7 / 60)} мин)`, 'good');
  closeAllPanels();
}
void placeNear;

// ------------------------- лавка -------------------------
function openShop(shop) {
  currentShop = shop;
  openPanel('panel-shop', () => renderShop());
}
function renderShop() {
  const shop = currentShop;
  if (!shop) return;
  const st = G.economy.stockOf(shop);
  const p = G.player;
  const kind = G.economy.kinds[shop.kind] || G.economy.kinds.trader;
  $('shop-name').textContent = shop.name;
  $('shop-sub').textContent = `${kind.title} · ${placeNear(shop.x, shop.z)?.name || ''}`;
  $('shop-stock-title').textContent = `Товар (деньги лавки: ${Math.max(0, Math.round(st.gold))})`;
  $('shop-stock').innerHTML = st.stock.filter((s) => s.qty > 0).map((s) => {
    const def = G.economy.items[s.id];
    if (!def) return '';
    const price = G.economy.priceOf(shop, s.id);
    return `<div class="item-row${def.rare ? ' rare' : ''}" data-buy="${s.id}">
      <span class="ic">${def.icon}</span><span class="nm">${def.name}<br><span class="q">${def.desc || ''}</span></span>
      <span class="q">×${s.qty}</span><span class="pr">${price} 🪙</span></div>`;
  }).join('') || '<div class="note">Пусто.</div>';
  $('shop-mine').innerHTML = p.inventory.filter((i) => G.economy.items[i.id]).map((i) => {
    const def = G.economy.items[i.id];
    const price = Math.round(G.economy.sellValue(i.id) * (kind.buys && kind.buys.includes(def.kind) ? 1.15 : 0.8));
    return `<div class="item-row" data-sell="${i.id}">
      <span class="ic">${def.icon}</span><span class="nm">${def.name}</span>
      ${i.qty > 1 ? `<span class="q">×${i.qty}</span>` : ''}<span class="pr">${price} 🪙</span></div>`;
  }).join('') || '<div class="note">Нечего продать.</div>';
  const deal = [`<div><span class="k">Золото:</span> <span class="v">${p.gold}</span></div>`,
    `<div><span class="k">Торг:</span> <span class="v">${st.haggleUsed ? 'использован' : 'возможен'}</span></div>`,
    `<div><span class="k">Навык торговли:</span> <span class="v">${Math.round(p.skills.trade)}</span></div>`];
  if (kind.service === 'heal') deal.push(`<button data-service="heal">Лечить раны — ${G.economy.servicePrice(shop, 'heal')} 🪙</button>`);
  if (kind.service === 'prosthetic') deal.push(`<button data-service="prosthetic">Осмотр и установка протеза — ${G.economy.servicePrice(shop, 'prosthetic')} 🪙</button>`);
  if (kind.service === 'bank') {
    deal.push('<button data-service="dep">Внести 100 🪙</button><button data-service="wd">Снять 100 🪙</button>');
    deal.push('<button data-service="loan">Займ 200 🪙</button><button data-service="repay">Вернуть долг</button>');
    deal.push(`<div><span class="k">Вклад:</span> <span class="v">${G.bank.deposit}</span></div>`);
    deal.push(`<div><span class="k">Долг:</span> <span class="v">${G.bank.loan}</span></div>`);
  }
  if (kind.service === 'train') {
    for (const sk of ['blade', 'archery', 'block', 'speech', 'athletics', 'sneak']) {
      deal.push(`<button data-train="${sk}">${G.economy.skillLabel(sk)} +3 — ${G.economy.servicePrice(shop, 'train')} 🪙</button>`);
    }
  }
  if (kind.service === 'hire') {
    deal.push('<button data-hire="1">Нанять бойца (120 🪙)</button>');
  }
  $('shop-deal').innerHTML = deal.join('<div style="height:6px"></div>');
  $('shop-deal').querySelectorAll('[data-service]').forEach((b) => b.addEventListener('click', () => {
    const s = b.dataset.service;
    if (s === 'heal') G.economy.healService(shop);
    if (s === 'prosthetic') { notify('Выбери протез в сумке и нажми на него — он встанет на место.'); }
    if (s === 'dep') G.economy.bankDeposit(100);
    if (s === 'wd') G.economy.bankWithdraw(100);
    if (s === 'loan') G.economy.takeLoan(200);
    if (s === 'repay') G.economy.repayLoan();
    renderShop();
  }));
  $('shop-deal').querySelectorAll('[data-train]').forEach((b) => b.addEventListener('click', () => {
    G.economy.trainService(shop, b.dataset.train);
    renderShop();
  }));
  const hireBtn = $('shop-deal').querySelector('[data-hire]');
  if (hireBtn) hireBtn.addEventListener('click', () => emit('ui:squad', {}));
  $('shop-gold').textContent = `Золото: ${p.gold}`;
}
function shopClick(e, buying) {
  const row = e.target.closest(buying ? '[data-buy]' : '[data-sell]');
  if (!row) return;
  if (buying) {
    const id = row.dataset.buy;
    const qty = e.shiftKey ? 5 : 1;
    if (G.economy.buy(currentShop, id, qty)) notify(`Куплено: ${G.economy.items[id].name} ×${qty}`);
  } else {
    const id = row.dataset.sell;
    if (G.economy.sell(currentShop, id, 1)) notify(`Продано: ${G.economy.items[id].name}`);
  }
  renderShop();
  emit('player:inventory', {});
}

// ------------------------- диалоги -------------------------
function openDialogue(npc) {
  const d = G.quests.dialogueFor(npc);
  currentDialogueNpc = d;
  openPanel('panel-dialogue', () => {
    $('dlg-name').textContent = d.name;
    $('dlg-role').textContent = d.role;
    $('dlg-text').textContent = d.text;
    $('dlg-options').innerHTML = d.options.map((o, i) => `<button data-idx="${i}"><span class="num">${i + 1}.</span>${o.text}</button>`).join('');
  });
  G.audio.play('ui_open');
}

// ------------------------- обыск -------------------------
function openLoot(target, kind) {
  currentLoot = { target, kind };
  openPanel('panel-loot', () => renderLoot());
}
function renderLoot() {
  const { target, kind } = currentLoot;
  const p = G.player;
  const loot = kind === 'container' ? target.loot : target.entity.inventory;
  $('loot-title').textContent = kind === 'container' ? `Обыск: ${target.name}` : `Тело: ${target.entity.name}`;
  $('loot-sub').textContent = kind === 'corpse' ? `${target.entity.role} · ${target.entity.faction}` : '';
  $('loot-list').innerHTML = loot.filter((l) => l.qty > 0).map((l) => {
    const def = G.economy.items[l.id];
    if (!def) return '';
    return `<div class="item-row" data-take="${l.id}"><span class="ic">${def.icon}</span><span class="nm">${def.name}</span>${l.qty > 1 ? `<span class="q">×${l.qty}</span>` : ''}</div>`;
  }).join('') || '<div class="note">Пусто.</div>';
  $('loot-mine').innerHTML = p.inventory.map((i) => `<div class="item-row"><span class="ic">${G.economy.items[i.id]?.icon || '?'}</span><span class="nm">${G.economy.items[i.id]?.name || i.id}</span>${i.qty > 1 ? `<span class="q">×${i.qty}</span>` : ''}</div>`).join('');
  $('loot-hint').textContent = kind === 'container' && target.locked ? 'Заперто — нужна отмычка (клик откроет)' : 'Клик по предмету — взять';
}
function onLootClick(e) {
  const row = e.target.closest('[data-take]');
  const { target, kind } = currentLoot;
  if (kind === 'container' && target.locked) {
    if (!G.player.inventory.some((i) => i.id === 'lockpick')) { notify('Нужна отмычка.', 'bad'); return; }
    if (Math.random() < 0.75 + G.player.skills.sneak * 0.002) { target.locked = false; notify('Замок вскрыт.', 'good'); }
    else { notify('Отмычка хрустнула…', 'bad'); removeItem('lockpick', 1); }
    renderLoot();
    if (target.locked) return;
  }
  if (!row) return;
  const id = row.dataset.take;
  const loot = kind === 'container' ? target.loot : target.entity.inventory;
  const slot = loot.find((l) => l.id === id);
  if (!slot) return;
  addItem(id, slot.qty);
  if (id === 'gold') { gainGold(slot.qty); G.audio.play('coin'); notify(`Взято золота: ${slot.qty}`, 'good'); }
  else notify(`Взято: ${G.economy.items[id]?.name} ×${slot.qty}`);
  slot.qty = 0;
  if (kind === 'corpse') { target.looted = true; }
  else if (loot.length && loot.every((l) => l.qty <= 0)) target.opened = true;
  emit('player:inventory', {});
  renderLoot();
  if (kind === 'corpse' && G.gore) G.audio.play('ui');
}
function onLootMineClick() { /* подсказка */ }
function takeAll() {
  const { target, kind } = currentLoot;
  const loot = kind === 'container' ? target.loot : target.entity.inventory;
  for (const l of loot) {
    if (l.qty <= 0) continue;
    if (l.id === 'gold') { gainGold(l.qty); }
    else addItem(l.id, l.qty);
    l.qty = 0;
  }
  if (kind === 'corpse') target.looted = true;
  else target.opened = true;
  notify('Взято всё.', 'good');
  G.audio.play('coin');
  emit('player:inventory', {});
  renderLoot();
}
function openBed(bed) {
  if (G.player.gold < bed.price) { notify('Нет золота на ночлег.', 'bad'); return; }
  G.economy.restAtBed(bed);
  renderInventory();
}

// ------------------------- отряд -------------------------
function renderSquadPanel() {
  const p = G.player;
  const squad = p.squad || [];
  $('squad-sub').textContent = `бойцов: ${squadAlive(squad)} / 8`;
  $('squad-body').innerHTML = squad.length ? squad.map((e, i) => `
    <div class="squad-member">
      <span>${e.name}</span><span class="st">${e.role}${e.dead ? ' — убит' : ''}</span>
      <span class="hp-mini"><i style="width:${clamp(e.hp / e.hpMax, 0, 1) * 100}%"></i></span>
      <button data-dismiss="${i}">Отпустить</button>
    </div>`).join('') : '<div class="note">Отряда нет. Нанимай бойцов у легиона (Дрегар), у капитана (гвардия) или в кабаках.</div>';
  const hireCosts = { legion: 120, dark_archer: 150, brute: 220 };
  $('squad-body').innerHTML += `
    <h3>Наём (Дрегар)</h3>
    <div class="squad-member">Легионер — ${hireCosts.legion} 🪙 <button data-hire="legion">Нанять</button></div>
    <div class="squad-member">Тёмный лучник — ${hireCosts.dark_archer} 🪙 <button data-hire="dark_archer">Нанять</button></div>
    <div class="squad-member">Громила — ${hireCosts.brute} 🪙 <button data-hire="brute">Нанять</button></div>
    <h3>Приказы</h3>
    <div><button data-cmd="follow">За мной</button> <button data-cmd="hold">Держать позицию</button> <button data-cmd="attack">В атаку</button></div>`;
  $('squad-hint').textContent = 'Клавиши: T — этот экран, H — держать, Y — в атаку на ближайшего врага.';
}
function onSquadClick(e) {
  const p = G.player;
  const dis = e.target.closest('[data-dismiss]');
  if (dis) {
    const i = Number(dis.dataset.dismiss);
    const e2 = p.squad[i];
    if (e2) { e2.ai.squad = null; p.squad.splice(i, 1); emit('squad:changed', {}); renderSquadPanel(); }
    return;
  }
  const hire = e.target.closest('[data-hire]');
  if (hire) { hireTroop(hire.dataset.hire); renderSquadPanel(); return; }
  const cmd = e.target.closest('[data-cmd]');
  if (cmd) { issueOrder(cmd.dataset.cmd); }
}
export function hireTroop(role) {
  const p = G.player;
  const cost = { legion: 120, dark_archer: 150, brute: 220 }[role] || 120;
  if (p.gold < cost) { notify(`Нужно ${cost} золота.`, 'bad'); return; }
  if (!p.squad) p.squad = [];
  if (squadAlive(p.squad) >= 8) { notify('Отряд полон.', 'bad'); return; }
  gainGold(-cost);
  emit('squad:hireRequest', { role });
}
export function issueOrder(cmd) {
  const p = G.player;
  if (!p.squad || !p.squad.length) { notify('Отряда нет.', 'bad'); return; }
  if (cmd === 'attack') {
    let best = null, bd = 120;
    for (const e of G.entities) {
      if (e.dead) continue;
      const d = dist2D(p.pos.x, p.pos.z, e.pos.x, e.pos.z);
      if (d < bd && e.ai && (e.faction === 'empire' || e.faction === 'villain' || e.faction === 'elves' || e.faction === 'bandits')) {
        if (e.faction !== (p.heroFaction === 'elf' ? 'elves' : p.heroFaction === 'guard' ? 'empire' : 'villain')) { bd = d; best = e; }
      }
    }
    if (!best) { notify('Врагов рядом нет.', 'bad'); return; }
    for (const m of p.squad) { m.ai.target = best; m.ai.forcedTarget = best; m.ai.alert = 30; m.ai.command = 'attack'; }
    notify(`Отряд атакует: ${best.name}`, 'good');
    emit('squad:changed', {});
    return;
  }
  for (const m of p.squad) {
    m.ai.command = cmd;
    if (cmd === 'hold') { m.ai.holdPoint = { x: m.pos.x, z: m.pos.z }; m.ai.target = null; m.ai.forcedTarget = null; }
    if (cmd === 'follow') { m.ai.target = null; m.ai.forcedTarget = null; }
  }
  notify(cmd === 'hold' ? 'Отряд держит позицию.' : 'Отряд идёт за тобой.');
  emit('squad:changed', {});
}

// ------------------------- троны -------------------------
function captureThrone() {
  const p = G.player;
  if (p.heroFaction !== 'villain') { notify('Трон Императора занят кем-то другим.'); return; }
  if (G.throneCaptured) { notify('Знамя уже висит.'); return; }
  G.throneCaptured = true;
  G.audio.play('quest');
  notify('Знамя Дрегара водружено над Златоверхим дворцом!', 'good');
  emit('banner', { text: 'ДВОРЕЦ ВЗЯТ' });
  emit('ui:throne', {});
  // знамя над теремом
  const lm = G.landmarks && G.landmarks.palaceCenter;
  if (lm) {
    const flag = new G.THREE_Group();
    void flag;
  }
}
function sitFortThrone() {
  notify('Ты сел на трон Владыки. Теперь форт твой.', 'good');
  emit('ui:fortthrone', {});
}

// ------------------------- пауза, сохранения, настройки -------------------------
function renderPause() {
  const p = G.player;
  $('pause-summary').innerHTML = `
    <div><span class="k">Фракция:</span> <span class="v">${p.heroFaction === 'elf' ? 'лесные эльфы' : p.heroFaction === 'guard' ? 'охрана дворца' : 'Владыка Дрегар'}</span></div>
    <div><span class="k">Уровень:</span> <span class="v">${p.level}</span></div>
    <div><span class="k">Золото:</span> <span class="v">${p.gold}</span></div>
    <div><span class="k">Убито:</span> <span class="v">${p.stats.kills}</span></div>
    <div><span class="k">Заданий:</span> <span class="v">${G.stats.questsDone}</span></div>
    <div><span class="k">Время в мире:</span> <span class="v">день ${G.time.day}, ${formatClock(G.time.seconds)}</span></div>
    <div class="note">Подсказка: F5 — быстрое сохранение, F9 — быстрая загрузка.</div>`;
  $('pause-hint').textContent = `Сид мира: ${G.seedRaw || G.seed}`;
}
function renderSaves(mode) {
  const saves = G.save ? G.save.list() : [];
  $('saves-list').innerHTML = saves.length ? saves.map((s) => `
    <div class="save-row">
      <div class="grow"><b>${s.name}</b><div class="when">${s.when} · ${s.faction} · уровень ${s.level} · ${s.place}</div></div>
      <button data-save="${s.slot}">Записать</button>
      <button data-load="${s.slot}">Загрузить</button>
      <button data-del="${s.slot}">Удалить</button>
    </div>`).join('') : '<div class="note">Сохранений пока нет. Всего доступно 4 слота + автосейв.</div>';
  $('saves-list').innerHTML += `
    <div class="save-row"><div class="grow"><b>Новый слот</b><div class="when">записать текущую игру</div></div>
      <button data-save="new">Создать</button></div>`;
  $('saves-list').querySelectorAll('[data-save]').forEach((b) => b.addEventListener('click', () => {
    emit('game:save', { slot: b.dataset.save });
    setTimeout(() => renderSaves(mode), 60);
  }));
  $('saves-list').querySelectorAll('[data-load]').forEach((b) => b.addEventListener('click', () => emit('game:load', { slot: b.dataset.load })));
  $('saves-list').querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { if (G.save) G.save.remove(b.dataset.del); renderSaves(mode); }));
}
function bindSettingsUI() {
  const set = (id, key, fn = (v) => v) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('input', () => {
      if (el.type === 'checkbox') SETTINGS[key] = el.checked;
      else SETTINGS[key] = fn(parseFloat(el.value));
      updateSettingLabels();
      applySettingsFromUI();
    });
  };
  set('set-view', 'viewDist');
  set('set-fov', 'fov');
  set('set-sens', 'sens');
  set('set-vol', 'volume');
  set('set-shadows', 'shadows');
  set('set-grass', 'grass');
  set('set-invert', 'invertY');
  set('set-blood', 'blood');
  set('set-music', 'music');
  set('set-hints', 'hints');
}
function updateSettingLabels() {
  $('set-view-v').textContent = SETTINGS.viewDist;
  $('set-fov-v').textContent = SETTINGS.fov;
  $('set-sens-v').textContent = SETTINGS.sens.toFixed(1);
  $('set-vol-v').textContent = Math.round(SETTINGS.volume * 100) + '%';
}
export function syncSettingsUI() {
  $('set-view').value = SETTINGS.viewDist;
  $('set-fov').value = SETTINGS.fov;
  $('set-sens').value = SETTINGS.sens;
  $('set-vol').value = SETTINGS.volume;
  $('set-shadows').checked = SETTINGS.shadows;
  $('set-grass').checked = SETTINGS.grass;
  $('set-invert').checked = SETTINGS.invertY;
  $('set-blood').checked = SETTINGS.blood;
  $('set-music').checked = SETTINGS.music;
  $('set-hints').checked = SETTINGS.hints;
  updateSettingLabels();
}
function applySettingsFromUI() {
  saveSettings();
  if (G.audio) G.audio.setVolume(SETTINGS.volume);
  emit('settings:changed', {});
}

// ------------------------- смерть и победа -------------------------
function showDeath(cause) {
  G.paused = true;
  const p = G.player;
  const texts = {
    bleeding: 'Кровь ушла. Надо было перевязать рану (F) или дойти до лекаря.',
    'потеря крови': 'Ты потерял слишком много крови. Бинт и лекарь спасли бы.',
    default: 'Тебя достали. Мир не прощает беспечности.',
  };
  $('death-text').textContent = texts[cause] || texts.default;
  $('death-stats').innerHTML = `
    <div><span class="k">Убито:</span> <span class="v">${p.stats.kills}</span></div>
    <div><span class="k">Отрублено конечностей:</span> <span class="v">${G.stats.severed}</span></div>
    <div><span class="k">Заданий выполнено:</span> <span class="v">${G.stats.questsDone}</span></div>
    <div><span class="k">Золота добыто:</span> <span class="v">${G.stats.goldEarned}</span></div>
    <div><span class="k">Ночь/день:</span> <span class="v">день ${G.time.day}, ${formatClock(G.time.seconds)}</span></div>`;
  const iron = G.difficulty === 'ironman';
  $('btn-respawn').disabled = iron;
  $('death-hint').textContent = iron
    ? 'Железный режим: одна жизнь. Жми «Загрузить сохранение» или начни заново.'
    : 'Очнуться у лекаря — потеряешь часть золота, но раны залечат. Тяжёлые увечья останутся.';
  showScreen('screen-death');
}
function showVictory(title, text) {
  $('victory-title').textContent = title;
  $('victory-text').textContent = text;
  showScreen('screen-victory');
}

export { doInteract, playerBandage, ZONES };

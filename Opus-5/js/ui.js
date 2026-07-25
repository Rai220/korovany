// Весь интерфейс: HUD, лавки (покупать как в Daggerfall), рюкзак, диалоги, карта.
import { ITEMS, SHOPS, SERVICES, ZONE_LIST, BASES, FACTIONS, TRADE_ROAD } from './config.js';
import { LIMB_RU } from './actors.js';
import { rankName, questLine } from './quests.js';
import { sfx } from './audio.js';
import { saveInfo } from './save.js';

const $ = (id) => document.getElementById(id);

const PART_STATE_RU = {
  ok: 'цела', lost: 'ОТРУБЛЕНА', prosthetic: 'протез',
};
const PART_STATE_EYE = {
  ok: 'цел', lost: 'ВЫКОЛОТ', prosthetic: 'стеклянный',
};

export class UI {
  constructor(game) {
    this.game = game;
    this.logLines = [];
    this.el = {
      hud: $('hud'), log: $('log'), prompt: $('prompt'), squad: $('squadline'),
      hpfill: $('hpfill'), hptext: $('hptext'), stfill: $('stfill'),
      bleed: $('bleedwarn'), body: $('bodypanel'),
      faction: $('factionline'), zone: $('zoneline'), gold: $('goldline'),
      obj: $('objline'), caravan: $('caravanline'),
      weapon: $('weaponname'), ammo: $('ammoline'), mob: $('mobline'),
      eyeL: $('eyeL'), eyeR: $('eyeR'), blind: $('blindfold'),
      hurt: $('hurt'), crawlvig: $('crawlvig'),
    };
    this.screens = {
      loading: $('loading'), menu: $('menu'), pause: $('pause'), death: $('death'),
      shop: $('shop'), inv: $('inv'), dialog: $('dialog'), map: $('map'),
    };
    for (const btn of document.querySelectorAll('[data-close]')) {
      btn.addEventListener('click', () => { sfx('ui'); this.game.closeOverlay(); });
    }
  }

  // ---------- экраны ----------
  show(name) {
    for (const k in this.screens) this.screens[k].classList.add('hidden');
    if (name && this.screens[name]) this.screens[name].classList.remove('hidden');
    this.el.hud.classList.toggle('hidden', name === 'menu' || name === 'loading');
  }

  setLoading(pct, text) {
    $('loadfill').style.width = `${Math.round(pct * 100)}%`;
    if (text) $('loadtext').textContent = text;
  }

  // ---------- журнал ----------
  log(msg, cls = '') {
    this.logLines.push({ msg, cls, t: performance.now() });
    if (this.logLines.length > 7) this.logLines.shift();
    this._renderLog();
  }

  _renderLog() {
    const now = performance.now();
    this.logLines = this.logLines.filter((l) => now - l.t < 9000);
    this.el.log.innerHTML = this.logLines
      .map((l) => `<div class="${l.cls}">${l.msg}</div>`).join('');
  }

  // ---------- HUD ----------
  updateHud() {
    const g = this.game, p = g.player;
    if (!p) return;
    const hp = Math.max(0, p.hp);
    this.el.hpfill.style.transform = `scaleX(${hp / p.maxHp})`;
    this.el.hptext.textContent = `${Math.ceil(hp)} / ${p.maxHp}`;
    this.el.stfill.style.transform = `scaleX(${p.stamina / 100})`;
    this.el.bleed.classList.toggle('hidden', p.bleed <= 0);

    for (const el of this.el.body.children) {
      const st = p.parts[el.dataset.part];
      el.classList.toggle('lost', st === 'lost');
      el.classList.toggle('prosthetic', st === 'prosthetic');
    }

    this.el.faction.textContent = `${FACTIONS[p.faction].name} · ${rankName(p.faction, p.rank)}`;
    this.el.zone.textContent = `${g.zone.name} · ${Math.round(p.pos.x)}, ${Math.round(p.pos.z)}`;
    this.el.gold.textContent = `💰 ${Math.floor(p.gold)}`;
    this.el.obj.textContent = g.quest ? questLine(g.quest) : g.objective;

    const car = g.nearestCaravan();
    if (car) {
      const dx = car.pos.x - p.pos.x, dz = car.pos.z - p.pos.z;
      const d = Math.round(Math.hypot(dx, dz));
      this.el.caravan.textContent = `🐫 КОРОВАН — ${d} м на ${compass(Math.atan2(dx, -dz))}`;
      this.el.caravan.classList.remove('hidden');
    } else {
      this.el.caravan.classList.add('hidden');
    }

    const w = p.weaponData;
    this.el.weapon.textContent = w.name;
    if (w.ammo) {
      const n = p.count(w.ammo);
      this.el.ammo.textContent = `${ITEMS[w.ammo].name.split(' ')[0]}: ${n}`;
    } else this.el.ammo.textContent = w.kind === 'ranged' ? 'боеприпасы не нужны' : '';
    this.el.mob.textContent = p.mobilityText;

    // Увечья глаз: пол-экрана не видно.
    this.el.eyeL.classList.toggle('hidden', p.parts.eyeL !== 'lost' || p.parts.eyeR === 'lost');
    this.el.eyeR.classList.toggle('hidden', p.parts.eyeR !== 'lost' || p.parts.eyeL === 'lost');
    this.el.blind.classList.toggle('hidden', !(p.parts.eyeL === 'lost' && p.parts.eyeR === 'lost'));
    this.el.crawlvig.classList.toggle('hidden', p.mobility !== 'crawl');
    this.el.hurt.style.opacity = Math.min(0.9, Math.max(p.hurtFlash * 1.6, (1 - hp / p.maxHp) * 0.42));

    const sq = g.squad.filter((a) => !a.dead).length;
    this.el.squad.classList.toggle('hidden', sq === 0);
    if (sq) {
      this.el.squad.textContent = `Отряд: ${sq} · F — приказ «за мной», T — «в атаку на дворец»`;
    }
    this._renderLog();
  }

  setPrompt(text) {
    if (text) {
      this.el.prompt.innerHTML = text;
      this.el.prompt.classList.remove('hidden');
    } else this.el.prompt.classList.add('hidden');
  }

  // ---------- лавка ----------
  openShop(shopId, name) {
    const shop = SHOPS[shopId];
    if (!shop) return;
    this.currentShop = shopId;
    $('shopname').textContent = name || shop.name;
    $('shopmsg').textContent = '';
    this.renderShop();
    this.show('shop');
  }

  renderShop() {
    const shop = SHOPS[this.currentShop];
    const p = this.game.player;
    $('shopgold').textContent = `💰 ${Math.floor(p.gold)}`;

    let html = '';
    for (const id of shop.stock) {
      const it = ITEMS[id];
      const can = p.gold >= it.price;
      html += `<div class="row"><div class="nm">${it.name}<i>${it.desc || ''}</i></div>
        <span class="pr">${it.price}</span>
        <button data-buy="${id}" ${can ? '' : 'disabled'}>Купить</button></div>`;
    }
    if (shop.services) {
      html += '<div class="row head">Услуги</div>';
      for (const sid of shop.services) {
        const s = SERVICES[sid];
        html += `<div class="row"><div class="nm">${s.name}<i>${s.desc}</i></div>
          <span class="pr">${s.price}</span>
          <button data-serv="${sid}" ${p.gold >= s.price ? '' : 'disabled'}>Взять</button></div>`;
      }
    }
    $('shopbuy').innerHTML = html;

    let sell = '';
    for (const id in p.inv) {
      const it = ITEMS[id];
      if (!it || it.noSell || !p.inv[id]) continue;
      const price = Math.max(1, Math.floor(it.price / 2));
      sell += `<div class="row"><div class="nm">${it.name} ×${p.inv[id]}<i>${it.desc || ''}</i></div>
        <span class="pr">${price}</span>
        <button data-sell="${id}">Продать</button></div>`;
    }
    $('shopsell').innerHTML = sell || '<div class="row">Продавать нечего.</div>';

    $('shopbuy').querySelectorAll('[data-buy]').forEach((b) =>
      b.addEventListener('click', () => this.game.buy(b.dataset.buy)));
    $('shopbuy').querySelectorAll('[data-serv]').forEach((b) =>
      b.addEventListener('click', () => this.game.service(b.dataset.serv)));
    $('shopsell').querySelectorAll('[data-sell]').forEach((b) =>
      b.addEventListener('click', () => this.game.sell(b.dataset.sell)));
  }

  shopMsg(text) { $('shopmsg').textContent = text; }

  // ---------- рюкзак ----------
  openInventory() {
    this.renderInventory();
    this.show('inv');
  }

  renderInventory() {
    const p = this.game.player;
    $('invgold').textContent = `💰 ${Math.floor(p.gold)}`;
    let html = '';
    const ids = Object.keys(p.inv).filter((id) => ITEMS[id] && p.inv[id] > 0);
    if (!ids.length) html = '<div class="row">Пусто.</div>';
    for (const id of ids) {
      const it = ITEMS[id];
      let act = '';
      if (it.cat === 'weapon') {
        act = p.weapon === id
          ? '<button disabled>В руках</button>'
          : `<button data-eq="${id}">Взять в руки</button>`;
      } else if (it.cat === 'armor') {
        act = p.armor === id
          ? '<button disabled>Надето</button>'
          : `<button data-eq="${id}">Надеть</button>`;
      } else if (it.cat === 'med') {
        act = `<button data-use="${id}">Применить</button>`;
      }
      html += `<div class="row"><div class="nm">${it.name} ×${p.inv[id]}<i>${it.desc || ''}</i></div>${act}</div>`;
    }
    $('invlist').innerHTML = html;

    let body = '';
    for (const part of ['armL', 'armR', 'legL', 'legR', 'eyeL', 'eyeR']) {
      const st = p.parts[part];
      const isEye = part.startsWith('eye');
      const label = (isEye ? PART_STATE_EYE : PART_STATE_RU)[st];
      let act = '';
      if (st === 'lost') {
        const need = part.startsWith('arm') ? 'prosth_arm' : part.startsWith('leg') ? 'prosth_leg' : 'glass_eye';
        act = p.count(need)
          ? `<button data-prosth="${part}">Поставить ${ITEMS[need].name.toLowerCase()}</button>`
          : `<button disabled>Нужен: ${ITEMS[need].name}</button>`;
      }
      const cap = LIMB_RU[part][0].toUpperCase() + LIMB_RU[part].slice(1);
      body += `<div class="row"><div class="nm">${cap}<i>${label}</i></div>${act}</div>`;
    }
    if (p.bleed > 0) {
      body += `<div class="row"><div class="nm" style="color:#ff7d72">Кровотечение: −${p.bleed.toFixed(2)} здоровья в секунду
        <i>Перевязать (R) или к лекарю, иначе умрёте.</i></div></div>`;
    }
    body += `<div class="row"><div class="nm">Передвижение<i>${p.mobilityText || 'обычный шаг, можно прыгать'}</i></div></div>`;
    $('invbody').innerHTML = body;

    const g = this.game;
    $('invstats').innerHTML = `
      <div class="row"><div class="nm">Звание<i>${rankName(p.faction, p.rank)}</i></div></div>
      <div class="row"><div class="nm">Убито врагов<i>${p.kills}</i></div></div>
      <div class="row"><div class="nm">Ограблено корованов<i>${p.caravansRobbed}</i></div></div>
      <div class="row"><div class="nm">Выполнено заданий<i>${p.questsDone}</i></div></div>
      <div class="row"><div class="nm">Задание<i>${questLine(g.quest)}</i></div></div>`;

    $('invlist').querySelectorAll('[data-eq]').forEach((b) =>
      b.addEventListener('click', () => this.game.equip(b.dataset.eq)));
    $('invlist').querySelectorAll('[data-use]').forEach((b) =>
      b.addEventListener('click', () => this.game.useItem(b.dataset.use)));
    $('invbody').querySelectorAll('[data-prosth]').forEach((b) =>
      b.addEventListener('click', () => this.game.putProsthetic(b.dataset.prosth)));
  }

  invMsg(t) { $('invmsg').textContent = t; }

  // ---------- диалог ----------
  openDialog({ name, text, options }) {
    $('dlgname').textContent = name;
    $('dlgtext').textContent = text;
    const box = $('dlgopts');
    box.innerHTML = options.map((o, i) =>
      `<div class="row opt" data-i="${i}"><div class="nm">${o.label}${o.desc ? `<i>${o.desc}</i>` : ''}</div></div>`).join('');
    box.querySelectorAll('.opt').forEach((el) => {
      el.addEventListener('click', () => {
        sfx('ui');
        options[+el.dataset.i].fn();
      });
    });
    this.show('dialog');
  }

  // ---------- карта ----------
  openMap() {
    this.renderMap();
    this.show('map');
  }

  renderMap() {
    const g = this.game, p = g.player;
    const cv = $('mapcanvas');
    const ctx = cv.getContext('2d');
    const S = cv.width;
    const toX = (x) => ((x + 1000) / 2000) * S;
    const toY = (z) => ((z + 1000) / 2000) * S;

    ctx.fillStyle = '#0d1108';
    ctx.fillRect(0, 0, S, S);

    const tints = { human: '#5d7a35', elf: '#22401d', palace: '#3a4a6a', villain: '#4a3a3a' };
    for (const z of ZONE_LIST) {
      const r = (z.r / 2000) * S;
      ctx.fillStyle = tints[z.id];
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.arc(toX(z.x), toY(z.z), r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(224,180,74,.4)';
      ctx.stroke();
      // Подписи держим внутри круга, чтобы не уезжали за край карты.
      ctx.fillStyle = '#e8dcc0';
      ctx.font = 'bold 15px Verdana';
      ctx.textAlign = 'center';
      ctx.fillText(z.name, toX(z.x), toY(z.z) - r * 0.55);
      ctx.fillStyle = 'rgba(232,220,192,.6)';
      ctx.font = '11px Verdana';
      ctx.fillText(z.sub, toX(z.x), toY(z.z) - r * 0.55 + 16);
    }

    // Тракт, по которому ходят корованы.
    ctx.strokeStyle = '#8a7048';
    ctx.lineWidth = 3;
    ctx.beginPath();
    TRADE_ROAD.path.forEach(([x, z], i) =>
      (i ? ctx.lineTo(toX(x), toY(z)) : ctx.moveTo(toX(x), toY(z))));
    ctx.stroke();
    ctx.lineWidth = 1;

    for (const c of g.caravans) {
      if (c.dead) continue;
      ctx.fillStyle = '#ffd479';
      ctx.beginPath();
      ctx.arc(toX(c.pos.x), toY(c.pos.z), 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.font = '9px Verdana';
      ctx.fillText('К', toX(c.pos.x), toY(c.pos.z) + 3);
    }

    // Игрок — треугольник по направлению взгляда.
    const px = toX(p.pos.x), py = toY(p.pos.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-p.yaw);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Быстрое перемещение как в Daggerfall.
    let html = '<div class="row head">Быстрое перемещение (25 золотых, займёт время)</div>';
    for (const key of ['elf', 'guard', 'villain', 'human']) {
      const b = BASES[key];
      const zoneId = key === 'guard' ? 'palace' : key;
      const known = p.discovered[zoneId];
      const here = Math.hypot(p.pos.x - b.x, p.pos.z - b.z) < 120;
      html += `<div class="row"><div class="nm">${b.name}<i>${known ? 'разведано' : 'вы там ещё не были — дойдите ногами'}</i></div>
        <button data-travel="${key}" ${known && !here && p.gold >= 25 ? '' : 'disabled'}>${here ? 'Вы здесь' : 'Ехать'}</button></div>`;
    }
    $('travel').innerHTML = html;
    $('travel').querySelectorAll('[data-travel]').forEach((b) =>
      b.addEventListener('click', () => this.game.fastTravel(b.dataset.travel)));
    $('mapgold').textContent = `💰 ${Math.floor(p.gold)}`;
  }

  mapMsg(t) { $('mapmsg').textContent = t; }

  // ---------- смерть ----------
  showDeath(title, text) {
    $('deathtitle').textContent = title;
    $('deathtext').textContent = text;
    this.show('death');
  }

  refreshSaveInfo() {
    const s = saveInfo();
    $('savehint').textContent = s ? `Сохранение: ${s}` : 'Сохранения нет.';
  }
}

function compass(a) {
  const dirs = ['север', 'северо-восток', 'восток', 'юго-восток', 'юг', 'юго-запад', 'запад', 'северо-запад'];
  let d = a;
  while (d < 0) d += Math.PI * 2;
  return dirs[Math.round(d / (Math.PI / 4)) % 8];
}

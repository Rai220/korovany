// ДЖВА ГОДА — интерфейс: HUD, лавки, карта, инвентарь, экраны.
import { ZONES, POI, landmarks, ROADS } from './world.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor(game) {
    this.game = game;
    this.logLines = [];
    this.mapDrag = null;
    this.bindButtons();
  }

  show(id, on = true) { $(id).classList.toggle('hidden', !on); }

  bindButtons() {
    document.querySelectorAll('[data-close]').forEach(b =>
      b.addEventListener('click', () => this.show(b.dataset.close, false)));
    $('btnResume').onclick = () => this.game.togglePause(false);
    $('btnSaveGame').onclick = () => { this.game.saveGame(); };
    $('btnLoadGame').onclick = () => this.game.loadGame();
    $('btnPauseMenu').onclick = () => this.game.toMenu();
    $('btnLoadLast').onclick = () => this.game.loadGame();
    $('btnDeathMenu').onclick = () => this.game.toMenu();

    // карта: клик — быстрое перемещение
    const mc = $('mapCanvas');
    mc.addEventListener('click', (e) => {
      if (!this.mapFastTravel) return;
      const r = mc.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width;
      const nz = (e.clientY - r.top) / r.height;
      this.game.fastTravel(nx, nz);
    });
  }

  // ---------- HUD ----------
  updateHUD() {
    const p = this.game.player;
    $('hpFill').style.width = Math.max(0, p.hp / p.hpMax * 100) + '%';
    $('hpText').textContent = Math.max(0, Math.round(p.hp));
    $('stamFill').style.width = Math.max(0, p.stam / p.stamMax * 100) + '%';
    $('goldVal').textContent = Math.round(p.gold);
    const zid = this.game.zoneAtPlayer();
    $('zoneLabel').textContent = ZONES[zid] ? ZONES[zid].name : '';
    $('questLabel').textContent = this.game.questText || '';
    $('clock').textContent = this.game.timeString();
    $('blindfold').style.width = p.limbs.eye === 'lost' ? '50%' : '0%';
    // тело
    const map = { armL: 'bodyLArm', armR: 'bodyRArm', legL: 'bodyLLeg', legR: 'bodyRLeg', eye: 'bodyEye' };
    for (const [limb, el] of Object.entries(map)) {
      const st = p.limbs[limb];
      const e = $(el);
      e.classList.toggle('lost', st === 'lost' || st === 'bleeding');
      e.classList.toggle('prosthesis', st === 'prosthesis');
    }
    // отряд
    const sb = $('squadBox');
    if (this.game.squad.length) {
      sb.innerHTML = this.game.squad.map(s =>
        `<div class="squadMember ${s.dead ? 'down' : ''}">⚔ ${s.name || 'бойник'} — ${s.dead ? 'пал' : Math.round(s.hp) + ' hp'}</div>`
      ).join('') + `<div style="color:#8a8060">приказ: [C] ${this.game.squadOrder === 'attack' ? 'В АТАКУ' : 'за мной'}</div>`;
    } else if (this.game.canRecruit) {
      sb.innerHTML = `<div style="color:#ffd76a">E у командира — нанять отряд</div>`;
    } else sb.innerHTML = '';
  }

  log(text, cls = '') {
    const box = $('logbox');
    const div = document.createElement('div');
    div.className = 'logline ' + cls;
    div.textContent = text;
    box.appendChild(div);
    setTimeout(() => div.remove(), 5000);
    while (box.children.length > 6) box.firstChild.remove();
  }

  loot(text) {
    const box = $('lootbox');
    const div = document.createElement('div');
    div.className = 'lootline';
    div.textContent = '💰 ' + text;
    box.appendChild(div);
    setTimeout(() => div.remove(), 4000);
  }

  bloodFlash() {
    const el = $('bloodflash');
    el.style.opacity = '0.9';
    setTimeout(() => { el.style.opacity = '0'; }, 180);
  }
  hitMark() {
    const el = $('hitmark');
    el.style.opacity = '1';
    setTimeout(() => { el.style.opacity = '0'; }, 120);
  }
  showBleed(on) { $('bleedWarn').classList.toggle('hidden', !on); }

  banner(text, ms = 3500) {
    const el = $('waveBanner');
    el.textContent = text;
    el.classList.remove('hidden');
    clearTimeout(this._bt);
    this._bt = setTimeout(() => el.classList.add('hidden'), ms);
  }

  setHint(t) { $('usehint').textContent = t || ''; }

  // ---------- карта ----------
  drawMap() {
    const cv = $('mapCanvas'), ctx = cv.getContext('2d');
    const S = cv.width, W = this.game.worldHalf;
    ctx.clearRect(0, 0, S, S);
    // зоны
    for (const z of ZONES) {
      ctx.fillStyle = z.color + '55';
      ctx.fillRect(z.rect.x0 * S, z.rect.z0 * S, (z.rect.x1 - z.rect.x0) * S, (z.rect.z1 - z.rect.z0) * S);
      ctx.strokeStyle = z.color;
      ctx.strokeRect(z.rect.x0 * S, z.rect.z0 * S, (z.rect.x1 - z.rect.x0) * S, (z.rect.z1 - z.rect.z0) * S);
      ctx.fillStyle = z.color;
      ctx.font = 'bold 13px monospace';
      ctx.fillText(z.short, z.rect.x0 * S + 8, z.rect.z0 * S + 18);
    }
    // река
    ctx.strokeStyle = '#3a6a9a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= 32; i++) {
      const z = -W + (i / 32) * 2 * W;
      const x = -60 + 30 * Math.sin(z * 0.005);
      const px = (x + W) / (2 * W) * S, pz = (z + W) / (2 * W) * S;
      i ? ctx.lineTo(px, pz) : ctx.moveTo(px, pz);
    }
    ctx.stroke();
    // дороги
    ctx.strokeStyle = '#8a7a5a55';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    for (const r of ROADS) {
      ctx.moveTo((r.ax + W) / (2 * W) * S, (r.az + W) / (2 * W) * S);
      ctx.lineTo((r.bx + W) / (2 * W) * S, (r.bz + W) / (2 * W) * S);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // достопримечательности
    ctx.font = '12px monospace';
    for (const lm of landmarks) {
      const px = (lm.x + W) / (2 * W) * S, pz = (lm.z + W) / (2 * W) * S;
      ctx.fillStyle = lm.color;
      ctx.fillText(lm.icon + ' ' + lm.label, px + 5, pz + 4);
    }
    // корованы
    for (const c of this.game.caravans) {
      if (c.looted) continue;
      const px = (c.pos.x + W) / (2 * W) * S, pz = (c.pos.z + W) / (2 * W) * S;
      ctx.fillStyle = '#ffd76a';
      ctx.fillText('💰', px - 6, pz + 5);
    }
    // игрок
    const p = this.game.player;
    const px = (p.pos.x + W) / (2 * W) * S, pz = (p.pos.z + W) / (2 * W) * S;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(px, pz, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(px, pz);
    ctx.lineTo(px - Math.sin(p.yaw) * 12, pz - Math.cos(p.yaw) * 12);
    ctx.stroke();
    $('mapInfo').textContent = this.mapFastTravel
      ? 'Кликните по карте — быстрое перемещение по разведанным землям.'
      : 'Карта мира. Четыре зоны: люди, император, эльфы, злой.';
  }

  // ---------- лавка ----------
  openShop(shop) {
    this.shop = shop;
    this.show('shopScreen', true);
    $('shopTitle').textContent = shop.name.toUpperCase();
    this.renderShop();
  }
  renderShop() {
    const p = this.game.player;
    $('shopGold').textContent = Math.round(p.gold);
    const goods = this.game.shopGoods(shopKindToGoods(this.shop.kind));
    const box = $('shopGoods');
    box.innerHTML = '';
    for (const g of goods) {
      const div = document.createElement('div');
      div.className = 'goodsItem' + (g.owned ? ' owned' : '');
      const info = document.createElement('div');
      info.innerHTML = `<b>${g.name}</b> — ${g.price} з.<div class="desc">${g.desc}</div>`;
      const btn = document.createElement('button');
      btn.textContent = g.owned ? 'куплено' : 'купить';
      btn.disabled = g.owned || p.gold < g.price;
      btn.onclick = () => { if (this.game.buy(g.id)) this.renderShop(); };
      div.appendChild(info);
      div.appendChild(btn);
      box.appendChild(div);
    }
  }

  // ---------- инвентарь ----------
  openInventory() {
    this.show('invScreen', true);
    const p = this.game.player;
    const box = $('invBody');
    const lines = [];
    lines.push(`<div class="invLine"><span>Оружие: <b>${p.weapon === 'sword' ? 'меч' : 'лук'}</b> [R — сменить]</span><span class="sub">${p.weapon === 'bow' ? 'стрел: ' + p.arrows : 'обычный меч'}</span></div>`);
    lines.push(`<div class="invLine"><span>Бинты: <b>${p.bandages}</b></span><span class="sub">[кнопка справа — остановить кровотечение]</span><button id="btnBandage">перевязать</button></div>`);
    const limbNames = { armL: 'левая рука', armR: 'правая рука', legL: 'левая нога', legR: 'правая нога', eye: 'глаз' };
    for (const [limb, label] of Object.entries(limbNames)) {
      const st = p.limbs[limb];
      const stText = st === false ? 'цела' : st === 'bleeding' ? '⚠ КРОВОТОЧИТ' :
        st === 'lost' ? 'потеряна' : 'протез';
      lines.push(`<div class="invLine"><span>${label}: <b>${stText}</b></span><span class="sub">протезы продаёт лекарь</span></div>`);
    }
    lines.push(`<div class="invLine"><span>Коляска: <b>${p.hasWheelchair ? 'есть' : 'нет'}</b></span><span class="sub">нужна, если обе ноги потеряны (лекарь)</span></div>`);
    box.innerHTML = lines.join('');
    const bb = document.getElementById('btnBandage');
    if (bb) bb.onclick = () => {
      if (this.game.player.bandages > 0 && this.game.player.bandage()) { this.openInventory(); }
      else this.game.log('Нечего перевязывать или нет бинтов.', 'bad');
    };
  }

  showDeath(cause) {
    $('deathCause').textContent = cause;
    this.show('deathScreen', true);
  }
  showMenu(factions) {
    const box = $('menuButtons');
    box.innerHTML = '';
    for (const f of factions) {
      const b = document.createElement('button');
      b.className = 'factionBtn ' + f.id;
      b.innerHTML = `<b>${f.title}</b><small>${f.desc}</small>`;
      b.onclick = f.onClick;
      box.appendChild(b);
    }
    const hasSave = !!localStorage.getItem(this.game.saveKey());
    const cont = document.createElement('button');
    cont.className = 'factionBtn';
    cont.innerHTML = `<b>${hasSave ? 'Загрузить сохранение' : 'Загрузить сохранение (нет файла)'}</b><small>${hasSave ? 'продолжить последнюю игру' : 'сохранений пока нет'}</small>`;
    cont.onclick = () => { if (hasSave) this.game.loadGame(); else this.game.ui.log('Сохранений нет.', 'bad'); };
    box.appendChild(cont);
  }
}

function shopKindToGoods(kind) {
  if (kind === 'weapon') return 'weapons';
  if (kind === 'healer') return 'healer';
  return 'general';
}

// HUD, миникарта, лавка, диалоги, экраны и синтезированные звуки.
import { zoneAt } from './world.js';
import { isHostile } from './npc.js';

const $ = id => document.getElementById(id);

// ---------- ЗВУК (WebAudio-синтез, без файлов) ----------
export class SFX {
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }
  tone(f1, f2, dur, type = 'square', vol = 0.12, delay = 0) {
    try {
      if (!this.ensure()) return;
      const t0 = this.ctx.currentTime + delay;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f1, t0);
      o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t0 + dur);
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) { /* звук не критичен */ }
  }
  hit() { this.tone(180, 90, 0.09, 'square', 0.14); }
  swing() { this.tone(300, 140, 0.06, 'sawtooth', 0.05); }
  hurt() { this.tone(110, 60, 0.18, 'sawtooth', 0.16); }
  sever() { this.tone(90, 30, 0.3, 'sawtooth', 0.2); this.tone(700, 200, 0.1, 'square', 0.08, 0.02); }
  coin() { this.tone(880, 880, 0.06, 'square', 0.08); this.tone(1320, 1320, 0.08, 'square', 0.08, 0.07); }
  shoot() { this.tone(500, 1200, 0.08, 'sine', 0.07); }
  click() { this.tone(600, 500, 0.04, 'square', 0.06); }
  potion() { this.tone(400, 900, 0.2, 'sine', 0.1); }
  death() { this.tone(220, 40, 0.9, 'sawtooth', 0.2); }
  raid() { this.tone(150, 150, 0.3, 'sawtooth', 0.15); this.tone(120, 120, 0.35, 'sawtooth', 0.15, 0.35); }
  fanfare() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.18, 'square', 0.1, i * 0.12)); }
}

// ---------- ЛАВКА ----------
const SHOP = [
  { id: 'potion', name: 'Зелье лечения', desc: '+50 ХП. Пить на [Q]', price: 40, can: () => true, buy: p => p.inv.potion++ },
  { id: 'bandage', name: 'Бинт', desc: 'Останавливает кровотечение [B]', price: 20, can: () => true, buy: p => p.inv.bandage++ },
  { id: 'arrows', name: 'Стрелы x10', desc: 'Боеприпас для лука', price: 15, can: () => true, buy: p => p.inv.arrows += 10 },
  { id: 'bow', name: 'Лук', desc: 'Дальний бой [2]. Нужны обе руки', price: 120, can: p => !p.weapons.bow, no: 'куплено', buy: p => { p.weapons.bow = true; } },
  { id: 'steel', name: 'Стальной меч', desc: 'Урон 40 вместо 25', price: 150, can: p => !p.weapons.steel, no: 'куплено', buy: p => { p.weapons.steel = true; } },
  { id: 'armP', name: 'Протез руки', desc: 'Возвращает руку в строй', price: 180, can: p => p.limbs.armL === 0 || p.limbs.armR === 0, no: 'руки на месте', buy: p => p.installProsthetic('arm') },
  { id: 'legP', name: 'Протез ноги', desc: 'Самое хорошее: снова ходить и прыгать', price: 220, can: p => p.limbs.legL === 0 || p.limbs.legR === 0, no: 'ноги на месте', buy: p => p.installProsthetic('leg') },
  { id: 'eyeP', name: 'Волшебный глаз', desc: 'Протез глаза. Видит лучше прежнего', price: 250, can: p => p.limbs.eyeL === 0 || p.limbs.eyeR === 0, no: 'глаза на месте', buy: p => p.installProsthetic('eye') },
  { id: 'wheel', name: 'Инвалидная коляска', desc: 'Если нет ноги. Нужна хоть одна рука', price: 90, can: p => !p.wheelchair, no: 'куплена', buy: p => { p.wheelchair = true; } },
];

const LIMB_LABELS = {
  eyeL: 'Глаз Л', eyeR: 'Глаз П',
  armL: 'Рука Л', armR: 'Рука П',
  legL: 'Нога Л', legR: 'Нога П',
};

export class UI {
  constructor(game) {
    this.g = game;
    this.mm = $('minimap').getContext('2d');
    this.lastLimbSig = '';
    this._bt = null;
  }

  showScreen(id) { $(id).classList.remove('hidden'); }
  hideScreen(id) { $(id).classList.add('hidden'); }

  msg(text, cls = '') {
    const d = document.createElement('div');
    d.className = 'msg ' + cls;
    d.textContent = text;
    const box = $('msgs');
    box.appendChild(d);
    while (box.children.length > 7) box.removeChild(box.firstChild);
    setTimeout(() => { d.classList.add('fade'); setTimeout(() => d.remove(), 900); }, 3800);
  }

  banner(text, cls = '') {
    const b = $('banner');
    b.textContent = text;
    b.className = 'show ' + cls;
    clearTimeout(this._bt);
    this._bt = setTimeout(() => { b.className = ''; }, 2600);
  }

  prompt(t) {
    const p = $('prompt');
    if (t) { p.textContent = t; p.classList.remove('hidden'); }
    else p.classList.add('hidden');
  }

  setBleeding(b) {
    $('bleed').classList.toggle('hidden', !b);
    document.body.classList.toggle('bleeding', b);
  }

  damageFlash() {
    document.body.classList.add('hurt');
    clearTimeout(this._ht);
    this._ht = setTimeout(() => document.body.classList.remove('hurt'), 160);
  }

  applyEyes() {
    const p = this.g.player;
    const L = p.limbs.eyeL === 0, R = p.limbs.eyeR === 0;
    $('eyeL').classList.toggle('hidden', !L);
    $('eyeR').classList.toggle('hidden', !R);
    $('blind').classList.toggle('hidden', !(L && R));
  }

  updateHUD() {
    const g = this.g, p = g.player;
    $('hpbar').style.width = Math.max(0, p.hp / p.maxHp * 100) + '%';
    $('hptext').textContent = `${Math.ceil(Math.max(0, p.hp))} / ${p.maxHp}`;
    $('gold').textContent = `Золото: ${p.gold}`;
    $('arrows').textContent = p.weapons.bow ? `Стрелы: ${p.inv.arrows}` : '';
    const wname = p.weapon === 'bow' ? 'Лук' : (p.weapons.steel ? 'Стальной меч' : 'Меч');
    $('weaponname').textContent = `Оружие: ${wname} | Зелья [Q]: ${p.inv.potion} | Бинты [B]: ${p.inv.bandage}`;
    $('order').textContent = g.quests ? g.quests.orderText() : '';
    $('zonename').textContent = zoneAt(p.pos.x, p.pos.z);

    const sig = JSON.stringify([p.limbs, p.wheelchair, p.moveMode()]);
    if (sig !== this.lastLimbSig) {
      this.lastLimbSig = sig;
      const box = $('limbs');
      box.innerHTML = '';
      const anyBad = Object.values(p.limbs).some(v => v !== 1);
      if (anyBad || p.wheelchair) {
        for (const key of Object.keys(LIMB_LABELS)) {
          const v = p.limbs[key];
          if (v === 1) continue;
          const chip = document.createElement('span');
          chip.className = 'limbchip ' + (v === 0 ? 'lost' : 'prost');
          chip.textContent = `${LIMB_LABELS[key]}: ${v === 0 ? 'НЕТ' : 'ПРОТЕЗ'}`;
          box.appendChild(chip);
        }
        const mode = p.moveMode();
        if (mode !== 'walk') {
          const chip = document.createElement('span');
          chip.className = 'limbchip aid';
          chip.textContent = mode === 'wheel' ? 'ВЫ В КОЛЯСКЕ' : 'ВЫ ПОЛЗЁТЕ';
          box.appendChild(chip);
        }
      }
    }
  }

  updateMinimap() {
    const g = this.g, c = this.mm, W = 190, H = 190;
    const px = x => (x + 400) / 800 * W;
    const pz = z => (z + 400) / 800 * H;
    // 4 зоны
    c.fillStyle = '#15330f'; c.fillRect(0, 0, W / 2, H / 2);          // лес эльфов
    c.fillStyle = '#46423a'; c.fillRect(W / 2, 0, W / 2, H / 2);      // горы Злодея
    c.fillStyle = '#49591f'; c.fillRect(0, H / 2, W / 2, H / 2);      // земли людей
    c.fillStyle = '#5c5433'; c.fillRect(W / 2, H / 2, W / 2, H / 2);  // земли Императора
    // дорога корованов
    c.strokeStyle = '#8a7a50'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(px(-240), pz(200)); c.lineTo(px(152), pz(200)); c.stroke();
    // объекты
    c.fillStyle = '#d4af37'; c.fillRect(px(200) - 4, pz(200) - 4, 8, 8);     // дворец
    c.fillStyle = '#16161c'; c.fillRect(px(220) - 3, pz(-220) - 3, 6, 6);    // форт
    c.fillStyle = '#8a6a4a'; c.fillRect(px(-200) - 3, pz(200) - 3, 6, 6);    // деревня
    c.fillStyle = '#2c8a3c'; c.beginPath(); c.arc(px(-200), pz(-200), 4, 0, 7); c.fill(); // эльфы
    // корованы
    for (const cv of g.npcs.caravans) {
      if (cv.gone) continue;
      c.fillStyle = cv.robbed ? '#555' : '#e8c84a';
      c.fillRect(px(cv.pos.x) - 2, pz(cv.pos.z) - 2, 4, 4);
    }
    // NPC поблизости
    const pp = g.player.pos;
    for (const n of g.npcs.npcs) {
      if (n.dead) continue;
      const np = n.group.position;
      if (Math.hypot(np.x - pp.x, np.z - pp.z) > 140) continue;
      const ally = n.faction === g.faction || n.playerTroop;
      const hostile = isHostile(n.faction, g.faction) || isHostile(g.faction, n.faction) || n.personal === g.player;
      c.fillStyle = ally ? '#5ad05a' : hostile ? '#e04040' : '#b8b8a8';
      c.fillRect(px(np.x) - 1.5, pz(np.z) - 1.5, 3, 3);
    }
    // маркеры заданий
    if (g.quests) {
      c.fillStyle = '#ffd700';
      for (const m of g.quests.markers()) {
        const mx = px(m[0]), mz = pz(m[1]);
        c.beginPath();
        c.moveTo(mx, mz - 5); c.lineTo(mx + 4, mz); c.lineTo(mx, mz + 5); c.lineTo(mx - 4, mz);
        c.closePath(); c.fill();
      }
    }
    // игрок
    c.save();
    c.translate(px(pp.x), pz(pp.z));
    c.rotate(-g.player.yaw);
    c.fillStyle = '#fff';
    c.beginPath(); c.moveTo(0, -6); c.lineTo(4, 5); c.lineTo(-4, 5); c.closePath(); c.fill();
    c.restore();
    c.strokeStyle = '#000'; c.lineWidth = 1; c.strokeRect(0, 0, W, H);
  }

  // ---------- лавка ----------
  openShop() {
    const g = this.g;
    g.state = 'dialog';
    g.unlockFor();
    this.renderShop();
    this.showScreen('shop');
  }

  renderShop() {
    const g = this.g, p = g.player;
    $('shop-gold').textContent = `Ваше золото: ${p.gold}`;
    const box = $('shop-items');
    box.innerHTML = '';
    for (const it of SHOP) {
      const row = document.createElement('div');
      row.className = 'shop-item';
      const nm = document.createElement('span');
      nm.className = 'nm';
      nm.innerHTML = `<b></b><small></small>`;
      nm.querySelector('b').textContent = it.name;
      nm.querySelector('small').textContent = it.desc;
      const pr = document.createElement('span');
      pr.className = 'pr';
      pr.textContent = it.price + 'з';
      const btn = document.createElement('button');
      const available = it.can(p);
      btn.textContent = available ? 'Купить' : (it.no || '—');
      btn.disabled = !available || p.gold < it.price;
      btn.onclick = () => {
        if (!it.can(p)) return;
        if (p.gold < it.price) { this.msg('Не хватает золота! Ограбьте корован.', 'bad'); return; }
        p.gold -= it.price;
        it.buy(p);
        g.sfx.coin();
        this.msg(`Куплено: ${it.name}`, 'gold');
        this.renderShop();
      };
      row.append(nm, pr, btn);
      box.appendChild(row);
    }
  }

  // ---------- диалог ----------
  openDialog({ title, text, buttons }) {
    const g = this.g;
    g.state = 'dialog';
    g.unlockFor();
    $('dialog-title').textContent = title;
    $('dialog-text').textContent = text;
    const box = $('dialog-buttons');
    box.innerHTML = '';
    for (const b of buttons) {
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = b.label;
      btn.onclick = b.fn;
      box.appendChild(btn);
    }
    this.showScreen('dialog');
  }

  closeDialog() { this.hideScreen('dialog'); }
  closeAll() { this.hideScreen('dialog'); this.hideScreen('shop'); this.hideScreen('pause'); }

  statsLine() {
    const s = this.g.stats;
    const mm = Math.floor(s.playTime / 60), ss = Math.floor(s.playTime % 60);
    return `Убито врагов: ${s.kills} | Ограблено корованов: ${s.caravans} | Отбито атак: ${s.waves} | Приказов выполнено: ${s.orders} | Время: ${mm}:${String(ss).padStart(2, '0')}`;
  }

  showDeath(cause) {
    $('death-cause').textContent = cause;
    $('death-stats').textContent = this.statsLine();
    this.showScreen('death');
  }

  showVictory(text) {
    $('victory-text').textContent = text;
    $('victory-stats').textContent = this.statsLine();
    this.showScreen('victory');
  }

  toggleHelp() { $('help').classList.toggle('hidden'); }
}

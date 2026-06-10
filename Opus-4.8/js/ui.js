// Весь интерфейс: меню выбора фракции, HUD, компас, лог, магазин (экономика
// как в Daggerfall), инвентарь, оверлеи травм, пауза и экран смерти.
import { WEAPONS } from './player.js';

const FACTION_BADGE = {
  elf: '🏹 ЛЕСНЫЕ ЭЛЬФЫ',
  guard: '🛡️ ОХРАНА ДВОРЦА',
  villain: '💀 ЗЛОДЕЙ',
};

// Товары лавки. available/apply работают с объектом player.
function shopItems(p) {
  return [
    { id: 'sword', emoji: '🗡', name: 'Стальной меч', desc: 'Урон 30, шанс отрубить конечность 22%',
      price: 120, available: () => p.weaponKey === 'rusty' || p.weaponKey === 'elfblade',
      apply: () => { p.weaponKey = 'sword'; } },
    { id: 'axe', emoji: '🪓', name: 'Боевой топор', desc: 'Урон 42, расчленяет в 40% случаев',
      price: 260, available: () => p.weaponKey !== 'axe',
      apply: () => { p.weaponKey = 'axe'; } },
    { id: 'leather', emoji: '🦺', name: 'Кожаная броня', desc: 'Поглощает 20% урона',
      price: 90, available: () => p.armor < 0.2, apply: () => { p.armor = 0.2; } },
    { id: 'plate', emoji: '🛡', name: 'Латная броня', desc: 'Поглощает 45% урона',
      price: 240, available: () => p.armor < 0.45, apply: () => { p.armor = 0.45; } },
    { id: 'potion', emoji: '🧪', name: 'Зелье лечения', desc: '+60 HP и остановка крови',
      price: 40, available: () => true, apply: () => { p.potions++; } },
    { id: 'bandage', emoji: '🩹', name: 'Бинт', desc: 'Останавливает кровотечение',
      price: 20, available: () => true, apply: () => { p.bandages++; } },
    { id: 'phand', emoji: '🦾', name: 'Протез руки', desc: 'Возвращает силу удара после потери руки',
      price: 150, available: () => p.handLost && !p.handProsth, apply: () => p.installProsthetic('hand') },
    { id: 'peye', emoji: '👁', name: 'Глазной протез', desc: 'Возвращает полный обзор',
      price: 130, available: () => p.eyeLost && !p.eyeProsth, apply: () => p.installProsthetic('eye') },
    { id: 'pleg', emoji: '🦿', name: 'Протез ноги', desc: 'Снова ходишь и прыгаешь (лучший вариант)',
      price: 200, available: () => p.legLost && !p.legProsth, apply: () => p.installProsthetic('leg') },
    { id: 'chair', emoji: '♿', name: 'Инвалидная коляска', desc: 'Катаешься быстрее, чем ползаешь',
      price: 80, available: () => p.legLost && !p.legProsth && !p.wheelchair, apply: () => p.installProsthetic('wheelchair') },
  ];
}

export class UI {
  constructor() {
    this.$ = id => document.getElementById(id);
    this.handlers = {};
    this.compassTarget = null;
    this._bind();
  }

  _bind() {
    // выбор фракции
    document.querySelectorAll('.faction .play-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const f = btn.closest('.faction').dataset.faction;
        this.handlers.selectFaction && this.handlers.selectFaction(f);
      });
    });
    this.$('continue-btn').addEventListener('click', () => this.handlers.continue && this.handlers.continue());
    this.$('resume-btn').addEventListener('click', () => this.handlers.resume && this.handlers.resume());
    this.$('save-btn').addEventListener('click', () => this.handlers.save && this.handlers.save());
    this.$('load-btn').addEventListener('click', () => this.handlers.load && this.handlers.load());
    this.$('quit-btn').addEventListener('click', () => this.handlers.quit && this.handlers.quit());
    this.$('shop-close').addEventListener('click', () => this.handlers.closeShop && this.handlers.closeShop());
    this.$('inv-close').addEventListener('click', () => this.handlers.closeInv && this.handlers.closeInv());
    this.$('respawn-btn').addEventListener('click', () => this.handlers.respawn && this.handlers.respawn());
    this.$('death-menu-btn').addEventListener('click', () => this.handlers.quit && this.handlers.quit());
  }

  // ---------- лог ----------
  log(text, cls = '') {
    const box = this.$('log');
    const line = document.createElement('div');
    line.className = 'line ' + cls;
    line.textContent = text;
    box.appendChild(line);
    setTimeout(() => line.remove(), 6000);
    while (box.children.length > 6) box.removeChild(box.firstChild);
  }

  // ---------- меню / экраны ----------
  showMenu(hasSave) {
    this.$('menu').classList.remove('hidden');
    this.$('hud').classList.add('hidden');
    this.$('crosshair').classList.add('hidden');
    this.$('continue-btn').classList.toggle('hidden', !hasSave);
  }
  hideMenu() { this.$('menu').classList.add('hidden'); }
  showGameHUD() {
    this.$('hud').classList.remove('hidden');
    this.$('crosshair').classList.remove('hidden');
  }
  hideLoading() { this.$('loading').classList.add('hidden'); }

  showPause(hint = '') {
    this.$('pause').classList.remove('hidden');
    this.$('pause-hint').textContent = hint;
  }
  hidePause() { this.$('pause').classList.add('hidden'); }

  showDeath(reason) {
    this.$('death').classList.remove('hidden');
    this.$('death-text').textContent = reason;
  }
  hideDeath() { this.$('death').classList.add('hidden'); }

  // ---------- HUD ----------
  setObjective(text) { this.$('objective').innerHTML = text; }
  setFactionBadge(f) { this.$('faction-badge').textContent = FACTION_BADGE[f] || ''; }

  updateHUD(p) {
    this.$('hp-fill').style.width = Math.max(0, p.hp / p.maxHp * 100) + '%';
    this.$('stam-fill').style.width = Math.max(0, p.stam / p.maxStam * 100) + '%';
    this.$('gold').textContent = Math.floor(p.gold);
    this.$('weapon-name').textContent = p.weapon.name;
    // иконки состояния
    const icons = [];
    if (p.bleeding) icons.push('🩸');
    if (p.handProsth) icons.push('🦾'); else if (p.handLost) icons.push('✊');
    if (p.eyeProsth) icons.push('👁'); else if (p.eyeLost) icons.push('🕶');
    if (p.legProsth) icons.push('🦿'); else if (p.legLost) icons.push(p.wheelchair ? '♿' : '🧎');
    if (p.armor >= 0.45) icons.push('🛡'); else if (p.armor >= 0.2) icons.push('🦺');
    this.$('status-icons').innerHTML = icons.map(i => `<span class="si">${i}</span>`).join('');
  }

  setEyeOverlay(on, side = 'right') {
    const o = this.$('eye-overlay');
    o.classList.toggle('hidden', !on);
    o.style.transform = side === 'left' ? 'scaleX(-1)' : 'none';
  }

  showHint(text) { const h = this.$('hint'); h.textContent = text; h.style.display = 'block'; }
  hideHint() { this.$('hint').style.display = 'none'; }

  setCompassTarget(t) { this.compassTarget = t; }
  updateCompass(player) {
    const W = 340, half = W / 2;
    const yaw = player.yaw;
    const headFwd = Math.atan2(-Math.sin(yaw), -Math.cos(yaw));
    const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
    const marks = [
      { b: Math.PI, label: 'С' }, { b: Math.PI / 2, label: 'В' },
      { b: 0, label: 'Ю' }, { b: -Math.PI / 2, label: 'З' },
    ];
    let html = '';
    for (const m of marks) {
      const rel = norm(m.b - headFwd);
      if (Math.abs(rel) > Math.PI / 2) continue;
      const x = half + (rel / (Math.PI / 2)) * half;
      html += `<span class="compass-mark" style="left:${x}px">${m.label}</span>`;
    }
    if (this.compassTarget) {
      const dx = this.compassTarget.x - player.pos.x, dz = this.compassTarget.z - player.pos.z;
      const bt = Math.atan2(dx, dz);
      const rel = norm(bt - headFwd);
      const dist = Math.round(Math.hypot(dx, dz));
      if (Math.abs(rel) <= Math.PI / 2) {
        const x = half + (rel / (Math.PI / 2)) * half;
        html += `<span class="compass-mark tgt" style="left:${x}px">◆ ${dist}м</span>`;
      } else {
        html += `<span class="compass-mark tgt" style="left:${rel > 0 ? W - 14 : 6}px">${rel > 0 ? '►' : '◄'} ${dist}м</span>`;
      }
    }
    this.$('compass').innerHTML = html;
  }

  // ---------- магазин ----------
  openShop(player) {
    this.player = player;
    this.$('shop').classList.remove('hidden');
    this._renderShop();
  }
  closeShop() { this.$('shop').classList.add('hidden'); }
  _renderShop() {
    const p = this.player;
    this.$('shop-gold').textContent = Math.floor(p.gold);
    const box = this.$('shop-items'); box.innerHTML = '';
    for (const it of shopItems(p)) {
      if (!it.available()) continue;
      const afford = p.gold >= it.price;
      const row = document.createElement('div');
      row.className = 'shop-item' + (afford ? '' : ' disabled');
      row.innerHTML = `<div class="si-emoji">${it.emoji}</div>
        <div class="si-info"><b>${it.name}</b><span>${it.desc}</span></div>
        <div class="si-price">💰 ${it.price}</div>`;
      const btn = document.createElement('button');
      btn.textContent = 'Купить';
      btn.disabled = !afford;
      btn.addEventListener('click', () => {
        if (p.gold < it.price) return;
        p.gold -= it.price; it.apply();
        this.log(`Куплено: ${it.name}.`, 'good');
        this._renderShop();
      });
      row.appendChild(btn);
      box.appendChild(row);
    }
    if (!box.children.length) box.innerHTML = '<div style="color:#9a8a6a">Всё уже куплено. Возвращайся, когда ранят.</div>';
  }

  // ---------- инвентарь ----------
  openInventory(player) {
    this.player = player;
    this.$('inventory').classList.remove('hidden');
    this._renderInv();
  }
  closeInv() { this.$('inventory').classList.add('hidden'); }
  _renderInv() {
    const p = this.player;
    const tag = (t, c = '') => `<span class="tag ${c}">${t}</span>`;
    const inj = [];
    inj.push(p.handProsth ? tag('Рука: протез 🦾', 'good') : p.handLost ? tag('Рука отрублена ✊', 'bad') : tag('Рука цела', 'good'));
    inj.push(p.eyeProsth ? tag('Глаз: протез 👁', 'good') : p.eyeLost ? tag('Глаз выколот 🕶', 'bad') : tag('Глаза целы', 'good'));
    inj.push(p.legProsth ? tag('Нога: протез 🦿', 'good') : p.legLost ? tag(p.wheelchair ? 'Нога: коляска ♿' : 'Нога отрублена 🧎', 'bad') : tag('Ноги целы', 'good'));
    if (p.bleeding) inj.push(tag('КРОВОТЕЧЕНИЕ! 🩸', 'bad'));

    this.$('inv-body').innerHTML = `
      <div class="inv-section"><h3>Снаряжение</h3>
        <div class="inv-row"><span>Оружие: <b>${p.weapon.name}</b></span>${tag('урон ' + p.weapon.dmg)}</div>
        <div class="inv-row"><span>Броня</span>${tag(Math.round(p.armor * 100) + '% защиты')}</div>
        <div class="inv-row"><span>Золото</span>${tag('💰 ' + Math.floor(p.gold))}</div>
      </div>
      <div class="inv-section"><h3>Расходники</h3>
        <div class="inv-row"><span>🧪 Зелья лечения: <b>${p.potions}</b></span>
          <button id="use-potion">Выпить</button></div>
        <div class="inv-row"><span>🩹 Бинты: <b>${p.bandages}</b></span>
          <button id="use-bandage">Перевязать</button></div>
      </div>
      <div class="inv-section"><h3>Состояние тела</h3>
        <div class="inv-row" style="flex-wrap:wrap;gap:6px">${inj.join('')}</div>
      </div>`;
    const ub = this.$('use-potion'); if (ub) ub.onclick = () => { p.usePotion(); this._renderInv(); };
    const bb = this.$('use-bandage'); if (bb) bb.onclick = () => { p.useBandage(); this._renderInv(); };
  }

  anyOverlayOpen() {
    return ['pause', 'shop', 'inventory', 'death', 'menu'].some(id => !this.$(id).classList.contains('hidden'));
  }
}

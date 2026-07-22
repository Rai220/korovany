// ui.js — HUD, диалоги, лавка, карта 4 зон, тосты, простенький синтез звука.
import { SITES, ZONE_NAMES, ZONE_COLORS, ZONE_RADII, ROADS, heightAt, zoneAt } from './world.js';

const $ = id => document.getElementById(id);

// ---------- звук (WebAudio, без ассетов) ----------
let actx = null;
function ac() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
function beep(freq, dur, type = 'square', vol = 0.12, when = 0, slide = 0) {
  try {
    const a = ac();
    const o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, a.currentTime + when);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), a.currentTime + when + dur);
    g.gain.setValueAtTime(vol, a.currentTime + when);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + when + dur);
    o.connect(g).connect(a.destination);
    o.start(a.currentTime + when);
    o.stop(a.currentTime + when + dur + 0.02);
  } catch (e) { /* звук не критичен */ }
}
const SFX = {
  hit:   () => beep(110, 0.09, 'square', 0.16, 0, -60),
  swing: () => beep(300, 0.06, 'sawtooth', 0.05, 0, -220),
  hurt:  () => beep(160, 0.16, 'sawtooth', 0.14, 0, -90),
  coin:  () => { beep(1150, 0.07, 'sine', 0.12); beep(1650, 0.11, 'sine', 0.12, 0.07); },
  buy:   () => { beep(900, 0.06, 'sine', 0.1); beep(1350, 0.09, 'sine', 0.1, 0.06); },
  heal:  () => { beep(500, 0.12, 'sine', 0.09, 0, 300); beep(800, 0.14, 'sine', 0.08, 0.1, 300); },
  quest: () => { beep(520, 0.12, 'triangle', 0.13); beep(660, 0.12, 'triangle', 0.13, 0.12); beep(880, 0.2, 'triangle', 0.13, 0.24); },
  death: () => beep(220, 0.7, 'sawtooth', 0.16, 0, -180),
  injury:() => { beep(90, 0.25, 'square', 0.18, 0, -40); beep(70, 0.3, 'square', 0.14, 0.18, -30); },
};

export function initUI(G) {
  const ui = {};
  G.ui = ui;
  ui.sfx = name => SFX[name] && SFX[name]();

  // ---------- экраны ----------
  const screens = ['menu', 'pauseMenu', 'dialog', 'shop', 'mapOverlay', 'deathScreen', 'victoryScreen', 'loading'];
  ui.show = name => {
    for (const s of screens) $(s).classList.toggle('hidden', s !== name);
    $('hud').classList.toggle('hidden', !(name === null || name === 'mapOverlay'));
  };

  // ---------- тосты ----------
  ui.toast = (text, cls = '') => {
    const d = document.createElement('div');
    d.className = 'toast ' + cls;
    d.textContent = text;
    $('toasts').appendChild(d);
    setTimeout(() => d.remove(), 3300);
    while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
  };

  ui.zoneBanner = text => {
    const z = $('zoneBanner');
    z.textContent = text;
    z.classList.remove('hidden');
    z.style.animation = 'none';
    void z.offsetWidth;
    z.style.animation = '';
  };

  ui.waveBanner = text => {
    $('waveBanner').classList.toggle('hidden', !text);
    if (text) $('waveBanner').textContent = text;
  };

  ui.interactPrompt = text => {
    $('interactPrompt').classList.toggle('hidden', !text);
    if (text) $('interactPrompt').textContent = text;
  };

  ui.damageFlash = () => {
    const el = $('damageFlash');
    el.style.opacity = '1';
    setTimeout(() => { el.style.opacity = '0'; }, 110);
  };
  ui.healFlash = () => {
    const el = $('healFlash');
    el.style.opacity = '1';
    setTimeout(() => { el.style.opacity = '0'; }, 220);
  };
  ui.setBleeding = on => $('bleedVignette').classList.toggle('hidden', !on);
  ui.setEye = on => $('eyeOverlay').classList.toggle('hidden', !on);

  // ---------- HUD ----------
  ui.updateHUD = () => {
    const p = G.player;
    const hpFrac = Math.max(0, p.hp / p.maxHp);
    $('hpBar').style.width = (hpFrac * 100).toFixed(1) + '%';
    $('hpBar').classList.toggle('low', hpFrac < 0.3);
    $('hpText').textContent = `${Math.max(0, Math.ceil(p.hp))} / ${p.maxHp}`;
    $('goldVal').textContent = p.gold;
    $('zoneVal').textContent = ZONE_NAMES[zoneAt(p.pos.x, p.pos.z)] || '—';
    const st = [];
    if (p.injuries.arm) st.push(p.prosthesis.arm ? 'рука: протез' : 'РУКА ОТРУБЛЕНА');
    if (p.injuries.eye) st.push(p.prosthesis.eye ? 'глаз: протез' : 'ГЛАЗ ВЫБИТ');
    if (p.injuries.leg) st.push(p.prosthesis.leg ? 'нога: протез' : (p.wheelchair ? 'НОГА ОТРУБЛЕНА: коляска' : 'НОГА ОТРУБЛЕНА: ползёте'));
    if (p.bleeding) st.push('КРОВОТЕЧЕНИЕ!');
    $('statusLine').textContent = st.join(' · ');
    const q = G.campaign && G.campaign.questText;
    $('questTitle').textContent = q ? q.title : '';
    $('questDesc').textContent = q ? q.desc : '';
    $('questDist').textContent = '';
  };

  ui.setQuestDist = text => { $('questDist').textContent = text; };

  // ---------- диалог ----------
  ui.dialog = (title, text, buttons) => {
    $('dlgTitle').textContent = title;
    $('dlgText').textContent = text;
    const box = $('dlgButtons');
    box.innerHTML = '';
    for (const b of buttons) {
      const btn = document.createElement('button');
      btn.className = 'mbtn';
      btn.textContent = b.label;
      btn.onclick = () => { b.cb && b.cb(); };
      box.appendChild(btn);
    }
    ui.show('dialog');
  };

  // ---------- лавка ----------
  ui.openShop = (title, items) => {
    $('shopTitle').textContent = title;
    const render = () => {
      $('shopGold').textContent = `Ваше золото: ${G.player.gold}`;
      const box = $('shopItems');
      box.innerHTML = '';
      for (const it of items) {
        if (it.hidden) continue;
        const row = document.createElement('div');
        row.className = 'shopItem';
        const info = document.createElement('div');
        info.innerHTML = `<div class="si-name">${it.name}</div><div class="si-desc">${it.desc}</div>`;
        const btn = document.createElement('button');
        btn.textContent = it.sold ? 'Куплено' : `${it.price} зол.`;
        btn.disabled = !!it.sold || G.player.gold < it.price;
        btn.onclick = () => {
          if (G.player.gold < it.price) return;
          G.player.gold -= it.price;
          ui.sfx('buy');
          it.onBuy();
          ui.updateHUD();
          render();
        };
        row.append(info, btn);
        box.appendChild(row);
      }
    };
    render();
    ui.show('shop');
  };

  // ---------- карта ----------
  ui.drawMap = () => {
    const cv = $('mapCanvas');
    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    const SC = W / 1180; // мир ~±590
    const X = x => W / 2 + x * SC;
    const Y = z => H / 2 + z * SC;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0b0f08';
    ctx.fillRect(0, 0, W, H);

    // зоны
    const siteArr = [SITES.village, SITES.palace, SITES.forest, SITES.fort];
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(X(siteArr[i].x), Y(siteArr[i].z), ZONE_RADII[i + 1] * SC, 0, 7);
      ctx.fillStyle = ZONE_COLORS[i + 1] + '22';
      ctx.fill();
      ctx.strokeStyle = ZONE_COLORS[i + 1];
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // дороги
    ctx.strokeStyle = '#8a6f4a';
    ctx.lineWidth = 3;
    for (const road of ROADS) {
      ctx.beginPath();
      ctx.moveTo(X(road[0][0]), Y(road[0][1]));
      for (const [x, z] of road) ctx.lineTo(X(x), Y(z));
      ctx.stroke();
    }
    // значки поселений
    const mark = (x, z, color, label) => {
      ctx.fillStyle = color;
      ctx.fillRect(X(x) - 5, Y(z) - 5, 10, 10);
      ctx.fillStyle = '#e8d8a0';
      ctx.font = 'bold 13px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(label, X(x), Y(z) - 12);
    };
    mark(SITES.village.x, SITES.village.z, '#c9b458', 'Деревня');
    mark(SITES.palace.x, SITES.palace.z, '#d4af37', 'Дворец');
    mark(SITES.forest.x, SITES.forest.z, '#3f8f4a', 'Роща эльфов');
    mark(SITES.fort.x, SITES.fort.z, '#8a5a72', 'Форт Злого');
    // подписи зон
    ctx.font = '12px "Courier New", monospace';
    ctx.fillStyle = '#9a8a6a';
    const zoneLbl = ['1 — люди (нейтрал)', '2 — Император', '3 — эльфы', '4 — Злой (горы)'];
    for (let i = 0; i < 4; i++)
      ctx.fillText(zoneLbl[i], X(siteArr[i].x), Y(siteArr[i].z) + ZONE_RADII[i + 1] * SC - 8);
    // корованы
    if (G.caravans) for (const c of G.caravans) {
      if (c.looted) continue;
      ctx.fillStyle = '#ffd76a';
      ctx.beginPath();
      ctx.arc(X(c.x), Y(c.z), 4, 0, 7);
      ctx.fill();
    }
    // цель
    if (G.world && G.world.beaconPos) {
      const b = G.world.beaconPos;
      ctx.strokeStyle = '#ffd76a';
      ctx.lineWidth = 2;
      const t = 6 + Math.sin(performance.now() / 200) * 2;
      ctx.strokeRect(X(b.x) - t, Y(b.z) - t, t * 2, t * 2);
    }
    // игрок
    const p = G.player;
    ctx.save();
    ctx.translate(X(p.pos.x), Y(p.pos.z));
    ctx.rotate(Math.atan2(Math.sin(p.yaw), Math.cos(p.yaw)) * -1);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(-6, 7);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    // сев... юг-верх: просто рамка
    ctx.strokeStyle = '#555030';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);
  };

  return ui;
}

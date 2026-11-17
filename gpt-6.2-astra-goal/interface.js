'use strict';
const $ = (id) => document.getElementById(id);
const paths = {
  brand:
    '<path d="m24 2 3.5 7-1.8 18.5L24 45l-1.7-17.5L20.5 9z" fill="currentColor"/><path d="m5 9 7 7 7 1.5-6-6-2-6m32 3.5-7 7-7 1.5 6-6 2-6M6 18l9 6 5 1-7-7m29 0-9 6-5 1 7-7M11 28l10 3.5m16-3.5-10 3.5" stroke-width="2.3"/><path d="m15 35 9 10 9-10"/>',
  swords: '<path d="m3 3 4 1 13 15-2 2L4 7zM15 16l6-5M3 20l6-6M3 15l6 6M14 9l4-5 3-1-1 4-4 4"/>',
  map: '<path d="m2 5 6-2 8 3 6-2v15l-6 2-8-3-6 2zM8 3v15m8-12v15"/>',
  keys: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M5 9h1m3 0h1m3 0h1m3 0h1M5 12h1m3 0h1m3 0h1m3 0h1M8 15h8"/>',
  expand: '<path d="M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6"/>',
  mute: '<path d="M3 9h4l5-4v14l-5-4H3zM16 9l6 6m0-6-6 6"/>',
  sound: '<path d="M3 9h4l5-4v14l-5-4H3zM16 8a5 5 0 0 1 0 8m3-11a9 9 0 0 1 0 14"/>',
  pin: '<path d="M19 9c0 5-7 12-7 12S5 14 5 9a7 7 0 1 1 14 0z"/><circle cx="12" cy="9" r="2"/>',
  arrow: '<path d="M3 12h17m-7-6 7 6-7 6"/>',
  close: '<path d="m5 5 14 14M19 5 5 19"/>',
  compass:
    '<circle cx="12" cy="12" r="8"/><path d="m12 0 2.3 9.7L24 12l-9.7 2.3L12 24l-2.3-9.7L0 12l9.7-2.3z"/><path d="m12 3 0 9 7 0m-7 0v8"/>',
  town: '<path d="m2 11 7-6 7 6M4 10v10h10V10m-6 10v-6h3v6m3-13 3-3 5 5m-2-1v12h-4"/>',
  crown: '<path d="m2 6 5 5 5-8 5 8 5-5-3 11H5zM5 20h14"/>',
  tree: '<path d="m12 2 5 7h-3l5 6h-4l5 4H4l5-4H5l5-6H7zM12 18v4"/>',
  peak: '<path d="m2 20 8-14 4 7 3-5 6 12zM7 12l3 2 2-3"/>',
};
function icon(n) {
  return (
    '<svg aria-hidden="true" class="glyph" viewBox="' +
    (n === 'brand' ? '0 0 48 48' : '0 0 24 24') +
    '" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
    paths[n] +
    '</svg>'
  );
}
const emblems = [
  '<path d="M23 3v40m0-7L9 24l-3-9 9 9-3-11-4-6m15 24 10-11 3-12m-13 28 12-10 5-13m-17 7-7-9 1-7m6 22 7-15V5"/><path d="m11 31 12 12 12-12m-17 1 5 4 5-4"/>',
  '<path d="m7 7 8 4 8-6 8 6 8-4-2 15c-2 9-9 14-14 20C18 36 11 31 9 22z"/><path d="m14 14 5 4 4-7 4 7 5-4-2 9H16zm3 12h12m-6 1v9"/>',
  '<path d="M5 6l12 8 6-10 6 10 12-8-5 15-6 4 1 9-8 8-8-8 1-9-6-4z"/><path d="m12 17 7 5-3-9m18 4-7 5 3-9m-13 14 4 1-1 4m9-5-4 1 1 4m-6 3 3 3 3-3"/>',
];
function crest(i) {
  return (
    '<svg class="insignia" aria-hidden="true" viewBox="0 0 46 46" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">' +
    emblems[i] +
    '</svg>'
  );
}
const sides = [
  {
    name: 'Лесные эльфы',
    role: 'Разведчик лесного союза',
    place: 2,
    img: 'elf',
    desc: 'В дозорной книге леса пропали три имени. Последний след ведёт к повозке сборщика податей.',
  },
  {
    name: 'Дворцовая стража',
    role: 'Солдат императорской гвардии',
    place: 1,
    img: 'guard',
    desc: 'На приказе капитана — ваша печать. Но вы впервые видите приказ. Идите к южным воротам.',
  },
  {
    name: 'Тёмный владыка',
    role: 'Повелитель горного форта',
    place: 3,
    img: 'lord',
    desc: 'Форту осталось хлеба на два дня. Ваши люди готовы идти за вами. Решите, чьи амбары вы откроете.',
  },
];
const lands = [
  {
    name: 'Вольные земли',
    icon: 'town',
    roman: 'I',
    lore: 'Перепутье торговцев и вольных людей. Через деревню проходит корован с товарами. На рыночной площади лекарь продаёт бинты и протезы.',
  },
  {
    name: 'Имперский дворец',
    icon: 'crown',
    roman: 'II',
    lore: 'За зубчатыми стенами расположились императорская стража и её командир. Шпионы и налётчики пробираются сюда с горных троп.',
  },
  {
    name: 'Эльфийский лес',
    icon: 'tree',
    roman: 'III',
    lore: 'Густой хвойный лес скрывает деревянные дома союза. Эльфы обороняют поселение от дворцовых солдат и горных дружин.',
  },
  {
    name: 'Чёрные горы',
    icon: 'peak',
    roman: 'IV',
    lore: 'Старый форт нависает над перевалом. Отсюда тёмный владыка отправляет дружину на дворец или лесное поселение.',
  },
];
const roman = ['I', 'II', 'III'];
let choice = 0,
  active = false,
  modalExit = null,
  uiTimer,
  soundOn = true,
  audioCtx;
function tone(hz, duration = 0.13, type = 'sine', vol = 0.05, end = hz) {
  if (!soundOn) return;
  try {
    audioCtx ||= new AudioContext();
    audioCtx.resume().catch(() => {});
    const o = audioCtx.createOscillator(),
      g = audioCtx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(hz, audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(end, audioCtx.currentTime + duration);
    g.gain.setValueAtTime(Math.max(0.0001, vol * prefs.effects), audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    o.connect(g).connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + duration);
  } catch {}
}
function toast(text) {
  $('message').textContent = text;
  clearTimeout(uiTimer);
  uiTimer = setTimeout(() => ($('message').textContent = ''), 2800);
}
function choose(i) {
  choice = i;
  const s = sides[i];
  $('hero-desc').textContent = s.desc;
  [...$('factions').children].forEach((el, j) => {
    el.classList.toggle('on', j === i);
    el.setAttribute('aria-pressed', j === i);
  });
  refreshResume();
}
function saveKey() {
  return 'korovany.gpt-6.2-astra-goal.v1.' + choice;
}
function refreshResume() {
  try {
    $('resume').hidden = !(
      localStorage.getItem(saveKey()) || localStorage.getItem(saveKey() + '.checkpoint')
    );
  } catch {
    $('resume').hidden = true;
  }
}
function modal(kicker, title, body, onExit = null) {
  if (active) {
    keys.clear();
    if (document.pointerLockElement) {
      expectedUnlock = true;
      document.exitPointerLock();
    }
  }
  $('dialog-kicker').textContent = kicker;
  $('dialog-title').textContent = title;
  $('dialog-body').innerHTML = body;
  modalExit = onExit;
  if (!$('dialog').open) $('dialog').showModal();
}
function closeModal() {
  if ($('dialog').open) $('dialog').close();
  const f = modalExit;
  modalExit = null;
  if (f) f();
}
$('dialog').addEventListener('cancel', (e) => {
  e.preventDefault();
  closeModal();
});
$('close').onclick = closeModal;
const controlRows = [
  ['W A S D / ↑ ↓', 'Движение'],
  ['Мышь / ← →', 'Осмотр и поворот'],
  ['Shift / Пробел', 'Бег / прыжок'],
  ['ЛКМ / F', 'Атака'],
  ['G / C', 'Пробивающий удар / отскок'],
  ['1 / 2', 'Меч / лук'],
  ['ПКМ / R', 'Держать блок мечом'],
  ['C', 'Отскок назад'],
  ['J', 'Хроника и улики'],
  ['E', 'Действие, торговля, грабёж'],
  ['H', 'Использовать бинт'],
  ['Q', 'Приказ дружине владыки'],
  ['M / Esc', 'Карта / пауза'],
  ['K', 'Сохранить игру'],
];
function help() {
  modal(
    'Справочник',
    'Управление',
    '<dl class="controls">' +
      controlRows.map(([key, v]) => '<div><dt><kbd>' + key + '</kbd></dt><dd>' + v + '</dd></div>').join('') +
      '</dl><p style="margin-top:13px">Щёлкните по миру для обзора мышью. На сенсорном экране двигайтесь левым джойстиком и ведите пальцем по миру для поворота. Золотой ромб отмечает цель.</p>',
  );
}
function page(n) {
  $('menu').classList.toggle('atlas-only', n === 'atlas');
  document.querySelectorAll('[data-page]').forEach((b) => b.classList.toggle('active', b.dataset.page === n));
  window.scrollTo(0, 0);
}
document.querySelectorAll('[data-icon]').forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
document.querySelectorAll('[data-page]').forEach((b) => (b.onclick = () => page(b.dataset.page)));
document.querySelector('.brand').onclick = (e) => {
  e.preventDefault();
  page('campaign');
};
$('help').onclick = help;
$('factions').innerHTML = sides
  .map(
    (s, i) =>
      '<button class="faction" type="button">' +
      crest(i) +
      '<span><strong>' +
      s.name +
      '</strong><small>' +
      s.role +
      '</small></span><i class="choice-dot"></i></button>',
  )
  .join('');
[...$('factions').children].forEach(
  (el, i) =>
    (el.onclick = () => {
      choose(i);
      tone(140, 0.18);
    }),
);
$('regions').innerHTML = lands
  .map(
    (l, i) =>
      '<button class="region" style="--land:url(./assets/land' +
      i +
      '.webp)"><span class="roman">' +
      l.roman +
      '</span><span class="region-name">' +
      icon(l.icon) +
      l.name +
      '</span></button>',
  )
  .join('');
[...$('regions').children].forEach(
  (el, i) =>
    (el.onclick = () =>
      modal(
        'Атлас мира / Регион ' + lands[i].roman,
        lands[i].name,
        '<img class="modal-image" alt="" src="./assets/land' + i + '.webp"><p>' + lands[i].lore + '</p>',
      )),
);
$('full').onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    toast('Полный экран недоступен в этом браузере');
  }
};
function audioToggle() {
  soundOn = !soundOn;
  if (typeof scoreStop === 'function') {
    if (!soundOn) scoreStop();
    else if (active) scoreStart();
  }
  audioButton();
  tone(260, 0.4);
}
function audioButton() {
  $('audio').innerHTML = icon(soundOn ? 'sound' : 'mute');
  $('audio').title = soundOn ? 'Выключить звук' : 'Включить звук';
  $('audio').setAttribute('aria-label', $('audio').title);
  $('audio').setAttribute('aria-pressed', soundOn);
}
$('audio').onclick = audioToggle;
audioButton();
choose(0);

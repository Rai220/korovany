'use strict';
const defaults = {
  quality: 'balanced',
  sensitivity: 1,
  music: 0.8,
  effects: 0.8,
  voice: 0.96,
  sound: true,
  subtitles: true,
  motion: !matchMedia('(prefers-reduced-motion:reduce)').matches,
};
let prefs = { ...defaults };
try {
  Object.assign(prefs, JSON.parse(localStorage.getItem('korovany.goal.preferences')) || {});
} catch {}
soundOn = prefs.sound !== false;
audioButton();
document.body.classList.toggle('no-subtitles', !prefs.subtitles);
function persistSettings() {
  try {
    localStorage.setItem('korovany.goal.preferences', JSON.stringify(prefs));
  } catch {}
}
function applyGraphics() {
  if (!world) return;
  const level = prefs.quality,
    size = level === 'high' ? 2048 : 1024,
    ratio =
      level === 'light'
        ? 0.8
        : level === 'high'
          ? Math.min(2, devicePixelRatio)
          : Math.min(1.5, devicePixelRatio);
  world.renderer.setPixelRatio(ratio);
  world.renderer.shadowMap.enabled = level !== 'light';
  if (world.sun.shadow.mapSize.x !== size) {
    world.sun.shadow.mapSize.set(size, size);
    world.sun.shadow.map?.dispose();
    world.sun.shadow.map = null;
  }
  world.renderer.shadowMap.needsUpdate = true;
  world.resize();
}
function settings() {
  modal(
    'Параметры игры',
    'Настройки',
    '<div class="preferences"><label>Графика<select id="quality"><option value="light">Экономная</option><option value="balanced">Сбалансированная</option><option value="high">Высокая</option></select></label>' +
      [
        ['sensitivity', 'Чувствительность', 0.35, 2.4],
        ['music', 'Музыка', 0, 1],
        ['voice', 'Русская речь', 0, 1],
        ['effects', 'Эффекты', 0, 1],
      ]
        .map(
          ([id, name, min, max]) =>
            '<label>' +
            name +
            '<input type="range" id="' +
            id +
            '" min="' +
            min +
            '" max="' +
            max +
            '" step=".05"></label>',
        )
        .join('') +
      '<label>Субтитры в пути<input id="subtitles" type="checkbox"></label><label>Покачивание камеры<input id="motion" type="checkbox"></label></div>',
  );
  for (const id of ['quality', 'sensitivity', 'music', 'effects', 'voice', 'subtitles', 'motion']) {
    const el = $(id);
    if (el.type === 'checkbox') el.checked = prefs[id];
    else el.value = prefs[id];
    el.oninput = () => {
      prefs[id] = id === 'quality' ? el.value : el.type === 'checkbox' ? el.checked : Number(el.value);
      if (id === 'quality') applyGraphics();
      if (id === 'music') scoreRefresh();
      if (id === 'voice') realmVoice.refresh();
      if (id === 'subtitles') document.body.classList.toggle('no-subtitles', !prefs.subtitles);
      persistSettings();
    };
  }
}
$('settings').onclick = settings;

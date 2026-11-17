'use strict';
const defaults = {
  quality: 'balanced',
  sensitivity: 1,
  music: 0.8,
  effects: 0.8,
  motion: !matchMedia('(prefers-reduced-motion:reduce)').matches,
};
let prefs = { ...defaults };
try {
  Object.assign(prefs, JSON.parse(localStorage.getItem('korovany.goal.preferences')) || {});
} catch {}
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
      '<label>Покачивание камеры<input id="motion" type="checkbox"></label></div>',
  );
  const write = () => {
    try {
      localStorage.setItem('korovany.goal.preferences', JSON.stringify(prefs));
    } catch {}
  };
  for (const id of ['quality', 'sensitivity', 'music', 'effects', 'motion']) {
    const el = $(id);
    if (id === 'motion') el.checked = prefs.motion;
    else el.value = prefs[id];
    el.oninput = () => {
      prefs[id] = id === 'quality' ? el.value : id === 'motion' ? el.checked : Number(el.value);
      if (id === 'quality') applyGraphics();
      if (id === 'music')
        music.forEach((a, j) => (a.volume = prefs.music * (j ? scoreMix : 1 - scoreMix) * 0.52));
      write();
    };
  }
}
$('settings').onclick = settings;

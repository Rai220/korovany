'use strict';
const editionBoot = (() => {
  let packs = 0,
    failed = false;
  const el = (id) => document.getElementById(id);
  function onResource(event) {
    const script = event.target;
    if (!(script instanceof HTMLScriptElement) || !script.src) return;
    if (event.type === 'error') {
      failed = true;
      const button = el('begin'),
        label = el('start-label');
      if (label) label.textContent = 'Повторить загрузку';
      if (button) {
        button.disabled = false;
        button.onclick = () => location.reload();
      }
      const notice = el('menu-error');
      if (notice) {
        notice.hidden = false;
        notice.textContent =
          'Не удалось загрузить файл игры. Проверьте соединение или откройте целую папку издания.';
      }
      return;
    }
    if (script.hasAttribute('data-pack') && !failed) {
      packs++;
      const label = el('start-label');
      if (label) label.textContent = 'Подготовка мира · ' + packs + ' / 5';
    }
  }
  document.addEventListener('load', onResource, true);
  document.addEventListener('error', onResource, true);
  function ready() {
    if (failed) return false;
    el('start-label').textContent = 'Дело пропавшего обоза';
    el('begin').disabled = false;
    for (const id of ['oath-begin', 'post-race', 'explore-entry', 'resume', 'audio', 'settings'])
      el(id).disabled = false;
    return true;
  }
  return {
    ready,
    get failed() {
      return failed;
    },
  };
})();

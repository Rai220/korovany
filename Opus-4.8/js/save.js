// Сохранение/загрузка в localStorage. «Сохранятся можно...» — как в ТЗ.
const KEY = 'korovany_opus48_save_v1';

export const Save = {
  has() { return !!localStorage.getItem(KEY); },

  write(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); return true; }
    catch (e) { console.warn('Не удалось сохранить:', e); return false; }
  },

  read() {
    try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; }
    catch (e) { return null; }
  },

  clear() { localStorage.removeItem(KEY); },
};

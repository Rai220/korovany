// Сохранятся можно. Всё лежит в localStorage браузера.
import { SAVE_KEY } from './config.js';

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}

export function saveGame(data) {
  try {
    const payload = { v: 1, time: Date.now(), ...data };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    return true;
  } catch (e) {
    console.warn('Не удалось сохранится:', e);
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !data.player) return null;
    return data;
  } catch (e) {
    console.warn('Сохранение битое:', e);
    return null;
  }
}

export function saveInfo() {
  const d = loadGame();
  if (!d) return '';
  const dt = new Date(d.time || Date.now());
  const f = { elf: 'Эльфы', guard: 'Охрана дворца', villain: 'Злой…' }[d.player.faction] || '?';
  return `${f}, золота ${Math.floor(d.player.gold)} — ${dt.toLocaleString('ru-RU')}`;
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ничего */ }
}

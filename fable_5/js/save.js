// Сохраняться можно... (localStorage)
const KEY = 'korovany_djva_goda_save';

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export function saveGame(G) {
  try {
    const d = {
      v: 1,
      savedAt: Date.now(),
      faction: G.faction,
      villainName: G.villainName,
      timeOfDay: G.timeOfDay,
      flags: G.flags,
      stats: G.stats,
      player: G.player.serialize(),
      quests: G.quests.serialize(),
    };
    localStorage.setItem(KEY, JSON.stringify(d));
    return true;
  } catch (e) { return false; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}

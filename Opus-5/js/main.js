// Точка входа.
import { Game } from './game.js';

const game = new Game();
window.game = game;      // чтобы можно было поковыряться из консоли
game.boot().catch((e) => {
  console.error(e);
  document.getElementById('loadtext').textContent = 'Ошибка запуска: ' + e.message;
});

// Все текстуры рисуются на canvas прямо в браузере — никаких внешних файлов,
// значит никаких проблем с CORS на GitHub Pages.
import * as THREE from 'three';

const cache = {};

function makeCanvas(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function rand(a, b) { return a + Math.random() * (b - a); }

// Шумная заливка с пятнами — основа для травы/земли/камня
function noisyFill(ctx, size, base, spots, spotColors) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < spots; i++) {
    ctx.fillStyle = spotColors[(Math.random() * spotColors.length) | 0];
    ctx.globalAlpha = rand(0.15, 0.5);
    const r = rand(1, 5);
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function grassTexture() {
  if (cache.grass) return cache.grass;
  const size = 256, c = makeCanvas(size), ctx = c.getContext('2d');
  noisyFill(ctx, size, '#2f4a1e', 2600, ['#3c5e26', '#264018', '#46702c', '#1f3614', '#557e30']);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(60, 60);
  cache.grass = t;
  return t;
}

export function dirtTexture() {
  if (cache.dirt) return cache.dirt;
  const size = 128, c = makeCanvas(size), ctx = c.getContext('2d');
  noisyFill(ctx, size, '#6b5230', 1200, ['#7a5e38', '#5a4426', '#80664a', '#4e3c20']);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(8, 8);
  cache.dirt = t;
  return t;
}

export function stoneTexture() {
  if (cache.stone) return cache.stone;
  const size = 256, c = makeCanvas(size), ctx = c.getContext('2d');
  noisyFill(ctx, size, '#8a8478', 1400, ['#9a948a', '#76706a', '#a6a098', '#5e5852']);
  // швы кладки
  ctx.strokeStyle = 'rgba(40,38,34,.6)'; ctx.lineWidth = 3;
  for (let y = 0; y < size; y += 42) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
    const off = (y / 42) % 2 ? 64 : 0;
    for (let x = off; x < size; x += 128) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 42); ctx.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  cache.stone = t;
  return t;
}

export function woodTexture() {
  if (cache.wood) return cache.wood;
  const size = 128, c = makeCanvas(size), ctx = c.getContext('2d');
  ctx.fillStyle = '#5a3c1e'; ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(40,26,12,.5)'; ctx.lineWidth = 2;
  for (let x = 0; x < size; x += 12) {
    ctx.beginPath(); ctx.moveTo(x + rand(-3, 3), 0);
    ctx.bezierCurveTo(x + 4, size / 3, x - 4, 2 * size / 3, x + rand(-3, 3), size);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  cache.wood = t;
  return t;
}

export function rockTexture() {
  if (cache.rock) return cache.rock;
  const size = 256, c = makeCanvas(size), ctx = c.getContext('2d');
  noisyFill(ctx, size, '#5c5650', 2000, ['#6c665e', '#46423c', '#7a746a', '#383430']);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4);
  cache.rock = t;
  return t;
}

// Билборд дерева для дальнего LOD — спрайт с прозрачным фоном.
export function treeBillboard(variant = 0) {
  const key = 'tree' + variant;
  if (cache[key]) return cache[key];
  const size = 256, c = makeCanvas(size), ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  // ствол
  const trunkW = size * 0.07;
  const trunkGrad = ctx.createLinearGradient(size / 2 - trunkW, 0, size / 2 + trunkW, 0);
  trunkGrad.addColorStop(0, '#3a2812'); trunkGrad.addColorStop(.5, '#5a3c1e'); trunkGrad.addColorStop(1, '#2e2010');
  ctx.fillStyle = trunkGrad;
  ctx.fillRect(size / 2 - trunkW / 2, size * 0.55, trunkW, size * 0.45);
  // крона — несколько слоёв «облаков»
  const greens = [['#1f3a12', '#2f5a1e', '#3c7026'], ['#20401a', '#356025', '#4a8030'], ['#18300f', '#284e1c', '#386a26']][variant % 3];
  for (let layer = 0; layer < 3; layer++) {
    const cy = size * (0.18 + layer * 0.15);
    const baseR = size * (0.34 - layer * 0.07);
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + layer;
      const rr = baseR * rand(0.5, 1);
      const x = size / 2 + Math.cos(a) * rr * rand(0.7, 1);
      const y = cy + Math.sin(a) * rr * 0.7;
      ctx.fillStyle = greens[(Math.random() * greens.length) | 0];
      ctx.globalAlpha = rand(0.7, 1);
      ctx.beginPath();
      ctx.arc(x, y, size * rand(0.05, 0.11), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache[key] = t;
  return t;
}

// Простое «лицо» NPC на текстуре головы (чтобы было видно фракцию/направление)
export function leafTexture() {
  if (cache.leaf) return cache.leaf;
  const size = 64, c = makeCanvas(size), ctx = c.getContext('2d');
  noisyFill(ctx, size, '#2f5a1e', 300, ['#3c7026', '#23491a', '#4a8030']);
  const t = new THREE.CanvasTexture(c);
  cache.leaf = t;
  return t;
}

// Небо-градиент как фон сцены
export function skyTexture(top = '#7fa6c8', bottom = '#cfe0ec') {
  const size = 256, c = makeCanvas(size), ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Коллизии мира: статические коробки-препятствия + рельеф. Пространственная сетка.
import { G } from '../core/state.js';
import { clamp, rayBox } from '../core/mathutil.js';
import { heightAt } from './terrain.js';

const CELL = 16;
const grid = new Map();
let built = false;
const key = (cx, cz) => cx * 100003 + cz;

export function addCollider(c) {
  c.id = G.colliders.length;
  G.colliders.push(c);
  built = false;
  return c;
}
export function clearColliders() { G.colliders.length = 0; grid.clear(); built = false; }

export function buildColliderGrid() {
  grid.clear();
  for (const c of G.colliders) {
    const cx0 = Math.floor(c.x0 / CELL), cx1 = Math.floor(c.x1 / CELL);
    const cz0 = Math.floor(c.z0 / CELL), cz1 = Math.floor(c.z1 / CELL);
    for (let cz = cz0; cz <= cz1; cz++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const k = key(cx, cz);
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(c);
      }
    }
  }
  built = true;
}

function nearColliders(x, z, r) {
  if (!built) buildColliderGrid();
  const out = [];
  const cx0 = Math.floor((x - r) / CELL), cx1 = Math.floor((x + r) / CELL);
  const cz0 = Math.floor((z - r) / CELL), cz1 = Math.floor((z + r) / CELL);
  for (let cz = cz0; cz <= cz1; cz++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      const list = grid.get(key(cx, cz));
      if (list) for (const c of list) if (!out.includes(c)) out.push(c);
    }
  }
  return out;
}

// Выталкивание круга игрока/НПС из коробок-препятствий.
export function resolveCollisions(pos, radius, feetY, height) {
  const list = nearColliders(pos.x, pos.z, radius + 2.5);
  let hit = false;
  for (const c of list) {
    if (c.y1 !== undefined && (feetY + height < c.y0 || feetY > c.y1)) continue;
    if (c.dead) continue;
    const nx = clamp(pos.x, c.x0, c.x1), nz = clamp(pos.z, c.z0, c.z1);
    const dx = pos.x - nx, dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 > radius * radius) continue;
    hit = true;
    if (d2 > 1e-6) {
      const d = Math.sqrt(d2);
      pos.x = nx + (dx / d) * radius;
      pos.z = nz + (dz / d) * radius;
    } else {
      // центр внутри коробки — выталкиваем по минимальной стороне
      const left = Math.abs(pos.x - c.x0), right = Math.abs(c.x1 - pos.x);
      const back = Math.abs(pos.z - c.z0), front = Math.abs(c.z1 - pos.z);
      const m = Math.min(left, right, back, front);
      if (m === left) pos.x = c.x0 - radius;
      else if (m === right) pos.x = c.x1 + radius;
      else if (m === back) pos.z = c.z0 - radius;
      else pos.z = c.z1 + radius;
    }
  }
  return hit;
}

export function isInsideCollider(x, y, z, pad = 0) {
  for (const c of nearColliders(x, z, pad + 0.5)) {
    if (x > c.x0 - pad && x < c.x1 + pad && z > c.z0 - pad && z < c.z1 + pad && y > c.y0 && y < c.y1) return c;
  }
  return null;
}

// Луч по препятствиям (для стрел и проверки видимости).
export function raycastColliders(ox, oy, oz, dx, dy, dz, maxDist) {
  let best = null;
  const steps = Math.ceil(maxDist / CELL) + 1;
  const seen = new Set();
  for (let s = 0; s <= steps; s++) {
    const t0 = (s / steps) * maxDist;
    const x = ox + dx * t0, z = oz + dz * t0;
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const list = grid.get(key(cx + i, cz + j));
      if (!list) continue;
      for (const c of list) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        const min = { x: c.x0, y: c.y0, z: c.z0 }, max = { x: c.x1, y: c.y1, z: c.z1 };
        const t = rayBox(ox, oy, oz, dx, dy, dz, min, max);
        if (t !== null && t >= 0 && t <= maxDist && (!best || t < best.t)) best = { t, collider: c };
      }
    }
  }
  return best;
}

// Луч по рельефу (маршевый поиск).
export function raycastTerrain(ox, oy, oz, dx, dy, dz, maxDist) {
  const step = 2.2;
  let prev = oy - heightAt(ox, oz);
  for (let t = step; t <= maxDist; t += step) {
    const x = ox + dx * t, y = oy + dy * t, z = oz + dz * t;
    const h = heightAt(x, z);
    const cur = y - h;
    if (cur <= 0) {
      const k = prev / (prev - cur || 1e-6);
      return { t: t - step + k * step, y: h };
    }
    prev = cur;
  }
  return null;
}

export function raycastWorld(ox, oy, oz, dx, dy, dz, maxDist = 120) {
  const a = raycastColliders(ox, oy, oz, dx, dy, dz, maxDist);
  const b = raycastTerrain(ox, oy, oz, dx, dy, dz, maxDist);
  if (a && b) return a.t < b.t ? a : b;
  return a || b;
}

export function lineOfSight(ax, ay, az, bx, by, bz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const len = Math.hypot(dx, dy, dz);
  if (len < 0.01) return true;
  const hit = raycastWorld(ax, ay, az, dx / len, dy / len, dz / len, len - 0.4);
  return !hit;
}

// Высота поверхности с учётом деревянных помостов (эльфийские дома на ветвях).
export function surfaceHeight(x, z, feetY, stepUp = 0.9) {
  let h = heightAt(x, z);
  const plats = G.platforms;
  if (plats) {
    for (let i = 0; i < plats.length; i++) {
      const p = plats[i];
      if (x > p.x0 - 0.2 && x < p.x1 + 0.2 && z > p.z0 - 0.2 && z < p.z1 + 0.2) {
        if (p.y > h && p.y <= feetY + stepUp) h = p.y;
      }
    }
  }
  return h;
}

export function isOnPlatform(x, z, y) {
  const plats = G.platforms;
  if (!plats) return false;
  for (const p of plats) {
    if (x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1 && Math.abs(p.y - y) < 0.35) return true;
  }
  return false;
}

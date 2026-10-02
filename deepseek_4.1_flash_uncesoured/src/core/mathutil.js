// Мелкие математические помощники.
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const smoothstep = (a, b, v) => { const t = clamp(invLerp(a, b, v), 0, 1); return t * t * (3 - 2 * t); };
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export function wrapAngle(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}
export function angleTowards(cur, target, maxStep) {
  const d = wrapAngle(target - cur);
  return cur + clamp(d, -maxStep, maxStep);
}
export function dist2D(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return Math.hypot(dx, dz); }
export function dist2DSq(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; }

export function pointInRect(x, z, r) {
  return x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
}
export function pointInCircle(x, z, cx, cz, rad) { return dist2DSq(x, z, cx, cz) < rad * rad; }

// Ближайшая точка на отрезке (для дорог и рек).
export function closestOnSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz || 1e-6;
  let t = ((px - ax) * dx + (pz - az) * dz) / len2;
  t = clamp(t, 0, 1);
  return { x: ax + dx * t, z: az + dz * t, t };
}

export function closestOnPolyline(px, pz, pts) {
  let best = { x: pts[0][0], z: pts[0][1], d: Infinity, t: 0, i: 0 };
  for (let i = 0; i < pts.length - 1; i++) {
    const c = closestOnSegment(px, pz, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    const d = dist2D(px, pz, c.x, c.z);
    if (d < best.d) best = { x: c.x, z: c.z, d, t: c.t, i };
  }
  return best;
}

export function polylineLength(pts) {
  let L = 0;
  for (let i = 0; i < pts.length - 1; i++) L += dist2D(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
  return L;
}

export function pointAlongPolyline(pts, s) {
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const seg = dist2D(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    if (acc + seg >= s) {
      const t = seg > 0 ? (s - acc) / seg : 0;
      return {
        x: lerp(pts[i][0], pts[i + 1][0], t),
        z: lerp(pts[i][1], pts[i + 1][1], t),
        dir: Math.atan2(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]),
      };
    }
    acc += seg;
  }
  const n = pts.length - 1;
  return { x: pts[n][0], z: pts[n][1], dir: Math.atan2(pts[n][0] - pts[n - 1][0], pts[n][1] - pts[n - 1][1]) };
}

export function weightedPick(entries, rand) {
  let total = 0;
  for (const e of entries) total += e.w;
  let r = rand.float() * total;
  for (const e of entries) { r -= e.w; if (r <= 0) return e.v; }
  return entries[entries.length - 1].v;
}

export function formatClock(seconds) {
  const s = ((seconds % 86400) + 86400) % 86400;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatGold(n) { return Math.round(n).toLocaleString('ru-RU'); }

export function romanNumeral(n) {
  const map = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
  return out || 'I';
}

// Пересечение луча и вертикального цилиндра — для стрел и ударов.
export function rayCylinder(ox, oy, oz, dx, dy, dz, cx, cz, radius, y0, y1) {
  const px = ox - cx, pz = oz - cz;
  const a = dx * dx + dz * dz;
  const b = 2 * (px * dx + pz * dz);
  const c = px * px + pz * pz - radius * radius;
  if (a < 1e-8) return null;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  for (const t of [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]) {
    if (t < 0) continue;
    const y = oy + dy * t;
    if (y >= y0 && y <= y1) return t;
  }
  return null;
}

// Пересечение луча и AABB (slab method) для стен и домов.
export function rayBox(ox, oy, oz, dx, dy, dz, min, max) {
  let tmin = -Infinity, tmax = Infinity;
  for (const [o, d, mn, mx] of [[ox, dx, min.x, max.x], [oy, dy, min.y, max.y], [oz, dz, min.z, max.z]]) {
    if (Math.abs(d) < 1e-8) { if (o < mn || o > mx) return null; continue; }
    let t1 = (mn - o) / d, t2 = (mx - o) / d;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return tmin >= 0 ? tmin : (tmax >= 0 ? tmax : null);
}

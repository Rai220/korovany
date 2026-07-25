// Рельеф мира: высота, зоны, дороги, меш земли.
import * as THREE from 'three';
import { fbm, smoothstep, lerp, clamp, distToPath } from './util.js';
import { MAP_HALF, ZONE_LIST, ROADS } from './config.js';

/** Выровненные площадки под поселения. */
const FLATS = [
  { x: -600, z: -600, r: 135, feather: 150, h: 4 },    // деревня эльфов
  { x:  600, z: -600, r: 185, feather: 130, h: 16 },   // дворец
  { x: -600, z:  600, r: 155, feather: 130, h: 6 },    // городок людей
  { x:  620, z:  620, r: 100, feather: 140, h: 118 },  // старый форт на горе
];

export function heightAt(x, z) {
  let h = (fbm((x + 4300) * 0.0016, (z + 1700) * 0.0016, 4) - 0.5) * 48;
  h += (fbm(x * 0.0072, z * 0.0072, 3) - 0.5) * 7;

  // Горы Злого… на юго-востоке.
  const dm = Math.hypot(x - 620, z - 620);
  const m = smoothstep(640, 110, dm);
  h += m * m * 150;

  // Пологие холмы у границ карты, чтобы мир выглядел закрытым.
  const edge = Math.max(Math.abs(x), Math.abs(z));
  h += smoothstep(760, MAP_HALF, edge) * 55;

  for (let i = 0; i < FLATS.length; i++) {
    const f = FLATS[i];
    const d = Math.hypot(x - f.x, z - f.z);
    const t = 1 - smoothstep(f.r, f.r + f.feather, d);
    h = lerp(h, f.h, t);
  }
  return h;
}

/** Крутизна склона 0..1 (1 — отвес). */
export function slopeAt(x, z) {
  const e = 1.5;
  const dx = heightAt(x + e, z) - heightAt(x - e, z);
  const dz = heightAt(x, z + e) - heightAt(x, z - e);
  return clamp(Math.hypot(dx, dz) / (2 * e), 0, 1);
}

export function normalAt(x, z, out = new THREE.Vector3()) {
  const e = 1.5;
  const dx = heightAt(x + e, z) - heightAt(x - e, z);
  const dz = heightAt(x, z + e) - heightAt(x, z - e);
  return out.set(-dx, 2 * e, -dz).normalize();
}

/** Насколько точка близка к дороге: 1 — прямо на тракте, 0 — далеко. */
export function roadFactor(x, z) {
  let best = Infinity;
  for (const r of ROADS) {
    const d = distToPath(x, z, r.path);
    if (d < best) best = d;
  }
  return 1 - smoothstep(5, 13, best);
}

export function zoneAt(x, z) {
  for (const zn of ZONE_LIST) {
    if (Math.hypot(x - zn.x, z - zn.z) < zn.r) return zn;
  }
  return { id: 'wild', name: 'Ничейные пустоши', sub: 'дороги и корованы' };
}

const C = {
  grass:  new THREE.Color(0x5d7a35),
  dark:   new THREE.Color(0x2f4a22),
  dry:    new THREE.Color(0x8a8a45),
  rock:   new THREE.Color(0x6a6055),
  stone:  new THREE.Color(0x4b4642),
  snow:   new THREE.Color(0xd8dee2),
  road:   new THREE.Color(0x6d5b3d),
  ash:    new THREE.Color(0x413a38),
};

function colorAt(x, z, h, slope, out) {
  const zn = zoneAt(x, z);
  if (zn.id === 'elf') out.copy(C.dark).lerp(C.grass, 0.25);
  else if (zn.id === 'human') out.copy(C.grass).lerp(C.dry, 0.35);
  else if (zn.id === 'palace') out.copy(C.grass).lerp(C.dark, 0.2);
  else if (zn.id === 'villain') out.copy(C.ash).lerp(C.rock, 0.5);
  else out.copy(C.grass).lerp(C.dry, 0.15);

  // Камень на крутых склонах, снег на вершинах.
  out.lerp(C.stone, smoothstep(0.35, 0.85, slope));
  out.lerp(C.snow, smoothstep(108, 140, h));

  const rf = roadFactor(x, z);
  if (rf > 0) out.lerp(C.road, rf * 0.85);

  // Лёгкая пятнистость, чтобы земля не была плоской по цвету.
  const n = fbm(x * 0.03, z * 0.03, 2);
  out.offsetHSL(0, 0, (n - 0.5) * 0.07);
  return out;
}

export function buildTerrain() {
  const SEG = 220;
  const geo = new THREE.PlaneGeometry(MAP_HALF * 2, MAP_HALF * 2, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
  }
  geo.computeVertexNormals();

  const nrm = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = pos.getY(i);
    const slope = 1 - clamp(nrm.getY(i), 0, 1);
    colorAt(x, z, h, slope, tmp);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

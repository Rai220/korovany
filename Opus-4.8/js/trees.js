// LOD-лес. Сердце ТЗ Кирилла:
//   «вдали деревья картинкой, когда подходишь они преобразовываются в 3-хмерные деревья».
// Дальние деревья — billboard-спрайты в одном InstancedMesh на каждый вариант (1 draw call).
// Ближние (в радиусе NEAR_DIST) берут из пула полноценные 3D-меши (ствол + крона).
import * as THREE from 'three';
import { treeBillboard } from './textures.js';

const NEAR_DIST = 42;       // ближе этого — превращаем в 3D
const POOL_SIZE = 64;       // сколько 3D-деревьев одновременно
const TICK = 0.08;          // как часто пересчитывать LOD (сек)
const VARIANTS = 3;

export class Forest {
  constructor(scene) {
    this.scene = scene;
    this.trees = [];           // {x,z,scale,variant,instIndex,detailed,mesh,grow}
    this.byVariant = [[], [], []];
    this.billboards = [];      // InstancedMesh на каждый вариант
    this.pool = [];            // переиспользуемые 3D-меши
    this.colliders = [];       // стволы ближних деревьев — для коллизий
    this._acc = TICK;          // чтобы билборды встали на места на первом же кадре
    this._dummy = new THREE.Object3D();
    this.materializedOnce = false;
    this.onFirstMaterialize = null;
  }

  // regions: [{x,z,r,count}] — где и сколько деревьев насыпать
  build(regions) {
    for (const reg of regions) {
      for (let i = 0; i < reg.count; i++) {
        // плотнее к центру региона
        const a = Math.random() * Math.PI * 2;
        const d = Math.pow(Math.random(), 0.6) * reg.r;
        const x = reg.x + Math.cos(a) * d;
        const z = reg.z + Math.sin(a) * d;
        const variant = (Math.random() * VARIANTS) | 0;
        const scale = 5 + Math.random() * 7;       // высота дерева
        const tree = { x, z, scale, variant, instIndex: this.byVariant[variant].length,
                       detailed: false, mesh: null, grow: 0 };
        this.byVariant[variant].push(tree);
        this.trees.push(tree);
      }
    }
    this._buildBillboards();
    this._buildPool();
  }

  _buildBillboards() {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(0, 0.5, 0); // низ на земле
    for (let v = 0; v < VARIANTS; v++) {
      const list = this.byVariant[v];
      if (!list.length) { this.billboards.push(null); continue; }
      const mat = new THREE.MeshBasicMaterial({
        map: treeBillboard(v), transparent: false, alphaTest: 0.5,
        side: THREE.DoubleSide, fog: true,
      });
      const mesh = new THREE.InstancedMesh(geo, mat, list.length);
      mesh.frustumCulled = false;
      mesh.renderOrder = 1;
      this.scene.add(mesh);
      this.billboards.push(mesh);
    }
  }

  _buildPool() {
    for (let i = 0; i < POOL_SIZE; i++) {
      const g = new THREE.Group();
      const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a3c1e });
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 1, 6), trunkMat);
      trunk.name = 'trunk';
      g.add(trunk);
      const foliMat = new THREE.MeshLambertMaterial({ color: 0x2f5a1e });
      for (let k = 0; k < 3; k++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1.4, 7), foliMat);
        cone.name = 'foli' + k;
        g.add(cone);
      }
      g.visible = false;
      g.userData.tree = null;
      this.scene.add(g);
      this.pool.push(g);
    }
  }

  _shapePoolMesh(g, tree) {
    const h = tree.scale;
    const trunkH = h * 0.45;
    const trunk = g.getObjectByName('trunk');
    trunk.scale.set(1, trunkH, 1);
    trunk.position.y = trunkH / 2;
    const greens = [0x2f5a1e, 0x356025, 0x284e1c][tree.variant];
    for (let k = 0; k < 3; k++) {
      const cone = g.getObjectByName('foli' + k);
      const r = (h * 0.5) * (1 - k * 0.26);
      const ch = h * 0.42;
      cone.scale.set(r, ch, r);
      cone.position.y = trunkH + k * (h * 0.24) + ch * 0.3;
      cone.material.color.setHex(greens);
    }
    g.position.set(tree.x, 0, tree.z);
  }

  // Пересчёт LOD относительно позиции камеры/игрока
  update(dt, camPos) {
    // плавный «рост» только что материализованных деревьев
    for (const g of this.pool) {
      if (!g.visible || !g.userData.tree) continue;
      const tree = g.userData.tree;
      if (tree.grow < 1) {
        tree.grow = Math.min(1, tree.grow + dt * 4);
        g.scale.setScalar(tree.grow);
      }
    }

    this._acc += dt;
    if (this._acc < TICK) return;
    this._acc = 0;

    // 1) найдём ближайшие деревья
    const near = [];
    const R2 = NEAR_DIST * NEAR_DIST;
    for (const t of this.trees) {
      const dx = t.x - camPos.x, dz = t.z - camPos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < R2) near.push([d2, t]);
    }
    near.sort((a, b) => a[0] - b[0]);
    const chosen = near.slice(0, POOL_SIZE).map(p => p[1]);
    const chosenSet = new Set(chosen);

    // 2) освободим пул-меши, чьи деревья больше не близко
    for (const g of this.pool) {
      const t = g.userData.tree;
      if (t && !chosenSet.has(t)) {
        t.detailed = false; t.mesh = null;
        g.visible = false; g.userData.tree = null;
      }
    }
    // 3) выдадим меши новым ближним деревьям
    let freeMeshes = this.pool.filter(g => !g.userData.tree);
    let fi = 0;
    let materializedNow = false;
    for (const t of chosen) {
      if (t.detailed) continue;
      const g = freeMeshes[fi++];
      if (!g) break;
      t.detailed = true; t.mesh = g; t.grow = 0.01;
      g.userData.tree = t;
      this._shapePoolMesh(g, t);
      g.scale.setScalar(0.01);
      g.visible = true;
      materializedNow = true;
    }
    if (materializedNow && !this.materializedOnce) {
      this.materializedOnce = true;
      if (this.onFirstMaterialize) this.onFirstMaterialize();
    }

    // 4) обновим билборды: повернём «лицом» к камере (yaw) и спрячем те, что стали 3D
    this._updateBillboards(camPos);

    // 5) коллайдеры — стволы ближних 3D-деревьев
    this.colliders.length = 0;
    for (const t of chosen) {
      if (t.detailed) this.colliders.push({ x: t.x, z: t.z, r: 0.5 });
    }
  }

  _updateBillboards(camPos) {
    const d = this._dummy;
    for (let v = 0; v < VARIANTS; v++) {
      const mesh = this.billboards[v];
      if (!mesh) continue;
      const list = this.byVariant[v];
      for (let i = 0; i < list.length; i++) {
        const t = list[i];
        d.position.set(t.x, 0, t.z);
        if (t.detailed) {
          d.scale.set(0, 0, 0); // спрятан — вместо него 3D-меш
        } else {
          const yaw = Math.atan2(camPos.x - t.x, camPos.z - t.z);
          d.rotation.set(0, yaw, 0);
          d.scale.set(t.scale * 0.9, t.scale, 1);
        }
        d.updateMatrix();
        mesh.setMatrixAt(i, d.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
}

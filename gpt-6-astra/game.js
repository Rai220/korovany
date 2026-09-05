/* КОРОВАНЫ / GPT-6 (astra). Original procedural world; no build step. */
(async () => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  let THREE;
  for (const url of [
    "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
    "https://unpkg.com/three@0.170.0/build/three.module.js",
  ]) {
    try {
      THREE = await import(url);
      break;
    } catch (_) {
      /* Try the second CDN. */
    }
  }
  if (!THREE)
    throw new Error(
      "Не удалось загрузить Three.js. Проверьте интернет и обновите страницу.",
    );
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  let seed = 6032026;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  const rand = (a, b) => a + random() * (b - a);
  const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const camps = {
    elf: {
      x: -96,
      z: -96,
      name: "Шелестящий бор",
      sub: "Деревянные дома лесных эльфов",
      color: "#8fac79",
      title: "Лесной эльф",
    },
    guard: {
      x: 96,
      z: -96,
      name: "Белый престол",
      sub: "Дворец и земли императора",
      color: "#8cabb8",
      title: "Дворцовая стража",
    },
    human: {
      x: -96,
      z: 96,
      name: "Вольный перекрёсток",
      sub: "Нейтральные земли · торговля и лечение",
      color: "#ceb47f",
      title: "Вольные люди",
    },
    evil: {
      x: 96,
      z: 96,
      name: "Безымянные горы",
      sub: "Старый форт злого. Имя не придумал.",
      color: "#b89aa7",
      title: "Злой. Имя не придумал.",
    },
  };
  const zoneAt = (x, z) =>
    z < 0 ? (x < 0 ? "elf" : "guard") : x < 0 ? "human" : "evil";
  const SAVE_KEY = "korovany:gpt-6-astra:v1";
  const canvas = $("world");
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#b7c4a7");
  scene.fog = new THREE.FogExp2("#bec5a4", 0.005);
  const camera = new THREE.PerspectiveCamera(
    70,
    innerWidth / innerHeight,
    0.08,
    650,
  );
  camera.rotation.order = "YXZ";
  scene.add(camera);
  const hemi = new THREE.HemisphereLight("#dbe2c6", "#3c5541", 2.5);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight("#ffd09b", 3.1);
  sun.position.set(-90, 135, -100);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {
    left: -65,
    right: 65,
    top: 65,
    bottom: -65,
    near: 1,
    far: 340,
  });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.07;
  scene.add(sun, sun.target);
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(590, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {},
      vertexShader:
        "varying vec3 vPos; void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader:
        "varying vec3 vPos; void main(){float h=normalize(vPos).y;vec3 low=vec3(.88,.76,.57);vec3 high=vec3(.30,.50,.53);gl_FragColor=vec4(mix(low,high,smoothstep(-.02,.65,h)),1.);}",
    }),
  );
  scene.add(sky);
  const sunDisc = new THREE.Mesh(
    new THREE.SphereGeometry(15, 24, 16),
    new THREE.MeshBasicMaterial({ color: "#fff0b4", fog: false }),
  );
  sunDisc.position.set(150, 100, -420);
  scene.add(sunDisc);
  const mats = new Map();
  function material(color, extra = {}) {
    const key = color + JSON.stringify(extra);
    if (!mats.has(key))
      mats.set(
        key,
        new THREE.MeshStandardMaterial({
          color,
          roughness: 1,
          flatShading: true,
          ...extra,
        }),
      );
    return mats.get(key);
  }
  const boxGeo = new THREE.BoxGeometry(1, 1, 1),
    coneGeo = new THREE.ConeGeometry(1, 1, 7),
    cylinderGeo = new THREE.CylinderGeometry(1, 1, 1, 7),
    icoGeo = new THREE.IcosahedronGeometry(1, 0);
  const world = new THREE.Group();
  scene.add(world);
  const colliders = [];
  function box(parent, x, y, z, w, h, d, color, shadow = true) {
    const m = new THREE.Mesh(boxGeo, material(color));
    m.position.set(x, y, z);
    m.scale.set(w, h, d);
    m.castShadow = shadow;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function shape(parent, geometry, x, y, z, sx, sy, sz, color) {
    const m = new THREE.Mesh(geometry, material(color));
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function terrain(x, z) {
    const mountain = 15 * Math.exp(-((x - 135) ** 2 + (z - 125) ** 2) / 5000);
    const soft = Math.sin(x * 0.035) * Math.cos(z * 0.028) * 1.1;
    let h = soft + mountain;
    for (const c of Object.values(camps)) {
      const d = Math.hypot(x - c.x, z - c.z);
      const flat = c === camps.evil ? 8 : 0;
      const f = 1 - clamp((d - 32) / 25, 0, 1);
      h = h * (1 - f) + flat * f;
    }
    return h;
  }
  function blocker(x, z, w, d) {
    colliders.push({ x, z, w: w / 2, d: d / 2 });
  }
  function blocked(x, z, r = 0.5) {
    for (const c of colliders) {
      if (c.r) {
        if ((x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + r) ** 2) return true;
      } else if (Math.abs(x - c.x) < c.w + r && Math.abs(z - c.z) < c.d + r)
        return true;
    }
    return false;
  }
  const terrainGeo = new THREE.PlaneGeometry(420, 420, 112, 112);
  terrainGeo.rotateX(-Math.PI / 2);
  const positions = terrainGeo.attributes.position;
  const colors = [];
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i),
      z = positions.getZ(i);
    positions.setY(i, terrain(x, z));
    const key = zoneAt(x, z);
    const c = new THREE.Color(
      { elf: "#567359", guard: "#929767", human: "#9a9566", evil: "#777a6b" }[
        key
      ],
    );
    c.multiplyScalar(rand(0.9, 1.08));
    colors.push(c.r, c.g, c.b);
  }
  terrainGeo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();
  const ground = new THREE.Mesh(
    terrainGeo,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      flatShading: true,
    }),
  );
  ground.receiveShadow = true;
  world.add(ground);
  const route = [
    { x: -72, z: -68 },
    { x: 72, z: -68 },
    { x: 72, z: 68 },
    { x: -72, z: 68 },
  ];
  const roads = [];
  for (let i = 0; i < route.length; i++)
    roads.push([route[i], route[(i + 1) % route.length]]);
  roads.push(
    [
      { x: -72, z: 0 },
      { x: 72, z: 0 },
    ],
    [
      { x: 0, z: -68 },
      { x: 0, z: 68 },
    ],
  );
  for (const c of Object.values(camps))
    roads.push([
      { x: c.x, z: c.z + 18 },
      { x: c.x < 0 ? -72 : 72, z: c.z < 0 ? -68 : 68 },
    ]);
  function segmentDistance(x, z, a, b) {
    const dx = b.x - a.x,
      dz = b.z - a.z,
      t = clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz), 0, 1);
    return Math.hypot(x - a.x - t * dx, z - a.z - t * dz);
  }
  for (const [a, b] of roads) {
    const n = Math.ceil(distance(a, b) / 3),
      verts = [],
      ids = [];
    const dx = b.x - a.x,
      dz = b.z - a.z,
      len = Math.hypot(dx, dz),
      px = (-dz / len) * 3.3,
      pz = (dx / len) * 3.3;
    for (let i = 0; i <= n; i++) {
      const x = a.x + (dx * i) / n,
        z = a.z + (dz * i) / n;
      verts.push(
        x - px,
        terrain(x - px, z - pz) + 0.055,
        z - pz,
        x + px,
        terrain(x + px, z + pz) + 0.055,
        z + pz,
      );
      if (i < n) {
        const j = i * 2;
        ids.push(j, j + 2, j + 1, j + 1, j + 2, j + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    g.setIndex(ids);
    g.computeVertexNormals();
    const road = new THREE.Mesh(g, material("#b29d73"));
    road.receiveShadow = true;
    world.add(road);
  }
  function label(text, color = "#f3dc9c", w = 5) {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 96;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#182b25cc";
    ctx.fillRect(0, 12, 512, 72);
    ctx.font = "30px Georgia";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText(text, 256, 49);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: tex,
        depthTest: true,
        transparent: true,
      }),
    );
    s.scale.set(w, (w * 96) / 512, 1);
    return s;
  }
  function flag(parent, x, y, z, color, size = 1) {
    shape(parent, cylinderGeo, x, y / 2, z, 0.075, y, 0.075, "#615b49");
    box(
      parent,
      x + size * 0.7,
      y - 0.55,
      z,
      size * 1.4,
      1.8 * size,
      0.06,
      color,
    );
    box(parent, x + size * 0.7, y - 0.55, z, 0.12, 1.1 * size, 0.08, "#d7bd80");
  }
  function house(x, z, scale = 1, elf = true) {
    const g = new THREE.Group();
    g.position.set(x, terrain(x, z), z);
    g.scale.setScalar(scale);
    world.add(g);
    box(g, 0, 0.3, 0, 8, 0.6, 7, "#696e57");
    box(g, 0, 2.3, 0, 7, 4, 6, elf ? "#8b6548" : "#c2ae85");
    for (let i = 0; i < 8; i++)
      box(g, 0, 0.6 + i * 0.47, 3.05, 7, 0.1, 0.1, "#644b38");
    for (const a of [-3.45, 3.45])
      for (const b of [-2.95, 2.95])
        box(g, a, 2.3, b, 0.27, 4.5, 0.27, "#503e30");
    const roof = shape(
      g,
      new THREE.ConeGeometry(1, 1, 4),
      0,
      5.25,
      0,
      5.9,
      3.2,
      5.2,
      elf ? "#466d5f" : "#94694e",
    );
    roof.rotation.y = Math.PI / 4;
    box(g, 0, 1.5, 3.1, 1.5, 2.8, 0.2, "#3e392c");
    for (const a of [-2.2, 2.2]) {
      box(g, a, 2.3, 3.1, 1.25, 1.35, 0.14, "#dcb37a");
      box(g, a, 2.3, 3.2, 0.12, 1.4, 0.13, "#554835");
      box(g, a, 2.3, 3.2, 1.3, 0.13, 0.13, "#554835");
    }
    box(g, 0, 0.3, 4.1, 2.2, 0.4, 1.8, "#8b7351");
    blocker(x, z, 7 * scale, 6 * scale);
    return g;
  }
  house(-111, -104, 1.1);
  house(-119, -81, 0.85);
  house(-83, -113, 1.15);
  house(-68, -100, 0.8);
  house(-110, 91, 1, false);
  house(-85, 107, 1.1, false);
  house(-119, 113, 0.8, false);
  house(-78, 89, 0.8, false);
  function fortress(c, ruin) {
    const g = new THREE.Group();
    g.position.set(c.x, terrain(c.x, c.z), c.z);
    world.add(g);
    const stone = ruin ? "#696970" : "#c0bba0",
      roof = ruin ? "#514d60" : "#526e73";
    for (const x of [-19, 19])
      for (const z of [-18, 18]) {
        shape(g, cylinderGeo, x, 7, z, 3.5, 14, 3.5, stone);
        shape(g, coneGeo, x, 16, z, 4.5, 5, 4.5, roof);
        blocker(c.x + x, c.z + z, 6, 6);
        for (let k = 0; k < 6; k++) {
          const a = (k * Math.PI) / 3;
          box(
            g,
            x + Math.cos(a) * 3.3,
            14,
            z + Math.sin(a) * 3.3,
            0.9,
            1.3,
            0.9,
            stone,
          );
        }
      }
    for (const x of [-19, 19]) {
      box(g, x, 4, 0, 1.7, 8, 36, stone);
      blocker(c.x + x, c.z, 1.7, 36);
    }
    box(g, 0, 4, -18, 38, 8, 1.7, stone);
    blocker(c.x, c.z - 18, 38, 1.7);
    for (const x of [-12, 12]) {
      box(g, x, 4, 18, 14, 8, 1.7, stone);
      blocker(c.x + x, c.z + 18, 14, 1.7);
    }
    box(g, 0, 8, 18, 10, 3, 2, stone);
    for (let x = -17; x <= 17; x += 3) {
      box(g, x, 8.5, -18, 1.3, 1.7, 1.8, stone);
      if (Math.abs(x) > 5) box(g, x, 8.5, 18, 1.3, 1.7, 1.8, stone);
    }
    box(g, 0, 7, -6, 15, 14, 13, stone);
    blocker(c.x, c.z - 6, 15, 13);
    const top = shape(
      g,
      new THREE.ConeGeometry(1, 1, 4),
      0,
      16,
      -6,
      12,
      5,
      10,
      roof,
    );
    top.rotation.y = Math.PI / 4;
    for (const x of [-4, 0, 4]) {
      box(g, x, 8, 0.56, 1.2, 3, 0.2, "#404e47");
      box(g, x, 12, 0.56, 1, 1.7, 0.2, "#404e47");
    }
    flag(g, -5, 12, 19.2, ruin ? "#a65c65" : "#a46549", 1.4);
    flag(g, 5, 12, 19.2, ruin ? "#a65c65" : "#a46549", 1.4);
    if (ruin)
      for (let i = 0; i < 12; i++)
        shape(
          g,
          icoGeo,
          rand(-15, 15),
          0.6,
          rand(5, 14),
          rand(0.6, 1.5),
          rand(0.4, 1),
          rand(0.5, 1.3),
          "#76747a",
        );
    return g;
  }
  fortress(camps.guard, false);
  fortress(camps.evil, true);
  // Mountain silhouettes and rocky spires. The playable slope remains walkable.
  for (let i = 0; i < 52; i++) {
    const angle = rand(0, Math.PI * 2),
      radius = rand(239, 330),
      h = rand(24, 83);
    shape(
      world,
      coneGeo,
      Math.cos(angle) * radius,
      h * 0.25 - 13,
      Math.sin(angle) * radius,
      rand(21, 48),
      h,
      rand(20, 44),
      i % 2 ? "#879b90" : "#708b86",
    );
  }
  for (let i = 0; i < 23; i++) {
    const x = rand(40, 195),
      z = rand(40, 195);
    if (
      distance({ x, z }, camps.evil) < 40 ||
      roads.some(([a, b]) => segmentDistance(x, z, a, b) < 9)
    )
      continue;
    const r = rand(3, 8);
    shape(
      world,
      icoGeo,
      x,
      terrain(x, z) + r * 0.5,
      z,
      r,
      rand(6, 16),
      r,
      "#797b77",
    );
    colliders.push({ x, z, r: r * 0.7 });
  }
  const merchants = [];
  function stall(key) {
    const c = camps[key],
      x = c.x - 10,
      z = c.z + 24,
      g = new THREE.Group();
    g.position.set(x, terrain(x, z), z);
    world.add(g);
    for (const dx of [-2.5, 2.5])
      for (const dz of [-1.4, 1.4])
        box(g, dx, 1.8, dz, 0.13, 3.6, 0.13, "#66513a");
    box(g, 0, 3.7, 0, 5.8, 0.25, 3.6, "#d4bc80");
    for (let i = 0; i < 6; i++)
      box(
        g,
        -2.4 + i * 0.96,
        3.8,
        0,
        0.48,
        0.08,
        3.7,
        key === "evil" ? "#976d73" : "#5c8f78",
      );
    box(g, 0, 0.9, 0, 5, 1.5, 1.5, "#805d3c");
    for (let i = 0; i < 5; i++)
      shape(
        g,
        icoGeo,
        -1.8 + i * 0.8,
        1.8,
        0,
        0.28,
        0.3,
        0.28,
        i % 2 ? "#b6a35e" : "#a8644b",
      );
    const l = label("ЛАВКА · ЛЕКАРЬ");
    l.position.set(0, 4.6, 0);
    g.add(l);
    blocker(x, z, 5, 1.5);
    merchants.push({ x, z: z + 2.8, key });
  }
  Object.keys(camps).forEach(stall);
  // Distant canvas picture and nearby solid trees share a silhouette and size.
  const treeCanvas = document.createElement("canvas");
  treeCanvas.width = 128;
  treeCanvas.height = 256;
  const tc = treeCanvas.getContext("2d");
  tc.fillStyle = "#64503a";
  tc.fillRect(59, 139, 10, 112);
  for (const [y, w, h, c] of [
    [114, 118, 100, "#34564c"],
    [64, 99, 113, "#3e6656"],
    [9, 72, 128, "#547b61"],
  ]) {
    tc.fillStyle = c;
    tc.beginPath();
    tc.moveTo(64, y);
    tc.lineTo(64 + w / 2, y + h);
    tc.lineTo(64 - w / 2, y + h);
    tc.closePath();
    tc.fill();
    tc.fillStyle = "#ffffff0a";
    tc.beginPath();
    tc.moveTo(64, y);
    tc.lineTo(64, y + h);
    tc.lineTo(64 - w / 2, y + h);
    tc.closePath();
    tc.fill();
  }
  const treeTexture = new THREE.CanvasTexture(treeCanvas);
  treeTexture.colorSpace = THREE.SRGBColorSpace;
  const trees = [];
  for (let i = 0; i < 1450; i++) {
    const x = rand(-202, 202),
      z = rand(-202, 202);
    if (zoneAt(x, z) !== "elf" && random() < 0.86) continue;
    if (
      Object.values(camps).some((c) => distance({ x, z }, c) < 29) ||
      roads.some(([a, b]) => segmentDistance(x, z, a, b) < 5.8) ||
      blocked(x, z, 2)
    )
      continue;
    const h = rand(9, 18);
    trees.push({ x, z, y: terrain(x, z), h, r: rand(0, 6.28) });
    colliders.push({ x, z, r: 0.48 });
  }
  // Add the dense outer forest deliberately: broad clearing at the village, narrow road.
  for (let i = 0; i < 780; i++) {
    const x = rand(-204, -7),
      z = rand(-204, -7);
    if (
      distance({ x, z }, camps.elf) < 30 ||
      roads.some(([a, b]) => segmentDistance(x, z, a, b) < 5.5) ||
      blocked(x, z, 1.9)
    )
      continue;
    trees.push({ x, z, y: terrain(x, z), h: rand(10, 18), r: rand(0, 6.28) });
    colliders.push({ x, z, r: 0.48 });
  }
  const farTrees = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: treeTexture,
      alphaTest: 0.45,
      side: THREE.DoubleSide,
      fog: true,
    }),
    trees.length,
  );
  farTrees.frustumCulled = false;
  world.add(farTrees);
  const treeTrunks = new THREE.InstancedMesh(
    cylinderGeo,
    material("#675740"),
    trees.length,
  );
  treeTrunks.frustumCulled = false;
  treeTrunks.castShadow = true;
  world.add(treeTrunks);
  const crowns = ["#34564c", "#3e6656", "#547b61"].map((color) => {
    const mesh = new THREE.InstancedMesh(
      coneGeo,
      material(color),
      trees.length,
    );
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    world.add(mesh);
    return mesh;
  });
  const dummy = new THREE.Object3D();
  let lodStats = { near: 0, far: 0, total: trees.length };
  function matrix(mesh, index, x, y, z, sx, sy, sz, rotation = 0) {
    dummy.position.set(x, y, z);
    dummy.scale.set(sx, sy, sz);
    dummy.rotation.set(0, rotation, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  }
  function updateTrees() {
    let near = 0,
      far = 0;
    for (const t of trees) {
      const d = Math.hypot(t.x - camera.position.x, t.z - camera.position.z);
      if (d > 285) continue;
      if (d < 48) {
        matrix(
          treeTrunks,
          near,
          t.x,
          t.y + t.h * 0.25,
          t.z,
          0.24,
          t.h * 0.5,
          0.24,
          t.r,
        );
        [
          [0.47, 0.24, 0.39],
          [0.65, 0.2, 0.44],
          [0.8, 0.145, 0.5],
        ].forEach(([y, w, h], j) =>
          matrix(
            crowns[j],
            near,
            t.x,
            t.y + t.h * y,
            t.z,
            t.h * w,
            t.h * h,
            t.h * w,
            t.r,
          ),
        );
        near++;
      } else {
        matrix(
          farTrees,
          far++,
          t.x,
          t.y + t.h * 0.5,
          t.z,
          t.h * 0.5,
          t.h,
          1,
          Math.atan2(camera.position.x - t.x, camera.position.z - t.z),
        );
      }
    }
    farTrees.count = far;
    treeTrunks.count = near;
    for (const m of [farTrees, treeTrunks, ...crowns]) {
      if (crowns.includes(m)) m.count = near;
      m.instanceMatrix.needsUpdate = true;
    }
    lodStats = { near, far, total: trees.length };
  }
  // Ground details in two instanced batches.
  const rocks = new THREE.InstancedMesh(icoGeo, material("#8a9271"), 380);
  world.add(rocks);
  for (let i = 0; i < 380; i++) {
    const x = rand(-195, 195),
      z = rand(-195, 195),
      s = rand(0.2, 0.8);
    matrix(rocks, i, x, terrain(x, z) + s * 0.1, z, s, s * 0.65, s, rand(0, 6));
  }
  const grass = new THREE.InstancedMesh(coneGeo, material("#9fa87a"), 1400);
  world.add(grass);
  for (let i = 0; i < 1400; i++) {
    const x = rand(-194, 194),
      z = rand(-194, 194);
    matrix(
      grass,
      i,
      x,
      terrain(x, z) + 0.16,
      z,
      0.12,
      rand(0.2, 0.65),
      0.12,
      rand(0, 6),
    );
  }
  const motesGeo = new THREE.BufferGeometry(),
    motePos = [];
  for (let i = 0; i < 110; i++)
    motePos.push(rand(-155, -35), rand(1, 10), rand(-150, -25));
  motesGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(motePos, 3),
  );
  const motes = new THREE.Points(
    motesGeo,
    new THREE.PointsMaterial({
      color: "#ffe1a3",
      size: 0.13,
      transparent: true,
      opacity: 0.7,
    }),
  );
  scene.add(motes);
  const actors = [],
    debris = [],
    traces = [];
  let actorID = 1;
  const uniforms = {
    elf: "#557c57",
    guard: "#6e919d",
    evil: "#8c5968",
    human: "#af9867",
  };
  function humanoid(faction, commander = false) {
    const g = new THREE.Group(),
      parts = {};
    const skin = "#c5a079",
      cloth = uniforms[faction];
    parts.body = box(g, 0, 1.22, 0, 0.65, 0.75, 0.38, cloth);
    box(g, 0, 0.91, 0, 0.69, 0.13, 0.42, "#514735");
    parts.head = box(g, 0, 1.88, 0, 0.4, 0.43, 0.38, skin);
    box(
      g,
      0,
      2.1,
      0,
      0.46,
      0.12,
      0.44,
      faction === "guard" ? "#b6b6a4" : cloth,
    );
    for (const x of [-0.1, 0.1])
      box(
        parts.head,
        x / 0.4,
        0.035 / 0.43,
        -0.195 / 0.38,
        0.06 / 0.4,
        0.06 / 0.43,
        0.02 / 0.38,
        "#302f28",
      );
    for (const [name, x] of [
      ["arm", -0.46],
      ["otherArm", 0.46],
    ]) {
      const joint = new THREE.Group();
      joint.position.set(x, 1.5, 0);
      g.add(joint);
      box(joint, 0, -0.32, 0, 0.21, 0.65, 0.25, cloth);
      box(joint, 0, -0.67, 0, 0.2, 0.17, 0.2, skin);
      parts[name] = joint;
    }
    for (const [name, x] of [
      ["leg", -0.19],
      ["otherLeg", 0.19],
    ]) {
      const joint = new THREE.Group();
      joint.position.set(x, 0.9, 0);
      g.add(joint);
      box(joint, 0, -0.41, 0, 0.24, 0.78, 0.28, "#484e3b");
      box(joint, 0, -0.83, -0.08, 0.28, 0.18, 0.44, "#4d4031");
      parts[name] = joint;
    }
    box(parts.otherArm, 0, -0.73, -0.4, 0.065, 0.065, 0.9, "#ced0b4");
    box(parts.otherArm, 0, -0.73, -0.11, 0.33, 0.08, 0.08, "#b69e61");
    const cape = box(
      g,
      0,
      1.24,
      0.24,
      0.7,
      0.9,
      0.08,
      commander ? "#c69859" : cloth,
    );
    cape.rotation.x = 0.12;
    if (faction === "evil")
      for (const x of [-0.26, 0.26])
        shape(g, coneGeo, x, 2.25, 0, 0.09, 0.39, 0.09, "#c5b69b");
    if (faction === "elf") {
      for (const x of [-0.29, 0.29])
        shape(g, coneGeo, x, 1.94, 0, 0.1, 0.25, 0.08, skin);
    }
    if (commander) shape(g, coneGeo, 0, 2.28, 0, 0.16, 0.35, 0.16, "#d7b264");
    return { group: g, parts };
  }
  function spawn(faction, x, z, options = {}) {
    if (blocked(x, z, 0.4)) {
      let found = false;
      for (let r = 1; r < 8 && !found; r++)
        for (let i = 0; i < 12; i++) {
          const nx = x + Math.cos((i * Math.PI) / 6) * r,
            nz = z + Math.sin((i * Math.PI) / 6) * r;
          if (!blocked(nx, nz, 0.4)) {
            x = nx;
            z = nz;
            found = true;
            break;
          }
        }
    }
    const model = humanoid(faction, options.commander),
      a = {
        id: actorID++,
        faction,
        x,
        z,
        health: options.commander ? 120 : 68,
        maxHealth: options.commander ? 120 : 68,
        home: { x, z },
        cooldown: rand(0.2, 1.4),
        dead: false,
        arm: false,
        leg: false,
        eye: false,
        loot: false,
        mode: "guard",
        ...options,
        ...model,
      };
    a.group.position.set(x, terrain(x, z), z);
    a.group.rotation.y = rand(0, 6.28);
    world.add(a.group);
    a.group.traverse((m) => {
      if (m.isMesh) m.userData.actorId = a.id;
    });
    actors.push(a);
    return a;
  }
  function removeActor(a) {
    world.remove(a.group);
    const i = actors.indexOf(a);
    if (i >= 0) actors.splice(i, 1);
  }
  function sever(a, part) {
    if (a[part]) return;
    a[part] = true;
    const mesh = a.parts[part === "eye" ? "head" : part];
    if (part === "eye") {
      box(
        a.parts.head,
        -0.11 / 0.4,
        0.03 / 0.43,
        -0.2 / 0.38,
        0.13 / 0.4,
        0.1 / 0.43,
        0.04 / 0.38,
        "#77382f",
      );
      return;
    }
    a.group.updateMatrixWorld(true);
    const piece = mesh.clone();
    scene.add(piece);
    piece.position.copy(mesh.getWorldPosition(new THREE.Vector3()));
    piece.quaternion.copy(mesh.getWorldQuaternion(new THREE.Quaternion()));
    piece.scale.copy(mesh.getWorldScale(new THREE.Vector3()));
    mesh.visible = false;
    debris.push({
      mesh: piece,
      vx: rand(-2, 2),
      vz: rand(-2, 2),
      vy: 3,
      life: 40,
    });
    if (debris.length > 24) scene.remove(debris.shift().mesh);
  }
  function kill(a, credit = false) {
    if (a.dead) return;
    a.dead = true;
    a.health = 0;
    a.group.rotation.z = Math.PI / 2;
    a.group.position.y = terrain(a.x, a.z) + 0.35;
    a.group.rotation.y = rand(0, 6.28);
    if (credit) {
      P.kills++;
      P.gold += 8;
      if (a.mission === P.missionTag) P.missionKills++;
      sound("kill");
      notify("Враг повержен · +8 золотых. Тело можно обыскать.");
    }
    const dead = actors.filter((e) => e.dead);
    if (dead.length > 20) removeActor(dead[0]);
  }
  function hurtActor(a, amount, part = "arm", credit = true) {
    if (a.dead) return;
    a.health -= amount;
    if (!a[part] && (amount >= 30 || a.health < 25)) {
      sever(a, part);
    }
    a.aggro = true;
    if (a.health <= 0) kill(a, credit);
    else {
      a.group.scale.set(1.08, 1, 1.08);
      a.hitFlash = 0.13;
    }
  }
  const caravans = [];
  function makeCaravan(index) {
    const g = new THREE.Group();
    world.add(g);
    box(g, 0, 1.0, 0, 2.8, 0.38, 4.5, "#785437");
    box(g, 0, 1.7, 0, 2.7, 1, 4, "#a98759");
    for (let i = 0; i < 5; i++)
      box(g, 0, 1.3 + i * 0.22, 0, 2.85, 0.06, 4.1, "#614c37");
    const cover = shape(
      g,
      new THREE.CylinderGeometry(1, 1, 1, 10, 1, false, 0, Math.PI),
      0,
      2.5,
      0,
      1.65,
      4.3,
      1.65,
      "#dbcb9e",
    );
    cover.rotation.x = Math.PI / 2;
    for (const x of [-1.6, 1.6])
      for (const z of [-1.45, 1.45]) {
        const wheel = shape(
          g,
          new THREE.TorusGeometry(0.68, 0.13, 5, 10),
          x,
          0.72,
          z,
          1,
          1,
          1,
          "#4e4738",
        );
        wheel.rotation.y = Math.PI / 2;
        for (let k = 0; k < 4; k++) {
          const spoke = box(g, x, 0.72, z, 0.12, 1.3, 0.1, "#826b49");
          spoke.rotation.x = (k * Math.PI) / 4;
        }
      }
    box(g, 0, 0.9, -3.1, 0.15, 0.15, 2.9, "#725937");
    // A little low-poly ox pulls each wagon.
    box(g, 0, 1.25, -4.7, 1.15, 0.95, 2, "#ae9369");
    box(g, 0, 1.65, -5.75, 0.75, 0.72, 0.83, "#bca17a");
    box(g, 0, 1.47, -6.13, 0.8, 0.32, 0.3, "#7d6c4e");
    for (const x of [-0.4, 0.4])
      for (const z of [-4, -5.3]) box(g, x, 0.55, z, 0.23, 1, 0.24, "#6b6046");
    for (const x of [-0.55, 0.55]) {
      const horn = shape(g, coneGeo, x, 2.05, -5.75, 0.1, 0.6, 0.1, "#e0d3aa");
      horn.rotation.z = x < 0 ? 0.8 : -0.8;
    }
    const l = label("КОРОВАН · ТОРГОВЫЙ СОЮЗ", "#f0d79a", 6);
    l.position.set(0, 4, 0);
    g.add(l);
    const c = {
      id: index,
      x: 0,
      z: 0,
      segment: index ? 2 : 0,
      t: index ? 0.35 : 0.12,
      robbed: false,
      hostile: false,
      cooldown: 0,
      group: g,
      escorts: [],
    };
    caravans.push(c);
    positionCaravan(c);
    return c;
  }
  function positionCaravan(c) {
    const a = route[c.segment],
      b = route[(c.segment + 1) % 4];
    c.x = a.x + (b.x - a.x) * c.t;
    c.z = a.z + (b.z - a.z) * c.t;
    c.group.position.set(c.x, terrain(c.x, c.z), c.z);
    c.group.rotation.y = Math.atan2(-(b.x - a.x), -(b.z - a.z));
  }
  makeCaravan(0);
  makeCaravan(1);
  const beacon = new THREE.Group();
  beacon.position.set(96, terrain(96, -88), -88);
  world.add(beacon);
  flag(beacon, 0, 6, 0, "#c5905b", 1.1);
  const beaconLabel = label("ЗНАМЯ ИМПЕРАТОРА", "#f0d79a", 5);
  beaconLabel.position.set(0, 7, 0);
  beacon.add(beaconLabel);
  const chairRig = new THREE.Group();
  camera.add(chairRig);
  const chairWheels = [];
  for (const x of [-0.52, 0.52]) {
    const wheel = shape(
      chairRig,
      new THREE.TorusGeometry(0.48, 0.05, 5, 18),
      x,
      -0.65,
      0.06,
      1,
      1,
      1,
      "#655743",
    );
    wheel.rotation.y = Math.PI / 2;
    chairWheels.push(wheel);
    box(chairRig, x, -0.35, -0.1, 0.09, 0.08, 0.65, "#947c55");
  }
  box(chairRig, 0, -1.03, -0.6, 0.75, 0.06, 0.4, "#927b56");
  chairRig.visible = false;
  const weaponRig = new THREE.Group();
  camera.add(weaponRig);
  const sword = new THREE.Group();
  weaponRig.add(sword);
  box(sword, 0.43, -0.65, -0.7, 0.19, 0.48, 0.2, "#776347");
  box(sword, 0.43, -0.38, -0.72, 0.09, 0.28, 0.08, "#574931");
  box(sword, 0.43, -0.26, -0.72, 0.36, 0.07, 0.1, "#b4a16a");
  box(sword, 0.43, 0.17, -0.72, 0.105, 0.8, 0.045, "#c4d1c6");
  shape(sword, coneGeo, 0.43, 0.62, -0.72, 0.062, 0.18, 0.03, "#dfe5d0");
  sword.rotation.z = -0.15;
  const bow = new THREE.Group();
  weaponRig.add(bow);
  const bowArc = new THREE.Mesh(
    new THREE.TorusGeometry(0.47, 0.026, 5, 20, Math.PI),
    material("#ac8150"),
  );
  bowArc.rotation.z = -Math.PI / 2;
  bowArc.position.set(0.42, -0.16, -0.73);
  bow.add(bowArc);
  box(bow, 0.42, -0.16, -0.73, 0.012, 0.94, 0.012, "#d8c999");
  box(bow, 0.41, -0.16, -1.01, 0.028, 0.028, 0.9, "#bba874");
  box(bow, 0.42, -0.48, -0.64, 0.19, 0.4, 0.2, "#776347");
  bow.visible = false;
  let P = null,
    started = false,
    selected = "elf",
    paused = false,
    activeModal = "",
    time = 0,
    raidTimer = 75,
    autoSaveTimer = 0,
    attackCooldown = 0,
    swing = 0,
    hurtFlash = 0,
    walkPhase = 0,
    lastZone = "",
    sensitivity = 0.0022,
    quality = "auto",
    renderScale = Math.min(devicePixelRatio, 1.5),
    qualityTimer = 0;
  const keys = new Set();
  let mouseDown = false,
    blocking = false,
    dragLook = false;
  const notices = [];
  let audioContext = null,
    audioEnabled = true;
  function sound(type) {
    if (!audioEnabled) return;
    try {
      audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === "suspended")
        audioContext.resume().catch(() => {});
      const osc = audioContext.createOscillator(),
        gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.type = type === "hit" ? "sawtooth" : "triangle";
      const f =
        { hit: 120, kill: 80, coin: 740, heal: 440, bow: 190, click: 340 }[
          type
        ] || 220;
      osc.frequency.setValueAtTime(f, audioContext.currentTime);
      osc.frequency.exponentialRampToValueAtTime(
        f * 0.45,
        audioContext.currentTime + 0.14,
      );
      gain.gain.setValueAtTime(0.045, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + 0.18,
      );
      osc.start();
      osc.stop(audioContext.currentTime + 0.2);
    } catch (_) {
      audioEnabled = false;
    }
  }
  function notify(text) {
    if (activeModal && $("modal-status")) $("modal-status").textContent = text;
    notices.push({ text, expires: time + 6 });
    while (notices.length > 3) notices.shift();
    drawNotices();
  }
  function drawNotices() {
    $("announcements").replaceChildren(
      ...notices.map((n) => {
        const el = document.createElement("div");
        el.textContent = n.text;
        return el;
      }),
    );
  }
  function newPlayer(faction) {
    const c = camps[faction];
    return {
      faction,
      x: c.x,
      z: c.z + 30,
      y: 0,
      vy: 0,
      yaw: faction === "elf" ? -0.25 : 0,
      pitch: 0,
      health: 100,
      stamina: 100,
      gold: faction === "evil" ? 160 : 100,
      bandages: 4,
      arrows: 30,
      arm: "ok",
      eye: "ok",
      leg: "ok",
      bleed: 0,
      wheel: false,
      armor: 0,
      upgrade: 0,
      weapon: faction === "elf" ? 2 : 1,
      kills: 0,
      robberies: 0,
      chapter: 0,
      missionKills: 0,
      missionTag: "",
      squadOrder: "follow",
      baseHealth: 100,
      captured: false,
      completed: false,
      injuryCooldown: 0,
      lastSafe: { x: c.x, z: c.z + 30 },
    };
  }
  function resetWorld() {
    for (const a of [...actors]) removeActor(a);
    for (const d of debris) scene.remove(d.mesh);
    debris.length = 0;
    for (const t of traces) scene.remove(t.mesh);
    traces.length = 0;
    notices.length = 0;
    actorID = 1;
    for (const [key, c] of Object.entries(camps)) {
      if (key === "human") continue;
      for (let i = 0; i < 4; i++)
        spawn(key, c.x - 12 + i * 8, c.z + 23 + (i % 2) * 3);
    }
    spawn("guard", 87, -84, { commander: true, role: "commander" });
    for (const c of caravans) {
      c.segment = c.id ? 2 : 0;
      c.t = c.id ? 0.35 : 0.12;
      c.robbed = false;
      c.hostile = false;
      c.cooldown = 0;
      c.escorts = [];
      positionCaravan(c);
      for (let i = 0; i < 2; i++)
        c.escorts.push(
          spawn("human", c.x + (i ? 4 : -4), c.z + 3, {
            caravan: c.id,
            mode: "escort",
          }).id,
        );
    }
  }
  function begin(faction, saved = null) {
    P = newPlayer(faction);
    resetWorld();
    time = 0;
    raidTimer = 75;
    autoSaveTimer = 0;
    attackCooldown = 0;
    swing = 0;
    hurtFlash = 0;
    mouseDown = false;
    blocking = false;
    keys.clear();
    if (saved) {
      Object.assign(P, saved.player);
      raidTimer = saved.raidTimer;
      time = saved.time;
      for (const a of [...actors]) removeActor(a);
      for (const raw of saved.actors) {
        const { arm, leg, eye, dead, ...data } = raw;
        const a = spawn(raw.faction, raw.x, raw.z, data);
        a.arm = false;
        a.leg = false;
        a.eye = false;
        for (const part of ["arm", "leg", "eye"]) if (raw[part]) sever(a, part);
        if (dead) kill(a, false);
      }
      actorID = Math.max(1, ...actors.map((a) => a.id)) + 1;
      for (const c of caravans) {
        Object.assign(
          c,
          saved.caravans.find((s) => s.id === c.id),
        );
        positionCaravan(c);
      }
    } else if (faction === "evil") {
      for (let i = 0; i < 4; i++)
        spawn("evil", P.x - 5 + i * 3, P.z + 3, {
          squad: true,
          mode: "follow",
        });
      notify("Четыре воина ждут приказа. C — командование.");
    } else if (faction === "elf") {
      startMissionRaid("elf", 3);
      notify("Дозорные заметили солдат. Защитите деревянные дома!");
    } else
      notify("Командир ждёт во дворе. Подойдите к золотому шлему и нажмите E.");
    beacon.children.forEach((o) => {
      if (o.isMesh && o.geometry === boxGeo)
        o.material = material(P.captured ? uniforms[P.faction] : "#c5905b");
    });
    started = true;
    paused = false;
    activeModal = "";
    $("menu").hidden = true;
    $("hud").hidden = false;
    $("modal").hidden = true;
    $("capture").hidden = true;
    lastZone = "";
    updateCamera(0);
    updateTrees();
    updateHUD();
    requestLock();
    sound("click");
  }
  function requestLock() {
    if (!started || paused || P.health <= 0) return;
    try {
      const promise = canvas.requestPointerLock();
      if (promise?.catch)
        promise.catch(() => {
          $("capture").hidden = false;
        });
    } catch (_) {
      $("capture").hidden = false;
    }
  }
  function damagePlayer(amount) {
    if (!P || P.health <= 0) return;
    const mitigated =
      amount * (1 - P.armor * 0.16) * (blocking && P.stamina > 5 ? 0.25 : 1);
    if (blocking) P.stamina = Math.max(0, P.stamina - 8);
    P.health -= mitigated;
    hurtFlash = 0.6;
    sound("hit");
    if (
      !blocking &&
      P.health < 83 &&
      P.injuryCooldown <= 0 &&
      random() < 0.23
    ) {
      const choices = ["arm", "eye", "leg"].filter((p) => P[p] === "ok");
      if (choices.length)
        injurePlayer(choices[Math.floor(random() * choices.length)]);
    }
    if (P.health <= 0) die();
  }
  function injurePlayer(part) {
    if (P[part] !== "ok") return;
    P[part] = "missing";
    P.injuryCooldown = 20;
    if (part === "eye")
      notify("Глаз потерян. Половина обзора закрыта. Нужен стеклянный глаз.");
    else {
      P.bleed += part === "arm" ? 2 : 1.6;
      notify(
        part === "arm"
          ? "Рука отсечена! Q — остановить кровотечение, затем купить протез."
          : "Нога отсечена! Q — перевязка. Теперь вы можете ползти; купите коляску или протез.",
      );
    }
    hurtFlash = 1;
    updateHUD();
  }
  function bandage() {
    if (!P || P.health <= 0) return;
    if (P.bandages < 1) {
      notify("Бинты закончились. Лекарь есть в каждой земле.");
      return;
    }
    if (P.health >= 100 && P.bleed === 0) {
      notify("Перевязка пока не нужна.");
      return;
    }
    P.bandages--;
    P.bleed = 0;
    P.health = Math.min(100, P.health + 38);
    notify("Рана перевязана. Кровотечение остановлено. +38 здоровья.");
    sound("heal");
    updateHUD();
  }
  function die() {
    P.health = 0;
    mouseDown = false;
    blocking = false;
    openModal(
      "death",
      "Тракт помнит ваше имя",
      "<p>Вы пали. " +
        (P.bleed > 0
          ? "Кровотечение оказалось смертельным."
          : "Но в четырёх землях ещё не всё решено.") +
        '</p><p>Можно загрузить запись или начать заново за ту же фракцию.</p><div class="modal-actions"><button class="primary" data-action="load">Загрузить сохранение</button><button class="secondary" data-action="restart">Начать заново</button><button class="secondary" data-action="menu">Выбор фракции</button></div>',
    );
  }
  const raycaster = new THREE.Raycaster(),
    direction = new THREE.Vector3();
  function lineClear(a, b) {
    const length = distance(a, b),
      steps = Math.ceil(length / 0.65);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (blocked(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, 0.05))
        return false;
    }
    return true;
  }
  function aimedEnemy(range) {
    camera.getWorldDirection(direction);
    let chosen = null,
      best = Infinity;
    for (const a of actors) {
      if (a.dead || !hostileToPlayer(a)) continue;
      const d = distance(P, a);
      if (d > range) continue;
      const dx = (a.x - P.x) / d,
        dz = (a.z - P.z) / d,
        dot = dx * direction.x + dz * direction.z;
      if (dot < (range < 5 ? 0.58 : 0.982)) continue;
      if (d < best && lineClear(P, a)) {
        chosen = a;
        best = d;
      }
    }
    return chosen;
  }
  function attack() {
    if (!started || paused || P.health <= 0 || attackCooldown > 0) return;
    const cost = P.weapon === 1 ? 12 : 8;
    if (P.stamina < cost) {
      notify("Переведите дух. Выносливость кончилась.");
      attackCooldown = 0.5;
      return;
    }
    if (P.weapon === 2 && P.arrows < 1) {
      notify("Нет стрел. Клинок — клавиша 1.");
      return;
    }
    P.stamina -= cost;
    attackCooldown = P.weapon === 1 ? 0.53 : 0.75;
    swing = 1;
    sound(P.weapon === 1 ? "hit" : "bow");
    if (P.weapon === 2) P.arrows--;
    let victim = null,
      part = "arm";
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = raycaster.intersectObjects(
      actors.filter((a) => !a.dead).map((a) => a.group),
      true,
    );
    const hit = hits.find((h) => h.distance < (P.weapon === 1 ? 3.9 : 64));
    if (hit) {
      const a = actors.find((e) => e.id === hit.object.userData.actorId);
      if (a && a.faction !== P.faction && lineClear(P, a)) {
        victim = a;
        const height = hit.point.y - terrain(a.x, a.z);
        part = height > 1.67 ? "eye" : height < 0.8 ? "leg" : "arm";
      }
    }
    if (!victim) victim = aimedEnemy(P.weapon === 1 ? 3.5 : 60);
    if (victim) {
      hurtActor(
        victim,
        ((P.weapon === 1 ? 35 : 38) + P.upgrade * 9) *
          (P.arm === "missing" ? 0.48 : 1),
        part,
      );
      if (victim.faction === "human") {
        const c = caravans.find((c) => c.id === victim.caravan);
        if (c) c.hostile = true;
      }
      notify(
        part === "eye"
          ? "Попадание в голову."
          : part === "leg"
            ? "Попадание в ногу."
            : "Удар достиг цели.",
      );
    }
    if (P.weapon === 2) {
      camera.getWorldDirection(direction);
      const start = camera.position.clone().add(new THREE.Vector3(0, -0.16, 0));
      const end = victim
        ? new THREE.Vector3(
            victim.x,
            terrain(victim.x, victim.z) + 1.2,
            victim.z,
          )
        : start.clone().addScaledVector(direction, 45);
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.017, 0.017, 1, 4),
        material("#e6d09b"),
      );
      mesh.position.copy(start).lerp(end, 0.5);
      mesh.scale.y = start.distanceTo(end);
      mesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        end.clone().sub(start).normalize(),
      );
      scene.add(mesh);
      traces.push({ mesh, life: 0.13 });
    }
    updateHUD();
  }
  function hostileToPlayer(a) {
    if (a.dead) return false;
    if (a.faction === "human")
      return !!a.aggro || !!caravans.find((c) => c.id === a.caravan)?.hostile;
    return a.faction !== P.faction;
  }
  function hostileActors(a, b) {
    if (a.dead || b.dead || a.faction === b.faction) return false;
    if (a.faction === "human" || b.faction === "human")
      return (
        (a.faction === "human" &&
          hostileToPlayer(a) &&
          b.faction === P.faction) ||
        (b.faction === "human" && hostileToPlayer(b) && a.faction === P.faction)
      );
    return true;
  }
  function moveEntity(a, tx, tz, speed, dt) {
    let dx = tx - a.x,
      dz = tz - a.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.1) return;
    dx /= d;
    dz /= d;
    const step = Math.min(d, speed * dt),
      nx = a.x + dx * step,
      nz = a.z + dz * step;
    if (!blocked(nx, nz, 0.38)) {
      a.x = nx;
      a.z = nz;
    } else if (!blocked(nx, a.z, 0.38)) a.x = nx;
    else if (!blocked(a.x, nz, 0.38)) a.z = nz;
    else {
      const sign = a.id % 2 ? 1 : -1;
      const sx = a.x - dz * step * sign,
        sz = a.z + dx * step * sign;
      if (!blocked(sx, sz, 0.36)) {
        a.x = sx;
        a.z = sz;
      }
    }
    a.group.rotation.y = Math.atan2(-dx, -dz);
  }
  function marchTarget(a, target) {
    // Route armies through the open southern gates, around buildings.
    if (a.z < -79 && Math.abs(a.x) > 76 && target.z > -65)
      return { x: a.faction === "guard" ? 96 : a.home.x, z: -62 };
    if (target.z < -79 && a.z > -70 && target.x > 70 && Math.abs(a.x - 96) > 4)
      return { x: 96, z: -65 };
    return target;
  }
  function updateActors(dt) {
    for (const a of [...actors]) {
      if (a.dead) continue;
      a.cooldown -= dt;
      if (a.hitFlash) {
        a.hitFlash -= dt;
        if (a.hitFlash <= 0) a.group.scale.set(1, 1, 1);
      }
      if (a.commander) continue;
      let target = null,
        dist = Infinity;
      const pd = distance(a, P);
      if (hostileToPlayer(a) && pd < (a.aggro ? 40 : 23) && lineClear(a, P)) {
        target = P;
        dist = pd;
      }
      for (const b of actors) {
        if (!hostileActors(a, b)) continue;
        const d = distance(a, b);
        if (d < dist && d < 15 && lineClear(a, b)) {
          target = b;
          dist = d;
        }
      }
      let moving = false;
      if (target) {
        if (dist > 2) {
          moveEntity(a, target.x, target.z, a.leg ? 1.1 : 3.2, dt);
          moving = true;
        } else if (a.cooldown <= 0) {
          a.cooldown = a.arm ? 1.9 : 1.35;
          a.attackAnim = 0.4;
          if (target === P) damagePlayer(rand(7, 12) * (a.arm ? 0.6 : 1));
          else
            hurtActor(
              target,
              rand(9, 15) * (a.arm ? 0.6 : 1),
              random() < 0.5 ? "arm" : "leg",
              a.faction === P.faction,
            );
        }
      } else {
        let destination = null,
          speed = 3;
        if (a.squad) {
          if (P.squadOrder === "attack") {
            const path = [
              { x: 70, z: 126 },
              { x: 70, z: 68 },
              { x: 70, z: -65 },
              { x: 96, z: -65 },
              { x: 96, z: -87 },
            ];
            a.marchStep ??= 0;
            if (a.marchStep < 4 && distance(a, path[a.marchStep]) < 3)
              a.marchStep++;
            destination = path[a.marchStep];
          } else if (P.squadOrder === "hold") destination = a.hold || a.home;
          else
            destination = {
              x: P.x + ((a.id % 3) - 1) * 2.5,
              z: P.z + 3 + (a.id % 2) * 2,
            };
        } else if (a.mode === "raid") destination = a.destination;
        else if (a.mode === "escort") {
          const c = caravans.find((c) => c.id === a.caravan);
          if (c) destination = { x: c.x + (a.id % 2 ? 4 : -4), z: c.z + 3 };
          speed = 5;
        } else if (distance(a, a.home) > 3) destination = a.home;
        if (destination && distance(a, destination) > 2.5) {
          destination = marchTarget(a, destination);
          moveEntity(a, destination.x, destination.z, a.leg ? 1 : speed, dt);
          moving = true;
        }
        if (
          a.mode === "raid" &&
          destination &&
          distance(a, destination) < 8 &&
          a.faction !== P.faction
        ) {
          P.baseHealth = Math.max(0, P.baseHealth - dt * 0.35);
        }
      }
      a.group.position.set(a.x, terrain(a.x, a.z) + (a.leg ? 0.15 : 0), a.z);
      a.group.rotation.x = a.leg ? -0.48 : 0;
      const walk = moving ? Math.sin(time * 8 + a.id) * 0.55 : 0;
      a.parts.leg.rotation.x = walk;
      a.parts.otherLeg.rotation.x = -walk;
      a.parts.arm.rotation.x = -walk * 0.5;
      a.parts.otherArm.rotation.x = a.attackAnim ? -1.4 : walk * 0.5;
      if (a.attackAnim) a.attackAnim = Math.max(0, a.attackAnim - dt);
    }
  }
  function startMissionRaid(faction, count) {
    const c = camps[faction];
    P.missionTag = "mission-" + P.chapter + "-" + Math.round(time);
    P.missionKills = 0;
    for (let i = 0; i < count; i++) {
      const enemy =
        faction === "elf"
          ? i % 2
            ? "evil"
            : "guard"
          : faction === "guard"
            ? i % 2
              ? "elf"
              : "evil"
            : i % 2
              ? "elf"
              : "guard";
      spawn(enemy, c.x - 7 + i * 6, c.z + 53 + rand(0, 3), {
        mode: "raid",
        destination: { x: c.x, z: c.z + 25 },
        mission: P.missionTag,
        role: enemy === "evil" ? "spy" : "raider",
      });
    }
  }
  function startRaid() {
    const faction = P.faction,
      c = camps[faction];
    if (actors.filter((a) => !a.dead).length > 58) return;
    for (let i = 0; i < 3; i++)
      spawn(
        faction === "elf"
          ? i % 2
            ? "guard"
            : "evil"
          : faction === "guard"
            ? i % 2
              ? "evil"
              : "elf"
            : i % 2
              ? "elf"
              : "guard",
        c.x - 8 + i * 8,
        c.z + 54,
        {
          mode: "raid",
          destination: { x: c.x, z: c.z + 25 },
          role: i ? "partisan" : "spy",
        },
      );
    notify(
      faction === "evil"
        ? "Шпионы и эльфийские партизаны напали на ваш форт!"
        : "Новый набег! Враги идут к вашему поселению.",
    );
  }
  function updateMissions() {
    if (P.completed) return;
    if (P.faction === "elf") {
      if (P.chapter === 0 && P.missionKills >= 3) {
        P.chapter = 1;
        P.gold += 60;
        notify("Лес отстояли · +60 золотых. Теперь перехватите корован.");
      }
      if (P.chapter === 1 && P.robberies > 0) {
        P.chapter = 2;
        notify("Припасы наши. Поднимите лесное знамя во дворце!");
      }
    }
    if (P.faction === "guard") {
      if (P.chapter === 1 && P.missionKills >= 3) {
        P.chapter = 2;
        notify("Нападение отбито. Вернитесь к командиру за наградой.");
      }
      if (P.chapter === 3 && P.missionKills >= 4) {
        P.chapter = 4;
        notify("Рейд завершён. Доложите командиру у дворца.");
      }
    }
    if (P.baseHealth <= 0) {
      P.baseHealth = 45;
      P.gold = Math.max(0, P.gold - 50);
      notify(
        "Враги разграбили поселение. Потеряно 50 золотых; жители восстанавливают дома.",
      );
      for (const a of actors)
        if (a.mode === "raid" && !a.dead) {
          a.mode = "guard";
          a.home = { x: a.x, z: a.z + 45 };
        }
    }
  }
  function finishCampaign() {
    P.completed = true;
    P.captured = P.faction !== "guard";
    P.gold += 200;
    if (P.captured)
      beacon.children.forEach((o) => {
        if (o.isMesh && o.geometry === boxGeo)
          o.material = material(uniforms[P.faction]);
      });
    notify("Летопись завершена · +200 золотых. Свободная игра продолжается.");
    openModal(
      "victory",
      "Эту историю будут рассказывать",
      `<p>${P.faction === "elf" ? "Деревянные дома уцелели, корованы разграблены, а над дворцом — знамя леса." : P.faction === "guard" ? "Вы исполнили приказы командира и защитили императорские земли." : "Старый форт стал столицей новой силы. Войска прошли за вами через дворцовые ворота."}</p><p>Кирилл ждал джва года. Вы справились за ${Math.ceil(time / 60)} мин. Побед: ${P.kills}; корованов: ${P.robberies}. Награда — 200 золотых.</p><div class="modal-actions"><button class="primary" data-action="resume">Продолжить путешествие</button><button class="secondary" data-action="save">Сохранить летопись</button></div>`,
    );
    saveGame(true);
  }
  function interaction() {
    let found = null,
      best = 5.8;
    for (const m of merchants) {
      const d = distance(P, m);
      if (d < best) {
        best = d;
        found = {
          type: "shop",
          object: m,
          text: "Лавка и лекарь · товары, лечение, протезы",
        };
      }
    }
    for (const a of actors) {
      const d = distance(P, a);
      if (d < 4.3 && d < best) {
        if (a.role === "commander" && P.faction === "guard") {
          best = d;
          found = {
            type: "commander",
            object: a,
            text: "Командир · получить приказ / доложить",
          };
        } else if (a.dead && !a.loot) {
          best = d;
          found = { type: "loot", object: a, text: "Обыскать тело" };
        }
      }
    }
    for (const c of caravans) {
      const d = distance(P, c);
      if (d < 5.7 && d < best && !c.robbed) {
        best = d;
        found = {
          type: "caravan",
          object: c,
          text: c.hostile
            ? "Забрать груз корована"
            : "Ограбить корован · охрана окажет сопротивление",
        };
      }
    }
    if (
      P.faction !== "guard" &&
      !P.captured &&
      distance(P, { x: 96, z: -88 }) < 4
    ) {
      found = { type: "banner", text: "Захватить дворец · поднять своё знамя" };
    }
    return found;
  }
  function interact() {
    if (paused) return;
    const action = interaction();
    if (!action) {
      notify("Подойдите ближе к лавке, командиру, телу или коровану.");
      return;
    }
    if (action.type === "shop") openShop(action.object);
    if (action.type === "commander") commander();
    if (action.type === "loot") {
      action.object.loot = true;
      const gold = 12 + (action.object.commander ? 20 : 0);
      P.gold += gold;
      P.arrows += 2;
      if (random() < 0.35) P.bandages++;
      notify(`Обыскано: ${gold} золотых и 2 стрелы.`);
      sound("coin");
    }
    if (action.type === "caravan") {
      const c = action.object;
      if (!c.hostile) {
        c.hostile = true;
        c.cooldown = 60;
        for (const id of c.escorts) {
          const a = actors.find((a) => a.id === id);
          if (a) a.aggro = true;
        }
        notify("Корован остановлен. Сначала разберитесь с охраной!");
      } else if (
        c.escorts.some((id) =>
          actors.some((a) => a.id === id && !a.dead && distance(a, c) < 25),
        )
      ) {
        notify("Охрана не отдаёт груз. Победите двух конвоиров.");
      } else {
        c.robbed = true;
        c.cooldown = 110;
        P.gold += 90;
        P.bandages += 2;
        P.arrows += 12;
        P.robberies++;
        if (P.faction === "guard") {
          P.gold = Math.max(0, P.gold - 25);
          notify(
            "Груз ваш: 90 золотых, бинты, стрелы. За разбой удержано 25 золотых жалованья.",
          );
        } else notify("Корован ограблен! +90 золотых, 2 бинта, 12 стрел.");
        sound("coin");
        updateMissions();
      }
    }
    if (action.type === "banner") {
      if (P.faction === "elf" && P.chapter < 2) {
        notify("Сперва защитите деревню и перехватите корован.");
        return;
      }
      const guards = actors.filter(
        (a) =>
          !a.dead &&
          a.faction === "guard" &&
          distance(a, { x: 96, z: -88 }) < 28,
      );
      if (guards.length) {
        notify(
          `Дворец ещё защищают ${guards.length} стражников. Знамя пока не ваше.`,
        );
      } else finishCampaign();
    }
    updateHUD();
  }
  const goods = [
    {
      id: "bandage",
      name: "Льняные бинты ×3",
      cost: 18,
      desc: "Q: остановить кровь, восстановить 38 здоровья.",
    },
    {
      id: "arrows",
      name: "Колчан · 20 стрел",
      cost: 16,
      desc: "Для лука. Берегите стрелы и держите дистанцию.",
    },
    {
      id: "heal",
      name: "Помощь лекаря",
      cost: 24,
      desc: "Полное здоровье и остановка кровотечения.",
    },
    {
      id: "arm",
      name: "Механическая рука",
      cost: 75,
      desc: "Вернёт полную силу удара; остановит кровь.",
    },
    {
      id: "eye",
      name: "Стеклянный глаз",
      cost: 55,
      desc: "В этом мире он волшебный: вернёт весь обзор.",
    },
    {
      id: "wheel",
      name: "Деревянная коляска",
      cost: 38,
      desc: "Быстрее ползания. Прыгать в ней не получится.",
    },
    {
      id: "leg",
      name: "Протез ноги",
      cost: 85,
      desc: "Снова ходить, бегать и прыгать. Остановит кровь.",
    },
    {
      id: "armor",
      name: "Укрепить доспех",
      cost: 65,
      desc: "−16% входящего урона за уровень. До 3 уровней.",
    },
    {
      id: "upgrade",
      name: "Заточка и тетива",
      cost: 60,
      desc: "+9 к урону обоих видов оружия. До 3 уровней.",
    },
    {
      id: "recruit",
      name: "Наёмник в ваш отряд",
      cost: 45,
      desc: "Союзник следует за вами и сражается. До 8 воинов.",
    },
  ];
  let currentMerchant = null;
  function allowedGood(id) {
    if (["arm", "eye", "leg"].includes(id)) return P[id] === "missing";
    if (id === "wheel") return P.leg === "missing" && !P.wheel;
    if (id === "heal") return P.health < 100 || P.bleed > 0;
    if (id === "armor" || id === "upgrade") return P[id] < 3;
    if (id === "recruit")
      return actors.filter((a) => a.squad && !a.dead).length < 8;
    return true;
  }
  function openShop(merchant = currentMerchant) {
    currentMerchant = merchant;
    const html = `<p>«Что угодно душе, путник. И кое-что — взамен утраченного».<br>В кошельке <strong>${P.gold}</strong> золотых. Сделка совершается сразу.</p><div class="shop-grid">${goods.map((g) => `<button class="shop-item" data-buy="${g.id}" ${P.gold < g.cost || !allowedGood(g.id) ? "disabled" : ""}><b>${g.name}</b><span>◈ ${g.cost}</span><small>${g.desc}</small></button>`).join("")}</div><p>Лекарь лечит раны; потерянные части тела заменяются протезами. Покупки и лечение доступны во всех четырёх землях.</p>`;
    openModal("shop", "Товары и добрые услуги", html);
  }
  function buy(id) {
    const g = goods.find((g) => g.id === id);
    if (!g || P.gold < g.cost || !allowedGood(id)) return;
    P.gold -= g.cost;
    if (id === "bandage") P.bandages += 3;
    else if (id === "arrows") P.arrows += 20;
    else if (id === "heal") {
      P.health = 100;
      P.bleed = 0;
    } else if (["arm", "eye", "leg"].includes(id)) {
      P[id] = "prosthetic";
      if (id !== "eye") P.bleed = 0;
      if (id === "leg") P.wheel = false;
    } else if (id === "wheel") P.wheel = true;
    else if (id === "armor" || id === "upgrade") P[id]++;
    else if (id === "recruit")
      spawn(P.faction, P.x + 2, P.z + 3, { squad: true, mode: "follow" });
    sound("coin");
    notify("Куплено: " + g.name);
    openShop();
    updateHUD();
  }
  function commander() {
    let text, button;
    if (P.chapter === 0) {
      text =
        "«Слушай приказ. Шпионы злого и эльфийские партизаны идут к южным воротам. Уничтожь троих и доложи мне лично. За самовольный уход жалованья не будет». Нажатие кнопки начнёт оборону.";
      button =
        '<button class="primary" data-action="order-defend">Есть! Защищать дворец</button>';
    } else if (P.chapter === 1) {
      text = `«Не время для разговоров. Уничтожено ${P.missionKills} из 3 нападающих. Южные ворота — за моей спиной».`;
      button =
        '<button class="primary" data-action="resume">К воротам</button>';
    } else if (P.chapter === 2) {
      text =
        "«Дворец цел. Получи 75 золотых. Новый приказ: возглавь вылазку к старому форту в юго-восточных горах. Четверо противников у южных ворот форта. Двое солдат пойдут с тобой». ";
      button =
        '<button class="primary" data-action="order-raid">Принять награду и приказ</button>';
    } else if (P.chapter === 3) {
      text = `«Приказ остаётся в силе: старый форт. Уничтожено ${P.missionKills} из 4. Открой карту на M; дорога огибает горы».`;
      button =
        '<button class="primary" data-action="resume">Вернуться к заданию</button>';
    } else if (P.chapter === 4) {
      text =
        "«Приказ выполнен. Император узнал твоё имя. Ты заслужил место в летописи дворца». ";
      button =
        '<button class="primary" data-action="finish-guard">Доложить о победе</button>';
    } else {
      text = "«Дворец под твоей защитой. Продолжай патрулировать тракт». ";
      button =
        '<button class="primary" data-action="resume">Продолжить службу</button>';
    }
    openModal(
      "commander",
      "Слово командира",
      `<p>${text}</p><div class="modal-actions">${button}</div>`,
    );
  }
  function orderDefend() {
    P.chapter = 1;
    startMissionRaid("guard", 3);
    closeModal();
    notify("Приказ I: уничтожить троих у южных ворот.");
  }
  function orderRaid() {
    P.gold += 75;
    P.chapter = 3;
    P.missionTag = "fort-raid";
    P.missionKills = 0;
    for (let i = 0; i < 4; i++)
      spawn("evil", 87 + i * 6, 126 + (i % 2) * 3, {
        mission: "fort-raid",
        home: { x: 87 + i * 6, z: 126 + (i % 2) * 3 },
      });
    for (let i = 0; i < 2; i++)
      spawn("guard", P.x + i * 3, P.z + 4, { squad: true });
    closeModal();
    notify("Приказ II: рейд на старый форт. Двое солдат следуют за вами.");
  }
  function commands() {
    const squad = actors.filter((a) => a.squad && !a.dead);
    openModal(
      "commands",
      P.faction === "evil" ? "Сам себе командир" : "Ваш отряд",
      `<p>${P.faction === "evil" ? "Вы сами выбираете время нападения. Прикажите войскам штурмовать дворец и идите вместе с ними через южные ворота." : "Наёмники следуют вашим приказам. " + (P.faction === "guard" ? "Цель службы определяет дворцовый командир." : "У дворца поднимите знамя леса, когда выполните задачи деревни.")}</p><p>В строю: <strong>${squad.length} / 8</strong>. Приказ: <strong>${{ follow: "за мной", hold: "держать позицию", attack: "штурм дворца" }[P.squadOrder]}</strong>. Новых бойцов можно нанять в лавке.</p><div class="modal-actions"><button class="primary" data-order="follow">За мной</button><button class="secondary" data-order="hold">Держать позицию</button>${P.faction === "evil" ? '<button class="secondary" data-order="attack">На штурм дворца!</button>' : ""}</div><p>Армия идёт по восточному тракту и входит в открытые южные ворота дворца. Воины атакуют врагов по пути. В одиночку штурмовать тоже можно.</p>`,
    );
  }
  function setOrder(order) {
    if (order === "attack" && P.faction !== "evil") return;
    P.squadOrder = order;
    for (const a of actors)
      if (a.squad) {
        a.hold = { x: a.x, z: a.z };
        a.marchStep = a.z < -60 ? 3 : a.z < 70 ? 2 : 0;
      }
    notify(
      order === "attack"
        ? "Войска выступают! Штурм дворца. Следуйте за ними по тракту."
        : order === "hold"
          ? "Отряд держит позицию."
          : "Отряд следует за вами.",
    );
    closeModal();
  }
  function journal() {
    openModal(
      "journal",
      "Летопись путешествия",
      `<p>${questInfo().text} ${questInfo().detail}</p><div class="injury-list"><p>Рука: ${partText(P.arm)}. Глаз: ${partText(P.eye)}. Нога: ${partText(P.leg)}${P.wheel ? " · коляска" : ""}.<br>${P.bleed > 0 ? "Кровотечение: −" + P.bleed.toFixed(1) + " здоровья в секунду. Нажмите Q после закрытия журнала." : "Кровотечения нет."}</p></div><p>Побеждено: ${P.kills} · Корованов ограблено: ${P.robberies}<br>Состояние поселения: ${Math.ceil(P.baseHealth)}% · Следующий набег примерно через ${Math.ceil(raidTimer)} сек.<br>Доспех: ${P.armor}/3 · Усиление оружия: ${P.upgrade}/3</p><p>Рука без протеза: сила удара −52%. Потеря глаза: половина экрана закрыта. Без ноги: ползание; коляска ускоряет передвижение, протез возвращает бег и прыжок. Бинт останавливает кровь, но не возвращает конечности.</p><div class="modal-actions"><button class="primary" data-action="save">Сохранить</button><button class="secondary" data-action="help">Управление</button></div>`,
    );
  }
  function partText(value) {
    return { ok: "цел", missing: "утрачен", prosthetic: "протез" }[value];
  }
  function questInfo() {
    if (P.completed)
      return {
        label: "ВПИСАНО В ЛЕТОПИСЬ",
        text: "Четыре земли всё ещё ваши",
        detail: "Свободная игра · торговля, набеги и корованы.",
      };
    if (P.faction === "elf")
      return [
        {
          label: "ЛЕС НЕ СДАЁТСЯ",
          text: "Отбейте набег на деревню",
          detail: `Нападающих побеждено: ${P.missionKills} / 3 · южная опушка.`,
        },
        {
          label: "МОЖНО ГРАБИТЬ КОРОВАНЫ",
          text: "Перехватите груз на тракте",
          detail:
            "Жёлтый ромб на карте · E у повозки. Сначала победите охрану.",
        },
        {
          label: "ЛЕС ИДЁТ К ДВОРЦУ",
          text: "Поднимите знамя эльфов",
          detail:
            "Дворец на северо-востоке. Победите стражу, войдите в южные ворота, E у знамени.",
        },
      ][Math.min(2, P.chapter)];
    if (P.faction === "guard")
      return [
        {
          label: "ПРИСЯГА ИМПЕРАТОРУ",
          text: "Явитесь к командиру",
          detail:
            "Золотой шлем во дворе · войдите в южные ворота. E — говорить.",
        },
        {
          label: "ПРИКАЗ I · ОБОРОНА",
          text: "Защитите южные ворота",
          detail: `Шпионы и партизаны: ${P.missionKills} / 3. Затем доложите командиру.`,
        },
        {
          label: "ДОЛОЖИТЬ КОМАНДИРУ",
          text: "Получите следующий приказ",
          detail: "Командир ждёт во дворе дворца.",
        },
        {
          label: "ПРИКАЗ II · ВЫЛАЗКА",
          text: "Разбейте дозор старого форта",
          detail: `Побеждено: ${P.missionKills} / 4 · юго-восток, за южными воротами форта.`,
        },
        {
          label: "ДОЛОЖИТЬ КОМАНДИРУ",
          text: "Вернитесь с победой",
          detail: "Дворец · E у командира.",
        },
      ][Math.min(4, P.chapter)];
    return {
      label: "САМ СЕБЕ КОМАНДИР",
      text:
        P.squadOrder === "attack"
          ? "Возглавьте штурм дворца"
          : "Император засиделся на троне",
      detail:
        "C — приказы войскам. Уничтожьте стражу и захватите знамя во дворе: E.",
    };
  }
  function updateHUD() {
    if (!P) return;
    $("health-text").innerHTML =
      `${Math.ceil(Math.max(0, P.health))} <small>/ 100</small>`;
    $("health-bar").style.width = clamp(P.health, 0, 100) + "%";
    $("stamina-bar").style.width = P.stamina + "%";
    $("life-label").textContent = P.bleed > 0 ? "КРОВОТЕЧЕНИЕ · Q" : "ЖИЗНЬ";
    $("health-bar").style.background = P.bleed > 0 ? "#d58b76" : "#a7c39b";
    for (const [part, name] of [
      ["arm", "РУКА"],
      ["eye", "ГЛАЗ"],
      ["leg", "НОГА"],
    ]) {
      const el = $(part + "-status");
      el.textContent =
        name +
        " " +
        (P[part] === "ok"
          ? "●"
          : P[part] === "prosthetic"
            ? "◇"
            : part === "leg" && P.wheel
              ? "◉"
              : "×");
      el.className =
        P[part] === "missing"
          ? "hurt"
          : P[part] === "prosthetic"
            ? "prosthetic"
            : "";
    }
    $("blind").style.display = P.eye === "missing" && started ? "flex" : "none";
    $("gold").textContent = P.gold;
    $("arrows").textContent = P.arrows;
    $("bandages").textContent = P.bandages;
    $("sword-slot").classList.toggle("active", P.weapon === 1);
    $("bow-slot").classList.toggle("active", P.weapon === 2);
    $("squad-count").textContent =
      "В отряде: " + actors.filter((a) => a.squad && !a.dead).length;
    const zone = zoneAt(P.x, P.z),
      c = camps[zone];
    $("zone-name").textContent = c.name;
    $("zone-sub").textContent = c.sub;
    $("faction-label").textContent = camps[P.faction].title.toUpperCase();
    if (zone !== lastZone) {
      if (lastZone) notify(c.name + " · " + c.sub);
      lastZone = zone;
    }
    const q = questInfo();
    $("quest-label").textContent = q.label;
    $("quest-text").textContent = q.text;
    $("quest-detail").textContent = q.detail;
    const angle = ((((P.yaw * 180) / Math.PI) % 360) + 360) % 360,
      cardinal = ["С", "СЗ", "З", "ЮЗ", "Ю", "ЮВ", "В", "СВ"][
        Math.round(angle / 45) % 8
      ];
    $("heading").textContent =
      cardinal +
      " · " +
      String(Math.round((360 - angle) % 360)).padStart(3, "0") +
      "°";
    const action = interaction();
    $("interact").hidden = !action;
    if (action) $("interact").querySelector("span").textContent = action.text;
    const aim = aimedEnemy(62);
    $("target").textContent = aim
      ? `${aim.role === "spy" ? "Шпион" : camps[aim.faction].title} · ${Math.ceil(aim.health)} / ${aim.maxHealth}`
      : "";
  }
  function drawMap(target, big = false) {
    const ctx = target.getContext("2d"),
      w = target.width,
      s = w / 420,
      to = (v) => (v + 210) * s;
    ctx.clearRect(0, 0, w, w);
    ctx.fillStyle = "#293e31";
    ctx.fillRect(0, 0, w / 2, w / 2);
    ctx.fillStyle = "#656c51";
    ctx.fillRect(w / 2, 0, w / 2, w / 2);
    ctx.fillStyle = "#8a805a";
    ctx.fillRect(0, w / 2, w / 2, w / 2);
    ctx.fillStyle = "#595a5b";
    ctx.fillRect(w / 2, w / 2, w / 2, w / 2);
    ctx.globalAlpha = 0.24;
    ctx.strokeStyle = "#d7c794";
    ctx.lineWidth = 0.7;
    for (let i = 1; i < 12; i++) {
      ctx.beginPath();
      ctx.moveTo(0, (i * w) / 12);
      ctx.lineTo(w, (i * w) / 12);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo((i * w) / 12, 0);
      ctx.lineTo((i * w) / 12, w);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#b3c092";
    for (let i = 0; i < trees.length; i += big ? 3 : 9) {
      const t = trees[i];
      ctx.beginPath();
      ctx.moveTo(to(t.x), to(t.z) - 2);
      ctx.lineTo(to(t.x) - 1.5, to(t.z) + 1.5);
      ctx.lineTo(to(t.x) + 1.5, to(t.z) + 1.5);
      ctx.fill();
    }
    ctx.strokeStyle = "#ccb485";
    ctx.lineWidth = big ? 4 : 2;
    for (const [a, b] of roads) {
      ctx.beginPath();
      ctx.moveTo(to(a.x), to(a.z));
      ctx.lineTo(to(b.x), to(b.z));
      ctx.stroke();
    }
    for (const [key, c] of Object.entries(camps)) {
      ctx.fillStyle = "#e2d1a6";
      ctx.fillRect(to(c.x) - 4, to(c.z) - 4, 8, 8);
      ctx.fillStyle = "#131f17";
      ctx.fillRect(to(c.x) - 2, to(c.z) - 2, 4, 4);
      if (big) {
        ctx.font = "16px Georgia";
        ctx.fillStyle = "#f5e7c1";
        ctx.textAlign = "center";
        ctx.fillText(c.name, to(c.x), to(c.z) - 16);
      }
    }
    for (const c of caravans) {
      ctx.save();
      ctx.translate(to(c.x), to(c.z));
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = c.robbed ? "#9d906d" : "#ffce72";
      ctx.fillRect(-3, -3, 6, 6);
      ctx.restore();
    }
    if (started && P) {
      for (const a of actors) {
        if (a.dead || (!big && distance(P, a) > 65)) continue;
        ctx.fillStyle = a.squad
          ? "#aee3c4"
          : a.commander
            ? "#ffe39a"
            : hostileToPlayer(a)
              ? "#e8886f"
              : "#c1d8b6";
        ctx.beginPath();
        ctx.arc(to(a.x), to(a.z), big ? 2.5 : 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.save();
      ctx.translate(to(P.x), to(P.z));
      ctx.rotate(-P.yaw);
      ctx.fillStyle = "#fff5ce";
      ctx.strokeStyle = "#193329";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(4.7, 5);
      ctx.lineTo(0, 2);
      ctx.lineTo(-4.7, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.textAlign = "center";
    ctx.fillStyle = "#f7e9c6";
    ctx.font = (big ? "12" : "10") + "px Arial";
    ctx.fillText("С", w / 2, 14);
    if (big) {
      ctx.textAlign = "left";
      ctx.font = "10px Arial";
      ctx.fillStyle = "#dfcda8";
      ctx.fillText("0 ━━━━━ 100 шагов", 15, w - 15);
    }
  }
  function showMap() {
    openModal(
      "map",
      "Четыре земли",
      `<canvas id="big-map" class="map-large" width="630" height="630" aria-label="Карта мира"></canvas><div class="map-legend"><span>▲ Вы</span><span>◆ Корован</span><span>■ Поселение и лавка</span><span>● Красный — враг</span></div><p>Север сверху. Дворец — на северо-востоке, форт — на юго-востоке. Все земли соединены трактом. Время на карте остановлено.</p>`,
    );
    drawMap($("big-map"), true);
  }
  function help() {
    openModal(
      "help",
      "Путнику на заметку",
      `<div class="help-grid"><span><kbd>W A S D</kbd> Движение</span><span><kbd>Мышь</kbd> Осмотреться</span><span><kbd>Shift</kbd> Бежать</span><span><kbd>Пробел</kbd> Прыгнуть</span><span><kbd>ЛКМ</kbd> Удар / выстрел</span><span><kbd>ПКМ</kbd> Блокировать удар</span><span><kbd>1 / 2</kbd> Клинок / лук</span><span><kbd>E</kbd> Говорить / грабить / обыскать</span><span><kbd>Q</kbd> Бинт: лечение и перевязка</span><span><kbd>C</kbd> Приказы отряду</span><span><kbd>M</kbd> Карта четырёх земель</span><span><kbd>J</kbd> Журнал и состояние тела</span><span><kbd>F5 / F9</kbd> Сохранить / загрузить</span><span><kbd>Esc / P</kbd> Пауза</span></div><p>Кликните по миру для захвата мыши. Если браузер его запрещает, зажмите мышь и тяните для обзора или используйте стрелки. Автоматическое сохранение — раз в 60 секунд. В открытых окнах мир ждёт вас.</p><h3>Не забывайте про бинты</h3><p>Ранения иногда отнимают руку, глаз или ногу. Кровотечение смертельно: Q останавливает его. Без руки слабее удары; без ноги можно ползти. Лекари продают коляску и протезы. Глаз закрывает ровно половину обзора, пока не купите замену.</p><h3>Можно грабить корованы</h3><p>Жёлтые ромбы на карте — повозки. Подойдите, нажмите E, победите охрану и ещё раз нажмите E. Купите припасы и наймите спутников в любой лавке.</p><div class="modal-actions"><button class="primary" data-action="resume">В путь</button></div>`,
    );
  }
  let previousFocus = null;
  function openModal(type, title, html) {
    previousFocus = document.activeElement;
    activeModal = type;
    paused = true;
    keys.clear();
    mouseDown = false;
    blocking = false;
    $("modal-title").textContent = title;
    $("modal-kicker").textContent =
      type === "shop" ? "ТОРГОВЫЙ СОЮЗ ЧЕТЫРЁХ ЗЕМЕЛЬ" : "КОРОВАНЫ / ЛЕТОПИСЬ";
    $("modal-content").innerHTML = html;
    $("modal-status").textContent = "";
    $("modal").hidden = false;
    $("capture").hidden = true;
    if (document.pointerLockElement) document.exitPointerLock();
    $("close-modal").focus();
  }
  function closeModal() {
    if (activeModal === "death") return;
    activeModal = "";
    paused = false;
    $("modal").hidden = true;
    if (previousFocus?.isConnected) previousFocus.focus();
    if (started) requestLock();
  }
  function pauseMenu() {
    openModal(
      "pause",
      "Привал у старого тракта",
      `<p>Мир остановлен. Можно перевести дух и сохранить свою историю.</p><div class="modal-actions"><button class="primary" data-action="resume">Продолжить</button><button class="secondary" data-action="save">Сохранить · F5</button><button class="secondary" data-action="load">Загрузить · F9</button><button class="secondary" data-action="help">Управление</button><button class="secondary" data-action="menu">Выбор фракции</button></div><label class="setting">Детализация <select id="quality"><option value="auto" ${quality === "auto" ? "selected" : ""}>Автоматическая</option><option value="high" ${quality === "high" ? "selected" : ""}>Обычная · тени</option><option value="low" ${quality === "low" ? "selected" : ""}>Лёгкая · без теней</option></select></label><label class="setting">Чувствительность мыши <input id="sensitivity" type="range" min="1" max="5" step=".2" value="${sensitivity * 1000}"></label><label class="setting"><input id="fps-toggle" type="checkbox" ${$("fps").hidden ? "" : "checked"}> Показывать FPS</label><label class="setting"><input id="audio-toggle" type="checkbox" ${audioEnabled ? "checked" : ""}> Звуки боя и действий</label><p>Запись хранится в localStorage этого браузера. При первом открытии file:// и сайта это разные записи.</p>`,
    );
  }
  function serialize() {
    return {
      version: 1,
      savedAt: new Date().toISOString(),
      player: { ...P },
      time,
      raidTimer,
      actors: actors.map((a) => ({
        id: a.id,
        faction: a.faction,
        x: a.x,
        z: a.z,
        health: a.health,
        maxHealth: a.maxHealth,
        home: a.home,
        cooldown: Math.max(0, a.cooldown),
        dead: a.dead,
        arm: a.arm,
        leg: a.leg,
        eye: a.eye,
        loot: a.loot,
        mode: a.mode,
        role: a.role,
        commander: !!a.commander,
        squad: !!a.squad,
        aggro: !!a.aggro,
        caravan: a.caravan,
        destination: a.destination,
        mission: a.mission,
        hold: a.hold,
        marchStep: a.marchStep,
      })),
      caravans: caravans.map((c) => ({
        id: c.id,
        x: c.x,
        z: c.z,
        segment: c.segment,
        t: c.t,
        robbed: c.robbed,
        hostile: c.hostile,
        cooldown: c.cooldown,
        escorts: [...c.escorts],
      })),
    };
  }
  function validSave(s) {
    if (
      !s ||
      s.version !== 1 ||
      !s.player ||
      !["elf", "guard", "evil"].includes(s.player.faction) ||
      !Array.isArray(s.actors) ||
      s.actors.length > 100 ||
      !Array.isArray(s.caravans) ||
      s.caravans.length !== 2
    )
      return false;
    const p = s.player;
    for (const key of [
      "x",
      "z",
      "yaw",
      "pitch",
      "health",
      "stamina",
      "gold",
      "bandages",
      "arrows",
      "bleed",
      "chapter",
      "missionKills",
      "baseHealth",
      "kills",
      "robberies",
      "armor",
      "upgrade",
      "weapon",
      "injuryCooldown",
    ])
      if (!Number.isFinite(p[key])) return false;
    if (
      Math.abs(p.x) > 205 ||
      Math.abs(p.z) > 205 ||
      p.health <= 0 ||
      p.health > 100 ||
      p.stamina < 0 ||
      p.stamina > 100 ||
      p.gold < 0 ||
      p.gold > 1e8 ||
      p.chapter < 0 ||
      p.chapter > 5 ||
      ![1, 2].includes(p.weapon) ||
      !["follow", "hold", "attack"].includes(p.squadOrder)
    )
      return false;
    for (const key of ["arm", "eye", "leg"])
      if (!["ok", "missing", "prosthetic"].includes(p[key])) return false;
    if (
      !Number.isFinite(s.time) ||
      s.time < 0 ||
      !Number.isFinite(s.raidTimer) ||
      s.raidTimer < 0 ||
      s.raidTimer > 200
    )
      return false;
    const ids = new Set();
    for (const a of s.actors) {
      if (
        !Object.hasOwn(camps, a.faction) ||
        !Number.isInteger(a.id) ||
        ids.has(a.id) ||
        !Number.isFinite(a.x) ||
        !Number.isFinite(a.z) ||
        !Number.isFinite(a.health) ||
        !a.home ||
        !Number.isFinite(a.home.x) ||
        !Number.isFinite(a.home.z) ||
        Math.abs(a.x) > 220 ||
        Math.abs(a.z) > 220
      )
        return false;
      ids.add(a.id);
      if (
        a.mode === "raid" &&
        (!a.destination ||
          !Number.isFinite(a.destination.x) ||
          !Number.isFinite(a.destination.z))
      )
        return false;
    }
    return s.caravans.every(
      (c, i) =>
        c.id === i &&
        Number.isInteger(c.segment) &&
        c.segment >= 0 &&
        c.segment < 4 &&
        Number.isFinite(c.t) &&
        c.t >= 0 &&
        c.t <= 1 &&
        Number.isFinite(c.cooldown) &&
        Array.isArray(c.escorts),
    );
  }
  function readSave() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
      return validSave(s) ? s : null;
    } catch (_) {
      return null;
    }
  }
  function saveGame(quiet = false) {
    if (!P || P.health <= 0) {
      if (!quiet) notify("Нельзя сохранить погибшего героя.");
      return false;
    }
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(serialize()));
      $("continue").disabled = false;
      if (!quiet) notify("Летопись сохранена в этом браузере.");
      return true;
    } catch (_) {
      notify("Браузер запретил сохранение или хранилище заполнено.");
      return false;
    }
  }
  function loadGame() {
    const s = readSave();
    if (!s) {
      if (started) notify("Подходящей записи нет: сохраните игру на F5.");
      else
        $("load-status").textContent =
          "Запись не найдена или повреждена. Начните новое путешествие.";
      return;
    }
    begin(s.player.faction, s);
    notify("Летопись загружена. Путешествие продолжается.");
  }
  function returnToMenu() {
    saveGame(true);
    started = false;
    paused = false;
    activeModal = "";
    keys.clear();
    mouseDown = false;
    blocking = false;
    document.exitPointerLock?.();
    $("modal").hidden = true;
    $("hud").hidden = true;
    $("menu").hidden = false;
    $("blind").style.display = "none";
    $("continue").disabled = !readSave();
  }
  function selectWeapon(n) {
    if (!P) return;
    P.weapon = n;
    updateHUD();
  }
  function updateCamera(dt) {
    if (!started) {
      weaponRig.visible = false;
      chairRig.visible = false;
      camera.position.set(-96, 4.4, -69);
      camera.lookAt(-80, 5, -114);
      sky.position.copy(camera.position);
      return;
    }
    const legMissing = P.leg === "missing";
    const eyeHeight = legMissing ? (P.wheel ? 1.2 : 0.65) : 1.8;
    const moving =
      keys.has("KeyW") ||
      keys.has("KeyA") ||
      keys.has("KeyS") ||
      keys.has("KeyD");
    walkPhase += dt * (moving ? 10 : 2);
    camera.position.set(
      P.x,
      terrain(P.x, P.z) +
        eyeHeight +
        (P.y || 0) +
        (moving ? Math.sin(walkPhase) * 0.035 : Math.sin(walkPhase) * 0.009),
      P.z,
    );
    camera.rotation.set(P.pitch, P.yaw, 0);
    sky.position.copy(camera.position);
    sword.visible = P.weapon === 1;
    bow.visible = P.weapon === 2;
    weaponRig.position.set(
      0.18,
      -0.3 + (moving ? Math.sin(walkPhase) * 0.014 : 0),
      -0.48,
    );
    weaponRig.rotation.set(blocking ? -0.25 : 0, 0, blocking ? 0.55 : 0);
    sword.rotation.set(
      -Math.sin(swing * Math.PI) * 0.9,
      Math.sin(swing * Math.PI) * 0.3,
      -0.15 - Math.sin(swing * Math.PI) * 1.1,
    );
    bow.position.z = Math.sin(swing * Math.PI) * 0.08;
    weaponRig.visible = P.health > 0;
    chairRig.visible = legMissing && P.wheel && P.health > 0;
    for (const wheel of chairWheels) if (moving) wheel.rotation.x += dt * 5;
  }
  function updatePlayer(dt) {
    P.injuryCooldown = Math.max(0, P.injuryCooldown - dt);
    attackCooldown = Math.max(0, attackCooldown - dt);
    swing = Math.max(0, swing - dt * 2.8);
    hurtFlash = Math.max(0, hurtFlash - dt * 1.8);
    if (P.bleed > 0) {
      P.health -= P.bleed * dt;
      if (P.health <= 0) {
        die();
        return;
      }
    }
    let forward = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0),
      strafe = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
    const norm = Math.hypot(forward, strafe);
    if (norm) {
      forward /= norm;
      strafe /= norm;
    }
    const running =
      (keys.has("ShiftLeft") || keys.has("ShiftRight")) &&
      P.stamina > 5 &&
      P.leg !== "missing" &&
      norm > 0;
    const speed =
      P.leg === "missing" ? (P.wheel ? 4.6 : 1.25) : running ? 9 : 5.2;
    const dx =
        (-Math.sin(P.yaw) * forward + Math.cos(P.yaw) * strafe) * speed * dt,
      dz = (-Math.cos(P.yaw) * forward - Math.sin(P.yaw) * strafe) * speed * dt;
    const nx = clamp(P.x + dx, -202, 202),
      nz = clamp(P.z + dz, -202, 202);
    if (!blocked(nx, P.z, 0.46)) P.x = nx;
    if (!blocked(P.x, nz, 0.46)) P.z = nz;
    if (keys.has("ArrowLeft")) P.yaw += dt * 1.7;
    if (keys.has("ArrowRight")) P.yaw -= dt * 1.7;
    if (keys.has("ArrowUp")) P.pitch = clamp(P.pitch + dt, -1.35, 1.35);
    if (keys.has("ArrowDown")) P.pitch = clamp(P.pitch - dt, -1.35, 1.35);
    if (
      keys.has("Space") &&
      P.y <= 0 &&
      P.leg !== "missing" &&
      P.stamina >= 12
    ) {
      P.vy = 6.3;
      P.y = 0.01;
      P.stamina -= 12;
      keys.delete("Space");
    }
    P.vy -= 17 * dt;
    P.y = Math.max(0, (P.y || 0) + P.vy * dt);
    if (P.y === 0) P.vy = 0;
    P.stamina = clamp(
      P.stamina + dt * (running ? -12 : blocking ? 4 : 19),
      0,
      100,
    );
    if (mouseDown) attack();
  }
  function updateCaravans(dt) {
    for (const c of caravans) {
      c.cooldown = Math.max(0, c.cooldown - dt);
      if (c.robbed && c.cooldown === 0) {
        c.robbed = false;
        c.hostile = false;
        for (const id of c.escorts) {
          const old = actors.find((a) => a.id === id);
          if (old && !old.dead) removeActor(old);
        }
        c.escorts = [];
        for (let i = 0; i < 2; i++)
          c.escorts.push(
            spawn("human", c.x + (i ? 4 : -4), c.z + 3, {
              caravan: c.id,
              mode: "escort",
            }).id,
          );
      }
      if (c.hostile && !c.robbed) continue;
      const a = route[c.segment],
        b = route[(c.segment + 1) % 4];
      c.t += (dt * 2.2) / distance(a, b);
      if (c.t >= 1) {
        c.t -= 1;
        c.segment = (c.segment + 1) % 4;
      }
      positionCaravan(c);
    }
  }
  function updateEffects(dt) {
    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i];
      d.life -= dt;
      if (d.life <= 0) {
        scene.remove(d.mesh);
        debris.splice(i, 1);
        continue;
      }
      const y = terrain(d.mesh.position.x, d.mesh.position.z) + 0.12;
      if (d.mesh.position.y > y) {
        d.vy -= 12 * dt;
        d.mesh.position.x += d.vx * dt;
        d.mesh.position.z += d.vz * dt;
        d.mesh.position.y += d.vy * dt;
        d.mesh.rotation.z += dt * 3;
      } else d.mesh.position.y = y;
    }
    for (let i = traces.length - 1; i >= 0; i--) {
      traces[i].life -= dt;
      if (traces[i].life <= 0) {
        scene.remove(traces[i].mesh);
        traces[i].mesh.geometry.dispose();
        traces.splice(i, 1);
      }
    }
  }
  function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  }
  window.addEventListener("resize", resize);
  document.querySelectorAll("[data-faction]").forEach((b) =>
    b.addEventListener("click", () => {
      selected = b.dataset.faction;
      document.querySelectorAll("[data-faction]").forEach((el) => {
        el.classList.toggle("selected", el === b);
        el.setAttribute("aria-pressed", String(el === b));
      });
      sound("click");
    }),
  );
  $("start").addEventListener("click", () => begin(selected));
  $("continue").addEventListener("click", loadGame);
  $("menu-help").addEventListener("click", help);
  $("close-modal").addEventListener("click", closeModal);
  $("capture").addEventListener("click", requestLock);
  $("map-button").addEventListener("click", showMap);
  $("sword-slot").addEventListener("click", () => selectWeapon(1));
  $("bow-slot").addEventListener("click", () => selectWeapon(2));
  $("heal-slot").addEventListener("click", bandage);
  $("modal-content").addEventListener("click", (e) => {
    const button = e.target.closest("button");
    if (!button) return;
    if (button.dataset.buy) {
      buy(button.dataset.buy);
      return;
    }
    if (button.dataset.order) {
      setOrder(button.dataset.order);
      return;
    }
    const actions = {
      resume: closeModal,
      save: () => saveGame(),
      load: loadGame,
      help,
      menu: returnToMenu,
      restart: () => begin(P.faction),
      "order-defend": orderDefend,
      "order-raid": orderRaid,
      "finish-guard": () => {
        P.chapter = 5;
        finishCampaign();
      },
    };
    actions[button.dataset.action]?.();
  });
  $("modal-content").addEventListener("change", (e) => {
    if (e.target.id === "quality") {
      quality = e.target.value;
      renderer.shadowMap.enabled = quality !== "low";
      renderScale = quality === "low" ? 0.75 : Math.min(devicePixelRatio, 1.5);
      renderer.setPixelRatio(renderScale);
      for (const mat of mats.values()) mat.needsUpdate = true;
      resize();
    }
    if (e.target.id === "fps-toggle") $("fps").hidden = !e.target.checked;
    if (e.target.id === "audio-toggle") audioEnabled = e.target.checked;
    if (e.target.id === "sensitivity")
      sensitivity = Number(e.target.value) / 1000;
  });
  document.addEventListener("keydown", (e) => {
    if (activeModal && e.code === "Tab") {
      const els = [
        ...$("modal").querySelectorAll("button:not(:disabled),input,select"),
      ];
      const first = els[0],
        last = els.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
      return;
    }
    if (!started) {
      if (e.code === "Escape" && activeModal) closeModal();
      return;
    }
    if (
      [
        "Space",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "F5",
        "F9",
        "Tab",
      ].includes(e.code)
    )
      e.preventDefault();
    if (e.repeat) return;
    if (e.code === "F5") {
      saveGame();
      return;
    }
    if (e.code === "F9") {
      loadGame();
      return;
    }
    if (e.code === "Escape" || e.code === "KeyP") {
      if (activeModal) closeModal();
      else pauseMenu();
      return;
    }
    if (activeModal) {
      if (
        (e.code === "KeyM" && activeModal === "map") ||
        (e.code === "KeyJ" && activeModal === "journal") ||
        (e.code === "KeyC" && activeModal === "commands")
      )
        closeModal();
      return;
    }
    keys.add(e.code);
    const actions = {
      KeyE: interact,
      KeyQ: bandage,
      KeyM: showMap,
      KeyJ: journal,
      KeyC: commands,
      Digit1: () => selectWeapon(1),
      Digit2: () => selectWeapon(2),
    };
    actions[e.code]?.();
  });
  document.addEventListener("keyup", (e) => keys.delete(e.code));
  canvas.addEventListener("mousedown", (e) => {
    if (!started || paused) return;
    if (document.pointerLockElement !== canvas) {
      dragLook = true;
      requestLock();
    }
    if (e.button === 0) mouseDown = true;
    if (e.button === 2) blocking = true;
  });
  document.addEventListener("mouseup", (e) => {
    dragLook = false;
    if (e.button === 0) mouseDown = false;
    if (e.button === 2) blocking = false;
  });
  document.addEventListener("mousemove", (e) => {
    if (!started || paused || (!document.pointerLockElement && !dragLook))
      return;
    P.yaw -= e.movementX * sensitivity;
    P.pitch = clamp(P.pitch - e.movementY * sensitivity, -1.35, 1.35);
  });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("pointerlockchange", () => {
    if (!started || paused) {
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      return;
    }
    keys.clear();
    mouseDown = false;
    blocking = false;
    $("capture").hidden = document.pointerLockElement === canvas;
    if (!document.pointerLockElement && P.health > 0) pauseMenu();
  });
  window.addEventListener("blur", () => {
    keys.clear();
    mouseDown = false;
    blocking = false;
    if (started && !paused && P.health > 0) pauseMenu();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && started) {
      saveGame(true);
      if (!paused && P.health > 0) pauseMenu();
    }
  });
  window.addEventListener("pagehide", () => {
    if (started) saveGame(true);
  });
  let last = performance.now(),
    lodTimer = 0,
    hudTimer = 0,
    frames = 0,
    fpsTime = 0,
    lastFPS = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const elapsed = (now - last) / 1000,
      dt = Math.min(0.05, elapsed);
    last = now;
    frames++;
    fpsTime += elapsed;
    if (fpsTime >= 1) {
      lastFPS = Math.round(frames / fpsTime);
      frames = 0;
      fpsTime = 0;
      $("fps").textContent = lastFPS + " FPS";
      qualityTimer++;
      if (
        quality === "auto" &&
        qualityTimer > 2 &&
        lastFPS < 28 &&
        renderScale > 0.56
      ) {
        renderScale = Math.max(0.55, renderScale * 0.78);
        renderer.setPixelRatio(renderScale);
        renderer.shadowMap.enabled = false;
        for (const mat of mats.values()) mat.needsUpdate = true;
        resize();
        qualityTimer = 0;
      }
    }
    if (started && !paused && P.health > 0) {
      time += dt;
      updatePlayer(dt);
      if (!paused) {
        updateActors(dt);
        updateCaravans(dt);
        updateMissions();
        updateEffects(dt);
        raidTimer -= dt;
        autoSaveTimer += dt;
        if (raidTimer <= 0) {
          startRaid();
          raidTimer = 110;
        }
        if (autoSaveTimer >= 60) {
          saveGame(true);
          autoSaveTimer = 0;
        }
        if (notices.some((n) => n.expires < time)) {
          while (notices[0]?.expires < time) notices.shift();
          drawNotices();
        }
      }
    }
    updateCamera(started && !paused ? dt : 0);
    $("damage").style.opacity = String(hurtFlash * 0.65);
    motes.position.y = Math.sin(now * 0.0003) * 0.3;
    lodTimer += dt;
    if (lodTimer > 0.22) {
      updateTrees();
      lodTimer = 0;
      sun.target.position.set(camera.position.x, 0, camera.position.z);
      sun.position.set(camera.position.x - 65, 130, camera.position.z - 70);
    }
    hudTimer += dt;
    if (started && hudTimer > 0.14) {
      updateHUD();
      drawMap($("minimap"));
      hudTimer = 0;
    }
    renderer.render(scene, camera);
  }
  updateCamera(0);
  updateTrees();
  requestAnimationFrame(frame);
  $("start").disabled = false;
  $("start").textContent = "НАЧАТЬ ПУТЕШЕСТВИЕ →";
  $("continue").disabled = !readSave();
  $("load-status").textContent = "Мир готов · выберите, на чьей вы стороне.";
  // Explicitly opt-in deterministic fixtures for the browser regression suite.
  if (new URLSearchParams(location.search).has("test"))
    window.astraTest = {
      get player() {
        return P;
      },
      get actors() {
        return actors;
      },
      get caravans() {
        return caravans;
      },
      get lod() {
        return lodStats;
      },
      get stats() {
        return {
          fps: lastFPS,
          calls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          paused,
          activeModal,
          time,
          raidTimer,
        };
      },
      begin,
      spawn,
      injurePlayer,
      bandage,
      damagePlayer,
      hurtActor,
      interact,
      buy,
      openShop,
      commander,
      orderDefend,
      orderRaid,
      setOrder,
      updateMissions,
      saveGame,
      readSave,
      loadGame,
      validSave,
      serialize,
      closeModal,
      attack,
      kill,
      blocked,
      updateActors,
      updateCaravans,
      updatePlayer,
      updateTrees,
      updateHUD,
      terrain,
      step(seconds) {
        for (let t = 0; t < seconds; t += 0.05) {
          time += 0.05;
          updatePlayer(0.05);
          if (P.health <= 0) break;
          updateActors(0.05);
          updateCaravans(0.05);
          updateMissions();
        }
        updateCamera(0);
        updateHUD();
      },
      teleport(x, z, yaw = 0, pitch = 0) {
        Object.assign(P, { x, z, yaw, pitch, y: 0, vy: 0 });
        updateCamera(0);
        updateTrees();
        updateHUD();
      },
    };
  window.astraReady = true;
})().catch((error) => {
  console.error(error);
  const el = document.getElementById("load-status");
  if (el) el.textContent = "Мир не загрузился: " + error.message;
  const start = document.getElementById("start");
  if (start) {
    start.textContent = "ОБНОВИТЕ СТРАНИЦУ";
    start.disabled = true;
  }
});

'use strict';
// Each actor has its own skeleton and mixer. Vertex buffers, textures and clips are shared by costume.
const castSurfaces = new Map(),
  castImages = new Map(),
  castCostumes = new Map(),
  castClips = new Map();
function castValues(text, Type) {
  const bytes = Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
  return new Type(bytes.buffer);
}
function castImage(key, linear = false) {
  if (!key) return null;
  if (!castImages.has(key)) {
    const tex = new THREE.TextureLoader().load(borderCast.tex[key]);
    tex.flipY = false;
    tex.colorSpace = linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    castImages.set(key, tex);
  }
  return castImages.get(key);
}
function castSurface(name, style) {
  const id = [name, style.palette, style.hairColor, style.closedHelm].join('/');
  if (castSurfaces.has(id)) return castSurfaces.get(id);
  const src = borderCast.mats[name];
  let mat;
  if (src) {
    const hair = name.startsWith('MI_Hair');
    const coat = name === 'MI_Ranger' ? style.palette : null;
    mat = new THREE.MeshStandardMaterial({
      map: castImage(coat || src.color),
      normalMap: castImage(src.normal, true),
      roughnessMap: castImage(src.orm, true),
      metalnessMap: castImage(src.orm, true),
      normalScale: new THREE.Vector2(0.63, -0.63),
      color: hair ? style.hairColor : 0xffffff,
      roughness: name === 'MI_Eyes' ? 0.25 : 0.91,
      metalness: src.metal * 0.74,
      side: THREE.DoubleSide,
    });
    if (name === 'MI_Ranger' || name === 'MI_Peasant') {
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.fibres = { value: texture('craft-finish') };
        shader.vertexShader =
          'varying vec3 weavePoint;\n' +
          shader.vertexShader.replace(
            '#include <begin_vertex>',
            '#include <begin_vertex>\n weavePoint=position;',
          );
        shader.fragmentShader =
          'uniform sampler2D fibres; varying vec3 weavePoint;\n' +
          shader.fragmentShader.replace(
            '#include <color_fragment>',
            '#include <color_fragment>\n diffuseColor.rgb*=.81+.47*sqrt(texture2D(fibres,vec2(.505,.005)+.49*fract(vec2(weavePoint.x+weavePoint.z*.73,weavePoint.y)*5.)).r);',
          );
      };
    } else if (style.closedHelm && (name.startsWith('MI_Superhero') || name === 'MI_Eyes' || hair)) {
      // A fitted visor shades the part of the face visible through its slit, even without shadow maps.
      mat.onBeforeCompile = (shader) => {
        shader.vertexShader =
          'varying float visorShade;\n' +
          shader.vertexShader.replace(
            '#include <begin_vertex>',
            '#include <begin_vertex>\n visorShade=smoothstep(1.596,1.675,position.y);',
          );
        shader.fragmentShader =
          'varying float visorShade;\n' +
          shader.fragmentShader.replace(
            '#include <color_fragment>',
            '#include <color_fragment>\n diffuseColor.rgb*=mix(1.,.095,visorShade);',
          );
      };
    }
  } else if (name.startsWith('relic-')) {
    const maps = borderCast.relicMats[name.slice(6)],
      scan = name.includes('cuirass') || name.includes('wawel');
    const sallet = name.includes('sallet');
    const image = name.includes('cuirass') && style.palette !== 'ash' ? 'cuirassCold' : maps.map;
    mat = new THREE.MeshStandardMaterial({
      map: castImage(image),
      normalMap: castImage(maps.normal, true),
      normalScale: new THREE.Vector2(0.69, -0.69),
      roughnessMap: castImage(maps.orm, true),
      metalnessMap: castImage(maps.orm, true),
      envMapIntensity: sallet ? 0.42 : 0.65,
      metalness: scan ? 0.45 : sallet ? 0.63 : 0.5,
      roughness: sallet ? 0.83 : 0.73,
      color: sallet ? 0x78878d : style.palette === 'ash' ? 0xd2c2ba : 0xfbf8ed,
      side: THREE.DoubleSide,
    });
    if (sallet) {
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.wornIron = { value: texture('craft-finish') };
        shader.vertexShader =
          'varying vec3 armourPoint;\n' +
          shader.vertexShader.replace(
            '#include <begin_vertex>',
            '#include <begin_vertex>\n armourPoint=position;',
          );
        shader.fragmentShader =
          'varying vec3 armourPoint; uniform sampler2D wornIron;\n' +
          shader.fragmentShader.replace(
            '#include <color_fragment>',
            `#include <color_fragment>
          vec2 ironUV=fract(vec2(armourPoint.x+armourPoint.z*.74,armourPoint.y)*3.1);
          float grain=texture2D(wornIron,vec2(.504,.504)+ironUV*.486).r;
          diffuseColor.rgb*=.54+.84*sqrt(grain);`,
          );
      };
    }
  } else if (name === 'mail') {
    mat = new THREE.MeshStandardMaterial({
      map: castImage('rivetMail'),
      color: 0xa3acab,
      metalness: 0.41,
      roughness: 0.74,
      side: THREE.DoubleSide,
    });
  } else if (name === 'arms') {
    const art = texture(style.palette === 'moss' ? 'standard-pine' : 'standard-sun');
    mat = new THREE.MeshStandardMaterial({ map: art, side: THREE.DoubleSide, roughness: 0.77 });
  } else {
    const colors = {
      steel: style.iron || 0x858f91,
      brass: 0xb49b60,
      black: 0x343335,
      leather: 0x4b3429,
      ear: 0xaf7f5f,
      silk: style.palette === 'ash' ? 0x5f3342 : 0x3e5261,
      blade: 0xc4d1d1,
    };
    const alloy = ['steel', 'brass', 'blade'].includes(name);
    mat = new THREE.MeshStandardMaterial({
      color: colors[name],
      metalness: alloy ? 0.59 : 0.07,
      roughness: name === 'blade' ? 0.3 : alloy ? 0.48 : 0.85,
      side: THREE.DoubleSide,
    });
    if (alloy && name !== 'blade') {
      const atlas = texture('craft-finish');
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.weaponPatina = { value: atlas };
        shader.vertexShader =
          'varying vec3 forgePoint;\n' +
          shader.vertexShader.replace(
            '#include <begin_vertex>',
            '#include <begin_vertex>\n forgePoint=position;',
          );
        shader.fragmentShader =
          'uniform sampler2D weaponPatina; varying vec3 forgePoint;\n' +
          shader.fragmentShader.replace(
            '#include <color_fragment>',
            `
          #include <color_fragment>
          vec2 coords=fract(vec2(forgePoint.x*.9+forgePoint.z*.67,forgePoint.y*1.45));
          float grain=texture2D(weaponPatina,vec2(.504,.504)+coords*.486).r;
          diffuseColor.rgb*=.60+.82*sqrt(grain);
        `,
          );
      };
    }
  }
  castSurfaces.set(id, mat);
  return mat;
}
function roleCostume(kind, tag) {
  if (tag === 'carter') kind = 'merchant';
  if (tag === 'vigil') kind = 'vigil';
  if (tag === 'keeper') kind = 'keeper';
  const guards = ['guard', 'escort', 'sentry', 'commander', 'vigil'],
    enemy = ['lord', 'regent', 'firekeeper', 'keeper'];
  if (guards.includes(kind))
    return {
      id: kind,
      sex: kind === 'commander' ? 'Female' : 'Male',
      outfit: 'Ranger',
      palette: 'imperial',
      plate: true,
      shield: true,
      blade: true,
      helm: true,
      closedHelm: kind !== 'commander' && kind !== 'vigil',
      captain: kind === 'commander' || kind === 'vigil',
      hair: kind === 'commander' ? ['Long'] : kind === 'vigil' ? ['Beard'] : [],
      hairColor: 0x574537,
      iron: 0x88939a,
    };
  if (enemy.includes(kind))
    return {
      id: kind,
      sex: 'Male',
      outfit: 'Ranger',
      palette: 'ash',
      plate: true,
      blade: true,
      helm: kind !== 'keeper',
      closedHelm: kind === 'lord' || kind === 'firekeeper',
      captain: true,
      hood: false,
      hair: kind === 'keeper' ? ['Beard', 'SimpleParted'] : kind === 'regent' ? ['Beard'] : [],
      hairColor: 0x665950,
      iron: 0x585e65,
    };
  if (kind === 'elf' || kind === 'spy' || kind === 'herbalist')
    return {
      id: kind,
      sex: kind === 'spy' ? 'Male' : 'Female',
      outfit: 'Ranger',
      palette: 'moss',
      blade: true,
      elf: true,
      hood: kind !== 'herbalist',
      hair: kind === 'herbalist' ? ['Buns'] : kind === 'spy' ? ['Buzzed'] : ['BuzzedFemale'],
      hairColor: 0x755c42,
    };
  const sex = tag === 'carter' || tag === 'scribe' ? 'Male' : 'Female';
  return {
    id: ['carter', 'scribe', 'healer'].includes(tag) ? tag : 'village',
    sex,
    outfit: 'Peasant',
    palette: 'moss',
    hair: tag === 'scribe' ? ['SimpleParted'] : sex === 'Male' ? ['SimpleParted', 'Beard'] : ['Buns'],
    hairColor: tag === 'healer' ? 0xaea28f : sex === 'Male' ? 0x564a42 : 0x765744,
  };
}
function vertexPart(d) {
  const p = castValues(d.p, Int16Array),
    normal = castValues(d.n, Int8Array),
    uv = castValues(d.uv, Int16Array);
  return {
    position: Float32Array.from(p, (v) => v * 0.0001),
    normal: Float32Array.from(normal, (v) => v / 127),
    uv: Float32Array.from(uv, (v) => v / 16384),
    skinIndex: castValues(d.j, Uint8Array),
    skinWeight: Float32Array.from(castValues(d.w, Uint8Array), (v) => v / 255),
    index: castValues(d.ix, Uint16Array),
  };
}
function combineCast(parts) {
  const geometry = new THREE.BufferGeometry();
  for (const [name, size, Type] of [
    ['position', 3, Float32Array],
    ['normal', 3, Float32Array],
    ['uv', 2, Float32Array],
    ['skinIndex', 4, Uint16Array],
    ['skinWeight', 4, Float32Array],
  ]) {
    const arr = new Type(parts.reduce((v, p) => v + p[name].length, 0));
    let offset = 0;
    for (const p of parts) {
      arr.set(p[name], offset);
      offset += p[name].length;
    }
    geometry.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  const indices = [],
    count = geometry.attributes.position.count;
  let offset = 0;
  for (const part of parts) {
    for (const i of part.index) indices.push(i + offset);
    offset += part.position.length / 3;
  }
  geometry.setIndex(
    new THREE.BufferAttribute(count < 65536 ? new Uint16Array(indices) : new Uint32Array(indices), 1),
  );
  return geometry;
}
function castArmor(style, add) {
  const female = style.sex === 'Female',
    drop = female ? 0.043 : 0;
  const rig = borderCast.rigs[style.sex],
    mat4 = new THREE.Matrix4();
  function piece(surface, bone, g, matrix) {
    if (matrix) g.applyMatrix4(matrix);
    const p = g.attributes.position,
      n = p.count,
      j = new Uint16Array(n * 4),
      w = new Float32Array(n * 4),
      b = rig.bones.indexOf(bone);
    for (let v = 0; v < n; v++) {
      j[v * 4] = b;
      w[v * 4] = 1;
    }
    add(surface, {
      position: p.array,
      normal: g.attributes.normal.array,
      uv: g.attributes.uv.array,
      index: g.index ? g.index.array : Uint32Array.from({ length: n }, (_, i) => i),
      skinIndex: j,
      skinWeight: w,
    });
    g.dispose();
  }
  function shell(name, bone, rows, segments = 28) {
    const p = [],
      uv = [],
      ix = [];
    for (let row = 0; row < rows.length; row++) {
      const [x, y, z, rx, rz, edge = 0] = rows[row];
      for (let i = 0; i <= segments; i++) {
        const t = (i / segments) * 2 * Math.PI,
          cs = Math.cos(t),
          k = p.length / 3;
        p.push(x + rx * Math.sin(t), y - drop + edge * cs * cs, z + rz * cs);
        uv.push(
          (i / segments) * (name === 'mail' ? 3 : 1),
          (row / (rows.length - 1)) * (name === 'mail' ? 0.8 : 1),
        );
        if (row && i) ix.push(k - segments - 2, k - segments - 1, k, k - segments - 2, k, k - 1);
      }
    }
    piece(name, bone, geometry(p, uv, ix));
  }
  function line(name, bone, a, b, w, r = w) {
    const v = new THREE.Vector3(...a),
      to = new THREE.Vector3(...b),
      axis = to.clone().sub(v),
      mid = v.add(to).multiplyScalar(0.5);
    mid.y -= drop;
    mat4.compose(
      mid,
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.clone().normalize()),
      new THREE.Vector3(1, 1, 1),
    );
    piece(name, bone, new THREE.CylinderGeometry(r, w, axis.length(), 7), mat4);
  }
  function plate(name, bone, points, indices, uv) {
    piece(
      name,
      bone,
      geometry(
        points.flatMap(([x, y, z]) => [x, y - drop, z]),
        uv || points.flatMap(([x, y, z]) => [0.5 + x, y]),
        indices,
      ),
    );
  }
  if (style.plate) {
    const chest = 'spine_03';
    // Mail at the collar fills the curved opening above the museum breastplate.
    shell(
      'mail',
      chest,
      [
        [0, 1.425, -0.034, 0.161, 0.129, -0.045],
        [0, 1.487, -0.037, 0.13, 0.103, -0.018],
        [0, 1.522, -0.04, 0.095, 0.079],
        [0, 1.551, -0.037, 0.073, 0.067],
      ],
      32,
    );
    for (const side of [-1, 1]) {
      const belt = [
        [1.445, -0.131],
        [1.505, -0.064],
        [1.512, 0.008],
        [1.485, 0.062],
        [1.459, 0.086],
      ];
      const edge = female ? 0.124 : 0.136,
        points = belt.flatMap(([y, z]) => [
          [side * (edge - 0.014), y, z],
          [side * (edge + 0.014), y, z],
        ]);
      const ix = [];
      for (let i = 0; i < belt.length - 1; i++) {
        const j = i * 2;
        ix.push(j, j + 1, j + 2, j + 1, j + 3, j + 2);
      }
      plate('leather', chest, points, ix);
      line(
        'brass',
        chest,
        [side * (edge - 0.015), 1.483, 0.066],
        [side * (edge + 0.015), 1.483, 0.066],
        0.003,
      );
      const shin = side > 0 ? 'calf_l' : 'calf_r',
        x = side * 0.1;
      for (const y of [0.278, 0.397]) {
        shell(
          'leather',
          shin,
          [
            [x, y - 0.012, -0.045, 0.075, 0.092],
            [x, y + 0.012, -0.045, 0.075, 0.092],
          ],
          16,
        );
      }
    }
  }
  if (style.elf) {
    for (const side of [-1, 1])
      plate(
        'ear',
        'Head',
        [
          [side * 0.079, 1.721, -0.009],
          [side * 0.103, 1.678, -0.02],
          [side * 0.147, 1.752, -0.067],
          [side * 0.106, 1.711, -0.04],
        ],
        [0, 1, 3, 1, 2, 3, 2, 0, 3],
      );
  }
  if (style.blade) {
    // Bounds measured in each authored bind pose from the closed fingers of the armed stance.
    const origin = female ? [-0.72543, 1.39867, -0.05267] : [-0.81923, 1.43287, -0.0625],
      width = female ? [-0.08918, 0.99583, -0.01905] : [-0.09243, 0.99568, -0.00832],
      reach = female ? [-0.26743, -0.00551, 0.96356] : [-0.24307, -0.01446, 0.9699],
      face = female ? [0.95944, 0.09102, 0.2668] : [0.9656, 0.09167, 0.24336];
    const held = (u, v, d) => [
      origin[0] + width[0] * u + face[0] * v + reach[0] * d,
      origin[1] + drop + width[1] * u + face[1] * v + reach[1] * d,
      origin[2] + width[2] * u + face[2] * v + reach[2] * d,
    ];
    const b = 'hand_r',
      points = [],
      uv = [],
      ind = [];
    for (const [d, w, h] of [
      [0.1, 0.024, 0.007],
      [0.16, 0.029, 0.009],
      [0.58, 0.023, 0.006],
      [0.73, 0.016, 0.004],
      [0.83, 0.0007, 0.0003],
    ]) {
      for (const [off, v, u] of [
        [-w, 0, 0],
        [-w * 0.13, h, 0.43],
        [w * 0.13, h, 0.57],
        [w, 0, 1],
        [0, -h, 0.5],
      ]) {
        points.push(held(off, v, d));
        uv.push(u, d);
      }
    }
    for (let j = 0; j < 4; j++)
      for (let k = 0; k < 5; k++) {
        const a = j * 5 + k,
          q = j * 5 + ((k + 1) % 5);
        ind.push(a, a + 5, q, a + 5, q + 5, q);
      }
    plate('blade', b, points, ind, uv);
    line('leather', b, held(0, 0, -0.095), held(0, 0, 0.097), 0.0175);
    line('brass', b, held(-0.093, 0, 0.103), held(0.093, 0, 0.103), 0.012);
    line('brass', b, held(0, 0, -0.121), held(0, 0, -0.094), 0.019, 0.025);
  }
  if (style.shield) {
    const b = 'lowerarm_l',
      cx = female ? 0.5428 : 0.6104,
      y = female ? 1.5538 : 1.5482,
      z = female ? -0.0477 : -0.0617;
    const outline = [
      [-0.229, -0.129],
      [-0.255, 0],
      [-0.229, 0.129],
      [-0.18, 0.165],
      [0.014, 0.162],
      [0.127, 0.118],
      [0.269, 0],
      [0.127, -0.118],
      [0.014, -0.162],
      [-0.18, -0.165],
    ];
    // The shield is strapped to the outside of the arm. In the combat guard the point faces the ground.
    const place = (down, across, rise) => [
      cx + 0.2023 * down - 0.9786 * across - 0.0383 * rise,
      y + 0.0776 * down - 0.023 * across + 0.9967 * rise,
      z - 0.9762 * down - 0.2046 * across + 0.0713 * rise,
    ];
    const ring = outline.map(([down, across]) =>
      place(down * 1.14, across * 1.18, (1 - (across / 0.18) ** 2) * 0.027),
    );
    const center = place(0, 0, 0.064);
    const indices = outline.flatMap((p, i) => [i, (i + 1) % outline.length, outline.length]);
    const uv = outline.flatMap(([xx, zz]) => [0.5 + zz / 0.37, 0.5 - xx / 0.57]);
    uv.push(0.5, 0.5);
    plate('arms', b, [...ring, center], indices, uv);
    for (let i = 0; i < ring.length; i++) line('brass', b, ring[i], ring[(i + 1) % ring.length], 0.0065);
  }
}
function costumeGeometry(style) {
  if (castCostumes.has(style.id)) return castCostumes.get(style.id);
  const groups = new Map(),
    add = (mat, part) => {
      if (!groups.has(mat)) groups.set(mat, []);
      groups.get(mat).push(part);
    };
  const take = (file, predicate = () => true) => {
    for (const [part, ids] of Object.entries(borderCast.parts[file] || {})) {
      if (!predicate(part)) continue;
      for (const id of ids) {
        const d = borderCast.mesh[id],
          a = vertexPart(d);
        if (file.startsWith('Superhero_')) {
          const type = style.id.split('/')[0],
            mane = style.sex === 'Female',
            eye = mane ? 1.654 : 1.699;
          const jaw =
            type === 'village'
              ? 0.085
              : type === 'regent'
                ? 0.11
                : type === 'elf' || type === 'spy'
                  ? -0.085
                  : 0;
          const nose = type === 'commander' ? 0.007 : type === 'regent' ? 0.009 : type === 'elf' ? -0.004 : 0;
          for (let i = 0; i < a.position.length; i += 3) {
            const x = a.position[i],
              y = a.position[i + 1],
              z = a.position[i + 2];
            const lower = Math.exp(-(((y - (eye - 0.075)) / 0.06) ** 2));
            a.position[i] = x * (1 + jaw * lower);
            if (z > 0.055)
              a.position[i + 2] += nose * Math.exp(-((x / 0.022) ** 2 + ((y - eye + 0.033) / 0.031) ** 2));
            if (style.closedHelm && d.m.startsWith('MI_Superhero') && y > eye + 0.022) {
              // Pull the hidden crown inside the metal above the visor, retaining the exposed face and eyes.
              const crown = THREE.MathUtils.smoothstep(y, eye + 0.022, eye + 0.089);
              a.position[i] *= 1 - 0.25 * crown;
              a.position[i + 1] -= 0.036 * crown;
              a.position[i + 2] = -0.017 + (a.position[i + 2] + 0.017) * (1 - 0.25 * crown);
            }
          }
        }
        if (style.helm && file === 'Hair_Long') {
          const brow = style.sex === 'Female' ? 1.671 : 1.715;
          for (let i = 0; i < a.position.length; i += 3) {
            const t = THREE.MathUtils.smoothstep(a.position[i + 1], brow - 0.023, brow + 0.029);
            a.position[i] *= 1 - 0.54 * t;
            a.position[i + 2] = -0.028 + (a.position[i + 2] + 0.028) * (1 - 0.62 * t);
          }
        }
        add(d.m, a);
      }
    }
  };
  take(style.sex + '_' + style.outfit, (name) => style.hood || !name.includes('Head_Hood'));
  if (style.plate) {
    const bones = borderCast.rigs[style.sex].bones;
    const swap = bones.map((n) => {
      const mirror = n.endsWith('_l') ? n.slice(0, -2) + '_r' : n.endsWith('_r') ? n.slice(0, -2) + '_l' : n;
      return Math.max(0, bones.indexOf(mirror));
    });
    const parts = borderCast.parts[style.sex + '_Ranger'];
    for (const [name, ids] of Object.entries(parts))
      if (name.includes('Pauldron'))
        for (const id of ids) {
          const d = borderCast.mesh[id],
            a = vertexPart(d);
          for (let i = 0; i < a.position.length; i += 3) {
            a.position[i] *= -1;
            a.normal[i] *= -1;
          }
          for (let i = 0; i < a.skinIndex.length; i++) a.skinIndex[i] = swap[a.skinIndex[i]];
          for (let i = 0; i < a.index.length; i += 3)
            [a.index[i + 1], a.index[i + 2]] = [a.index[i + 2], a.index[i + 1]];
          add(d.m, a);
        }
  }
  take('Superhero_' + style.sex + '_FullBody');
  for (const hair of style.hair) take('Hair_' + hair);
  if (style.plate) {
    const wear = (name) => {
      for (const d of borderCast.relics[name + style.sex]) {
        const a = vertexPart(d);
        if (name === 'sallet' || name === 'wawel') {
          for (let i = 0; i < a.position.length; i += 3) {
            if (name === 'sallet') {
              // The source sallet's opening is at 1.739 m, the wearer's eye line is at 1.699 m.
              a.position[i + 1] -= 0.04;
              a.position[i + 2] += 0.043 * THREE.MathUtils.smoothstep(a.position[i + 2], -0.145, 0.075);
            } else {
              a.position[i + 2] += 0.019 * THREE.MathUtils.smoothstep(a.position[i + 2], -0.14, 0.08);
              a.position[i + 1] -= 0.008;
            }
          }
        }
        if (name === 'cuirass')
          for (let i = 0; i < a.position.length; i += 3) {
            const t = THREE.MathUtils.smoothstep(
              a.position[i + 1],
              style.sex === 'Female' ? 1.3 : 1.34,
              (style.sex === 'Female' ? 1.3 : 1.34) + 0.15,
            );
            a.position[i + 2] += 0.012 * t;
          }
        add(d.m, a);
      }
    };
    wear('cuirass');
    if (style.helm)
      wear(
        style.id.startsWith('firekeeper') || style.id.startsWith('lord')
          ? 'wawel'
          : style.captain
            ? 'viking'
            : 'sallet',
      );
  }
  castArmor(style, add);
  const kit = [...groups].map(([material, parts]) => [combineCast(parts), castSurface(material, style)]);
  castCostumes.set(style.id, kit);
  return kit;
}
function appearance(kind, tag = '', unarmed = false) {
  const style = roleCostume(kind, tag);
  if (tag === 'hero' && !unarmed && !style.shield) {
    style.shield = true;
    style.id += '/shield';
  }
  if (unarmed) {
    style.blade = false;
    style.shield = false;
    style.id += '/peace';
  }
  const rig = borderCast.rigs[style.sex],
    actor = new THREE.Group();
  const bones = rig.bones.map((name, i) => {
    const bone = new THREE.Bone();
    bone.name = name;
    bone.position.fromArray(rig.pos[i]);
    bone.quaternion.fromArray(rig.q[i]);
    return bone;
  });
  bones.forEach((b, i) => (rig.p[i] < 0 ? actor : bones[rig.p[i]]).add(b));
  actor.updateMatrixWorld(true);
  const skel = new THREE.Skeleton(bones);
  for (const [geo, mat] of costumeGeometry(style)) {
    const m = new THREE.SkinnedMesh(geo, mat);
    m.bind(skel);
    m.castShadow = m.receiveShadow = true;
    m.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.85, 0), 2.0);
    actor.add(m);
  }
  actor.userData.actorStyle = style;
  actor.userData.mixer = new THREE.AnimationMixer(actor);
  actor.userData.skeleton = skel;
  actor.scale.setScalar(kind === 'regent' ? 1.1 : 1);
  poseCharacter(actor, style.plate && !unarmed ? 'watch' : 'idle', 0);
  return actor;
}
function releaseCharacter(actor) {
  if (!actor || !actor.userData.skeleton) return;
  const data = actor.userData;
  data.mixer.stopAllAction();
  data.mixer.uncacheRoot(actor);
  data.skeleton.dispose();
  delete data.skeleton;
  delete data.mixer;
  delete data.action;
}
function animationFor(sex, state) {
  const key = sex + '/' + state;
  if (castClips.has(key)) return castClips.get(key);
  const rig = borderCast.rigs[sex],
    d = borderCast.clips[sex][state] || borderCast.clips[sex].idle,
    times = Float32Array.from({ length: d.n }, (_, i) => (d.t * i) / (d.n - 1));
  const tracks = d.q.map((bytes, i) => {
    const v = Float32Array.from(castValues(bytes, Int16Array), (x) => x / 32767);
    return new THREE.QuaternionKeyframeTrack(rig.bones[i] + '.quaternion', v.length === 4 ? [0] : times, v);
  });
  tracks.push(
    new THREE.VectorKeyframeTrack(
      'pelvis.position',
      times,
      Float32Array.from(castValues(d.hip, Int16Array), (n) => n * 0.0001),
    ),
  );
  const clip = new THREE.AnimationClip(state, d.t, tracks);
  castClips.set(key, clip);
  return clip;
}
function poseCharacter(actor, state, t, rate = 1) {
  const u = actor.userData,
    mixer = u.mixer;
  if (!mixer) return;
  const isLoop = !['death', 'slash', 'slashBack', 'stagger', 'heavy'].includes(state);
  if (state !== u.state) {
    const next = mixer.clipAction(animationFor(u.actorStyle.sex, state));
    next.reset().setLoop(isLoop ? THREE.LoopRepeat : THREE.LoopOnce, isLoop ? Infinity : 1);
    next.clampWhenFinished = !isLoop;
    if (u.action && u.previousTime !== undefined && t - u.previousTime < 0.3 && state !== 'drive') {
      const blend = state === 'stagger' ? 0.065 : state === 'block' || u.state === 'block' ? 0.19 : 0.13;
      u.action.fadeOut(blend);
      next.fadeIn(blend);
    } else {
      mixer.stopAllAction();
    }
    next.play();
    u.action = next;
    u.state = state;
    if (isLoop && u.phase !== undefined && state !== 'drive')
      next.time = (u.phase * 0.103) % next.getClip().duration;
  }
  u.action.timeScale = rate;
  const dt = u.previousTime === undefined ? 0 : Math.min(0.12, Math.max(0, t - u.previousTime));
  u.previousTime = t;
  mixer.update(dt);
}
function animateCastActor(m, a, t, fellBeforeLoad) {
  const u = m.userData;
  u.phase = a.id;
  if (a.hp <= 0) {
    poseCharacter(m, 'death', t, 1.18);
    if (fellBeforeLoad) {
      u.action.time = u.action.getClip().duration;
      u.mixer.update(0);
    }
    return;
  }
  let state = u.actorStyle.plate ? 'watch' : 'idle',
    rate = 1;
  if ((u.windup > 0 && !(a.windup > 0)) || (u.cool !== undefined && a.cd > u.cool + 0.24 && !a.windup)) {
    u.strikeUntil = t + 0.61;
    u.counter = (u.counter || 0) + 1;
  }
  u.windup = a.windup || 0;
  u.cool = a.cd;
  if (a.stagger > 0) state = 'stagger';
  else if (a.windup > 0) {
    state = 'block';
    rate = 0.78;
  } else if (u.strikeUntil > t) {
    state = u.counter % 2 ? 'slash' : 'slashBack';
    rate = 1.35;
  } else if (a.walk) {
    state = a.team === 'hostile' || a.team === 'friend' ? 'run' : 'walk';
    rate = a.team === 'escort' && Number.isFinite(a.gaitSpeed) ? clamp(a.gaitSpeed / 1.45, 0.58, 1.7) : 1.08;
  }
  poseCharacter(m, state, t, rate);
}

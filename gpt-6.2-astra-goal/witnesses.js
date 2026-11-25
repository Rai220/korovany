'use strict';

function lakeWitnessStyle(tag) {
  const vera = tag === 'vera';
  return {
    id: tag,
    witness: tag,
    sex: vera ? 'Female' : 'Male',
    outfit: 'Peasant',
    palette: tag,
    hair: vera ? ['BuzzedFemale'] : ['Beard', 'Buzzed'],
    hairColor: vera ? 0x766255 : 0x777267,
  };
}
const witnessCloth = new Map();
function wovenWool(kind) {
  if (witnessCloth.has(kind)) return witnessCloth.get(kind);
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const q = c.getContext('2d'),
    p = q.createImageData(256, 256);
  const base = kind === 'indigo' ? [62, 81, 91] : kind === 'felt' ? [77, 63, 52] : [93, 67, 49];
  let seed = 271;
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 256; x++) {
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
      const twill = (((x + ((x >> 4) % 2 ? -y : y)) % 7) + 7) % 7;
      const nap = 3 * Math.sin((Math.PI * 2 * y) / 32) + 2 * Math.cos((Math.PI * 2 * (x + y)) / 64);
      const f = nap + (twill < 2 ? 10 : -3) + (seed / 4294967296 - 0.5) * 21;
      const k = (y * 256 + x) * 4;
      for (let j = 0; j < 3; j++) p.data[k + j] = base[j] + f;
      p.data[k + 3] = 255;
    }
  q.putImageData(p, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 2.4);
  tex.anisotropy = 4;
  const m = new THREE.MeshStandardMaterial({
    map: tex,
    bumpMap: tex,
    bumpScale: 0.0014,
    roughness: 0.99,
    side: THREE.DoubleSide,
  });
  witnessCloth.set(kind, m);
  return m;
}
function tailorWitness(style, { piece, line, geometry, drop }) {
  const vera = style.witness === 'vera',
    wool = vera ? 'indigo' : 'peat';
  // Open-front cape with a weighted scalloped hem, woven selvedge and hand-sewn repairs.
  const make = (row, angle) => {
    const rim = [0.087, 0.118, 0.229, 0.254, 0.219],
      depth = [0.081, 0.11, 0.151, 0.164, 0.159];
    const level = [1.558, 1.522, 1.456, 1.371, 1.07];
    const fold =
      (0.008 + (0.009 * row) / 4) * Math.sin(angle * 13 + 0.48 * row) + 0.004 * Math.cos(17 * angle);
    const f = Math.max(0, Math.cos(angle));
    return [
      (rim[row] + fold) * Math.sin(angle),
      level[row] - drop + (row === 4 ? 0.18 * f + 0.042 * Math.sin(angle * 2 + 0.4) : 0),
      -0.028 + (depth[row] + fold) * Math.cos(angle),
    ];
  };
  const verts = [],
    uv = [],
    ix = [],
    cols = 59;
  for (let r = 0; r < 5; r++)
    for (let i = 0; i <= cols; i++) {
      const a = 0.17 + ((2 * Math.PI - 0.34) * i) / cols,
        k = verts.length / 3;
      verts.push(...make(r, a));
      uv.push(i / cols, r / 4);
      if (r && i) ix.push(k - cols - 2, k - cols - 1, k, k - cols - 2, k, k - 1);
    }
  piece(wool, 'spine_03', geometry(verts, uv, ix));
  // Narrow copper-and-flax bindings on the front lapels. Helpers use male-height coordinates.
  for (const a of [0.17, 2 * Math.PI - 0.17]) {
    const edge = [0, 1, 2, 3, 4].map((r) => {
      const q = make(r, a);
      q[1] += drop;
      return q;
    });
    for (let i = 1; i < edge.length; i++) line('leather', 'spine_03', edge[i - 1], edge[i], 0.0048);
  }
  line('brass', 'spine_03', [-0.058, 1.476, 0.117], [0.071, 1.48, 0.123], 0.005);
  line('brass', 'spine_03', [0.05, 1.47, 0.126], [0.069, 1.488, 0.126], 0.0095);
  // Slouching knitted cap / linen head wrap. Its top bends toward the back of the skull.
  const h = [],
    hu = [],
    hi = [],
    rings = vera
      ? [
          [1.739, 0.105, 0.103, -0.025],
          [1.765, 0.106, 0.116, -0.029],
          [1.799, 0.097, 0.105, -0.039],
          [1.82, 0.076, 0.088, -0.047],
          [1.82, 0.006, 0.008, -0.064],
        ]
      : [
          [1.739, 0.107, 0.108, -0.023],
          [1.757, 0.114, 0.118, -0.025],
          [1.79, 0.113, 0.116, -0.031],
          [1.819, 0.095, 0.11, -0.052],
          [1.835, 0.064, 0.077, -0.079],
          [1.814, 0.007, 0.009, -0.115],
        ];
  for (let r = 0; r < rings.length; r++)
    for (let i = 0; i <= 44; i++) {
      const a = (2 * Math.PI * i) / 44,
        k = h.length / 3,
        [y, rx, rz, z] = rings[r];
      h.push(
        rx * Math.sin(a),
        y - drop + 0.008 * Math.sin(a - 0.7) - 0.011 * (1 - Math.cos(a)),
        z + rz * Math.cos(a),
      );
      hu.push(i / 44, r / (rings.length - 1));
      if (r && i) hi.push(k - 46, k - 45, k, k - 46, k, k - 1);
    }
  piece(vera ? 'indigo' : 'felt', 'Head', geometry(h, hu, hi));
  const band = [],
    bu = [],
    bi = [];
  for (let j = 0; j < 4; j++)
    for (let i = 0; i <= 48; i++) {
      const a = (i * Math.PI) / 24,
        k = band.length / 3,
        radius = (vera ? 0.106 : 0.111) + (j === 1 || j === 2 ? 0.007 : 0);
      band.push(
        radius * Math.sin(a),
        1.741 - drop + j * 0.006 + 0.01 * Math.sin(a - 0.5) - 0.009 * (1 - Math.cos(a)),
        -0.026 + (radius + 0.004) * Math.cos(a),
      );
      bu.push(i / 48, j / 3);
      if (i && j) bi.push(k - 50, k - 49, k, k - 50, k, k - 1);
    }
  piece(vera ? 'indigo' : 'peat', 'Head', geometry(band, bu, bi));
  if (vera) {
    const tail = [],
      tu = [],
      ti = [],
      rows = [
        [1.756, -0.071, -0.093, 0.028],
        [1.724, -0.083, -0.105, 0.029],
        [1.68, -0.089, -0.108, 0.038],
        [1.618, -0.088, -0.104, 0.035],
        [1.557, -0.076, -0.105, 0.03],
        [1.495, -0.056, -0.112, 0.022],
      ];
    for (let j = 0; j < rows.length; j++)
      for (let i = 0; i < 6; i++) {
        const [y, x, z, w] = rows[j],
          k = tail.length / 3,
          f = i / 5;
        tail.push(
          x + (f - 0.5) * w * 2,
          y - drop + 0.008 * Math.sin(Math.PI * f),
          z + 0.006 * Math.cos(f * Math.PI * 4 + j * 0.3),
        );
        tu.push(f, j / 5);
        if (i && j) ti.push(k - 7, k - 6, k, k - 7, k, k - 1);
      }
    piece('indigo', 'Head', geometry(tail, tu, ti));
  }
  if (!vera) {
    // The old ferryman keeps gate keys on two lengths of leather cord.
    for (let i = 0; i < 2; i++) {
      const x = 0.072 + 0.022 * i,
        y = 1.272 - i * 0.019;
      line('leather', 'spine_03', [0.02, 1.478, 0.142], [x, y + 0.045, 0.146], 0.003);
      line('brass', 'spine_03', [x, y + 0.05, 0.148], [x, y, 0.149], 0.005);
      line('brass', 'spine_03', [x, y + 0.005, 0.148], [x + 0.012, y + 0.005, 0.148], 0.005);
    }
  }
}
function shapeWitnessFace(g, mat, style) {
  const face = mat.startsWith('MI_Superhero'),
    eye = mat === 'MI_Eyes',
    beard = mat.startsWith('MI_Hair');
  if (!face && !eye && !beard) return;
  const p = g.attributes.position,
    vowel = new Float32Array(p.count * 3),
    blink = new Float32Array(p.count * 3);
  const eyeY = style.sex === 'Female' ? 1.654 : 1.699,
    mouth = eyeY - 0.084;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i),
      k = i * 3;
    if (z < 0.008 || y < eyeY - 0.22 || y > eyeY + 0.1) continue;
    const front = THREE.MathUtils.smoothstep(z, 0.012, 0.09);
    const jaw =
      front *
      Math.exp(-((x / 0.065) ** 2)) *
      Math.exp(-(((y - mouth + 0.024) / 0.052) ** 2)) *
      (1 - THREE.MathUtils.smoothstep(y, mouth - 0.008, mouth + 0.004));
    if (!eye) {
      vowel[k + 1] = -0.014 * jaw;
      vowel[k + 2] = 0.005 * jaw;
    }
    const orbit = Math.exp(-(((Math.abs(x) - 0.034) / 0.021) ** 2));
    if (eye) blink[k + 1] = -(y - eyeY) * 0.93;
    else if (face && y > eyeY - 0.003)
      blink[k + 1] = -0.012 * orbit * front * Math.exp(-(((y - eyeY - 0.006) / 0.01) ** 2));
  }
  g.morphAttributes.position = [
    new THREE.Float32BufferAttribute(vowel, 3),
    new THREE.Float32BufferAttribute(blink, 3),
  ];
  g.morphTargetsRelative = true;
}
function animateWitness(actor, t) {
  const u = actor.userData,
    vera = u.actorStyle.witness === 'vera',
    speaker = vera ? 'Вера' : 'Савва';
  let jaw = 0;
  if (realmVoice.active && realmVoice.speaker === speaker) {
    const envelope = typeof oathMouth !== 'undefined' && oathMouth[realmVoice.words];
    if (envelope) {
      const at = realmVoice.playhead * 25,
        i = Math.floor(at),
        from = envelope.charCodeAt(i) - 65,
        to = envelope.charCodeAt(i + 1) - 65;
      if (Number.isFinite(from)) jaw = (from + (Number.isFinite(to) ? (to - from) * (at - i) : 0)) / 25;
    } else jaw = 0.32 + 0.2 * Math.sin(19 * t);
  }
  const pulse = (t + (vera ? 1.13 : 0.32)) % 3.87;
  const lid = pulse < 0.15 ? Math.sin((Math.PI * pulse) / 0.15) ** 2 : 0;
  for (const m of actor.children)
    if (m.morphTargetInfluences) {
      m.morphTargetInfluences[0] = jaw;
      m.morphTargetInfluences[1] = lid;
    }
}

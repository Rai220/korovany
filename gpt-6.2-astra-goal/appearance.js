'use strict';

// A kit is one cut of clothing and armour. Dye, complexion, build and carriage vary independently.
// Only six cuts per role need vertex buffers however many companies are raised over a campaign.
const frontierCuts = [
  {
    height: 0.993,
    breadth: 1.085,
    head: 'sallet',
    shoulder: 1,
    jaw: 0.13,
    cheek: 0.055,
    nose: 0.008,
    brow: 0.005,
    shield: 0,
    carry: 0.76,
  },
  {
    height: 1.043,
    breadth: 0.95,
    head: 'nasal',
    shoulder: -1,
    jaw: -0.1,
    cheek: 0.02,
    nose: 0.011,
    brow: -0.004,
    shield: 1,
    carry: 0.59,
  },
  {
    height: 0.952,
    breadth: 1.08,
    head: 'bare',
    shoulder: 0,
    jaw: 0.17,
    cheek: 0.085,
    nose: -0.007,
    brow: 0.008,
    shield: 2,
    carry: 0.79,
  },
  {
    height: 0.985,
    breadth: 0.975,
    head: 'nasal',
    shoulder: 1,
    jaw: -0.06,
    cheek: -0.05,
    nose: -0.003,
    brow: 0.005,
    shield: 3,
    carry: 0.54,
  },
  {
    height: 1.056,
    breadth: 1.025,
    head: 'sallet',
    shoulder: -1,
    jaw: 0.06,
    cheek: -0.055,
    nose: 0.005,
    brow: 0.007,
    shield: 4,
    carry: 0.7,
  },
  {
    height: 0.943,
    breadth: 0.964,
    head: 'bare',
    shoulder: 0,
    jaw: -0.13,
    cheek: 0.054,
    nose: -0.004,
    brow: -0.005,
    shield: 5,
    carry: 0.62,
  },
];
const fieldDyes = {
  imperial: [0x264e59, 0x883e32, 0x6c663e, 0x535168],
  ash: [0x584254, 0x773e32, 0x444e49, 0x4a495d],
  moss: [0x415c43, 0x6f5636, 0x515f6a, 0x75514a],
};
const fieldSkin = [0xfff6ec, 0xf3dbbf, 0xd9b797, 0xcf9b7a, 0xb38364];
const fieldHair = [0x4a352e, 0x837362, 0x65524b, 0xa68158, 0x5d493a, 0x998d7e];
const heldNames = new Set([
  'hero',
  'commander',
  'regent',
  'healer',
  'carter',
  'scribe',
  'vigil',
  'keeper',
  'vera',
  'savva',
  'herbalist',
]);
function fieldTextSeed(value) {
  let h = 2166136261;
  for (const ch of String(value)) {
    h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  }
  return h >>> 0;
}
function fieldFraction(seed, salt) {
  let x = (seed + Math.imul(salt, 0x9e3779b9)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  return ((x ^ (x >>> 15)) >>> 0) / 4294967296;
}
function personalCut(kind, tag, origin) {
  if (origin == null || heldNames.has(tag) || ['commander', 'regent', 'witness'].includes(kind)) return null;
  const npc = typeof origin === 'object';
  const seed = npc ? actorSeed(origin) : typeof origin === 'number' ? origin >>> 0 : fieldTextSeed(origin);
  const id = npc ? origin.id : origin;
  const roll = (n) => fieldFraction(seed, n);
  // An escort office issues alternately the heavy and light cuts. Replacements keep their own kit.
  const cut =
    kind === 'escort' && Number.isInteger(id)
      ? 2 * Math.floor(roll(120) * 3) + (id & 1)
      : Math.floor(roll(120) * 6);
  const fit = frontierCuts[cut],
    height = fit.height + (roll(121) - 0.5) * 0.049;
  return {
    seed,
    cut,
    dye: Math.floor(roll(122) * 4),
    skin: Math.floor(roll(123) * 5),
    hair: Math.floor(roll(124) * 6),
    height,
    breadth: fit.breadth * height * (0.983 + 0.034 * roll(125)),
    depth: height * (0.98 + 0.045 * roll(126)),
    gait: roll(127),
    bearing: roll(128) * 2 - 1,
    breath: 0.79 + 0.43 * roll(129),
    phase: roll(130) * Math.PI * 2,
  };
}
function dressFieldActor(style, profile) {
  if (!profile) return;
  const cut = frontierCuts[profile.cut],
    i = profile.cut;
  style.person = profile;
  style.id += '/field-' + i;
  if (style.plate) {
    style.sex = i === 3 || i === 5 ? 'Female' : 'Male';
    style.closedHelm = cut.head === 'sallet';
    style.helm = cut.head !== 'bare';
    style.helmetModel = cut.head === 'nasal' ? 'viking' : style.palette === 'ash' ? 'wawel' : 'sallet';
    style.hair = style.closedHelm
      ? []
      : style.sex === 'Female'
        ? style.helm
          ? ['BuzzedFemale']
          : ['Long']
        : style.helm
          ? ['Beard']
          : ['SimpleParted', 'Beard'];
  } else {
    style.sex = i === 1 || i === 2 || i === 4 ? 'Male' : 'Female';
    style.hood = !!style.elf && (i === 0 || i === 4);
    style.hair =
      style.sex === 'Female'
        ? style.hood
          ? ['BuzzedFemale']
          : [i === 3 ? 'Buns' : 'Long']
        : style.hood
          ? ['Buzzed']
          : i === 2
            ? ['SimpleParted', 'Beard']
            : ['SimpleParted'];
  }
  style.hairColor = fieldHair[profile.hair];
}
function fieldFace(x, y, z, eye, fit) {
  const cheek = Math.exp(-(((y - eye + 0.036) / 0.038) ** 2)),
    jaw = Math.exp(-(((y - eye + 0.09) / 0.038) ** 2));
  const front = THREE.MathUtils.smoothstep(z, 0.012, 0.079);
  return [
    x * (1 + fit.jaw * jaw + fit.cheek * cheek),
    y + front * fit.brow * Math.exp(-(((y - eye - 0.019) / 0.017) ** 2)) * 0.75,
    z +
      front *
        (fit.nose * Math.exp(-((x / 0.023) ** 2 + ((y - eye + 0.027) / 0.033) ** 2)) +
          (0.0035 * fit.jaw * jaw) / 0.13),
  ];
}
// Fabric and shields describe affiliation at a distance. All marks, weave and wear are drawn locally.
const fieldHeraldry = new Map(),
  fieldCloth = new Map();
let loomPattern = null;
function fieldShield(style) {
  const { cut, dye } = style.person,
    key = [style.palette, cut, dye].join('/');
  if (fieldHeraldry.has(key)) return fieldHeraldry.get(key);
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 384;
  const ink = c.getContext('2d'),
    w = c.width,
    h = c.height;
  const field = fieldDyes[style.palette][dye],
    color = '#' + field.toString(16).padStart(6, '0');
  ink.fillStyle = color;
  ink.fillRect(0, 0, w, h);
  const oldGold = ['#dab87d', '#dfc69d', '#d9cba4', '#d5bea0'][dye];
  ink.fillStyle = oldGold;
  ink.strokeStyle = oldGold;
  const poly = (v) => {
    ink.beginPath();
    v.forEach(([x, y], i) => (i ? ink.lineTo(x, y) : ink.moveTo(x, y)));
    ink.closePath();
    ink.fill();
  };
  // The ruined gate, river bend, fir, twin bars, pale and chevrons are the march's six company badges.
  if (cut === 0) {
    poly([
      [53, 132],
      [53, 93],
      [70, 93],
      [70, 106],
      [84, 106],
      [84, 91],
      [100, 91],
      [100, 134],
      [153, 134],
      [153, 91],
      [169, 91],
      [169, 106],
      [184, 106],
      [184, 91],
      [203, 91],
      [203, 229],
      [153, 229],
      [153, 171],
      [101, 171],
      [101, 229],
      [53, 229],
    ]);
  } else if (cut === 1) {
    for (const y of [103, 181]) {
      ink.beginPath();
      ink.moveTo(-20, y + 34);
      ink.bezierCurveTo(56, y - 44, 118, y + 81, 279, y - 45);
      ink.lineWidth = 17;
      ink.stroke();
    }
  } else if (cut === 2) {
    for (let i = 0; i < 3; i++)
      poly([
        [128, 74 + i * 37],
        [77 - i * 7, 145 + i * 34],
        [179 + i * 7, 145 + i * 34],
      ]);
    ink.fillRect(115, 191, 25, 63);
  } else if (cut === 3) {
    for (const y of [100, 179])
      poly([
        [20, y],
        [236, y],
        [236, y + 26],
        [20, y + 26],
      ]);
  } else if (cut === 4) {
    poly([
      [111, 40],
      [145, 40],
      [145, 247],
      [128, 276],
      [111, 247],
    ]);
    poly([
      [65, 138],
      [191, 138],
      [191, 160],
      [65, 160],
    ]);
  } else
    for (const y of [100, 165])
      poly([
        [26, y + 68],
        [128, y],
        [230, y + 68],
        [230, y + 93],
        [128, y + 25],
        [26, y + 93],
      ]);
  const image = ink.getImageData(0, 0, w, h),
    px = image.data;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const s = fieldFraction((y * w + x) >>> 0, 132),
        plank = (x + 2 * Math.sin(y * 0.024) + 0.6 * Math.sin(y * 0.096)) % 42;
      const grain =
        (s - 0.5) * 11 + 2.7 * Math.sin(x * 1.63 + Math.sin(y * 0.021 + x * 0.08)) - (plank < 1.7 ? 12 : 0);
      const k = 4 * (y * w + x);
      for (let ch = 0; ch < 3; ch++) px[k + ch] += grain;
    }
  ink.putImageData(image, 0, 0);
  ink.lineCap = 'round';
  for (let j = 0; j < 78; j++) {
    const x = fieldFraction(cut + 1, 141 + 2 * j) * 256,
      y = fieldFraction(dye + 6, 142 + 2 * j) * 384;
    const l = fieldFraction(j, 304) * 22;
    ink.strokeStyle = j % 3 ? 'rgba(64,44,31,.34)' : 'rgba(209,182,131,.55)';
    ink.lineWidth = 0.8 + (j % 3) * 0.24;
    ink.beginPath();
    ink.moveTo(x, y);
    ink.lineTo(x - l * 0.32, y + l);
    ink.stroke();
  }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const m = new THREE.MeshStandardMaterial({ map, roughness: 0.85, side: THREE.DoubleSide });
  fieldHeraldry.set(key, m);
  return m;
}
function fieldTextile(style, edge) {
  const tone = edge ? 0xc5a477 : fieldDyes[style.palette][style.person.dye];
  if (!fieldCloth.has(tone)) {
    const base = wovenWool('felt').map;
    if (!loomPattern) {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const ctx = c.getContext('2d'),
        pix = ctx.createImageData(256, 256);
      for (let y = 0; y < 256; y++)
        for (let x = 0; x < 256; x++) {
          const row = y >> 3,
            zig = (((x + (row & 1 ? y : -y)) % 7) + 7) % 7;
          const v =
            216 +
            (zig < 2 ? 15 : -5) +
            8 * Math.sin(x * 0.157 + Math.sin(y * 0.026)) +
            (fieldFraction(y * 256 + x, 986) - 0.5) * 21;
          const k = 4 * (y * 256 + x);
          pix.data[k] = pix.data[k + 1] = pix.data[k + 2] = v;
          pix.data[k + 3] = 255;
        }
      ctx.putImageData(pix, 0, 0);
      loomPattern = new THREE.CanvasTexture(c);
      loomPattern.colorSpace = THREE.SRGBColorSpace;
      loomPattern.wrapS = loomPattern.wrapT = THREE.RepeatWrapping;
      loomPattern.repeat.set(1.7, 2.1);
      loomPattern.anisotropy = 4;
    }
    fieldCloth.set(
      tone,
      new THREE.MeshStandardMaterial({
        color: tone,
        map: loomPattern,
        bumpMap: base,
        bumpScale: 0.0018,
        roughness: 0.96,
        side: THREE.DoubleSide,
      }),
    );
  }
  return fieldCloth.get(tone);
}
function fitFieldGear(style, { plate, line }) {
  const fit = frontierCuts[style.person.cut],
    bone = 'spine_03';
  // A dense wool half-cape covers a single shoulder. Folds radiate from the clasp to the cut hem.
  if (fit.shoulder) {
    const side = fit.shoulder,
      rows = [1.534, 1.499, 1.425, 1.305, style.plate ? 1.089 : 1.005];
    const radii = [0.083, 0.144, 0.211, 0.234, 0.222],
      depth = style.plate ? [0.08, 0.128, 0.211, 0.232, 0.206] : [0.08, 0.107, 0.151, 0.16, 0.154];
    function point(i, j) {
      const a = -0.11 + (i / 22) * 3.82,
        fold = Math.sin(a * 12 + j * 0.43) * (0.003 + j * 0.0017);
      return [
        side * (radii[j] + fold) * Math.sin(a),
        rows[j] -
          0.043 * Math.max(0, Math.sin(a)) * (j / 4) +
          (j === 4 ? 0.071 * Math.cos(a + 0.51) + 0.022 * Math.sin(a * 3) : 0),
        -0.024 + (depth[j] + fold) * Math.cos(a),
      ];
    }
    const verts = [],
      uv = [],
      idx = [];
    for (let j = 0; j < rows.length; j++)
      for (let i = 0; i <= 22; i++) {
        const k = verts.length;
        verts.push(point(i, j));
        uv.push(i / 22, j / 4);
        if (j && i) idx.push(k - 24, k - 23, k, k - 24, k, k - 1);
      }
    plate('field-cloth', bone, verts, idx, uv);
    const hem = [],
      hi = [];
    for (let i = 0; i <= 22; i++) {
      const p = point(i, 4),
        k = hem.length;
      hem.push([p[0] * 1.009, p[1] + 0.008, p[2] * 1.012], [p[0] * 1.009, p[1] + 0.018, p[2] * 1.012]);
      if (i) hi.push(k - 2, k - 1, k, k + 1, k, k - 1);
    }
    plate('field-edge', bone, hem, hi);
    line('brass', bone, [side * 0.013, 1.506, 0.092], [side * 0.093, 1.483, 0.104], 0.005);
  } else {
    // A wide sash and its turned lining hang outside the skirt instead of intersecting the thighs.
    const side = style.person.cut === 5 ? -1 : 1;
    const pts = [
      [side * 0.12, 1.23, 0.128],
      [side * 0.172, 1.222, 0.09],
      [side * 0.179, 1.05, 0.061],
      [side * 0.15, 0.857, 0.094],
      [side * 0.112, 0.879, 0.139],
      [side * 0.113, 1.05, 0.127],
    ];
    plate('field-cloth', 'pelvis', pts, [0, 1, 2, 0, 2, 5, 5, 2, 3, 5, 3, 4]);
    line('field-edge', 'pelvis', pts[3], pts[4], 0.006);
  }
}

// The base clips still determine sole contact. Personal carriage is layered onto the moving trunk and arms.
function fieldCarriage(actor, state, a, t) {
  const u = actor.userData,
    p = u.actorStyle.person;
  if (!p) return;
  const move = state === 'run' || state === 'walk',
    rest = state === 'idle' || state === 'watch';
  if (!move && !rest) return;
  const cycle = (u.action.time / u.action.getClip().duration) * Math.PI * 2;
  const stride = move ? Math.sin(cycle) : 0,
    breath = Math.sin(t * p.breath * 2.23 + p.phase);
  const sway = (0.012 + 0.043 * p.gait) * stride,
    load = p.bearing * 0.027;
  const slant = a.mind?.strafe || 0;
  function turn(name, ax, ay, az) {
    const b = u.skeleton.getBoneByName(name);
    u.turnBones.push([b, b.quaternion.clone()]);
    b.rotateX(ax);
    b.rotateY(ay);
    b.rotateZ(az);
  }
  turn('spine_01', 0.03 * p.bearing + (move ? p.gait * 0.035 : 0.009 * breath), slant * 0.17, load + sway);
  turn(
    'spine_03',
    0.014 * breath,
    move ? stride * (0.025 + 0.065 * p.gait) : 0.022 * Math.sin(t * 0.76 + p.phase),
    -sway * 0.61,
  );
  turn(
    'neck_01',
    -p.bearing * 0.044,
    rest ? 0.066 * Math.sin(t * (0.56 + 0.38 * p.gait) + p.phase) : 0,
    -load * 0.64,
  );
  turn('clavicle_r', -0.012 * breath, 0, -0.031 * p.gait + 0.016 * stride);
  turn('lowerarm_r', 0, p.bearing * 0.068 + (move ? stride * (0.021 + 0.065 * p.gait) : 0), 0);
}
const fieldActions = {
  cut: {
    ready: [-0.39, 1.46, 0.03],
    edge: [-0.18, 0.83, -0.52],
    impact: [-0.1, 1.25, 0.54],
    point: [0.48, -0.08, 0.87],
    end: [0.24, 1.06, 0.35],
    exit: [0.85, -0.37, 0.31],
    duration: 0.45,
  },
  thrust: {
    ready: [-0.29, 1.19, 0.05],
    edge: [0.05, 0.15, 0.98],
    impact: [-0.14, 1.31, 0.66],
    point: [0.03, 0.025, 1],
    end: [-0.2, 1.3, 0.41],
    exit: [0.09, 0.12, 0.96],
    duration: 0.32,
  },
  heavy: {
    ready: [-0.22, 1.86, -0.015],
    edge: [0.12, 0.65, -0.75],
    impact: [-0.035, 1.37, 0.53],
    point: [0.02, -0.3, 0.96],
    end: [0.06, 0.94, 0.4],
    exit: [0.12, -0.77, 0.63],
    duration: 0.58,
  },
};
// IK directs the actual sword hand and its bound mesh. Targets live in the actor's frame, including stature.
function fieldAttackPose(actor, type, wind, recovery) {
  const u = actor.userData,
    move = fieldActions[type];
  if (!move) return;
  const sk = u.skeleton;
  if (!u.strikingArm) {
    const hand = sk.getBoneByName('hand_r'),
      index = sk.bones.indexOf(hand);
    const bindAxis =
      u.actorStyle.sex === 'Male' ? [-0.24307, -0.01446, 0.9699] : [-0.26743, -0.00551, 0.96356];
    u.strikingArm = {
      hand,
      lower: sk.getBoneByName('lowerarm_r'),
      upper: sk.getBoneByName('upperarm_r'),
      axis: new THREE.Vector3(...bindAxis)
        .applyQuaternion(new THREE.Quaternion().setFromRotationMatrix(sk.boneInverses[index]))
        .normalize(),
    };
  }
  const arm = u.strikingArm,
    release = recovery != null,
    ramp = THREE.MathUtils.smoothstep;
  const amount = release ? 1 - ramp(recovery, 0.47, 1) : ramp(wind, 0, 0.31);
  if (amount < 0.002) return;
  const phase = release ? ramp(recovery, 0, 0.43) : ramp(wind, type === 'heavy' ? 0.72 : 0.61, 1);
  const point = new THREE.Vector3()
    .fromArray(release ? move.impact : move.ready)
    .lerp(new THREE.Vector3().fromArray(release ? move.end : move.impact), phase);
  point.y -= u.actorStyle.sex === 'Female' ? 0.043 : 0;
  const blade = new THREE.Vector3()
    .fromArray(release ? move.point : move.edge)
    .lerp(new THREE.Vector3().fromArray(release ? move.exit : move.point), phase)
    .normalize();
  const goal = arm.hand.getWorldPosition(new THREE.Vector3()).lerp(actor.localToWorld(point), amount);
  const hint = actor.localToWorld(new THREE.Vector3(-0.7, type === 'heavy' ? 1.57 : 1.16, -0.07));
  for (const bone of [arm.upper, arm.lower, arm.hand]) u.turnBones.push([bone, bone.quaternion.clone()]);
  poseTwoBoneChain(arm.upper, arm.lower, arm.hand, goal, hint);
  const q = arm.hand.getWorldQuaternion(new THREE.Quaternion()),
    actorQ = actor.getWorldQuaternion(new THREE.Quaternion());
  const correction = new THREE.Quaternion().setFromUnitVectors(
    arm.axis.clone().applyQuaternion(q),
    blade.applyQuaternion(actorQ),
  );
  const target = arm.hand.parent
    .getWorldQuaternion(new THREE.Quaternion())
    .invert()
    .multiply(correction)
    .multiply(q)
    .normalize();
  arm.hand.quaternion.slerp(target, amount);
}

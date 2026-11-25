'use strict';

// Cells are shared by the rendered woodland and the collision query.
let marchTrees, marchTreeCells;
function marchFlora() {
  if (marchTrees) return marchTrees;
  marchTrees = [];
  marchTreeCells = new Map();
  for (let ix = -27; ix <= 27; ix++)
    for (let iz = -33; iz <= 33; iz++) {
      const x = (ix + meadowHash(ix, iz, 1) * 0.91) * 6.85,
        z = (iz + meadowHash(ix, iz, 2) * 0.91) * 6.85;
      const path = marchPath(x, z),
        y = marchGround(x, z, path),
        density = 0.54 + 0.24 * Math.sin(x * 0.08 + Math.sin(z * 0.081)) + 0.13 * Math.cos(z * 0.17);
      if (
        path.d < 3.5 ||
        y < 2 ||
        y > 44 ||
        meadowHash(ix, iz, 3) > density ||
        Object.values(marchSites).some((s) => Math.hypot(x - s.x, z - s.z) < 9.4) ||
        (x > 40 && x < 74 && Math.abs(z - 26) < 5)
      )
        continue;
      const steep = Math.hypot(
        marchGround(x + 0.6, z) - marchGround(x - 0.6, z),
        marchGround(x, z + 0.6) - marchGround(x, z - 0.6),
      );
      if (steep > 0.96) continue;
      const h = 5 + 10 * meadowHash(ix, iz, 4),
        fir = meadowHash(ix, iz, 9) < 0.61;
      const tree = { x, z, y, h, fir, a: meadowHash(ix, iz, 5) * 6.28, r: 0.1 + h * 0.014 };
      marchTrees.push(tree);
      const key = Math.floor(x / 8) + ',' + Math.floor(z / 8);
      if (!marchTreeCells.has(key)) marchTreeCells.set(key, []);
      marchTreeCells.get(key).push(tree);
    }
  return marchTrees;
}
function marchVegetationAt(x, z, r) {
  marchFlora();
  for (let a = Math.floor((x - r - 0.4) / 8); a <= Math.floor((x + r + 0.4) / 8); a++)
    for (let b = Math.floor((z - r - 0.4) / 8); b <= Math.floor((z + r + 0.4) / 8); b++)
      for (const tree of marchTreeCells.get(a + ',' + b) || [])
        if (Math.hypot(x - tree.x, z - tree.z) < r + tree.r) return true;
  return false;
}
function marchPlacard(text, wide = 3.4) {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 160;
  const c = canvas.getContext('2d');
  c.fillStyle = '#423a2c';
  c.fillRect(0, 0, 768, 160);
  for (let i = 0; i < 100; i++) {
    c.fillStyle = i % 2 ? 'rgba(178,140,82,.10)' : 'rgba(20,17,13,.16)';
    c.fillRect(meadowHash(i, 5, 1) * 550, meadowHash(i, 9, 2) * 160, 120 + meadowHash(i, 8, 3) * 510, 1.3);
  }
  c.strokeStyle = '#ba9a65';
  c.lineWidth = 3;
  c.strokeRect(12, 12, 744, 136);
  c.fillStyle = '#efe4bd';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = 'bold 71px Georgia';
  c.fillText(text, 384, 82, 713);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const group = new THREE.Group(),
    face = new THREE.Mesh(
      new THREE.PlaneGeometry(wide, (wide * 160) / 768),
      new THREE.MeshLambertMaterial({ map: tex }),
    );
  face.position.z = 0.028;
  const back = face.clone();
  back.rotation.y = Math.PI;
  back.position.z = -0.028;
  group.add(face, back);
  return group;
}
function placeMarchEntrance(realm) {
  const { x, z } = marchEntrance,
    y = ground(x, z);
  for (const side of [-1, 1]) {
    realm.block(x - 1.55, y + 1.48, z + side * 2.3, 0.52, 3.05, 0.59, 0x795f42);
    realm.bound(x - 1.55, z + side * 2.3, 0.48, 0.52);
    realm.block(x - 1.55, y + 2.72, z + side * 1.66, 0.28, 0.22, 1.65, 0x534432, 0, 0, side * 0.58);
  }
  realm.block(x - 1.55, y + 3.1, z, 0.53, 0.34, 5.45, 0x534432);
  const sign = marchPlacard('ОЗЁРНАЯ МАРКА', 3.75);
  sign.position.set(x - 1.22, y + 2.86, z);
  sign.rotation.y = Math.PI / 2;
  realm.scene.add(sign);
  const arrow = marchPlacard('◂  ОЗЁРНЫЙ ПРОХОД', 2.18);
  arrow.position.set(x + 4, y + 1.62, z + 1.69);
  realm.scene.add(arrow);
  realm.block(x + 4, y + 0.87, z + 1.8, 0.15, 1.74, 0.16, 0x795f42);
}
function marchTerrain(v) {
  const width = 405,
    depth = 485,
    nx = 202,
    nz = 242;
  const geo = new THREE.PlaneGeometry(width, depth, nx, nz);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position,
    surf = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      z = pos.getZ(i),
      p = marchPath(x, z),
      h = marchGround(x, z, p);
    pos.setY(i, h);
    surf.push(
      marchOverWater(x, z) ? 0 : 1 - marchEase(1.15, 3.05, p.d),
      marchEase(-0.38, 3.05, h),
      marchEase(10, 32, h) + 0.1 * Math.sin(x * 0.15) * Math.cos(z * 0.18),
    );
  }
  // Remove the six terrain cells above the well. The timber walkboards cover the cut edges exactly.
  const triangles = [],
    id = geo.index.array;
  for (let j = 0; j < id.length; j += 3) {
    const a = id[j],
      bb = id[j + 1],
      c = id[j + 2],
      cx = (pos.getX(a) + pos.getX(bb) + pos.getX(c)) / 3,
      cz = (pos.getZ(a) + pos.getZ(bb) + pos.getZ(c)) / 3;
    if (cx < 10.025 || cx > 18.045 || cz < -146.3 || cz > -140.29) triangles.push(a, bb, c);
  }
  geo.setIndex(triangles);
  geo.computeVertexNormals();
  geo.setAttribute('marchLayer', new THREE.Float32BufferAttribute(surf, 3));
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.94, map: texture('soil') });
  mat.onBeforeCompile = (s) => {
    s.uniforms.mRoad = { value: texture('road') };
    s.uniforms.mScree = { value: texture('scree') };
    s.uniforms.mGrass = { value: texture('meadow') };
    s.uniforms.mStone = { value: texture('outcrop-atlas', mountainImages) };
    s.vertexShader =
      'attribute vec3 marchLayer;varying vec3 mLayer;varying vec3 mPos;varying vec3 mNorm;\n' +
      s.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n mLayer=marchLayer;mPos=position;mNorm=normal;',
      );
    s.fragmentShader =
      'uniform sampler2D mRoad,mScree,mGrass,mStone;varying vec3 mLayer;varying vec3 mPos;varying vec3 mNorm;\n' +
      s.fragmentShader.replace(
        '#include <map_fragment>',
        `
      vec2 p=mPos.xz;vec3 axis=abs(normalize(mNorm));float cliff=smoothstep(.12,.46,1.-axis.y);
      float moor=.45+.21*sin(p.x*.098+p.y*.041)+.14*cos(p.y*.081-p.x*.025);
      vec3 grass=texture2D(mGrass,p*.27).rgb*vec3(.70,.82,.57);
      vec3 soil=texture2D(map,p*.35).rgb*vec3(.91,.76,.56);
      vec3 land=mix(grass,soil,clamp(.28+moor*.45+.19*mLayer.z,0.,1.));
      vec2 uv=axis.x>axis.z?mPos.zy:mPos.xy;
      vec2 fault=uv*vec2(.084,.092)+vec2(.037*mPos.y,.045*(p.x+p.y));
      vec2 lin=fract(fault);vec3 cliffA=texture2D(mStone,vec2(.002+.996*lin.x,.504+.492*lin.y)).rgb;
      vec2 uvB=mat2(.80,.60,-.60,.80)*fault*.71+vec2(.37,.27);
      vec3 cliffB=texture2D(mStone,vec2(.002+.996*fract(uvB.x),.504+.492*fract(uvB.y))).rgb;
      float split=sin(uv.x*.061+sin(uv.y*.073)*1.9)*.5+.5;
      vec3 clast=texture2D(mScree,(mPos.xz+vec2(mPos.y*.69,mPos.y*.41))*.23).rgb;
      vec3 face=mix(mix(cliffA,cliffB,.30+.35*split),clast*.78,.24)*vec3(.63,.72,.74);
      float folded=abs(sin(uv.x*.058+uv.y*.15+.6*sin(uv.x*.097)));
      face*=.94+.055*smoothstep(.04,.37,folded);
      float bedding=.97+.035*sin((mPos.y+p.x*.11-p.y*.073)*1.3+.4*sin(uv.x*.58));
      float exposed=max(cliff,smoothstep(18.,38.,mPos.y)*(.69+.22*split));
      land=mix(land,face*bedding,exposed);
      float snow=smoothstep(45.,57.,mPos.y+5.*mNorm.z+3.*sin(p.y*.097))*smoothstep(.24,.76,axis.y);
      land=mix(land,vec3(.57,.68,.71)*(.69+.36*clast.r),snow*.76);
      land=mix(mix(soil,texture2D(mScree,p*.36).rgb,.46)*vec3(.69,.8,.76),land,mLayer.y);
      vec3 trail=texture2D(mRoad,p*.32).rgb*vec3(1.08,.98,.82);
      diffuseColor.rgb*=mix(land,trail,mLayer.x*(.81+.14*sin(p.y*.73)*cos(p.x*.99)))*(.92+.09*moor);`,
      );
  };
  const groundMesh = new THREE.Mesh(geo, mat);
  groundMesh.receiveShadow = true;
  v.scene.add(groundMesh);
}
function marchWaterSurface(v) {
  const target = new THREE.WebGLRenderTarget(480, 272, { depthBuffer: true });
  const time = { value: 0 },
    projector = { value: new THREE.Matrix4() };
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      haze: { value: v.scene.fog.color },
      boatSpace: { value: new THREE.Matrix4() },
      t: time,
      projection: projector,
      mirror: { value: target.texture },
      sky: { value: texture('sky') },
      opacity: { value: 0.92 },
      night: { value: 0 },
      sunDirection: { value: new THREE.Vector3() },
      sunColor: { value: new THREE.Color() },
    },
    vertexShader: `
    varying vec3 wp;varying vec4 reflected;attribute float bedDepth;varying float depthBelow;uniform mat4 projection;
    void main(){vec4 p=modelMatrix*vec4(position,1.);wp=p.xyz;depthBelow=bedDepth;reflected=projection*p;gl_Position=projectionMatrix*viewMatrix*p;}
  `,
    fragmentShader: `
    varying vec3 wp;varying vec4 reflected;varying float depthBelow;uniform sampler2D mirror,sky;uniform float t,opacity,night;uniform vec3 sunDirection,sunColor,haze;uniform mat4 boatSpace;
    void main(){
      vec3 inside=(boatSpace*vec4(wp,1.)).xyz;
      float u=abs((inside.z+1.36)/2.87);
      if(u<1.){
        float halfHull=.055+.963*pow(max(0.,1.-pow(u,1.85)),.79);
        float height=clamp((inside.y+.324)/(.659+.30*pow(u,2.2)),0.,1.);
        if(abs(inside.x)<halfHull*(.16+.84*pow(sin(height*1.48),.84))+.009)discard;
      }
      vec2 p=wp.xz;float a=sin(dot(p,vec2(.56,.47))+t*1.8);
      float gust=.62+.22*sin(p.x*.08-p.y*.04+t*.21)+.14*cos(p.y*.17+t*.33);
      float b=sin(dot(p,vec2(.2,1.21))-t*2.2+sin(p.y*.26+t*.18));float c=sin(p.y*2.5-p.x*1.18+t*2.7+b*.55);
      vec2 ripple=vec2(a*.6+b*.31,a*.22+c*.44);vec3 n=normalize(vec3(ripple.x*.065*gust,1.,ripple.y*.073*gust));
      vec3 view=normalize(cameraPosition-wp);float fres=pow(1.-clamp(dot(n,view),0.,1.),2.3);
      vec3 ray=reflect(-view,n);float sy=max(0.,ray.y);
      vec2 pano=vec2(atan(ray.z,ray.x)*.15915494+.71,.582+asin(sy)*.248);
      float away=length(cameraPosition-wp);
      vec2 uv=reflected.xy/max(.01,reflected.w)*.5+.5+ripple*.0046*gust/(1.+away*.012);
      vec3 scenery=texture2D(mirror,clamp(uv,.002,.998)).rgb;
      vec3 skyOnly=texture2D(sky,pano).rgb*mix(vec3(.90,1.,1.04),vec3(.10,.16,.27),night);
      vec3 horizon=mix(haze,skyOnly,smoothstep(.005,.27,sy));
      vec3 reflection=mix(horizon,scenery,opacity);
      float sun=pow(max(0.,dot(reflect(-sunDirection,n),view)),145.);
      float deep=smoothstep(.03,3.4,depthBelow);
      vec3 body=mix(vec3(.114,.195,.137),vec3(.013,.067,.076),deep);
      body*=mix(vec3(1.),vec3(.13,.21,.3),night);
      vec3 ink=mix(body,reflection,.12+.76*fres)+sun*sunColor*.66;
      float shore=(1.-smoothstep(.02,.33,depthBelow))*smoothstep(.51,.94,a*.21+b*.29+c*.13+.49);
      ink=mix(ink,mix(vec3(.53,.61,.54),haze*.62,night),shore*.38);
      gl_FragColor=vec4(max(vec3(0.),ink+.0026*(a+b)*gust),mix(.57,.968,deep)+.027*fres);
      #include <colorspace_fragment>
    }`,
  });
  const surface = new THREE.PlaneGeometry(394, 470, 98, 117);
  surface.rotateX(-Math.PI / 2);
  const ground = surface.attributes.position,
    depth = [];
  for (let i = 0; i < ground.count; i++)
    depth.push(Math.max(0, marchWater - marchGround(ground.getX(i), ground.getZ(i))));
  surface.setAttribute('bedDepth', new THREE.Float32BufferAttribute(depth, 1));
  const mesh = new THREE.Mesh(surface, material);
  mesh.position.y = marchWater;
  mesh.renderOrder = 3;
  v.scene.add(mesh);
  v.water = {
    mesh,
    target,
    time,
    projector,
    cam: new THREE.PerspectiveCamera(),
    clip: new THREE.Plane(),
    clip4: new THREE.Vector4(),
    corner: new THREE.Vector4(),
    last: -99,
    material,
  };
}
function marchArch() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.5, 0);
  shape.lineTo(-0.5, 1);
  shape.lineTo(0.5, 1);
  shape.lineTo(0.5, 0);
  for (let i = 0; i <= 22; i++) {
    const a = (i * Math.PI) / 22;
    shape.lineTo(Math.cos(a) * 0.43, 0.12 + 0.72 * Math.sin(a));
  }
  shape.lineTo(-0.5, 0);
  const g = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 22 });
  g.translate(0, 0, -0.5);
  return g;
}
function marchRoof() {
  const p = [-0.5, 0, -0.5, 0.5, 0, -0.5, 0, 1, -0.5, -0.5, 0, 0.5, 0.5, 0, 0.5, 0, 1, 0.5];
  return geometry(
    p,
    [0, 0, 1, 0, 0.5, 1, 0, 0, 1, 0, 0.5, 1],
    [0, 2, 1, 3, 4, 5, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4, 0, 1, 4, 0, 4, 3],
  );
}
function marchBatches(scene) {
  const materials = {
    stone: projectedMaterial('stone', 0xe4d7b7, 0.5),
    pale: projectedMaterial('lime', 0xd3ceb3, 0.63),
    dark: projectedMaterial('scree', 0x958f7b, 0.71),
    oak: projectedMaterial('wood', 0xe1cba9, 0.61),
    beam: projectedMaterial('wood', 0xbba991, 0.76),
    slate: projectedMaterial('slate', 0xb7c1bd, 0.64),
    brass: new THREE.MeshStandardMaterial({ color: 0xab8052, roughness: 0.51, metalness: 0.38 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x55594d, roughness: 0.71, metalness: 0.28 }),
  };
  const geometries = {
    box: new THREE.BoxGeometry(1, 1, 1),
    post: new THREE.CylinderGeometry(1, 1, 1, 9),
    spire: new THREE.ConeGeometry(1, 1, 8),
    arch: marchArch(),
    roof: marchRoof(),
  };
  const groups = new Map(),
    o = new THREE.Object3D(),
    Y = new THREE.Vector3(0, 1, 0);
  function add(geo, mat, x, y, z, w, h, d, ry = 0, rz = 0, rx = 0, q = null) {
    const g = typeof geo === 'string' ? geometries[geo] : geo,
      m = typeof mat === 'string' ? materials[mat] : mat,
      cell = typeof geo === 'string' ? '' : Math.floor(x / 94) + ',' + Math.floor(z / 94),
      k = g.uuid + m.uuid + cell;
    if (!groups.has(k)) groups.set(k, { g, m, poses: [] });
    o.position.set(x, y, z);
    o.rotation.set(rx, ry, rz, 'YXZ');
    if (q) o.quaternion.copy(q);
    o.scale.set(w, h, d);
    o.updateMatrix();
    groups.get(k).poses.push(o.matrix.clone());
  }
  const box = (...args) => add('box', ...args);
  function beam(mat, a, b, width, depth = width) {
    const v = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = v.length(),
      q = new THREE.Quaternion().setFromUnitVectors(Y, v.normalize());
    add(
      'box',
      mat,
      (a[0] + b[0]) * 0.5,
      (a[1] + b[1]) * 0.5,
      (a[2] + b[2]) * 0.5,
      width,
      len,
      depth,
      0,
      0,
      0,
      q,
    );
  }
  function flush() {
    for (const { g, m, poses } of groups.values()) {
      const batch = new THREE.InstancedMesh(g, m, poses.length);
      poses.forEach((m, i) => batch.setMatrixAt(i, m));
      batch.computeBoundingSphere();
      batch.castShadow = false;
      batch.receiveShadow = true;
      scene.add(batch);
    }
    groups.clear();
  }
  return { add, box, beam, flush, materials };
}
function marchStructures(v, b) {
  const { box, beam, add } = b;
  const sign = (word, x, y, z, yaw = 0, w = 3.6) => {
    const o = marchPlacard(word, w);
    o.position.set(x, y, z);
    o.rotation.y = yaw;
    v.scene.add(o);
  };
  function wall(mat, x, y, z, w, h, d) {
    box(mat, x, y + h / 2, z, w, h, d);
    marchWall(x, z, w, d);
  }
  function framedHouse(x, z, w, d, h, roof, openFront = false) {
    const y = marchGround(x, z);
    wall('pale', x - w / 2, y, z, 0.46, h, d);
    wall('pale', x + w / 2, y, z, 0.46, h, d);
    wall('stone', x, y, z - d / 2, w, h, 0.46);
    if (!openFront)
      for (const side of [-1, 1])
        wall('pale', x + side * (w + 1.96) * 0.25, y, z + d / 2, (w - 1.96) * 0.5, h, 0.44);
    for (const side of [-1, 1])
      for (const zz of [-d * 0.5, 0, d * 0.5]) {
        box('beam', x + side * w * 0.5, y + h * 0.5, z + zz, 0.43, h + 0.12, 0.4);
      }
    for (const side of [-1, 1]) {
      box('beam', x + side * w * 0.5, y + h * 0.82, z, 0.52, 0.27, d + 0.33);
      beam(
        'beam',
        [x + side * w * 0.5, y + 0.38, z - d * 0.45],
        [x + side * w * 0.5, y + h * 0.78, z - 0.2],
        0.17,
      );
    }
    add('roof', roof, x, y + h, z, w + 1.42, w * 0.46, d + 1.46);
    for (const zz of [-d * 0.5 - 0.43, d * 0.5 + 0.43]) {
      beam('beam', [x - w * 0.5 - 0.62, y + h - 0.06, z + zz], [x, y + h + w * 0.46, z + zz], 0.26);
      beam('beam', [x, y + h + w * 0.46, z + zz], [x + w * 0.5 + 0.62, y + h - 0.06, z + zz], 0.26);
    }
    box('beam', x, y + h + 0.03, z + d * 0.5 + 0.1, w + 0.55, 0.34, 0.35);
  }
  function tower(x, z, y, h, span, wood = false) {
    for (const i of [-1, 1])
      for (const j of [-1, 1]) {
        const xx = x + i * span * 0.5,
          zz = z + j * span * 0.5;
        add('post', 'dark', xx, y + 0.54, zz, 0.62, 1.1, 0.62);
        box(wood ? 'beam' : 'stone', xx, y + h * 0.5, zz, 0.59, h, 0.59);
        marchWall(xx, zz, 0.61, 0.61);
        box('oak', xx, y + h * 0.8, zz, 0.83, 0.23, 0.83);
      }
    for (const side of [-1, 1]) {
      box('beam', x, y + h - 0.1, z + side * span * 0.5, span + 0.43, 0.4, 0.37);
      box('beam', x + side * span * 0.5, y + h - 0.1, z, 0.37, 0.4, span + 0.43);
      beam(
        'oak',
        [x - span * 0.5, y + h * 0.46, z + side * span * 0.5],
        [x + span * 0.5, y + h * 0.89, z + side * span * 0.5],
        0.18,
      );
    }
    add('spire', 'slate', x, y + h + span * 0.56, z, span * 0.94, span * 1.15, span * 0.94, Math.PI / 8);
    add('post', 'brass', x, y + h + span * 1.19, z, 0.055, 0.8, 0.055);
  }
  function roadSign(x, z, word, yaw = 0) {
    const y = marchGround(x, z);
    box('beam', x, y + 1.1, z, 0.18, 2.2, 0.18);
    sign(word, x, y + 1.74, z + 0.12, yaw, 2.85);
  }
  // Twelve masonry bays support a narrow inspection walk, with alternating exposed voussoirs.
  const total = 116,
    spans = 12,
    bay = total / spans,
    left = -55;
  for (let j = 0; j < spans; j++) {
    const x = left + (j + 0.5) * bay,
      y = -1.85;
    add('arch', 'stone', x, y, 5, bay, 9.85, 3.3);
    for (const z of [3.22, 6.78])
      for (let k = 0; k < 13; k++) {
        const a = ((k + 0.5) * Math.PI) / 13;
        const width = (Math.hypot(bay * 0.43 * Math.sin(a), 7.09 * Math.cos(a)) * Math.PI) / 13;
        box(
          'pale',
          x + Math.cos(a) * (bay * 0.43 + 0.23),
          y + 1.17 + Math.sin(a) * 7.34,
          z,
          width * 0.985,
          k === 6 ? 0.59 : 0.43,
          0.145,
          0,
          Math.atan2(7.09 * Math.cos(a), -bay * 0.43 * Math.sin(a)),
        );
      }
    if (j % 3 === 0) for (const z of [2.98, 7.02]) box('dark', left + j * bay, 2.3, z, 0.83, 8.3, 0.76);
  }
  box('pale', 3, 8.18, 5, 120, 0.44, 3.78);
  for (const z of [3.23, 6.77]) {
    box('stone', 3, 8.74, z, 110, 0.68, 0.34);
    box('pale', 3, 9.12, z, 110.4, 0.15, 0.46);
    marchWall(3, z, 110, 0.28);
  }
  // The low, independent timber bridge crosses the outflow, with triangular bracing below its deck.
  for (let i = 0; i < 43; i++) box(i % 4 ? 'oak' : 'beam', 13.3 + i * 0.595, 3.69, 134, 0.58, 0.22, 3.73);
  for (const z of [132.25, 135.75]) {
    box('beam', 26, 3.13, z, 26, 0.7, 0.34);
    box('oak', 26, 4.65, z, 26, 0.14, 0.14);
    marchWall(26, z, 26, 0.12);
    for (let x = 14; x <= 39; x += 4) {
      box('beam', x, 3.15, z, 0.23, 3.42, 0.24);
      beam('oak', [x, 2.0, z], [x + 3.6, 3.2, z], 0.19);
    }
  }
  // Open-front post house, its writing table, signal mast and drying flags.
  framedHouse(-56, 91.6, 9.2, 7.8, 3.7, 'slate', true);
  tower(-62.1, 93.5, 13, 9.6, 3.4, true);
  box('oak', -54, 14.03, 94.7, 2.9, 0.16, 1);
  for (const x of [-55, -53]) box('beam', x, 13.49, 94.7, 0.18, 0.98, 0.7);
  box('pale', -54.2, 14.16, 94.79, 0.65, 0.1, 0.47, 0.2);
  box('brass', -53.15, 14.27, 94.6, 0.12, 0.35, 0.12);
  sign('СИГНАЛЬНАЯ СТАНЦИЯ', -56, 16.2, 95.72, 0, 5.1);
  for (let j = 0; j < 3; j++) {
    const x = -61 + j * 1.35;
    box('oak', x, 17.4, 100, 0.12, 8.7, 0.12);
    box(j % 2 ? 'slate' : 'pale', x + 0.37, 20.79 - j * 0.33, 100, 0.76, 0.66, 0.043);
  }
  // An actual chapel interior. A traveller can enter, walk between the pews, and speak with its keeper.
  framedHouse(-77, -84.2, 8.4, 10.2, 3.8, 'slate');
  tower(-80.1, -89.2, 10, 7.15, 2.35);
  box('stone', -77, 10.34, -88.1, 2.5, 0.67, 0.82);
  for (const x of [-79.2, -74.8])
    for (const z of [-84.9, -82.8]) {
      box('oak', x, 10.52, z, 1.75, 0.15, 0.44);
      box('beam', x, 10.74, z - 0.21, 1.75, 0.48, 0.1);
      for (const i of [-0.55, 0.55]) box('beam', x + i, 10.25, z, 0.13, 0.5, 0.28);
    }
  for (const x of [-77.65, -76.35]) {
    add('post', 'brass', x, 10.91, -88.1, 0.08, 0.39, 0.08);
    add('spire', 'pale', x, 11.16, -88.1, 0.048, 0.17, 0.048);
  }
  sign('ЧАСОВНЯ ПЕРЕВОЗЧИКОВ', -77, 13.1, -78.84, 0, 3.6);
  // The gate lodge is cut into a bench of exposed slate. The old crane can swivel around its iron pintle.
  framedHouse(85.6, -74.4, 6.7, 5.9, 3.15, 'oak', true);
  for (let j = 0; j < 5; j++)
    for (let i = 0; i < 4; i++)
      box(i % 2 ? 'dark' : 'stone', 88 + i * 2.1, 14 + j * 1.25, -76 - j * 0.7, 2.05, 1.23, 3.7);
  box('oak', 78.4, 15.05, -69.5, 1.9, 0.2, 0.93);
  box('dark', 78.4, 14.55, -69.5, 0.74, 0.95, 0.58);
  box('pale', 78.4, 15.18, -69.5, 0.66, 0.11, 0.43);
  add('post', 'beam', 86.7, 18.4, -63, 0.36, 8.9, 0.36);
  beam('oak', [86.7, 22.4, -63], [79.1, 22.05, -62.5], 0.34);
  beam('beam', [86.7, 17.9, -63], [80.8, 22.1, -62.6], 0.25);
  add('post', 'iron', 79.65, 19.9, -62.55, 0.034, 4.3, 0.034);
  box('oak', 79.65, 17.7, -62.55, 1.45, 0.72, 1.1);
  // Descending gangway. Charred ribs of the other landing lie across the beach.
  for (let j = 0; j < 37; j++) {
    const x = 46.17 + j * 0.428,
      y = marchDeck(x, 26) ?? 5;
    box(j % 7 ? 'oak' : 'beam', x, y - 0.105, 26, 0.414, 0.21, 2.72);
  }
  for (const x of [47.1, 52, 57, 60])
    for (const z of [24.79, 27.21]) {
      const y = marchDeck(x, 26);
      add('post', 'beam', x, y / 2, z, 0.096, y + 0.54, 0.096);
    }
  // Ruins of the timber slip. Only the surviving end of each frame stands above the lake.
  for (let j = 0; j < 11; j++) {
    const x = 44.3 + j * 0.81,
      z = 32.15 + 0.17 * Math.cos(j * 0.31),
      base = Math.max(0.5, marchGround(x, z) + 0.08),
      s = 1.37 - j * 0.055;
    for (const side of [-1, 1]) {
      beam('beam', [x, base - 0.33, z], [x + 0.05, base + 0.1, z + side * s * 0.72], 0.13, 0.135);
      if ((j + side + 1) % 4)
        beam(
          'dark',
          [x + 0.05, base + 0.09, z + side * s * 0.72],
          [x - 0.08, base + 0.52 + 0.34 * meadowHash(j, side, 2), z + side * (s + 0.18)],
          0.115,
          0.14,
        );
    }
    if (j < 9) beam('beam', [x - 0.5, base - 0.12, z], [x + 0.5, base - 0.1, z], 0.2, 0.21);
  }
  // The surviving treadle crane unloads the lighter from a small platform beside the main gangway.
  const cx = 55.3,
    cz = 29.36,
    cy = 3.26;
  for (const x of [cx - 1.22, cx + 1.12])
    for (const z of [cz - 1.03, cz + 1.0]) {
      add('post', 'beam', x, 0.95, z, 0.16, 4.6, 0.16);
      beam('oak', [x - 0.27, 0.5, z], [x + 0.42, 3.03, z + 0.47], 0.14);
    }
  for (let k = 0; k < 8; k++) box('oak', cx - 1.31 + k * 0.374, cy - 0.11, cz, 0.352, 0.22, 2.39);
  add('post', 'dark', cx, cy + 0.13, cz, 0.5, 0.29, 0.5);
  add('post', 'oak', cx, cy + 1.99, cz, 0.24, 3.76, 0.24);
  for (const off of [-0.16, 0.16]) {
    beam('oak', [cx + 0.06, cy + 3.67, cz + off], [cx - 4.32, cy + 3.9, cz + off], 0.25, 0.18);
    beam('beam', [cx - 0.03, cy + 0.75, cz + off], [cx - 3.17, cy + 3.61, cz + off], 0.155);
  }
  for (const x of [cx - 4.16, cx - 0.15]) {
    add('post', 'iron', x, cy + 3.77, cz, 0.22, 0.46, 0.22, 0, 0, Math.PI / 2);
  }
  beam('iron', [cx - 0.2, cy + 1.22, cz], [cx - 0.2, cy + 3.98, cz], 0.029);
  beam('iron', [cx - 0.2, cy + 3.98, cz], [cx - 4.15, cy + 3.98, cz], 0.029);
  beam('iron', [cx - 4.15, cy + 3.95, cz], [cx - 4.13, cy + 1.12, cz], 0.032);
  box('oak', cx - 4.13, cy + 0.98, cz, 0.2, 0.29, 0.16);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.127, 0.029, 6, 17, Math.PI * 1.57), b.materials.iron);
  hook.rotation.z = 0.32;
  hook.position.set(cx - 4.13, cy + 0.8, cz);
  v.scene.add(hook);
  const hoistWheel = new THREE.Mesh(new THREE.TorusGeometry(0.71, 0.095, 7, 30), b.materials.oak);
  hoistWheel.position.set(cx, cy + 1.23, cz + 0.59);
  v.scene.add(hoistWheel);
  for (let j = 0; j < 6; j++) {
    const a = (j * Math.PI) / 6,
      dx = 0.66 * Math.cos(a),
      dy = 0.66 * Math.sin(a);
    beam('oak', [cx - dx, cy + 1.23 - dy, cz + 0.59], [cx + dx, cy + 1.23 + dy, cz + 0.59], 0.063);
  }
  add('post', 'beam', cx, cy + 1.23, cz, 0.23, 1.33, 0.23, 0, 0, Math.PI / 2);
  box('brass', 56.78, 3.84, 28.32, 0.37, 0.24, 0.085, -0.17);
  for (const side of [-1, 1])
    for (let k = 0; k < 3; k++) {
      const x = 46.85 + k * 2.43,
        z = 26 + side * 1.2;
      beam('beam', [x, 0.47, z], [x + 2.42, 1.51, z], 0.13, 0.17);
      beam('oak', [x, 1.52, z], [x + 2.45, 1.52, z], 0.15, 0.22);
    }
  sign('ОЗЁРНАЯ ПЕРЕПРАВА', 64.8, 6.76, 27.6, 0, 3.5);
  // Gate spindles and wrought chains occupy the side bay, clear of the public footway.
  for (let j = 0; j < 2; j++) {
    const x = -55.8 + j * 2.8,
      z = 8.8;
    box('dark', x, 8.62, z, 1.88, 0.46, 2.02);
    for (const xx of [-0.68, 0.68]) {
      box('beam', x + xx, 9.81, z, 0.19, 2.15, 0.23);
    }
    box('oak', x, 10.78, z, 1.81, 0.25, 0.4);
    add('post', 'brass', x, 10.03, z, 0.075, 1.73, 0.075);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.052, 7, 24), b.materials.iron);
    wheel.position.set(x, 10.04, z - 0.36);
    v.scene.add(wheel);
    v.valves.push(wheel);
    for (let k = 0; k < 4; k++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.048, 0.057), b.materials.brass);
      spoke.rotation.z = (k * Math.PI) / 4;
      wheel.add(spoke);
    }
  }
  // The upper lantern is empty. Its working bell swings underneath, behind an open arcade.
  tower(14, -142, 18, 13, 6.4);
  // A maintenance pit beneath the upper belfry opens onto the public apron.
  const xmin = 10.025,
    xmax = 18.045,
    zmin = -146.3,
    zmax = -140.29,
    top = 18.04,
    bed = 11.38;
  for (const x of [xmin, xmax]) {
    box('stone', x, (top + bed) * 0.5, -143.29, 0.42, top - bed + 0.08, 6.33);
    box('pale', x, top + 0.12, -143.29, 0.61, 0.24, 6.52);
  }
  for (const z of [zmin, zmax]) {
    box('stone', 14.03, (top + bed) * 0.5, z, 8.12, top - bed + 0.08, 0.39);
    box('pale', 14.03, top + 0.12, z, 8.35, 0.24, 0.57);
  }
  box('dark', 14.03, bed, -143.29, 8.1, 0.37, 6.3);
  // Permanent walkboards and the open hatch leave a view down to the counterweight and bronze.
  for (const x of [10.75, 17.37])
    for (let j = 0; j < 13; j++) box('oak', x, top - 0.03, -145.98 + j * 0.45, 1.17, 0.2, 0.425);
  for (const z of [-145.76, -140.69]) {
    box('beam', 14.03, top - 0.22, z, 7.8, 0.35, 0.31);
    for (let j = 0; j < 17; j++) box('oak', 10.45 + j * 0.445, top - 0.02, z, 0.42, 0.19, 0.68);
  }
  for (const x of [11.37, 16.72]) {
    box('iron', x, 18.73, -143.28, 0.079, 0.082, 4.87);
    for (const z of [-145.59, -143.25, -140.96]) box('iron', x, 18.46, z, 0.074, 0.91, 0.074);
  }
  box('iron', 14.04, 18.73, -145.8, 5.44, 0.081, 0.082);
  for (const x of [11.38, 16.71])
    for (const z of [-145.8, -140.72]) box('iron', x, 18.46, z, 0.076, 0.91, 0.076);
  for (const x of [11.92, 16.18]) box('iron', x, 18.68, -140.72, 1.08, 0.076, 0.076);
  beam('iron', [12.45, 18.68, -140.72], [14.03, 18.38, -140.72], 0.027);
  beam('iron', [14.03, 18.38, -140.72], [15.63, 18.68, -140.72], 0.027);
  marchWall(14.04, -143.24, 5.34, 4.79);
  for (const x of [11.4, 16.64])
    for (const z of [-145.62, -140.99]) add('post', 'brass', x, 18.8, z, 0.077, 0.1, 0.077);
  // The high lantern has an empty wooden yoke; its cut rope hangs above the lower hatch.
  for (const side of [-1, 1]) {
    box('oak', 14, 27.7, -142 + side * 2.4, 6.12, 0.35, 0.29);
    for (let j = 0; j < 5; j++) box('oak', 11.25 + j * 1.41, 28.55, -142 + side * 2.4, 0.13, 1.55, 0.13);
    box('beam', 14, 29.25, -142 + side * 2.4, 6.28, 0.17, 0.26);
    beam('beam', [11.15, 24.6, -142 + side * 2.4], [12.2, 27.57, -142 + side * 2.4], 0.24);
    beam('beam', [16.85, 24.6, -142 + side * 2.4], [15.8, 27.57, -142 + side * 2.4], 0.24);
  }
  box('oak', 14, 28.0, -142, 2.34, 0.32, 0.41);
  beam('iron', [14.05, 27.85, -142], [14.16, 26.76, -142.03], 0.031);
  // Both sluice states have material consequences at the well and at the pressure trough.
  const surface = new THREE.Mesh(
    new THREE.PlaneGeometry(7.53, 5.58),
    new THREE.MeshStandardMaterial({
      color: 0x315952,
      emissive: 0x122a27,
      roughness: 0.26,
      metalness: 0.12,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    }),
  );
  surface.rotation.x = -Math.PI / 2;
  surface.position.set(14.03, 16.5, -143.28);
  v.scene.add(surface);
  v.wellWater = surface;
  const lamp = new THREE.PointLight(0xf1bd78, 8.4, 6.4, 1.5);
  lamp.position.set(13.05, 16.65, -141.27);
  v.scene.add(lamp);
  for (const x of [12.27, 15.51]) {
    box('beam', x, 16.53, -143.02, 0.31, 3.8, 0.31);
    beam('oak', [x, 15.13, -144.74], [x, 17.91, -143.1], 0.22);
  }
  box('beam', 13.89, 17.75, -143.97, 4.15, 0.27, 0.31);
  for (const x of [12.91, 14.85]) beam('iron', [x, 17.75, -143.97], [x, 17.43, -142.93], 0.102);
  const bellGeometry = new THREE.LatheGeometry(
    [
      [0.22, 0],
      [0.97, -0.15],
      [1.1, -0.06],
      [0.84, 0.15],
      [0.67, 0.49],
      [0.55, 1.21],
      [0.38, 1.45],
      [0.13, 1.56],
    ].map((p) => new THREE.Vector2(...p)),
    44,
  );
  const bell = new THREE.Group();
  bell.position.set(13.9, 17.45, -143.02);
  const metal = new THREE.MeshStandardMaterial({ color: 0xa57a49, metalness: 0.4, roughness: 0.55 });
  const shell = new THREE.Mesh(bellGeometry, metal);
  shell.position.y = -1.94;
  bell.add(shell);
  for (const [y, r] of [
    [-1.95, 1.035],
    [-1.63, 0.77],
    [-1.52, 0.72],
    [-0.74, 0.52],
  ]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(r, 0.026, 7, 41), b.materials.brass);
    band.position.y = y;
    band.rotation.x = Math.PI / 2;
    bell.add(band);
  }
  const yoke = new THREE.Mesh(new THREE.BoxGeometry(2.58, 0.25, 0.35), b.materials.oak);
  yoke.position.y = -0.12;
  bell.add(yoke);
  const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), b.materials.iron);
  clapper.position.y = -2.02;
  bell.add(clapper);
  v.scene.add(bell);
  v.bell = bell;
  const wheel = new THREE.Group();
  wheel.position.set(16.65, 14.65, -143.16);
  wheel.rotation.y = Math.PI / 2;
  for (const off of [-0.27, 0.27]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.58, 0.115, 7, 32), b.materials.beam);
    ring.position.z = off;
    wheel.add(ring);
  }
  for (let k = 0; k < 10; k++) {
    const a = (k * Math.PI) / 5,
      o = new THREE.Mesh(new THREE.BoxGeometry(0.11, 2.97, 0.14), b.materials.oak);
    o.rotation.z = a;
    wheel.add(o);
    const paddle = new THREE.Mesh(new THREE.BoxGeometry(0.59, 0.09, 0.81), b.materials.oak);
    paddle.position.set(-1.55 * Math.sin(a), 1.55 * Math.cos(a), 0);
    paddle.rotation.z = a + 0.2;
    wheel.add(paddle);
  }
  marchJoin(wheel);
  v.scene.add(wheel);
  v.wheel = wheel;
  for (const x of [16.3, 17.0]) box('dark', x, 16.35, -145.12, 0.14, 0.42, 2.1);
  box('slate', 16.65, 16.18, -145.09, 0.83, 0.16, 2.24);
  const jet = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 1.73),
    new THREE.MeshBasicMaterial({
      color: 0x8bb8ad,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  jet.position.set(16.65, 15.43, -143.97);
  jet.rotation.x = -0.14;
  v.scene.add(jet);
  v.millJet = jet;
  beam('iron', [16.61, 14.74, -143.2], [15.18, 17.42, -143], 0.048);
  // Distant waymarks make the higher alternatives legible before a player commits to a climb.
  for (const [x, z, title, a] of [
    [-24, 135, 'СТАНЦИЯ  ◂', 0],
    [-70, 36, 'ВЕРХНЯЯ ТРОПА', 0.4],
    [70, 42, 'КАМЕНОЛОМНЯ  ▸', -0.2],
    [-39, -94, 'БРОД  ▸', Math.PI],
    [58, -85, 'ЧАСОВНЯ  ◂', 0],
    [-113, 65, 'СОСНОВЫЙ КАРНИЗ', 0],
    [101, -68, 'ОБХОД  ▸', 0],
    [0, 182, 'СТАРАЯ ПЕРЕПРАВА', Math.PI],
  ])
    roadSign(x, z, title, a);
  for (const [x, z] of [
    [-116, 61],
    [119, -97],
    [-30, -124],
    [61, 80],
    [-22, 149],
  ]) {
    const y = marchGround(x, z);
    add('post', 'dark', x, y + 0.43, z, 0.53, 0.86, 0.53);
    add('post', 'pale', x, y + 1.16, z, 0.27, 0.7, 0.27);
    add('spire', 'dark', x, y + 1.69, z, 0.38, 0.46, 0.38, Math.PI / 8);
  }
}
function marchWindows(v, b) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d'),
    radial = ctx.createRadialGradient(32, 32, 0, 32, 32, 31);
  radial.addColorStop(0, 'rgba(255,226,162,.78)');
  radial.addColorStop(0.2, 'rgba(255,176,94,.42)');
  radial.addColorStop(0.54, 'rgba(248,143,68,.11)');
  radial.addColorStop(1, 'rgba(248,129,58,0)');
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, 64, 64);
  const glowTex = new THREE.CanvasTexture(canvas);
  const glass = new THREE.MeshLambertMaterial({
    color: 0x816445,
    emissive: 0xffad62,
    emissiveIntensity: 0,
  });
  const glow = new THREE.SpriteMaterial({
    map: glowTex,
    depthWrite: false,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
  });
  v.lamps = { glass, glow, bulbs: [] };
  function window(x, y, z, w, h, lit = false) {
    const pane = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.1), glass);
    pane.position.set(x, y, z);
    v.scene.add(pane);
    for (const side of [-1, 1]) {
      b.box('beam', x + side * w * 0.5, y, z + 0.068, 0.11, h + 0.17, 0.145);
      b.box('oak', x, y + side * h * 0.5, z + 0.071, w + 0.19, 0.092, 0.15);
    }
    b.box('iron', x, y, z + 0.092, 0.045, h, 0.035);
    b.box('iron', x, y, z + 0.092, w, 0.04, 0.04);
    const halo = new THREE.Sprite(glow);
    halo.position.set(x, y, z + 0.14);
    halo.scale.set(w * 2.8, h * 2.4, 1);
    v.scene.add(halo);
    if (lit) {
      const warm = new THREE.PointLight(0xffa25b, 0, 8, 2);
      warm.position.set(x, y, z + 0.55);
      v.scene.add(warm);
      v.lamps.bulbs.push(warm);
    }
  }
  // The open lodge glows from within. Its two rear lights illuminate the clerk's ink and ledger.
  window(-57.9, 15.05, 87.98, 1.06, 1.4, true);
  window(-54.25, 15.05, 87.98, 0.9, 1.4);
  window(-61.95, 20.65, 95.28, 0.47, 0.76);
  window(-79.72, 12.08, -78.8, 0.72, 1.03, true);
  window(85.5, 16.04, -77.1, 0.83, 1.04);
}
function marchBoat(v, b) {
  // Clinker planking follows the moulds from stem to stern. Each lap has an actual lower edge.
  const boat = new THREE.Group(),
    timber = [0xc9a479, 0xaa805a, 0xccac80, 0x886749].map(
      (color) =>
        new THREE.MeshStandardMaterial({
          color,
          map: texture('wood'),
          roughness: 0.77,
          side: THREE.DoubleSide,
        }),
    );
  const shell = [...timber, b.materials.iron, b.materials.brass].map((material) => ({
    material,
    p: [],
    uv: [],
    ix: [],
  }));
  function quad(batch, a, b, c, d, v0 = 0, v1 = 1) {
    const i = batch.p.length / 3;
    batch.p.push(...a, ...b, ...c, ...d);
    batch.uv.push(a[2] * 0.72, v0, b[2] * 0.72, v1, c[2] * 0.72, v1, d[2] * 0.72, v0);
    batch.ix.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }
  function mould(u, h, side, lap = 0) {
    const width = 0.055 + 0.963 * Math.max(0, 1 - Math.pow(Math.abs(u), 1.85)) ** 0.79;
    const sheer = 0.335 + 0.3 * Math.pow(Math.abs(u), 2.2),
      lane = 0.16 + 0.84 * Math.sin(h * 1.48) ** 0.84;
    return [side * (width * lane + lap), -0.324 + (sheer + 0.324) * h, 2.87 * u];
  }
  const sect = 24,
    planks = 6;
  for (const side of [-1, 1])
    for (let k = 0; k < planks; k++)
      for (let j = 0; j < sect; j++) {
        const u = -1 + (j * 2) / sect,
          w = u + 2 / sect,
          lo = k / planks,
          hi = (k + 1) / planks;
        const a = mould(u, lo, side, 0.018),
          b = mould(u, hi, side),
          c = mould(w, hi, side),
          d = mould(w, lo, side, 0.018);
        quad(shell[(k + 1) % 3], a, b, c, d, lo * 1.1, hi * 1.1);
        const e = mould(u, lo, side, -0.012),
          f = mould(w, lo, side, -0.012);
        quad(shell[3], e, a, d, f, 0, 0.023);
        if (k === planks - 1) {
          const e = mould(u, 1, side, -0.066),
            f = mould(w, 1, side, -0.066);
          e[1] += 0.027;
          f[1] += 0.027;
          quad(shell[0], b, e, f, c, 0, 0.07);
        }
      }
  function beam(a, b, r, material, r2 = r) {
    const start = new THREE.Vector3(...a),
      end = new THREE.Vector3(...b),
      d = end.sub(start);
    const o = new THREE.Mesh(new THREE.CylinderGeometry(r2, r, d.length(), 7), material);
    o.position.copy(start).addScaledVector(d, 0.5);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    boat.add(o);
  }
  for (const side of [-1, 1]) {
    for (let n = -4; n <= 4; n++) {
      const u = n * 0.18;
      for (let k = 0; k < 6; k++) {
        const a = mould(u, k / 6, side, -0.04),
          c = mould(u, (k + 1) / 6, side, -0.04),
          e = [...a],
          f = [...c];
        e[2] += 0.077;
        f[2] += 0.077;
        quad(shell[3], a, c, f, e, 0, 0.1);
      }
    }
    for (let j = 0; j < sect; j++) {
      const u = -1 + (j * 2) / sect,
        w = u + 2 / sect;
      const a = mould(u, 0, side),
        d = mould(w, 0, side),
        b = [0, -0.34, u * 2.87],
        c = [0, -0.34, w * 2.87];
      quad(shell[3], a, b, c, d);
    }
  }
  for (const side of [-1, 1]) {
    const shoe = [0, -0.29, 2.86 * side],
      bow = [0, 0.68, 2.96 * side];
    beam(shoe, bow, 0.066, timber[2], 0.041);
    beam([0, 0.3, 2.925 * side], bow, 0.036, b.materials.brass, 0.042);
  }
  for (const g of shell) if (g.ix.length) boat.add(new THREE.Mesh(geometry(g.p, g.uv, g.ix), g.material));
  function board(x, y, z, w, h, d, material, rz = 0) {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    o.position.set(x, y, z);
    o.rotation.z = rz;
    boat.add(o);
  }
  for (const z of [-1.22, 0.24, 1.37]) {
    const half = mould(z / 2.87, 0.91, 1)[0];
    board(0, 0.245, z, 2 * half - 0.062, 0.094, 0.37, timber[0]);
    for (const side of [-1, 1]) board(side * (half - 0.13), 0.19, z, 0.1, 0.12, 0.45, timber[3], side * 0.28);
  }
  for (let k = -2; k <= 2; k++) board(k * 0.14, -0.177, -0.05, 0.127, 0.033, 2.75, timber[(k + 2) % 3]);
  // A shipped oar lies inside the port gunwale, below the actors' eyeline.
  beam([-0.64, 0.28, -1.71], [-0.49, 0.31, 1.28], 0.028, timber[0], 0.034);
  const blade = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), timber[1]);
  blade.position.set(-0.47, 0.32, 1.58);
  blade.scale.set(0.115, 0.026, 0.41);
  boat.add(blade);
  const stud = new THREE.SphereGeometry(0.015, 7, 4),
    pins = [];
  for (const side of [-1, 1])
    for (let j = -5; j <= 5; j++)
      for (const k of [2, 4, 5]) {
        const pos = mould(j * 0.155, (k + 0.75) / planks, side, 0.022);
        pins.push(pos);
      }
  const nails = new THREE.InstancedMesh(stud, b.materials.brass, pins.length),
    m = new THREE.Matrix4();
  pins.forEach(([x, y, z], i) => nails.setMatrixAt(i, m.makeTranslation(x, y, z)));
  boat.add(nails);
  marchJoin(boat);
  const hull = new THREE.Group();
  hull.add(...boat.children.slice());
  hull.position.z = -1.36;
  boat.add(hull);
  boat.position.set(44.7, marchWater, 26);
  boat.rotation.y = Math.PI / 2;
  v.scene.add(boat);
  v.ferryBoat = boat;
}
function marchTreeWood(fir) {
  const p = [],
    uv = [],
    idx = [],
    col = [],
    colours = [new THREE.Color(0xab9e81), new THREE.Color(0x74694f)];
  function limb(a, b, r1, r2) {
    const start = new THREE.Vector3(...a),
      end = new THREE.Vector3(...b),
      dir = end.clone().sub(start).normalize();
    const x = dir
        .clone()
        .cross(new THREE.Vector3(0, 0, 1))
        .normalize(),
      z = dir.clone().cross(x),
      off = p.length / 3;
    for (let ring = 0; ring < 2; ring++)
      for (let j = 0; j < 5; j++) {
        const u = (Math.PI * 2 * j) / 5,
          r = ring ? r2 : r1;
        const v = (ring ? end : start)
          .clone()
          .addScaledVector(x, Math.cos(u) * r)
          .addScaledVector(z, Math.sin(u) * r);
        p.push(v.x, v.y, v.z);
        uv.push(j * 0.2, ring);
        const c = colours[ring];
        col.push(c.r, c.g, c.b);
      }
    for (let j = 0; j < 5; j++) {
      const a = off + j,
        b = off + ((j + 1) % 5);
      idx.push(a, b, a + 5, b, b + 5, a + 5);
    }
  }
  if (fir) {
    limb([0, 0, 0], [0, 0.94, 0], 0.027, 0.003);
    for (let i = 0; i < 13; i++) {
      const a = i * 2.4,
        w = 0.17 * (1 - i * 0.052),
        y = 0.13 + i * 0.047;
      limb([0, y, 0], [Math.sin(a) * w, y + 0.035, Math.cos(a) * w], 0.007, 0.0018);
    }
  } else
    for (let i = 0; i < 18; i++) {
      const u = i / 17,
        a = i * 2.39996 + 0.27 * Math.sin(i * 0.95),
        dx = Math.sin(a),
        dz = Math.cos(a);
      const w = (0.205 + 0.12 * Math.sin(u * Math.PI)) * (1 - 0.66 * u) * (0.82 + 0.19 * Math.sin(i * 6.03));
      const root = [0.012 * Math.sin(u * 4), 0.247 + 0.63 * u, 0.009 * Math.cos(u * 5)];
      const elbow = [root[0] + w * dx * 0.51, root[1] + 0.092, root[2] + w * dz * 0.51];
      const tip = [root[0] + w * dx, root[1] + 0.126 + 0.05 * Math.sin(i * 3), root[2] + w * dz],
        r = 0.011 * (1 - u * 0.64);
      limb(root, elbow, r, r * 0.62);
      limb(elbow, tip, r * 0.62, 0.002);
    }
  const result = geometry(p, uv, idx);
  result.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return result;
}
// Boat, wheel and valve assemblies move as complete objects. Bake fixed members by material.
function marchJoin(group) {
  const parts = new Map();
  for (const obj of group.children.slice()) {
    if (!obj.isMesh || obj.isInstancedMesh || obj.children.length || Array.isArray(obj.material)) continue;
    obj.updateMatrix();
    const mesh = obj.geometry.clone().applyMatrix4(obj.matrix);
    const pos = mesh.attributes.position,
      n = mesh.attributes.normal,
      uv = mesh.attributes.uv;
    if (!parts.has(obj.material)) parts.set(obj.material, { p: [], n: [], uv: [], ix: [] });
    const row = parts.get(obj.material),
      first = row.p.length / 3;
    for (let i = 0; i < pos.count; i++) {
      row.p.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      row.n.push(n.getX(i), n.getY(i), n.getZ(i));
      row.uv.push(uv.getX(i), uv.getY(i));
    }
    if (mesh.index) {
      for (const index of mesh.index.array) row.ix.push(index + first);
    } else for (let i = 0; i < pos.count; i++) row.ix.push(i + first);
    group.remove(obj);
    mesh.dispose();
  }
  for (const [mat, g] of parts) {
    const mesh = new THREE.BufferGeometry();
    mesh.setAttribute('position', new THREE.Float32BufferAttribute(g.p, 3));
    mesh.setAttribute('normal', new THREE.Float32BufferAttribute(g.n, 3));
    mesh.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
    mesh.setIndex(g.ix);
    group.add(new THREE.Mesh(mesh, mat));
  }
}
function marchForest(v, b, realm) {
  const branchWood = marchTreeWood(false),
    firWood = marchTreeWood(true);
  const near = birchCrown(false),
    leaves = foliageMaterial('birch-spray');
  leaves.vertexColors = true;
  leaves.alphaTest = 0.31;
  const limb = new THREE.MeshLambertMaterial({ vertexColors: true }),
    bark = realm.birchBark();
  const birchTrunk = new THREE.CylinderGeometry(0.017, 0.026, 0.72, 7);
  birchTrunk.translate(0, 0.36, 0);
  const fir = trailGeometry('fir_tree_01', 'far'),
    firTrunk = firWood,
    needles = trailFoliage('fir_tree_01', '.0028', 0.23);
  const shadow = footShade(),
    shade = shadow.material,
    shadowG = shadow.geometry;
  for (const tree of marchFlora()) {
    const { x, y, z, h, a } = tree,
      w = h * (0.91 + 0.16 * Math.sin(a));
    if (tree.fir) {
      b.add(fir, needles, x, y, z, w, h, w, a);
      b.add(firTrunk, b.materials.beam, x, y, z, w, h, w, a);
    } else {
      b.add(near.crown, leaves, x, y, z, w, h, w, a);
      b.add(branchWood, limb, x, y, z, w, h, w, a);
      b.add(birchTrunk, bark, x, y, z, w, h, w, a);
    }
    if (h > 7) b.add(shadowG, shade, x, y + 0.04, z, h * 0.29, 1, h * 0.23, a);
  }
  const grass = trailGeometry('grass_medium_01', 'far'),
    grassMat = trailFoliage('grass_medium_01', '.04', 0.28);
  const fern = trailGeometry('fern_02', 'near'),
    fernMat = trailFoliage('fern_02', '.025', 0.31);
  const reeds = new THREE.ConeGeometry(0.035, 1, 4);
  reeds.translate(0, 0.5, 0);
  const straw = new THREE.MeshLambertMaterial({ color: 0x9c9458 });
  for (let i = 0; i < 5400; i++) {
    const x = (meadowHash(i, 87, 2) - 0.5) * 318,
      z = (meadowHash(i, 69, 3) - 0.5) * 400;
    const path = marchPath(x, z),
      y = marchGround(x, z, path),
      r = meadowHash(i, 10, 1),
      a = r * 12.73;
    if (y < 1.3 && y > -0.13 && path.d > 1.8) {
      for (let j = 0; j < 6; j++)
        b.add(
          reeds,
          straw,
          x + Math.sin(j * 2.4) * 0.52,
          y,
          z + Math.cos(j * 2.4) * 0.37,
          1,
          1.15 + r,
          1,
          a,
          0.08 * Math.sin(j),
        );
    } else if (
      y > 1.2 &&
      y < 35 &&
      path.d > 2.5 &&
      !marchOverWater(x, z) &&
      Math.hypot(marchGround(x + 0.45, z) - y, marchGround(x, z + 0.45) - y) < 0.28 &&
      !marchPads.some(([cx, cz, h, rx, rz]) => Math.abs(cx - x) < rx && Math.abs(cz - z) < rz)
    ) {
      const f = r > 0.91;
      const k = f ? 0.6 + r * 0.65 : 1.1 + r * 0.9;
      b.add(f ? fern : grass, f ? fernMat : grassMat, x, y - 0.015, z, k, k, k, a);
    }
  }
}
function marchResidents(v, b) {
  const person = (kind, tag) => {
    const actor = appearance(kind, tag, true);
    v.scene.add(actor);
    return actor;
  };
  v.vera = person('witness', 'vera');
  v.savva = person('witness', 'savva');
  v.bailiff = person('guard', 'vigil');
  v.family = [person('merchant', 'healer'), person('herbalist', 'herbalist'), person('merchant', 'young')];
  v.family[1].scale.set(0.83, 0.81, 0.83);
  v.family[2].scale.set(0.72, 0.65, 0.72);
  v.nameboard = marchPlacard('ИМЕНА СЕМЕЙ', 2.25);
  v.scene.add(v.nameboard);
  v.luggage = new THREE.Group();
  for (let k = 0; k < 6; k++) {
    const sack = new THREE.Mesh(new THREE.SphereGeometry(0.48, 9, 6), b.materials.beam);
    sack.scale.set(1, 0.67, 0.79);
    sack.position.set(60 + Math.sin(k * 2.4) * 1.3, 5.15, 29 + Math.cos(k * 2.4) * 0.8);
    v.luggage.add(sack);
  }
  v.scene.add(v.luggage);
  function stand(actor, x, z, yaw, show = true) {
    actor.visible = show;
    if (!show) return;
    actor.position.set(x, marchFloor(x, z), z);
    actor.rotation.y = yaw;
  }
  const ledgerTexture = (sealed = false) => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 160;
    const g = c.getContext('2d');
    g.fillStyle = '#cfbc88';
    g.fillRect(0, 0, 256, 160);
    g.strokeStyle = '#987147';
    g.strokeRect(7, 6, 242, 148);
    g.beginPath();
    g.moveTo(127, 5);
    g.lineTo(127, 156);
    g.stroke();
    g.font = 'italic 12px Georgia';
    g.fillStyle = '#493d2f';
    g.fillText('Журнал берега', 13, 26);
    for (let i = 0; i < 9; i++) {
      const y = 38 + i * 12;
      g.fillStyle = '#b99b69';
      g.fillRect(13, y, 102, 1);
      g.fillRect(138, y, 102, 1);
      if (!sealed) {
        g.fillStyle = '#514e39';
        g.font = 'italic 7px Georgia';
        g.fillText(['А. Савельев', 'М. Воронова', 'О. Плесцов', 'И. Маркова'][i % 4], 17, y - 2);
        g.fillText(['с каменоломни', 'дозор часовни', 'вечерний рейс'][i % 3], 142, y - 2);
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const ledgers = [ledgerTexture(), ledgerTexture(true)];
  const journal = new THREE.Mesh(
    new THREE.PlaneGeometry(0.64, 0.45),
    new THREE.MeshLambertMaterial({ map: ledgers[0] }),
  );
  journal.rotation.set(-Math.PI * 0.5, 0, -0.2);
  journal.position.set(-54.2, 14.217, 94.79);
  v.scene.add(journal);
  const receipt = typeof wetTally === 'function' ? wetTally() : null;
  if (receipt) {
    receipt.position.set(60.1, 5.33, 24.89);
    receipt.scale.setScalar(1.77);
    receipt.rotation.y = 0.38;
    v.scene.add(receipt);
  }
  v.placeResidents = (ending) => {
    journal.material.map = ledgers[ending === 'refuge' ? 1 : 0];
    stand(
      v.vera,
      ending === 'vigil' ? 12.1 : ending === 'refuge' ? 60.3 : -53.1,
      ending === 'vigil' ? -136.8 : ending === 'refuge' ? 27.1 : 95.6,
      -0.1,
    );
    stand(
      v.savva,
      ending === 'vigil' ? 15.5 : ending === 'hearing' ? -54.7 : ending === 'refuge' ? 61 : -78.1,
      ending === 'vigil' ? -137 : ending === 'hearing' ? 96.4 : ending === 'refuge' ? 27.6 : -83.05,
      0.46,
    );
    if (ending === 'refuge') {
      v.savva.position.set(43.91, marchWater + 0.24, 26.48);
      v.savva.rotation.y = 1.35;
    }
    stand(
      v.bailiff,
      ending === 'vigil' ? 18 : -56.8,
      ending === 'vigil' ? -138 : 96.7,
      0.42,
      ending === 'hearing' || ending === 'vigil',
    );
    v.family.forEach((a, i) => stand(a, 62 + 1.37 * i, 29.6 + i * 0.2, 1.9 + i, ending === 'refuge'));
    if (ending === 'refuge') {
      const seats = [
        [42.39, 26.33, 0.97],
        [44.42, 25.86, -1.28],
        [43.79, 25.66, 1.08],
      ];
      v.family.forEach((a, i) => {
        a.position.set(seats[i][0], marchWater + 0.24, seats[i][1]);
        a.rotation.y = seats[i][2];
      });
    }
    v.luggage.visible = ending === 'refuge';
    v.nameboard.visible = ['hearing', 'vigil'].includes(ending);
    v.nameboard.position.set(
      ending === 'hearing' ? -55.9 : 13.9,
      ending === 'hearing' ? 14.8 : 20.2,
      ending === 'hearing' ? 95.48 : -138.9,
    );
  };
  v.placeResidents(null);
  const p = new THREE.Shape();
  p.moveTo(0, 0);
  p.quadraticCurveTo(0.65, 0.38, 1.34, 0.11);
  p.lineTo(1.94, -0.16);
  p.quadraticCurveTo(1.09, 0.05, 0.02, -0.1);
  const geo = new THREE.ShapeGeometry(p),
    feather = new THREE.MeshLambertMaterial({ color: 0xced2c8, side: THREE.DoubleSide });
  v.birds = Array.from({ length: 7 }, (_, i) => {
    const g = new THREE.Group();
    for (const side of [-1, 1]) {
      const m = new THREE.Mesh(geo, feather);
      m.scale.x = side;
      m.rotation.x = Math.PI * 0.29;
      g.add(m);
    }
    g.scale.setScalar(0.85 + (i % 3) * 0.21);
    v.scene.add(g);
    return g;
  });
}
function ensureMarchView(realm) {
  if (realm.marchView) return realm.marchView;
  const scene = new THREE.Scene(),
    v = { scene, valves: [], bands: [], actors: new Map(), lastEnding: undefined };
  realm.marchView = v;
  marchSolids.length = 0;
  scene.background = new THREE.Color(0xb7c6c6);
  scene.fog = new THREE.FogExp2(0xb9c6be, 0.0029);
  v.skylight = new THREE.HemisphereLight(0xe8eeee, 0x958b73, 1.49);
  scene.add(v.skylight);
  const sun = new THREE.DirectionalLight(0xffe3bd, 2.5);
  sun.position.set(-85, 77, -62);
  scene.add(sun);
  v.sun = sun;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(550, 52, 30), createCountrySky(v));
  sky.rotation.y = 0;
  sky.renderOrder = -10;
  scene.add(sky);
  v.sky = sky;
  const b = marchBatches(scene);
  marchTerrain(v);
  marchWaterSurface(v);
  marchStructures(v, b);
  marchWindows(v, b);
  marchBoat(v, b);
  marchResidents(v, b);
  marchForest(v, b, realm);
  b.flush();
  return v;
}
function marchLighting(v, t) {
  const a = countryAlmanac(game),
    u = v.airUniforms;
  let j = 1;
  while (j < countryPalette.length - 1 && a.hour > countryPalette[j][0]) j++;
  const lo = countryPalette[j - 1],
    hi = countryPalette[j],
    f = marchEase(lo[0], hi[0], a.hour);
  v.scene.fog.color.copy(lo[1]).lerp(hi[1], f);
  v.scene.fog.density = 0.0039 + 0.0018 * a.rain + 0.0006 * a.night;
  v.skylight.color.copy(lo[2]).lerp(hi[2], f);
  v.skylight.groundColor.copy(lo[3]).lerp(hi[3], f);
  v.skylight.intensity = (lo[6] + f * (hi[6] - lo[6])) * 1.3;
  v.sun.color.copy(lo[4]).lerp(hi[4], f);
  v.sun.intensity = (lo[5] + f * (hi[5] - lo[5])) * (1 - 0.53 * a.rain);
  const rise = ((a.hour - 6) * Math.PI) / 12;
  u.sunny.value.set(Math.cos(rise), a.sunHeight, 0.33 * Math.sin(rise) - 0.1).normalize();
  u.moon.value
    .set(
      -Math.cos(rise - 0.46),
      Math.max(-0.52, 0.4 - a.sunHeight * 0.5),
      -0.44 + 0.15 * Math.sin(rise * 0.55),
    )
    .normalize();
  u.lightDirection.value.copy(u.moon.value).lerp(u.sunny.value, marchEase(-0.13, 0.105, a.sunHeight));
  u.lightDirection.value.y = Math.max(0.12, u.lightDirection.value.y);
  v.sun.position.copy(u.lightDirection.value).multiplyScalar(70);
  u.keyTint.value.copy(v.sun.color);
  u.dim.value = a.night;
  u.wet.value = a.rain;
  u.daylight.value = marchEase(-0.24, 0.088, a.sunHeight);
  countryLeafBounce.value
    .copy(v.skylight.color)
    .multiplyScalar((0.085 + 0.98 * u.daylight.value) * (1 - 0.17 * a.rain));
  u.twilight.value = 1 - marchEase(0.12, 0.6, a.sunHeight);
  u.aurora.value = a.aurora;
  u.wind.value = t;
  u.mobile.value = prefs.quality === 'light' ? 1 : 0;
  v.water.material.uniforms.night.value = a.night;
  v.water.material.uniforms.sunDirection.value.copy(u.lightDirection.value);
  v.water.material.uniforms.sunColor.value.copy(v.sun.color).multiplyScalar(v.sun.intensity * 0.45);
  if (v.lamps) {
    const lit = 1 - marchEase(-0.09, 0.26, a.sunHeight);
    v.lamps.glass.emissiveIntensity = 0.07 + lit * 2.2;
    v.lamps.glow.opacity = 0.08 + lit * 0.68;
    for (const bulb of v.lamps.bulbs) bulb.intensity = lit * 7;
  }
}
function marchUpdate(v, t) {
  if (game) marchLighting(v, t);
  const state = typeof oathVisualState === 'function' && game ? oathVisualState(game) : null;
  const ending = state?.ending || null;
  if (v.lastEnding !== ending) {
    v.placeResidents(ending);
    v.lastEnding = ending;
  }
  for (const a of [v.vera, v.savva, v.bailiff, ...v.family])
    if (a.visible)
      poseCharacter(
        a,
        ending === 'refuge' && (a === v.savva || v.family.includes(a)) ? 'sit' : 'idle',
        t + (a.id % 13) * 0.06,
        0.88,
      );
  for (let i = 0; i < v.valves.length; i++)
    v.valves[i].rotation.z = (i === 0 ? state?.waterToWheel : state?.drainOpen) ? Math.PI * 0.84 : 0;
  if (state?.waterToWheel) v.wheel.rotation.z = t * 0.72;
  v.millJet.visible = !!state?.waterToWheel;
  if (v.millJet.visible) v.millJet.material.opacity = 0.43 + 0.063 * Math.sin(t * 12);
  v.wellWater.position.y = state?.dry ? 11.68 : state?.drainOpen ? 14.66 : 16.49;
  v.wellWater.position.y += 0.016 * Math.sin(t * 1.56);
  v.wellWater.material.opacity = state?.dry ? 0.53 : 0.72;
  if (v.ringSerial !== state?.ringSerial) {
    if (v.ringSerial !== undefined) v.ringAt = t;
    v.ringSerial = state?.ringSerial;
  }
  const age = t - (v.ringAt ?? -100);
  v.bell.rotation.x = age < 5 ? 0.33 * Math.sin(age * 5.6) * Math.exp(-age * 0.66) : 0;
  if (!v.ferryBoat.userData.directed) {
    v.ferryBoat.rotation.z = 0.018 * Math.sin(t * 1.13);
    v.ferryBoat.position.y = marchWater + 0.041 * Math.sin(t * 0.81);
    if (ending === 'refuge')
      for (const a of [v.savva, ...v.family])
        a.position.y = v.ferryBoat.position.y + 0.298 - a.scale.y * (a === v.savva ? 0.458 : 0.448);
  }
  v.ferryBoat.updateMatrixWorld(true);
  v.water.material.uniforms.boatSpace.value.copy(v.ferryBoat.matrixWorld).invert();
  v.birds.forEach((g, i) => {
    const a = t * (0.078 + i * 0.001) + i * 0.42;
    g.position.set(
      9 + Math.cos(a) * (27 + i * 1.3),
      9 + i * 0.63 + Math.sin(a * 3) * 1.28,
      -16 + Math.sin(a) * (25 + i * 0.9),
    );
    g.rotation.y = -a;
    g.children.forEach((m, j) => (m.rotation.z = (j ? 1 : -1) * (0.08 + 0.2 * Math.sin(t * 2.32 + i))));
  });
  v.water.time.value = t;
  windClock.value = t;
}
function renderMarchCamera(realm, camera, t) {
  const v = ensureMarchView(realm),
    water = v.water,
    renderer = realm.renderer;
  marchUpdate(v, t);
  camera.updateMatrixWorld(true);
  camera.getWorldPosition(v.sky.position);
  v.sky.scale.setScalar(Math.min(360, camera.far * 0.85) / 550);
  if (prefs.quality !== 'light' && (Math.abs(t - water.last) > 0.14 || water.camera !== camera)) {
    const mirror = water.cam,
      p = camera.getWorldPosition(new THREE.Vector3()),
      target = p.clone().add(camera.getWorldDirection(new THREE.Vector3()));
    mirror.position.set(p.x, 2 * marchWater - p.y, p.z);
    target.y = 2 * marchWater - target.y;
    mirror.up.set(0, -1, 0);
    mirror.lookAt(target);
    mirror.projectionMatrix.copy(camera.projectionMatrix);
    mirror.updateMatrixWorld(true);
    water.projector.value.multiplyMatrices(mirror.projectionMatrix, mirror.matrixWorldInverse);
    const plane = water.clip
      .setComponents(0, 1, 0, -marchWater - 0.014)
      .applyMatrix4(mirror.matrixWorldInverse);
    const v4 = water.clip4.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant),
      m = mirror.projectionMatrix.elements;
    const corner = water.corner.set(
      (Math.sign(v4.x) + m[8]) / m[0],
      (Math.sign(v4.y) + m[9]) / m[5],
      -1,
      (1 + m[10]) / m[14],
    );
    v4.multiplyScalar(2 / v4.dot(corner));
    m[2] = v4.x;
    m[6] = v4.y;
    m[10] = v4.z + 1;
    m[14] = v4.w;
    mirror.projectionMatrixInverse.copy(mirror.projectionMatrix).invert();
    const held = camera.children.filter((o) => o.visible);
    for (const o of held) o.visible = false;
    water.mesh.visible = false;
    v.sky.position.copy(mirror.position);
    const previous = renderer.getRenderTarget();
    renderer.setRenderTarget(water.target);
    renderer.render(v.scene, mirror);
    renderer.setRenderTarget(previous);
    camera.getWorldPosition(v.sky.position);
    for (const o of held) o.visible = true;
    water.mesh.visible = true;
    water.last = t;
    water.camera = camera;
    water.material.uniforms.opacity.value = 0.985;
  } else if (prefs.quality === 'light') water.material.uniforms.opacity.value = 0;
  renderer.render(v.scene, camera);
}
function renderMarch(realm, s, t, attackAnim, bob) {
  const v = ensureMarchView(realm),
    m = s.march,
    c = realm.camera,
    dt = Math.min(0.1, Math.max(0, t - (v.time ?? t)));
  v.time = t;
  if (c.parent !== v.scene) v.scene.add(c);
  const y = marchFloor(m.x, m.z) + s.air,
    eye = s.leg === 'lost' ? 0.78 : s.leg === 'chair' ? 1.32 : 1.71;
  c.position.set(m.x, y + eye + bob, m.z);
  c.rotation.set(s.pitch, s.yaw, 0, 'YXZ');
  const focus = s.weapon === 'bow' && keys.has('KeyR');
  $('play').classList.toggle('bow-focus', focus);
  c.fov += ((focus ? 48 : 68) - c.fov) * (1 - Math.exp(-dt * 14));
  c.updateProjectionMatrix();
  const shoulder =
    prefs.camera === 'shoulder' &&
    s.weapon === 'sword' &&
    s.leg !== 'lost' &&
    s.leg !== 'chair' &&
    s.eye !== 'lost' &&
    s.arm !== 'lost';
  if (shoulder) {
    if (v.hero?.userData.playerSide !== s.side) {
      if (v.hero) {
        v.scene.remove(v.hero);
        releaseCharacter(v.hero);
      }
      v.hero = appearance(heroRoles[s.side], 'hero');
      v.hero.userData.playerSide = s.side;
      v.scene.add(v.hero);
    }
    const moving = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown'].some((k) => keys.has(k));
    v.hero.visible = true;
    v.hero.position.set(m.x, y, m.z);
    v.hero.rotation.y = s.yaw + Math.PI;
    realm.updateHands(s, t, attackAnim, bob);
    poseGuardedHero(
      v.hero,
      attackAnim > 0.01
        ? s.heavy
          ? 'heavy'
          : 'slash'
        : s.air > 0.12
          ? 'jump'
          : moving
            ? keys.has('ShiftLeft')
              ? 'run'
              : 'walk'
            : 'idle',
      t,
      realm.guardKick.value,
      realm.guardLift.value,
    );
    const dx = Math.sin(s.yaw) * 3.5 + Math.cos(s.yaw) * 0.69,
      dz = Math.cos(s.yaw) * 3.5 - Math.sin(s.yaw) * 0.69;
    let fraction = 1;
    for (let f = 0.09; f <= 1; f += 0.09)
      if (
        !marchLocalFree(m.x + dx * f, m.z + dz * f, 0.14) ||
        marchFloor(m.x + dx * f, m.z + dz * f) > y + 1.82
      ) {
        fraction = Math.max(0.06, f - 0.09);
        break;
      }
    c.position.x += dx * fraction;
    c.position.z += dz * fraction;
    c.position.y += 0.46 * fraction;
    realm.hideHands();
  } else {
    if (v.hero) v.hero.visible = false;
    realm.updateHands(s, t, attackAnim, bob);
  }
  if (typeof renderMarchWildlife === 'function') renderMarchWildlife(v, s, t);
  renderMarchCamera(realm, c, t);
}

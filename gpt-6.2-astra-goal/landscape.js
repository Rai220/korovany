'use strict';

// Mesh materials are loaded from the local texture pack, including under file://.
const textures = new Map();
function texture(name, source = materialImages) {
  if (textures.has(name)) return textures.get(name);
  const tex = new THREE.TextureLoader().load(source[name]);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  textures.set(name, tex);
  return tex;
}
const streamZ = (x) =>
  Math.sin((x * 4 * Math.PI) / WORLD_LIMIT) * 2.8 + Math.sin((x * 5 * Math.PI) / WORLD_LIMIT) * 0.7;

function creekDepth(x, z) {
  if (Math.min(Math.abs(wrapped(x) - 50), Math.abs(wrapped(x) + 50)) < 2.9) return 0;
  return Math.max(0, 1 - Math.abs(wrapped(z) - streamZ(x)) / 2.8) * 1.65;
}
function walkingSurface(x, z) {
  return ground(x, z) - creekDepth(x, z);
}
function projectedMaterial(name, tint, scale, metalness = 0) {
  const mat = new THREE.MeshStandardMaterial({
    color: tint,
    map: texture(name),
    roughness: metalness ? 0.4 : 0.94,
    metalness,
  });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader =
      'varying vec3 vPlace;\nvarying vec3 vAxis;\n' +
      shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
    vec4 localSurface=vec4(transformed,1.);
    vec3 localNormal=normal;
    #ifdef USE_INSTANCING
      localSurface=instanceMatrix*localSurface;
      localNormal=mat3(instanceMatrix)*normal;
    #endif
    vPlace=(modelMatrix*localSurface).xyz;vAxis=normalize(mat3(modelMatrix)*localNormal);`,
      );
    shader.fragmentShader =
      'varying vec3 vPlace;varying vec3 vAxis;\n' +
      shader.fragmentShader.replace(
        '#include <map_fragment>',
        `vec3 axis=abs(normalize(vAxis));vec2 planar=axis.y>.7?vPlace.xz:(axis.x>axis.z?vPlace.zy:vPlace.xy);
    vec4 surface=texture2D(map,planar*${scale.toFixed(3)});diffuseColor*=surface;`,
      );
  };
  mat.customProgramCacheKey = () => name + scale;
  return mat;
}
const windClock = { value: 0 };
function foliageMaterial(name) {
  const mat = new THREE.MeshLambertMaterial({
    map: texture(name),
    color: 0xe5eacb,
    alphaTest: 0.36,
    side: THREE.DoubleSide,
  });
  const amplitude = name === 'bough' || name === 'pine' ? '.0023' : '.046';
  mat.onBeforeCompile = (s) => {
    s.uniforms.windClock = windClock;
    s.vertexShader =
      'uniform float windClock;\n' +
      s.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
    #ifdef USE_INSTANCING
      transformed.x+=${amplitude}*sin(windClock*1.52+instanceMatrix[3].x*.37+instanceMatrix[3].z*.21)*uv.y;
    #endif`,
      );
  };
  mat.customProgramCacheKey = () => name;
  return mat;
}
function geometry(positions, uvs, indices) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
class FrontierLandscape extends RealmGeometry {
  prepareMaterials() {
    this.materialFamilies = new Map();
    const family = (hues, mat) => hues.forEach((h) => this.materialFamilies.set(h, mat));
    family([0x969384, 0x716e60, 0x66685c, 0x585956, 0x777766], projectedMaterial('stone', 0xd3d2c1, 0.26));
    family([0x4d5948, 0x654e3b, 0x43494a, 0x545e61], projectedMaterial('slate', 0xc5c5b2, 0.3));
    family(
      [0x897454, 0x967856, 0x826445, 0x795f42, 0x87704d, 0x785537, 0x6f5239],
      projectedMaterial('wood', 0xe7d8bc, 0.35),
    );
    family(
      [0x534432, 0x594431, 0x665644, 0x5a4434, 0x553d26, 0x4a4b3d, 0x4a4236],
      projectedMaterial('wood', 0xa39c89, 0.55),
    );
    family([0x534936], projectedMaterial('bark', 0xcac1a4, 0.6));
    family([0x746e63, 0x868577], projectedMaterial('scree', 0xb5b8a5, 1.36));
    family([0xd5c9aa, 0xd0bda0], projectedMaterial('linen', 0xd1c29d, 0.7));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.lightSites = [];
    this.blades = null;
    this.torchGeo = new THREE.OctahedronGeometry(1, 1);
    this.matCache.set(0xffca66, new THREE.MeshBasicMaterial({ color: 0xffc17b }));
  }
  mat(c) {
    return this.materialFamilies?.get(c) || super.mat(c);
  }
  sky() {
    const geo = new THREE.SphereGeometry(325, 64, 28);
    const mat = new THREE.MeshBasicMaterial({
      map: texture('sky'),
      color: 0xfff4db,
      side: THREE.BackSide,
      fog: false,
      toneMapped: false,
      depthWrite: false,
    });
    // Compress the lower hemisphere so ridgelines sit above the playable horizon.
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, Math.min(1, Math.max(0, 0.52 + (uv.getY(i) - 0.5) * 1.65)));
    this.skyMesh = new THREE.Mesh(geo, mat);
    this.skyMesh.rotation.y = 1.18;
    this.scene.add(this.skyMesh);
    const env = texture('sky').clone();
    env.mapping = THREE.EquirectangularReflectionMapping;
    const sky = texture('sky');
    this.environmentSource = sky;
    this.environmentMap = env;
  }
  terrain() {
    const g = new THREE.PlaneGeometry(PERIOD, PERIOD, 164, 180);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position,
      colors = [];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        gridZ = p.getZ(i),
        abs = Math.abs(gridZ),
        z =
          Math.sign(gridZ) *
          (abs < 28.8 ? abs * 0.3 : 8.64 + ((abs - 28.8) * (WORLD_LIMIT - 8.64)) / (WORLD_LIMIT - 28.8));
      p.setZ(i, z);
      p.setY(i, walkingSurface(x, z));
      const tint = new THREE.Color([0xf2e6a9, 0xf6d4a8, 0xbade91, 0xd4bec4][zoneAt(x, z)]);
      tint.lerp(new THREE.Color(0xdfebad), rimBlend(x, z));
      tint.multiplyScalar(0.96 + 0.08 * Math.sin(((x * 14 + z * 9) * Math.PI) / WORLD_LIMIT));
      colors.push(tint.r, tint.g, tint.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ map: texture('soil'), roughness: 1, vertexColors: true });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.trackMap = { value: texture('road') };
      for (const name of ['meadow', 'scree', 'moss', 'cobbles'])
        shader.uniforms[name] = { value: texture(name) };
      shader.vertexShader =
        'varying vec3 terrainPoint;\n' +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nterrainPoint=position;',
        );
      shader.fragmentShader =
        'uniform sampler2D trackMap,meadow,scree,moss,cobbles;varying vec3 terrainPoint;\n' +
        shader.fragmentShader.replace(
          '#include <map_fragment>',
          `
      vec2 pos=terrainPoint.xz,uv=pos*.26;
      vec3 soil=texture2D(map,uv).rgb;soil=mix(soil,texture2D(map,mat2(.866,.5,-.5,.866)*uv*.61).rgb,.27);
      float wav=sin(pos.x*.64+pos.y*.56)*.34+sin(pos.x*1.73-pos.y*1.3)*.15;
      vec2 dist=abs(abs(pos)-50.);float road=1.-smoothstep(1.95,3.55,min(dist.x,dist.y)+wav);
      vec3 dirt=texture2D(trackMap,pos*.25).rgb;
      float ruts=smoothstep(.12,.27,abs(min(dist.x,dist.y)-.84+wav*.2));
      float palace=smoothstep(33.,53.,pos.x)*(1.-smoothstep(-33.,-12.,pos.y));
      float forest=(1.-smoothstep(-12.,3.,pos.x))*smoothstep(-5.,15.,pos.y);
      float mountain=smoothstep(5.,32.,pos.x)*smoothstep(4.,29.,pos.y);
      float growth=clamp(.58+.26*sin(pos.x*.27+pos.y*.2)+.16*sin(pos.x*.15-pos.y*.69),.15,.93);
      float rim=smoothstep(95.,137.,max(abs(pos.x),abs(pos.y))); forest*=1.-rim;mountain*=1.-rim;palace*=1.-rim;
      vec3 wild=mix(soil,texture2D(meadow,pos*.31).rgb,growth);
      wild=mix(wild,mix(soil,texture2D(moss,pos*.36).rgb,growth),forest);
      wild=mix(wild,texture2D(scree,pos*.225).rgb,mountain*.92);
      float creek=sin(pos.x*.08726646)*2.8+sin(pos.x*.10908308)*.7;
      float bank=(1.-smoothstep(1.76,3.05,abs(pos.y-creek)+.13*wav))*smoothstep(2.8,3.6,dist.x);
      wild=mix(wild,texture2D(scree,pos*.61).rgb*vec3(.81,.92,.84),bank);
      dirt=mix(dirt,texture2D(cobbles,pos*.24).rgb,palace*.94);
      diffuseColor.rgb*=mix(wild*1.18,dirt*mix(.69,1.13,ruts),road);`,
        );
    };
    const land = new THREE.Mesh(g, mat);
    land.receiveShadow = true;
    this.tileGround(land);
    const verts = [],
      uvs = [],
      ind = [];
    for (let i = 0; i <= 240; i++) {
      const x = -WORLD_LIMIT + (i * PERIOD) / 240,
        z = streamZ(x);
      for (const sign of [-1, 1]) {
        verts.push(x, ground(x, z) - 0.48, z + sign * 2.55);
        uvs.push(x * 0.3, sign * 0.5 + 0.5);
      }
      if (i) {
        const a = i * 2 - 2;
        ind.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    this.waterTime = { value: 0 };
    const mirror = (this.riverMirror = {
      image: new THREE.WebGLRenderTarget(480, 360, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
      }),
      camera: new THREE.PerspectiveCamera(),
      clip: new THREE.Plane(),
      clip4: new THREE.Vector4(),
      corner: new THREE.Vector4(),
      targetPoint: new THREE.Vector3(),
      project: { value: new THREE.Matrix4() },
      active: { value: 0 },
      last: -1,
    });
    const water = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
    });
    water.onBeforeCompile = (shader) => {
      shader.uniforms.riverTime = this.waterTime;
      shader.uniforms.riverImage = { value: mirror.image.texture };
      shader.uniforms.riverProject = mirror.project;
      shader.uniforms.mirrorActive = mirror.active;
      shader.uniforms.riverSky = { value: texture('sky') };
      shader.vertexShader =
        'varying vec3 waterLocal; varying vec3 waterWorld;\n' +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\n waterLocal=position;waterWorld=(modelMatrix*vec4(position,1.)).xyz;',
        );
      shader.fragmentShader =
        'uniform float riverTime,mirrorActive; uniform sampler2D riverSky,riverImage;uniform mat4 riverProject; varying vec3 waterLocal; varying vec3 waterWorld;\n' +
        shader.fragmentShader.replace(
          '#include <color_fragment>',
          `#include <color_fragment>
        vec2 p=waterLocal.xz;
        float bedCenter=sin(p.x*.08726646)*2.8+sin(p.x*.10908308)*.7;
        float bank=abs(p.y-bedCenter)/2.55;
        float t=riverTime;
        float ripple=sin(p.x*2.54+p.y*9.2-t*2.36+sin(p.x*.94+t*.31))+
                     .38*sin(p.x*6.1-p.y*15.4+t*3.14)+.21*sin(p.y*21.+p.x*4.-t*3.3);
        float drift=sin(p.x*.71-p.y*1.8-t*.66)+.43*sin(p.y*2.1+p.x*1.7+t*.34);
        vec3 n=normalize(vec3(.064*ripple,1., .093*drift+.043*cos(p.y*8.1-t*1.5)));
        vec3 viewDir=normalize(cameraPosition-waterWorld),ray=reflect(-viewDir,n);
        float fresnel=.075+.49*pow(1.-max(dot(viewDir,n),0.),3.);
        vec2 pano=vec2(atan(ray.z,ray.x)*.159155+.5+.1878,.513+asin(clamp(ray.y,-1.,1.))*.31831);
        vec3 sky=texture2D(riverSky,pano).rgb;
        vec3 depth=mix(vec3(.020,.132,.143),vec3(.097,.219,.169),smoothstep(.25,1.,bank));
        vec4 mirrored=riverProject*vec4(waterWorld,1.);
        vec2 imageUV=.5+.5*mirrored.xy/max(.001,mirrored.w);
        vec3 panorama=sky*vec3(.55,.63,.61)+.014;
        vec2 bend=vec2(ripple*.0028,drift*.0036)/max(.45,abs(viewDir.y));
        float available=mirrorActive*step(0.,min(imageUV.x,imageUV.y))*step(max(imageUV.x,imageUV.y),1.)*step(0.,mirrored.w);
        vec3 reflection=mix(panorama,texture2D(riverImage,clamp(imageUV+bend,.005,.995)).rgb,available);
        vec3 river=mix(depth,reflection,mix(fresnel,.22+.66*pow(1.-max(dot(viewDir,n),0.),2.),available));
        float spec=pow(max(dot(reflect(-viewDir,n),normalize(vec3(-.66,.56,-.50))),0.),91.);
        float sheen=smoothstep(1.02,1.59,ripple)*(.28+.6*fresnel);
        river+=vec3(.055,.069,.065)*sheen+vec3(.96,.70,.36)*spec*.69;
        float edge=1.-smoothstep(.011,.061,abs(bank-(.80+.045*sin(p.x*3.+t*.4)+.025*ripple)));
        river=mix(river,vec3(.54,.67,.58),edge*(.25+.36*smoothstep(-.4,.75,drift)));
        diffuseColor.rgb=river;diffuseColor.a=.94-.38*smoothstep(.35,.89,bank);`,
        );
    };
    this.tileGround(new THREE.Mesh(geometry(verts, uvs, ind), water));
    mirror.tiles = this.tiles.filter((tile) => tile.material === water);
    this.riverBanks();
  }
  updateRiverMirror(s, t, c) {
    const distanceToBank = Math.abs(wrapped(c.position.z) - streamZ(c.position.x));
    const mirror = this.riverMirror;
    if (!mirror || prefs.quality === 'light' || distanceToBank > 17) {
      if (mirror) mirror.active.value = 0;
      return;
    }
    if (
      mirror.active.value &&
      t >= mirror.last &&
      t - mirror.last < (prefs.quality === 'high' ? 0.065 : 0.12)
    )
      return;
    const surface = ground(c.position.x, streamZ(c.position.x)) - 0.48;
    if (c.position.y < surface + 0.07) {
      mirror.active.value = 0;
      return;
    }
    mirror.last = t;
    const cam = mirror.camera;
    c.updateMatrixWorld();
    cam.position.copy(c.position);
    cam.position.y = 2 * surface - c.position.y;
    const target = mirror.targetPoint.set(0, 0, -1).applyMatrix4(c.matrixWorld);
    target.y = 2 * surface - target.y;
    cam.up.set(0, 1, 0).applyQuaternion(c.quaternion);
    cam.up.y *= -1;
    cam.lookAt(target);
    cam.updateMatrixWorld();
    cam.projectionMatrix.copy(c.projectionMatrix);
    mirror.project.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    // An oblique near plane prevents the underside of the terrain from covering reflections.
    const plane = mirror.clip.setComponents(0, 1, 0, -surface - 0.012).applyMatrix4(cam.matrixWorldInverse);
    const v = mirror.clip4.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const p = cam.projectionMatrix.elements;
    const corner = mirror.corner.set(
      (Math.sign(v.x) + p[8]) / p[0],
      (Math.sign(v.y) + p[9]) / p[5],
      -1,
      (1 + p[10]) / p[14],
    );
    v.multiplyScalar(2 / v.dot(corner));
    p[2] = v.x;
    p[6] = v.y;
    p[10] = v.z + 1;
    p[14] = v.w;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    const previous = this.renderer.getRenderTarget(),
      shadowUpdate = this.renderer.shadowMap.needsUpdate;
    mirror.tiles.forEach((tile) => {
      tile.userData.riverVisible = tile.visible;
      tile.visible = false;
    });
    c.visible = false;
    const markerShown = this.marker.visible;
    this.marker.visible = false;
    this.renderer.shadowMap.needsUpdate = false;
    this.renderer.setRenderTarget(mirror.image);
    this.renderer.render(this.scene, cam);
    this.renderer.setRenderTarget(previous);
    this.renderer.shadowMap.needsUpdate = shadowUpdate;
    c.visible = true;
    this.marker.visible = markerShown;
    mirror.tiles.forEach((tile) => {
      tile.visible = tile.userData.riverVisible;
    });
    mirror.active.value = 1;
  }

  riverBanks() {
    const stone = new THREE.DodecahedronGeometry(1, 1),
      reed = new THREE.CylinderGeometry(0.3, 1, 1, 4);
    for (let i = 0; i < 420; i++) {
      const x = -WORLD_LIMIT + PERIOD * meadowHash(i, 4, 9),
        side = i % 2 ? 1 : -1;
      if (Math.min(Math.abs(x - 50), Math.abs(x + 50)) < 4.1) continue;
      const bed = streamZ(x),
        z = bed + side * (1.5 + meadowHash(i, 3, 4) * 1.69),
        y = walkingSurface(x, z);
      const h = 0.07 + 0.24 * meadowHash(i, 7, 31);
      this.put(stone, i % 3 ? 0x746e63 : 0x868577, x, y + 0.045, z, h * 1.34, h * 0.7, h, i * 0.71, i * 0.27);
      if (i % 5 || Math.abs(z - bed) < 1.9) continue;
      for (let k = 0; k < 7; k++) {
        const px = x + 0.66 * (meadowHash(k, i, 3) - 0.5),
          pz = z + 0.63 * (meadowHash(k, i, 4) - 0.5),
          t = 0.41 + 0.53 * meadowHash(k, i, 5);
        const py = walkingSurface(px, pz);
        this.put(reed, 0x87884a, px, py + t * 0.5, pz, 0.015, t, 0.015, 0, 0.07 * Math.sin(i + k));
        this.put(
          this.head,
          0x61472d,
          px - 0.026 * Math.sin(i + k),
          py + t * 0.91,
          pz,
          0.037,
          0.115,
          0.036,
          0,
          0.07 * Math.sin(i + k),
        );
      }
    }
  }
  dressSettlements() {
    for (const [x, z] of CENTERS) {
      this.buildHeight = ground(x, z);
      for (let j = 0; j < 3; j++) this.barrel(x - 8 + j * 1.05, z + 5.2, 0.46 + j * 0.045);
      for (const k of [-1, 1]) {
        this.block(x + k * 3.95, 1.9, z + 8, 0.16, 3.8, 0.16, 0x534432);
        this.block(x + k * 3.72, 3.53, z + 8, 0.65, 0.12, 0.12, 0x534432);
        this.lantern(x + k * 3.45, z + 8, 3.05);
      }
      for (let j = 0; j < 4; j++)
        this.put(this.log, 0x897454, x - 9.5, 0.3 + j * 0.29, z + 5.9, 0.22, 2.8, 0.22, 0, 0, Math.PI / 2);
    }
    this.buildHeight = 0;
    for (const [cx, cz] of [CENTERS[0], CENTERS[2]])
      for (const [dx, dz] of [
        [-12, -9],
        [9, -11],
        [15, 7],
        [-13, 11],
      ]) {
        const x = cx + dx,
          z = cz + dz;
        this.block(x, 0.23, z, 5.35, 0.46, 4.78, 0x969384);
        for (let j = 0; j < 3; j++)
          this.block(x - 0.53, 0.08 + j * 0.095, z + 3.0 - j * 0.22, 1.45, 0.2, 0.39, 0x969384);
        this.lantern(x + 0.45, z + 2.6, 2.15);
      }
    // Sluice bridges mark the crossing between north and south.
    for (const x of [-50, 50]) {
      const z = streamZ(x);
      for (let j = -8; j <= 8; j++)
        this.block(x, 0.055, z + j * 0.44, 5.3, 0.2, 0.429, 0x897454, 0, 0.002 * Math.sin(j));
      for (const sign of [-1, 1]) {
        for (let j = -2; j <= 2; j++)
          this.block(x + sign * 2.63, 0.68, z + j * 1.65, 0.17, 1.36, 0.17, 0x594431);
        this.block(x + sign * 2.63, 1.14, z, 0.13, 0.13, 7.3, 0x897454);
      }
    }
    const [mx, mz] = [-73, -59];
    this.put(this.log, 0x969384, mx, 3.4, mz, 3.1, 6.8, 3.1);
    this.put(this.spire, 0x4d5948, mx, 7.7, mz, 3.4, 2.8, 3.4);
    this.bound(mx, mz, 5.2, 5.2);
    this.blades = new THREE.Group();
    this.blades.position.set(mx, 5.8, mz + 3.25);
    this.scene.add(this.blades);
    for (let i = 0; i < 4; i++) {
      const boom = new THREE.Group();
      boom.rotation.z = (i * Math.PI) / 2;
      this.blades.add(boom);
      this.part(boom, this.box, 0x594431, 0, 2.1, 0, 0.17, 4.5, 0.19);
      this.part(boom, this.box, 0xd5c9aa, 0.42, 2.75, 0, 0.8, 2.55, 0.08);
      for (let j = 0; j < 5; j++)
        this.part(boom, this.box, 0x897454, 0.42, 1.5 + j * 0.54, 0.08, 0.99, 0.06, 0.08);
    }
    for (const [x, z] of [
      [-57, 56],
      [62, -48],
      [62, 52],
      [-47, -56],
    ]) {
      const y = ground(x, z);
      this.put(this.log, 0x969384, x, 0.22 + y, z, 0.88, 0.44, 0.88);
      this.lantern(x, z, 1 + y);
    }
    this.landmarks();
    for (let j = 0; j < 24; j++) {
      const x = 34 + this.rnd() * 65,
        z = 65 + this.rnd() * 39,
        s = 1 + this.rnd() * 4;
      if (this.free(x, z, 1.5) && Math.abs(x - 50) > 5) {
        this.put(this.stone, 0x66685c, x, ground(x, z) + s * 0.3, z, s, s * 0.96, s * 1.2, this.rnd() * 6);
        this.bound(x, z, s * 1.1, s * 1.2);
      }
    }
  }
  barrel(x, z, r) {
    this.put(this.log, 0x897454, x, r * 1.2, z, r, r * 2.4, r);
    for (const h of [0.23, 1.18, 2.16]) this.put(this.log, 0x514f48, x, r * h, z, r * 1.04, 0.07, r * 1.04);
  }
  lantern(x, z, y) {
    this.block(x, y, z, 0.19, 0.3, 0.19, 0xffca66);
    for (const k of [-1, 1]) {
      this.block(x, y + k * 0.18, z, 0.3, 0.06, 0.3, 0x534432);
      this.block(x + k * 0.12, y, z + 0.105, 0.026, 0.37, 0.026, 0x534432);
    }
    this.lightSites.push([x, y + (this.buildHeight || 0), z]);
  }
  atmosphere() {
    const pos = new Float32Array(150 * 3);
    for (let i = 0; i < pos.length; i++) pos[i] = (this.rnd() - 0.5) * 30;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffdda0,
      size: 0.035,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    this.motes = new THREE.Points(geo, mat);
    this.scene.add(this.motes);
    this.birds = new THREE.Group();
    this.scene.add(this.birds);
    const wing = geometry(
      [-0.9, 0, 0, -0.35, 0.21, -0.15, 0, 0, 0.24, 0.35, 0.21, -0.15, 0.9, 0.05, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 2, 2, 3, 4],
    );
    for (let i = 0; i < 7; i++) {
      const bird = new THREE.Mesh(
        wing,
        new THREE.MeshBasicMaterial({ color: 0x424a47, side: THREE.DoubleSide }),
      );
      bird.position.set(i * 1.85, Math.sin(i) * 1.3, (i % 3) * 2.4);
      this.birds.add(bird);
    }
  }
  animateWeather(s, t) {
    windClock.value = t;
    this.waterTime.value = t;
    this.blades.rotation.z = t * 0.25;
    this.motes.position.set(Math.round(s.x / 10) * 10, 4 + Math.sin(t * 0.27), Math.round(s.z / 10) * 10);
    this.motes.rotation.y = t * 0.026;
    this.birds.position.set(
      Math.sin(t * 0.038) * 55,
      18 + Math.sin(t * 0.13) * 2,
      -26 + Math.cos(t * 0.038) * 45,
    );
    this.birds.rotation.y = t * 0.04;
    this.birds.children.forEach((b, i) => (b.scale.y = 0.8 + Math.sin(t * 4 + i * 0.7) * 0.7));
    if (this.environmentSource.image && !this.scene.environment) {
      this.environmentMap.image = this.environmentSource.image;
      this.environmentMap.needsUpdate = true;
      this.scene.environment = this.environmentMap;
    }
  }
}

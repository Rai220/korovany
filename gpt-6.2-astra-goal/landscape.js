'use strict';

// Mesh materials are loaded from the local texture pack, including under file://.
const textures = new Map();
function texture(name, source = materialImages) {
  if (textures.has(name)) return textures.get(name);
  const tex = new THREE.TextureLoader().load(trailImages[name] || source[name]);
  tex.colorSpace = name.endsWith('-normal') ? THREE.NoColorSpace : THREE.SRGBColorSpace;
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
  const bed = ground(x, z) - creekDepth(x, z);
  const lane = wrapped(x), bridgeX = lane < 0 ? -50 : 50;
  if (Math.abs(lane - bridgeX) > 2.65) return bed;
  const along = Math.abs(wrapped(z) - streamZ(bridgeX));
  if (along > 3.75) return bed;
  return Math.max(bed, 0.155 * (1 - THREE.MathUtils.smoothstep(along, 2.64, 3.74)));
}
// Project in metres so stone and timber retain their dimensions on stretched building instances.
function projectedMaterial(name, tint, scale, metalness = 0) {
  const bump = trailImages[name + '-normal'];
  const mat = new THREE.MeshStandardMaterial({
    color: tint,
    map: texture(name),
    roughness: metalness ? 0.46 : 0.94,
    metalness,
    envMapIntensity: 0.51,
    normalMap: bump ? texture(name + '-normal') : null,
  });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader =
      'varying vec3 vPlace; varying vec3 vAxis;\n' +
      shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
      vec4 localSurface = vec4(transformed, 1.);
      vec3 localNormal = normal;
      #ifdef USE_INSTANCING
        localSurface = instanceMatrix * localSurface;
        localNormal = mat3(instanceMatrix) * normal;
      #endif
      vPlace = (modelMatrix * localSurface).xyz;
      vAxis = normalize(mat3(modelMatrix) * localNormal);`,
      );
    shader.fragmentShader =
      'varying vec3 vPlace; varying vec3 vAxis;\n' +
      shader.fragmentShader.replace(
        '#include <map_fragment>',
        `vec3 axis = abs(normalize(vAxis));
      vec2 vertical = axis.x > axis.z ? vPlace.zy : vPlace.xy;
      vec2 surfaceUV = (axis.y > .66 ? vPlace.xz : vertical) * ${scale.toFixed(4)};
      vec4 surface = texture2D(map,surfaceUV);
      float patina = .96 + .045 * sin(dot(vPlace,vec3(.41,.29,.23)));
      diffuseColor.rgb *= surface.rgb * patina;`,
      );
    if (bump)
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_maps>',
        `vec3 embossed = texture2D(normalMap,surfaceUV).xyz * 2. - 1.;
      embossed.xy *= .70;
      normal = normalize(getTangentFrame(-vViewPosition,normal,surfaceUV) * embossed);`,
      );
  };
  mat.customProgramCacheKey = () => name + scale + !!bump;
  return mat;
}
const windClock = { value: 0 };
const cameraFoliageClearance = { value: 0.55 };
function fadeNearbyCrown(shader) {
  shader.uniforms.cameraFoliageClearance = cameraFoliageClearance;
  shader.fragmentShader =
    'uniform float cameraFoliageClearance;\n' +
    shader.fragmentShader.replace(
      '#include <alphatest_fragment>',
      `#include <alphatest_fragment>
    float leafVisibility=smoothstep(cameraFoliageClearance,cameraFoliageClearance+1.25,length(vViewPosition));
    if(leafVisibility<1. && leafVisibility<=fract(dot(gl_FragCoord.xy,vec2(.75487767,.56984029))))discard;`,
    );
}
function foliageMaterial(name) {
  const mat = new THREE.MeshLambertMaterial({
    map: texture(name),
    color: 0xe5eacb,
    alphaTest: 0.36,
    side: THREE.DoubleSide,
  });
  const amplitude = name === 'bough' || name === 'pine' ? '.0023' : '.046';
  mat.onBeforeCompile = (s) => {
    if (name === 'birch-spray') fadeNearbyCrown(s);
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
// Several kilometres of skyline in perspective. Each azimuth has its own saddle, face direction and snow line.
function distantMountains(layer, fogColor) {
  const profile = [
    [0, 18],
    [9, 14],
    [18, 22],
    [24, 30],
    [30, 22],
    [35, 40],
    [38, 34],
    [41, 39],
    [49, 25],
    [58, 16],
    [69, 14],
    [79, 20],
    [86, 16],
    [94, 34],
    [100, 29],
    [109, 44],
    [115, 37],
    [121, 49],
    [126, 35],
    [137, 23],
    [150, 25],
    [161, 16],
    [168, 21],
    [178, 30],
    [187, 24],
    [193, 39],
    [198, 35],
    [206, 45],
    [214, 24],
    [223, 26],
    [238, 16],
    [249, 18],
    [260, 29],
    [266, 26],
    [274, 34],
    [281, 29],
    [291, 44],
    [298, 35],
    [304, 39],
    [317, 23],
    [331, 25],
    [341, 17],
    [349, 22],
    [360, 18],
  ];
  const rows = 11,
    n = 384,
    p = [],
    uv = [],
    ix = [],
    colors = [],
    ao = [];
  for (let i = 0; i <= n; i++) {
    const theta = ((i % n) * Math.PI * 2) / n,
      deg = (((i % n) * 360) / n + layer * 24) % 360;
    const point = profile.findIndex((r, j) => j < profile.length - 1 && deg >= r[0] && deg < profile[j + 1][0]);
    const [left, a] = profile[point],
      [right, b] = profile[point + 1],
      t = (deg - left) / (right - left);
    const jitter = (Math.sin(theta * 39 + layer) * 0.56 + Math.sin(theta * 73 + layer * 3) * 0.44) * 1.77;
    const peak = (a + (b - a) * t + jitter) * (layer ? 0.73 : 1.10);
    for (let j = 0; j < rows; j++) {
      const u = Math.max(0, (j - 1) / (rows - 2)),
        h = j ? -16 + (peak + 16) * u : -218,
        channel = Math.sin(theta * 36 + layer * 2 + j * 0.73) + 0.48 * Math.sin(theta * 59 + j * 0.2);
      const radius =
        (layer ? 202 : 250) +
        u * (layer ? 42 : 52) +
        5.6 * Math.sin(theta * 5 + layer * 2) +
        Math.sin(Math.PI * u) * channel * 4.6;
      p.push(Math.sin(theta) * radius, h + Math.sin(Math.PI * u) * channel * 2.2, Math.cos(theta) * radius);
      uv.push(i / n, u);
      ao.push(channel);
      if (i && j) {
        const k = i * rows + j;
        ix.push(k - rows - 1, k - rows, k, k - rows - 1, k, k - 1);
      }
    }
  }
  const geo = geometry(p, uv, ix),
    normals = geo.attributes.normal;
  const night = new THREE.Color(layer ? 0x83949b : 0x9aa9b8),
    sun = new THREE.Color(layer ? 0xa7b2ad : 0xb7c4c7),
    snow = new THREE.Color(0xd2d8d3);
  for (let i = 0; i < normals.count; i++) {
    const y = p[i * 3 + 1],
      lit = 0.47 + 0.3 * normals.getX(i) - 0.08 * normals.getZ(i) + 0.12 * normals.getY(i) + 0.09 * ao[i];
    const c = night.clone().lerp(sun, Math.max(0, Math.min(1, lit)));
    if (!layer) c.lerp(snow, terrainFade(30, 54, y) * terrainFade(0.12, 0.93, lit) * 0.83);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      fog: false,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  mesh.material.onBeforeCompile = (shader) => {
    shader.uniforms.foothillHaze = { value: fogColor };
    shader.vertexShader = 'varying float ridgeHeight;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nridgeHeight = position.y;',
    );
    shader.fragmentShader = 'varying float ridgeHeight; uniform vec3 foothillHaze;\n' + shader.fragmentShader.replace(
      '#include <color_fragment>',
      '#include <color_fragment>\ndiffuseColor.rgb=mix(foothillHaze,diffuseColor.rgb,.53*smoothstep(-4.,44.,ridgeHeight));',
    );
  };
  mesh.renderOrder = -12 + layer;
  mesh.frustumCulled = false;
  return mesh;
}
class FrontierLandscape extends RealmGeometry {
  prepareMaterials() {
    this.materialFamilies = new Map();
    const family = (hues, mat) => hues.forEach((h) => this.materialFamilies.set(h, mat));
    family([0x969384, 0x716e60, 0x66685c, 0x585956, 0x777766], projectedMaterial('stone', 0xf1eee4, 0.63));
    family([0x4d5948, 0x654e3b, 0x43494a, 0x545e61], projectedMaterial('slate', 0xe7eae6, 0.58));
    family(
      [0x897454, 0x967856, 0x826445, 0x795f42, 0x87704d, 0x785537, 0x6f5239],
      projectedMaterial('wood', 0xf2e7d4, 0.68),
    );
    family(
      [0x534432, 0x594431, 0x665644, 0x5a4434, 0x553d26, 0x4a4b3d, 0x4a4236],
      projectedMaterial('wood', 0xbeb3a1, 0.68),
    );
    family([0x534936], projectedMaterial('bark', 0xd2cec0, 0.64));
    family([0x746e63, 0x868577], projectedMaterial('scree', 0xb5b8a5, 1.36));
    family([0xd5c9aa, 0xd0bda0], projectedMaterial('linen', 0xd1c29d, 0.7));
    family([0xc4b494, 0xb9a98d], projectedMaterial('lime', 0xf3ebdc, 0.81));
    family([0x9b8760], projectedMaterial('thatch', 0xe7dfc9, 0.47));
    for (const [tint, key] of [
      [0x84917c, 'fieldstone'],
      [0x786446, 'stump'],
    ])
      family([tint], new THREE.MeshStandardMaterial({ map: texture(key), roughness: 0.97 }));
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
      color: 0xfffcf3,
      side: THREE.BackSide,
      fog: false,
      toneMapped: false,
      depthWrite: false,
    });
    this.horizonHaze = { value: 0 };
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.horizonColor = { value: this.scene.fog.color };
      shader.uniforms.horizonHaze = this.horizonHaze;
      shader.vertexShader =
        'varying float skyAltitude;\n' +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nskyAltitude=normalize(position).y;',
        );
      shader.fragmentShader =
        'varying float skyAltitude;uniform vec3 horizonColor;uniform float horizonHaze;\n' +
        shader.fragmentShader.replace(
          '#include <map_fragment>',
          '#include <map_fragment>\nfloat airColumn=1.-smoothstep(-.035,.265,skyAltitude); diffuseColor.rgb=mix(diffuseColor.rgb,horizonColor,airColumn*horizonHaze);',
        );
    };
    // The playable ridges sit in front of two distant ranges and the photographed sky.
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++)
      uv.setY(i, Math.min(1, Math.max(0, 0.593 + Math.max(-0.026,uv.getY(i) - 0.5) * 0.795)));
    this.skyMesh = new THREE.Mesh(geo, mat);
    this.skyMesh.rotation.y = 1.18;
    this.skyMesh.renderOrder=-16;
    for (const layer of [0, 1]) this.skyMesh.add(distantMountains(layer, this.scene.fog.color));
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
      colors = [],
      surveyedHeights = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        gridZ = p.getZ(i),
        abs = Math.abs(gridZ),
        z =
          Math.sign(gridZ) *
          (abs < 28.8 ? abs * 0.3 : 8.64 + ((abs - 28.8) * (WORLD_LIMIT - 8.64)) / (WORLD_LIMIT - 28.8));
      p.setZ(i, z);
      surveyedHeights[i]=surveyedGround(x,z)-creekDepth(x,z);
      p.setY(i, surveyedHeights[i]+rockUplift(x,z));
      const tint = new THREE.Color([0xf4f1df, 0xf8ece0, 0xdadfcd, 0xe3dfea][zoneAt(x, z)]);
      tint.lerp(new THREE.Color(0xeae8da), rimBlend(x, z));
      tint.multiplyScalar(0.96 + 0.08 * Math.sin(((x * 14 + z * 9) * Math.PI) / WORLD_LIMIT));
      colors.push(tint.r, tint.g, tint.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    this.landGrid = { positions: p, surveyedHeights, xSteps: 164, zSteps: 180 };
    playableHeightGrid=this.landGrid;
    const mat = new THREE.MeshStandardMaterial({
      map: texture('soil'),
      normalMap: texture('land-normal'),
      roughness: 0.97,
      envMapIntensity: 0.43,
      vertexColors: true,
    });
    const outcrop=texture('outcrop-atlas',mountainImages);
    outcrop.colorSpace = THREE.NoColorSpace;
    // The two atlas halves encode different data. Never let a wrapping derivative sample the other half.
    outcrop.generateMipmaps = false;
    outcrop.minFilter = THREE.LinearFilter;
    outcrop.magFilter = THREE.LinearFilter;
    outcrop.anisotropy = 1;
    outcrop.needsUpdate = true;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.outcrop={value:outcrop};
      shader.uniforms.landShadow = { value: this.landShadow };
      shader.uniforms.trackMap = { value: texture('road') };
      for (const name of ['meadow', 'scree', 'moss', 'cobbles', 'grit'])
        shader.uniforms[name] = { value: texture(name) };
      shader.vertexShader =
        'varying vec3 terrainPoint;\n' +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nterrainPoint=position;',
        );
      shader.fragmentShader =
        'uniform sampler2D trackMap,meadow,scree,moss,cobbles,grit,landShadow,outcrop;varying vec3 terrainPoint;\n' +
        shader.fragmentShader.replace(
          '#include <map_fragment>',
          `
      vec2 pos=terrainPoint.xz;
      float wav=sin(pos.x*.36+pos.y*.49)*.24+sin(pos.x*1.93-pos.y*.79)*.12;
      vec2 dist=abs(abs(pos)-50.);
      float crossroad=min(dist.x,dist.y);
      float road=(1.-smoothstep(2.02,3.41,crossroad+wav))*(1.-smoothstep(76.,126.,length(vViewPosition)));
      float wheel=abs(crossroad-.89+wav*.19);
      float rut=1.-smoothstep(.105,.35,wheel);
      float palace=smoothstep(30.,51.,pos.x)*(1.-smoothstep(-39.,-14.,pos.y));
      float forest=(1.-smoothstep(-13.,4.,pos.x))*smoothstep(-6.,17.,pos.y);
      float mountain=smoothstep(6.,30.,pos.x)*smoothstep(6.,29.,pos.y);
      float rim=smoothstep(95.,137.,max(abs(pos.x),abs(pos.y))); forest*=1.-rim;mountain*=1.-rim;palace*=1.-rim;
      float grassCover=.5+.26*sin(pos.x*.23+pos.y*.17)+.14*sin(pos.x*.41-pos.y*.3)+.09*sin(pos.y*.83);
      vec2 guv=pos*.46, ruv=pos*.48, suv=pos*.42, cuv=pos*.54;
      vec3 earth=texture2D(map,pos*.51).rgb;
      vec3 grass=texture2D(meadow,guv).rgb;
      vec3 duff=texture2D(moss,pos*.44).rgb;
      vec3 cobble=texture2D(cobbles,cuv).rgb;
      vec3 packedDirt=texture2D(trackMap,ruv).rgb;
      vec3 gravel=texture2D(grit,pos*.285).rgb;
      vec3 rock=texture2D(scree,suv).rgb;
      vec3 landAxis=abs(normalize(cross(dFdx(terrainPoint),dFdy(terrainPoint))));
      float cliff=(1.-smoothstep(.59,.94,landAxis.y))*smoothstep(2.,9.,terrainPoint.y);
      vec2 faceUV=(landAxis.x>landAxis.z ? terrainPoint.zy : terrainPoint.xy)*vec2(.36,.66);
      vec3 bedrock=texture2D(scree,faceUV).rgb;
      float bedding=sin(terrainPoint.y*2.26+pos.x*.18-pos.y*.11+1.2*sin(pos.x*.21)+.8*sin(pos.y*.14));
      vec3 wild=mix(earth,grass*(.89+.16*grassCover),.52+.45*grassCover);
      wild=mix(wild,mix(earth,duff,.48+.34*grassCover),forest*.88);
      wild=mix(wild,rock,mountain*(.48+.43*grassCover));
      float creek=sin(pos.x*.08726646)*2.8+sin(pos.x*.10908308)*.7;
      float bank=(1.-smoothstep(1.6,3.18,abs(pos.y-creek)+wav*.17))*smoothstep(2.8,3.6,dist.x);
      wild=mix(wild,rock*vec3(.79,.84,.80),bank);
      wild=mix(wild,bedrock*mix(vec3(.84,.87,.89),vec3(1.11,1.08,1.01),.5+.5*bedding),cliff*.93);
      // Exposed gneiss has broad bedding planes. Old snow persists on the shelves and inside high clefts.
      float altitude=terrainPoint.y,upper=smoothstep(12.,30.,altitude);
      vec3 upAxis=normalize(cross(dFdx(terrainPoint),dFdy(terrainPoint)));upAxis*=sign(upAxis.y);
      vec2 faultUV=landAxis.y>.80?pos*.194:(landAxis.x>landAxis.z?terrainPoint.zy:terrainPoint.xy)*vec2(.185,.171);
      faultUV+=vec2(.039*sin(dot(pos,vec2(.053,.17))),.044*sin(pos.y*.13));
      vec2 localFace=fract(faultUV)*.997+.0015;
      vec3 gneiss=pow(texture2D(outcrop,vec2(localFace.x,.5+.5*localFace.y)).rgb,vec3(2.2));
      float joint=abs(sin(altitude*.81+pos.x*.33-pos.y*.14+1.56*sin(pos.y*.23+pos.x*.11)+gneiss.r*3.2));
      float warmth=.5+.5*sin(altitude*.19+pos.x*.067+pos.y*.079+.9*gneiss.g);
      vec3 schist=gneiss*mix(vec3(.88,.95,1.02),vec3(1.19,1.10,.90),warmth)*(.93+.09*smoothstep(.04,.55,joint));
      float rockFace=max(upper,cliff*smoothstep(5.,18.,altitude));
      wild=mix(wild,schist,rockFace*.96);
      float grainSnow=texture2D(grit,pos*.169).r+.27*sin(pos.x*.54+pos.y*.41);
      float snow=smoothstep(27.,39.,altitude+4.5*upAxis.z+3.1*grainSnow)*smoothstep(.17,.79,upAxis.y+.19*grainSnow);
      wild=mix(wild,vec3(.67,.77,.81)*(.91+.13*grainSnow),snow*.94);
      vec3 survey=texture2D(landShadow,pos/288.+.5).rgb;
      vec3 worn=mix(mix(gravel,packedDirt,.48),cobble,survey.b);
      wild=mix(wild,worn, .86*smoothstep(.03,.87,survey.g+wav*.21));
      float grassStrip=(1.-smoothstep(.09,.62,crossroad+.18*wav))*(.09+.13*grassCover);
      vec3 roadColor=mix(packedDirt,gravel,.46+.32*grassCover-.22*rut);
      roadColor=mix(roadColor*(1.-rut*.28),grass,grassStrip);
      roadColor=mix(roadColor,cobble*(1.-.09*rut),palace*.96);
      float macro=.965+.055*sin(dot(pos,vec2(.041,-.063)))+.043*sin(dot(pos,vec2(.115,.097)));
      float exposure=survey.r;
      diffuseColor.rgb*=mix(wild,roadColor,road)*macro*mix(.34,1.,exposure);`,
        );
      // Four normal maps share one sampler. Relief uses the same masks as the visible materials.
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_maps>',
        `
        vec3 meadowN=texture2D(normalMap,fract(guv)*.495+vec2(.0025,.5025)).xyz;
        vec3 roadN=texture2D(normalMap,fract(ruv)*.495+.5025).xyz;
        vec3 rockN=texture2D(normalMap,fract(suv)*.495+.0025).xyz;
        vec3 cobbleN=texture2D(normalMap,fract(cuv)*.495+vec2(.5025,.0025)).xyz;
        vec3 grain=mix(mix(meadowN,rockN,max(mountain,bank)),mix(roadN,cobbleN,palace),road)*2.-1.;
        grain.xy*=.64*(1.-smoothstep(19.,48.,length(vViewPosition)));
        normal=normalize(getTangentFrame(-vViewPosition,normal,pos)*grain);
        vec3 planeNormal=normalize(cross(dFdx(vViewPosition),dFdy(vViewPosition)));
        if(dot(planeNormal,normal)<0.)planeNormal=-planeNormal;
        normal=normalize(mix(normal,planeNormal,.32*cliff));
        if(rockFace>.10&&length(vViewPosition)<64.){
          vec3 fracture=texture2D(outcrop,vec2(localFace.x,.5*localFace.y)).xyz*2.-1.;
          fracture.xy*=.74;
          vec3 splitNormal=normalize(getTangentFrame(-vViewPosition,normal,faultUV)*fracture);
          normal=normalize(mix(normal,splitNormal,min(.88,rockFace)*(1.-smoothstep(41.,64.,length(vViewPosition)))));
        }`,
      );
    };
    const land = new THREE.Mesh(g, mat);
    land.receiveShadow = true;
    this.tileGround(land);
    this.exposedRock(mat);
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
  exposedRock(material) {
    // Low edges are buried in the actual terrain triangles. All intermediate vertices follow the surface,
    // so a long shelf cannot bridge across a gully. The adjoining mountain and these ledges share a shader.
    const p = [],
      uv = [],
      ix = [],
      colors = [];
    const hash = (i, j, k) => {
      let n = Math.imul(i + 233, 721987) ^ Math.imul(j + 19, 71237) ^ Math.imul(k + 11, 973733);
      n = Math.imul(n ^ (n >>> 12), 936689);
      return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = -52; i <= 52; i++)
      for (let j = -52; j <= 52; j++) {
        const x = (i + hash(i, j, 1) * 0.73) * 2.7,
          z = (j + hash(i, j, 2) * 0.73) * 2.7,
          base = ground(x, z);
        if (base < 6 || Math.abs(rockUplift(x, z)) < 0.42) continue;
        const gx = ground(x + 0.42, z) - ground(x - 0.42, z),
          gz = ground(x, z + 0.42) - ground(x, z - 0.42),
          incline = Math.hypot(gx, gz) / 0.84;
        if (incline < 0.62 || incline > 4.1 || !highTrackClear(x, z, 3.0)) continue;
        const bands = Math.sin(base * 0.74 + x * 0.153 - z * 0.077 + 0.78 * Math.sin(x * 0.19));
        if (bands < -0.07 && hash(i, j, 3) < 0.82) continue;
        const angle = Math.atan2(gx, gz) + (hash(i, j, 4) - 0.5) * 0.18,
          sn = Math.sin(angle),
          cs = Math.cos(angle),
          w = 0.71 + 1.21 * hash(i, j, 5),
          h = 0.27 + 0.53 * hash(i, j, 6);
        const rise = Math.min(0.16, Math.max(0.068, incline * 0.083)),
          tint = new THREE.Color([0xf4f1df, 0xf8ece0, 0xdadfcd, 0xe3dfea][zoneAt(x, z)]);
        const ring = [
            [-0.99, 0.16],
            [-0.52, 0.76],
            [0.31, 0.83],
            [0.94, 0.29],
            [0.78, -0.36],
            [0.27, -0.59],
            [-0.49, -0.51],
          ],
          first = p.length / 3;
        for (let n = 0; n < 4; n++)
          for (let k = 0; k < ring.length; k++) {
            const [a, b] = ring[k],
              r = [1, 0.82, 0.45, 0.055][n],
              u = r * a * w * (0.88 + 0.24 * hash(i, j, k + 16)),
              v = r * b * h;
            const xx = x + u * cs + v * sn,
              zz = z - u * sn + v * cs,
              yy = ground(xx, zz);
            const lift =
              n === 0
                ? -0.125
                : n === 1
                  ? rise * (b > 0 ? 0.17 : 0.78)
                  : n === 2
                    ? rise * (0.77 + 0.19 * hash(i, j, k + 24))
                    : rise * 0.97;
            p.push(xx, yy + lift, zz);
            uv.push(xx / PERIOD + 0.5, zz / PERIOD + 0.5);
            colors.push(tint.r, tint.g, tint.b);
            if (n) {
              const q = first + n * 7 + k,
                f = first + n * 7 + ((k + 1) % 7);
              ix.push(q - 7, f - 7, q, q, f - 7, f);
            }
          }
        for (let k = 1; k < 6; k++) ix.push(first + 21, first + 21 + k, first + 22 + k);
      }
    const g = geometry(p, uv, ix);
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const ledges = new THREE.Mesh(g, material);
    ledges.receiveShadow = true;
    this.tileGround(ledges);
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
    const reed = new THREE.CylinderGeometry(0.3, 1, 1, 4);
    for (let i = 0; i < 420; i++) {
      const x = -WORLD_LIMIT + PERIOD * meadowHash(i, 4, 9),
        side = i % 2 ? 1 : -1;
      if (Math.min(Math.abs(x - 50), Math.abs(x + 50)) < 4.1) continue;
      const bed = streamZ(x),
        z = bed + side * (1.5 + meadowHash(i, 3, 4) * 1.69);
      // Pale chips settle on the inside of the bend, in irregular and widely separated deposits.
      const curve = streamZ(x - 3) + streamZ(x + 3) - 2 * bed;
      if (side * curve > 0.045 && meadowHash(i, 23, 4) > 0.7) {
        const width = 0.25 + 0.34 * meadowHash(i, 7, 31);
        this.shaleSeam(x, z, width, -Math.atan2(streamZ(x + 1) - streamZ(x - 1), 2), i, true);
      }
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
      // Drying timber rests in a triangular pile, with the end grain visible at both ends.
      const pileX = x - 9.5,
        pileZ = z + 5.9;
      for (let row = 0; row < 3; row++)
        for (let column = 0; column < 4 - row; column++) {
          const bx = pileX + (column - (3 - row) * 0.5) * 0.34,
            h = 0.17 + row * 0.287;
          const dz = (meadowHash(row, column, 11) - 0.5) * 0.22;
          this.put(this.log, 0x534936, bx, h, pileZ + dz, 0.173, 2.63, 0.173, 0, 0, Math.PI / 2);
          for (const side of [-1, 1])
            this.put(
              this.log,
              0xb29b75,
              bx,
              h,
              pileZ + dz + side * 1.32,
              0.152,
              0.019,
              0.152,
              0,
              0,
              Math.PI / 2,
            );
        }
      this.bound(pileX, pileZ, 1.32, 2.63);
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
        const doorX = x + (dx === 9 || dx === -13 ? -0.99 : 0.96);
        for (const side of [-1, 1]) {
          this.block(doorX, 0.042, z + side * 2.96, 1.32, 0.1, 0.48, 0x969384);
          this.block(doorX, 0.099, z + side * 2.69, 1.22, 0.17, 0.38, 0x716e60);
          this.lantern(doorX + 0.71, z + side * 2.57, 2.12);
        }
      }
    // Sluice bridges mark the crossing between north and south.
    for (const x of [-50, 50]) {
      const z = streamZ(x);
      for (let j = -8; j <= 8; j++)
        this.block(x, walkingSurface(x, z + j * 0.44) - 0.1, z + j * 0.44, 5.3, 0.2, 0.429,
          0x897454, 0, 0.002 * Math.sin(j));
      for (const sign of [-1, 1]) {
        for (let j = -2; j <= 2; j++)
          this.block(x + sign * 2.63, 0.68, z + j * 1.65, 0.17, 1.36, 0.17, 0x594431);
        this.block(x + sign * 2.63, 1.14, z, 0.13, 0.13, 7.3, 0x897454);
      }
    }
    const [mx, mz] = [-73, -59];
    this.put(this.log, 0x969384, mx, 1.2, mz, 3.12, 2.4, 3.12);
    const millBody = new THREE.CylinderGeometry(0.82, 1, 1, 16);
    this.put(millBody, 0xc4b494, mx, 4.58, mz, 3.06, 4.36, 3.06);
    for (let j = 0; j < 12; j++) {
      const a = (j * Math.PI) / 6,
        s = Math.sin(a),
        c = Math.cos(a);
      this.block(mx + s * 2.82, 4.58, mz + c * 2.82, 0.16, 4.38, 0.17, 0x534432, a, 0, -0.12);
    }
    for (const [h, r] of [
      [2.49, 3.12],
      [4.39, 2.88],
      [6.53, 2.61],
    ])
      this.put(this.log, 0x594431, mx, h, mz, r, 0.16, r);
    this.put(this.spire, 0x4d5948, mx, 7.69, mz, 2.92, 2.8, 2.92);
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
    // Broken shale follows the strike of the lower ridges.
    for (let i = 0; i < 43; i++) {
      const x = 62 + 63 * meadowHash(i, 61, 5);
      const z = 84 + 0.21 * (x - 70) + 4.4 * Math.sin(x * 0.103) + 4.2 * (meadowHash(i, 8, 51) - 0.5);
      const scale = 0.44 + 0.91 * meadowHash(i, 16, 20);
      if (highTrackClear(x, z, 2.6) && this.free(x, z, 1.2))
        this.fieldStone(x, z, scale, 1.29 + 0.64 * meadowHash(i, 35, 9));
    }
  }
  plantTree(tree, width) {
    // Consume the original site's random draws before rejecting its new cliff, preserving the rest of the seed.
    if (rockUplift(tree.x, tree.z) > 0.5 && (tree.y > 28 || this.terrainIncline(tree.x, tree.z) > 0.64)) return;
    this.trees.push(tree);
    this.bound(tree.x, tree.z, width, width);
  }
  terrainIncline(x, z, beforeUplift = false) {
    // Match the two triangles of the rendered tile, including its denser rows along the river.
    if (!this.landGrid) return 0;
    const { positions, xSteps, zSteps } = this.landGrid;
    const rowWidth = xSteps + 1;
    const canonicalZ = wrapped(z),
      az = Math.abs(canonicalZ);
    const gridZ =
      Math.sign(canonicalZ) *
      (az < 8.64 ? az / 0.3 : 28.8 + ((az - 8.64) * (WORLD_LIMIT - 28.8)) / (WORLD_LIMIT - 8.64));
    const u = ((wrapped(x) + WORLD_LIMIT) * xSteps) / PERIOD,
      v = ((gridZ + WORLD_LIMIT) * zSteps) / PERIOD;
    const i = Math.min(xSteps - 1, Math.max(0, Math.floor(u)));
    const j = Math.min(zSteps - 1, Math.max(0, Math.floor(v)));
    const top = j * rowWidth + i,
      lower = top + rowWidth;
    const first = u - i + (v - j) <= 1;
    const a = first ? top : lower + 1,
      b = first ? top + 1 : lower,
      c = first ? lower : top + 1;
    const old = this.landGrid.surveyedHeights;
    const ya = beforeUplift ? old[a] : positions.getY(a),
      yb = beforeUplift ? old[b] : positions.getY(b),
      yc = beforeUplift ? old[c] : positions.getY(c);
    const sx = ((yb - ya) * xSteps) / PERIOD,
      sz = (yc - ya) / (positions.getZ(lower) - positions.getZ(top));
    return Math.hypot(sx, sz);
  }
  treeSite(x, z) {
    if (x > 52 && x < 84 && ((z > -78 && z < -51) || (z > 22 && z < 49))) return false;
    if (this.terrainIncline(x, z, true) > 0.76) return false;
    if (x < 2 || z < 5) return true;
    const height = surveyedGround(x, z);
    return (
      height < 20.5 + 1.25 * Math.sin(x * 0.37 + z * 0.13) &&
      this.terrainIncline(x - 0.75, z, true) < 1 &&
      this.terrainIncline(x + 0.75, z, true) < 1 &&
      this.terrainIncline(x, z - 0.75, true) < 1 &&
      this.terrainIncline(x, z + 0.75, true) < 1
    );
  }
  // Use the same triangle and diagonal as the visible terrain. A low flake must sit flush even on a river bank.
  chipSurface(x, z) {
    const { positions, xSteps, zSteps } = this.landGrid;
    const az = Math.abs(z);
    const gridZ =
      Math.sign(z) * (az < 8.64 ? az / 0.3 : 28.8 + ((az - 8.64) * (WORLD_LIMIT - 28.8)) / (WORLD_LIMIT - 8.64));
    const gx = Math.max(0, Math.min(xSteps - 1e-6, ((x + WORLD_LIMIT) * xSteps) / PERIOD));
    const gz = Math.max(0, Math.min(zSteps - 1e-6, ((gridZ + WORLD_LIMIT) * zSteps) / PERIOD));
    const i = Math.floor(gx),
      j = Math.floor(gz),
      u = gx - i,
      v = gz - j;
    const a = i + j * (xSteps + 1),
      c = a + xSteps + 1;
    const ha = positions.getY(a),
      hb = positions.getY(a + 1),
      hc = positions.getY(c);
    if (u + v <= 1) return ha + u * (hb - ha) + v * (hc - ha);
    const hd = positions.getY(c + 1);
    return hd + (1 - u) * (hc - hd) + (1 - v) * (hb - hd);
  }
  chipBatch(x, z, material) {
    this.groundDebris ||= new Map();
    const cx = (Math.floor(x / 32) + 0.5) * 32,
      cz = (Math.floor(z / 32) + 0.5) * 32;
    const key = [cx, cz, material].join('/');
    if (!this.groundDebris.has(key)) this.groundDebris.set(key, { cx, cz, material, vertices: [], uv: [] });
    return this.groundDebris.get(key);
  }
  shaleSeam(x, z, width, yaw, seed, bank = false) {
    // Each chip has a sharp toe and a higher broken edge. Its split faces follow the bed of the ground.
    const co = Math.cos(yaw),
      si = Math.sin(yaw);
    const roll = (chip, salt) => meadowHash(seed, chip, salt);
    const count = bank ? 2 + Math.floor(roll(1, 9) * 4) : 2 + Math.floor(roll(2, 9) * 3);
    const batch = this.chipBatch(x, z, bank ? 0x84917c : 0x746e63);
    for (let n = 0; n < count; n++) {
      const along = (n - (count - 1) / 2) * width * (0.57 + 0.34 * roll(n, 8));
      const across = (roll(n, 2) - 0.5) * width * 0.73;
      const ox = x + along * co + across * si,
        oz = z - along * si + across * co;
      const angle = yaw + (roll(n, 6) - 0.5) * 0.76,
        a = Math.cos(angle),
        b = Math.sin(angle);
      const length = width * (0.51 + 0.59 * roll(n, 4)),
        depth = length * (0.34 + 0.43 * roll(n, 7));
      const height = Math.min(0.17, length * (0.11 + 0.06 * roll(n, 10)));
      const uvOffset = 0.19 + roll(n, 14) * 0.41;
      const point = (u, v, h) => {
        const px = ox + a * u * length + b * v * depth,
          pz = oz - b * u * length + a * v * depth;
        return [
          px - batch.cx,
          this.chipSurface(px, pz) + h,
          pz - batch.cz,
          uvOffset + u * 0.105,
          0.63 + v * 0.13,
        ];
      };
      const ring = [
        [-0.62, -0.2],
        [-0.41, 0.39],
        [0.1 + 0.19 * roll(n, 13), 0.53],
        [0.53, 0.14],
        [0.46 + 0.24 * roll(n, 12), -0.21],
        [-0.12, -0.48],
      ];
      const rim = ring.map(([u, v], k) => point(u, v, height * (k < 2 ? 0.7 : 0.15 + 0.27 * roll(n, k + 18))));
      const root = ring.map(([u, v]) => point(u * 1.05, v * 1.05, -0.038));
      const crest = point(-0.28, -0.04, height);
      const add = (v) => {
        batch.vertices.push(v[0], v[1], v[2]);
        batch.uv.push(v[3], v[4]);
      };
      for (let i = 0; i < ring.length; i++) {
        const next = (i + 1) % ring.length;
        [crest, rim[i], rim[next], rim[next], rim[i], root[i], rim[next], root[i], root[next]].forEach(add);
      }
    }
  }
  fieldStone(x, z, scale, yaw) {
    const seed = Math.round(x * 41 + z * 97);
    const mountain = zoneAt(x, z) === 3 && ground(x, z) > 5;
    if (!mountain || meadowHash(seed, 8, 14) < 0.68 || this.terrainIncline(x, z) > 0.83) return;
    this.shaleSeam(x, z, Math.min(1.04, 0.4 + 0.44 * scale), yaw, seed);
  }
  finishGroundDebris() {
    for (const batch of this.groundDebris?.values() || []) {
      const geo = new THREE.BufferGeometry();
      geo.name = 'Bedded shale chips';
      geo.setAttribute('position', new THREE.Float32BufferAttribute(batch.vertices, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(batch.uv, 2));
      geo.computeVertexNormals();
      this.put(geo, batch.material, batch.cx, 0, batch.cz, 1, 1, 1);
    }
    this.groundDebris = null;
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

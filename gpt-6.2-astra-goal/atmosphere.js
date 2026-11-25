'use strict';

// A sixteen-minute day is measured in active game seconds, including journeys underground.
const countryLeafBounce = { value: new THREE.Color(0xb9c9ce) };
const COUNTRY_DAY = 960;
const COUNTRY_START = ((16 + 25 / 60) * COUNTRY_DAY) / 24;
function countrySeconds(s) {
  return Number.isFinite(s.worldSeconds) && s.worldSeconds >= 0 ? s.worldSeconds : COUNTRY_START;
}
function advanceCountryClock(s, dt) {
  if (Number.isFinite(dt) && dt > 0) s.worldSeconds = countrySeconds(s) + dt;
}
function waitForCountryHour(s, hour) {
  if (!Number.isFinite(hour)) return;
  const now = countrySeconds(s),
    target = ((((hour % 24) + 24) % 24) * COUNTRY_DAY) / 24;
  const ahead = (target - (now % COUNTRY_DAY) + COUNTRY_DAY) % COUNTRY_DAY;
  s.worldSeconds = now + (ahead < 1e-6 ? COUNTRY_DAY : ahead);
}
function countryWeather(s, seconds) {
  const x = wrapped(s.x),
    z = wrapped(s.z),
    u = (x * 2 * Math.PI) / PERIOD,
    v = (z * 2 * Math.PI) / PERIOD;
  const ridge = (1 - rimBlend(x, z)) * terrainFade(10, 55, x) * terrainFade(11, 57, z);
  const drift = seconds / COUNTRY_DAY;
  // Overlapping fronts travel through the periodic map. Mountain passes force moisture out of the air.
  const front =
    0.4 +
    0.23 * Math.sin(drift * 6.81 + 0.88 * Math.sin(u - v) + 0.66 * Math.cos(v)) +
    0.17 * Math.sin(drift * 13.51 + u - 0.46 * Math.sin(v)) +
    0.24 * ridge;
  return terrainFade(0.44, 0.82, front);
}
function countryAlmanac(s) {
  const seconds = countrySeconds(s),
    hour = ((seconds % COUNTRY_DAY) * 24) / COUNTRY_DAY;
  const day = Math.floor(seconds / COUNTRY_DAY) + 1,
    minute = Math.floor(hour * 60 + 1e-6);
  const sunHeight = 0.735 * Math.cos(((hour - 12) * Math.PI) / 12) + 0.047;
  const rain = countryWeather(s, seconds),
    night = 1 - terrainFade(-0.25, 0.023, sunHeight);
  const name =
    hour < 4.6 || hour >= 21.1
      ? 'Ночь'
      : hour < 6.55
        ? 'Рассвет'
        : hour < 10.4
          ? 'Утро'
          : hour < 16.3
            ? 'День'
            : hour < 18.52
              ? 'Золотой час'
              : hour < 19.5
                ? 'Закат'
                : 'Синие сумерки';
  const aurora =
    night *
    terrainFade(0.15, 0.47, -sunHeight) *
    (1 - rain) *
    terrainFade(0.18, 0.82, 0.67 + 0.28 * Math.sin(day * 1.87));
  const weather =
    rain > 0.65 ? 'Дождь' : rain > 0.27 ? 'Облачно' : aurora > 0.37 ? 'Северное сияние' : 'Ясно';
  return {
    day,
    hour,
    time: String(Math.floor(minute / 60) % 24).padStart(2, '0') + ':' + String(minute % 60).padStart(2, '0'),
    name,
    weather,
    night,
    aurora,
    rain,
    sunHeight,
  };
}
// Each key describes the colour of the air at the horizon, sky bounce, earth bounce and direct sun or moon.
const countryPalette = [
  [0, 0x233c4b, 0x88aabc, 0x697080, 0xb3d9ff, 0.53, 0.61],
  [4.3, 0x354553, 0x829aac, 0x6b6573, 0xb7c9eb, 0.52, 0.62],
  [5.2, 0x998487, 0xadb1cd, 0x746765, 0xf3ad87, 0.36, 0.76],
  [6.05, 0xd2ac8c, 0xb0cbe2, 0x877460, 0xffbf7c, 2.48, 1.0],
  [7.7, 0xdac7a6, 0xbdd7ee, 0x9c8b6c, 0xffd4a1, 2.9, 1.05],
  [11.5, 0xb6ccd0, 0xc7e0f4, 0x8b815c, 0xffe8c2, 2.75, 1.11],
  [15, 0xc4c7b4, 0xc0d7ea, 0x928666, 0xffdaa3, 2.9, 1.02],
  [16.42, 0xd1b792, 0xbacde6, 0x978268, 0xffc281, 3.1, 0.96],
  [17.65, 0xd2a082, 0xafbed9, 0x98795b, 0xffab66, 2.85, 0.95],
  [18.48, 0xbc9189, 0xb5bbd9, 0x816a66, 0xff9262, 1.08, 0.83],
  [19.35, 0x66788b, 0xa0b3cb, 0x807386, 0xc5c9f1, 0.48, 0.84],
  [20.9, 0x344d62, 0x90abc5, 0x686b81, 0xb1d7ff, 0.52, 0.67],
  [24, 0x233c4b, 0x88aabc, 0x697080, 0xb3d9ff, 0.53, 0.61],
].map(([h, ...k]) => [h, ...k.slice(0, 4).map((c) => new THREE.Color(c)), ...k.slice(4)]);
function createCountrySky(realm, alpine = false) {
  const uniform = (value) => ({ value });
  const load = (name) => {
    const tex = texture(name, firmamentImages);
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  };
  const relief = texture('skyline', mountainFaces);
  relief.colorSpace = THREE.NoColorSpace;
  relief.wrapT = THREE.ClampToEdgeWrapping;
  const u = (realm.airUniforms = {
    distantRelief: uniform(relief),
    showRidges: uniform(alpine ? 1 : 0),
    eveningSky: uniform(load('evening')),
    starSky: uniform(load('stars')),
    stormSky: uniform(load('squall')),
    daySky: uniform(texture('sky')),
    sunny: uniform(new THREE.Vector3()),
    moon: uniform(new THREE.Vector3()),
    horizon: uniform(realm.scene.fog.color),
    keyTint: uniform(new THREE.Color()),
    wind: uniform(0),
    wet: uniform(0),
    daylight: uniform(1),
    twilight: uniform(0),
    aurora: uniform(0),
    dim: uniform(0),
    mobile: uniform(0),
    lightDirection: uniform(new THREE.Vector3()),
    waterLight: uniform(new THREE.Color()),
    waterAmbient: uniform(new THREE.Color()),
  });
  return new THREE.ShaderMaterial({
    uniforms: u,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    vertexShader: `
      varying vec3 gaze;
      void main() {
        gaze=mat3(modelMatrix)*position;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
      }`,
    fragmentShader: `
      precision highp float;
      varying vec3 gaze;
      uniform sampler2D daySky,eveningSky,starSky,stormSky,distantRelief; uniform float showRidges; uniform vec3 lightDirection;
      uniform vec3 sunny,moon,horizon,keyTint;
      uniform float wind,wet,daylight,twilight,aurora,dim,mobile;
      float azimuth(vec3 v){return atan(v.z,v.x)*.15915494;}
      void main(){
        vec3 r=normalize(gaze);
        float y=max(0.,r.y), a=azimuth(r), v=asin(min(y,1.))*.63661977;
        float drift=wind*.000072;
        vec3 clear=texture2D(daySky,vec2(a+.21+drift,.582+v*.39)).rgb;
        float facing=max(0.,dot(r,sunny)), sunAngle=azimuth(sunny);
        vec3 gilded=texture2D(eveningSky,vec2(a-sunAngle+.612,clamp(v,.003,.997))).rgb;
        float density=clamp((gilded.r-.36*gilded.b+.024)*1.9,0.,1.);
        float east=dot(normalize(r.xz+.00001),normalize(sunny.xz+.00001))*.5+.5;
        vec3 honey=mix(vec3(.68,.48,.55),vec3(1.19,.57,.29),east);
        gilded*=mix(vec3(.70,.81,1.04),honey,smoothstep(.05,.65,density)*(.49+.51*(1.-v)));
        gilded+=vec3(.48,.205,.060)*pow(facing,14.)*(.35+.65*density);
        vec3 day=mix(clear*vec3(.88,1.,1.09),gilded,twilight);
        float disk=smoothstep(.99984,.99996,facing);
        day+=vec3(1.3,.94,.64)*(disk+.15*pow(facing,300.))*smoothstep(-.01,.055,sunny.y);
        vec3 stars=texture2D(starSky,vec2(a+.26+wind*.000012,.14+.856*v)).rgb;
        vec3 midnight=mix(horizon*.88,vec3(.006,.015,.036),smoothstep(0.,.52,y));
        midnight+=stars*vec3(.44,.63,1.02)*smoothstep(.025,.27,y);
        float north=.45+.55*smoothstep(-.45,.85,-r.z);
        if(aurora>.007 && y>.035){
          float az=atan(r.x,-r.z), t=wind*.013;
          float fold=.36*sin(az*2.7+t*.09)+.21*sin(az*5.4-t*.12);
          float base=.19+.105*sin(az*2.2+.58*t*.05)+.058*sin(5.4*az+1.5*fold);
          float rib=sin(az*87.+9.*fold+3.1*sin(az*11.+t*.19));
          float fringe=.39+.61*pow(.5+.5*rib,2.);
          float band=y-base, fade=exp(-max(0.,band)*13.);
          float curtain=smoothstep(-.037,.009,band)*fade*(.75+.25*fringe)*(.43+.57*fringe);
          float lower=exp(-abs(band)*62.);
          float back=y-(.39+.076*sin(az*2.1+.6+t*.045)+.047*sin(az*7.+fold));
          float veil=smoothstep(-.023,.036,back)*exp(-max(0.,back)*12.);
          vec3 radiance=vec3(.035,.47,.26)*curtain+vec3(.11,.34,.20)*lower*.61+vec3(.119,.052,.21)*(veil+.28*fade*curtain);
          midnight+=radiance*.76*aurora*north*(.42+.58*(.5+.5*cos(az*1.8+fold)));
        }
        float md=dot(r,moon);
        if(md>.998){
          vec3 right=normalize(cross(moon,vec3(0.,1.,0.))),up=cross(right,moon);
          vec2 p=vec2(dot(r,right),dot(r,up))/.016;
          float rr=dot(p,p);
          if(rr<1.){
            float z=sqrt(1.-rr),marble=.72+.16*sin(p.y*9.+2.8*sin(p.x*4.))+.07*cos(p.x*18.+p.y*14.);
            float side=smoothstep(-.07,.36,dot(vec3(p,z),normalize(vec3(-.80,.19,.6))));
            midnight=mix(midnight,vec3(.92,1.02,1.13)*marble*(.12+.90*side),1.-smoothstep(.83,1.,rr));
          }
          midnight+=vec3(.07,.102,.16)*pow(md,2800.);
        }
        vec3 sky=mix(midnight,day,daylight);
        float embers=(1.-smoothstep(.07,.46,abs(sunny.y+.235)))*(1.-daylight);
        sky+=embers*(vec3(.036,.073,.142)*(.94-.35*v)+vec3(.34,.105,.047)*east*east*exp(-y*6.));
        vec3 over=texture2D(stormSky,vec2(a+.41+drift*2.,v*.998+.001)).rgb;
        float l=dot(over,vec3(.23,.59,.18));
        vec3 front=mix(horizon*.38,horizon*1.48,pow(clamp(l,0.,1.),1.45))+mix(vec3(.003,.005,.009),vec3(.018,.027,.047),daylight);
        sky=mix(sky,front,wet*.88);
        sky=mix(horizon,sky,smoothstep(-.060,.078,r.y));
        if(showRidges>.5 && r.y<.55){
          float angle=asin(clamp(r.y,-.999,.999));
          vec4 dem=texture2D(distantRelief,vec2(.25+a,clamp((angle+.095)/.915,.001,.999)));
          if(dem.a>.04) {
            vec2 slope=dem.rg*2.-1.;
            vec3 face=normalize(vec3(slope.x,sqrt(max(.025,1.-dot(slope,slope))),-slope.y));
            float lit=smoothstep(-.37,.91,dot(face,lightDirection));
            float snow=smoothstep(.61,.91,dem.b+.11*face.y)*smoothstep(.18,.72,face.y);
            vec3 shadow=mix(vec3(.10,.15,.21),vec3(.24,.34,.46),snow);
            vec3 sunlit=mix(vec3(.41,.38,.33),vec3(.86,.87,.89),snow)*keyTint;
            vec3 massif=mix(shadow,sunlit,lit)*(.08+.98*daylight);
            float haze=clamp(.39+(dem.a-.5)*.78+.26*wet,0.,.89);
            vec3 foot=mix(horizon,vec3(.26,.34,.42)*(.13+.87*daylight),.22*daylight);
            massif=mix(massif,foot,haze);
            sky=mix(sky,massif,smoothstep(.12,.46,dem.a)*smoothstep(-.065,.008,angle));
          }
        }
        gl_FragColor=vec4(sky,1.);
        #include <colorspace_fragment>
      }`,
  });
}

function makeLampHalos(realm) {
  const sites = realm.lightSites,
    count = sites.length + 1;
  const geometry = new THREE.BufferGeometry(),
    positions = new Float32Array(count * 3);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    uniforms: { visibility: { value: 0 }, resolution: { value: 1 } },
    vertexShader: `uniform float resolution; varying float visibleAt;
      void main(){vec4 p=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*p;
      gl_PointSize=clamp(resolution*.66/max(.35,-p.z),2.,80.);
      visibleAt=smoothstep(.35,1.6,-p.z)*(1.-smoothstep(34.,76.,-p.z));}`,
    fragmentShader: `uniform float visibility; varying float visibleAt;
      void main(){vec2 p=gl_PointCoord-.5;float r=length(p)*2.;
      float ring=exp(-6.5*r*r)*(1.-smoothstep(.66,1.,r));
      vec3 c=mix(vec3(1.,.28,.06),vec3(1.,.73,.36),exp(-21.*r*r));
      gl_FragColor=vec4(c,ring*visibleAt*visibility*.48);
      #include <colorspace_fragment>
      }`,
  });
  const halos = new THREE.Points(geometry, mat);
  halos.frustumCulled = false;
  realm.scene.add(halos);
  const lights = Array.from({ length: 3 }, () => {
    const l = new THREE.PointLight(0xffac5a, 0, 7.1, 1.8);
    realm.scene.add(l);
    return l;
  });
  return { sites, halos, lights, positions, next: 0, nearest: [], lastX: Infinity, lastZ: Infinity };
}
function lightSettlement(realm, s, t, lamp) {
  const data = (realm.countryLamps ||= makeLampHalos(realm)),
    { sites, positions, halos, lights } = data;
  const watch = oathEnding(s) === 'vigil';
  if (
    data.watch !== watch ||
    t >= data.next ||
    t < data.next - 0.65 ||
    Math.hypot(s.x - data.lastX, s.z - data.lastZ) > 3
  ) {
    data.watch = watch;
    data.next = t + 0.44;
    data.lastX = s.x;
    data.lastZ = s.z;
    const near = [];
    const place = ([x, y, z], i) => {
      const cx = nearest(x, s.x),
        cz = nearest(z, s.z),
        d = (s.x - cx) ** 2 + (s.z - cz) ** 2;
      positions.set([cx, y, cz], 3 * i);
      if (d < 19 * 19) near.push({ x: cx, y, z: cz, d });
    };
    sites.forEach(place);
    if (watch)
      place(
        [
          oathRoadside.x + watchBeacon.x,
          walkingSurface(oathRoadside.x, oathRoadside.z) + watchBeacon.y,
          oathRoadside.z + watchBeacon.z,
        ],
        sites.length,
      );
    halos.geometry.setDrawRange(0, sites.length + Number(watch));
    near.sort((a, b) => a.d - b.d);
    data.nearest = near;
    halos.geometry.attributes.position.needsUpdate = true;
  }
  halos.material.uniforms.visibility.value = lamp;
  halos.material.uniforms.resolution.value = realm.renderer.domElement.height;
  halos.visible = lamp > 0.05;
  const lightCount = prefs.quality === 'high' ? 3 : prefs.quality === 'light' ? 1 : 2;
  for (let i = 0; i < lights.length; i++) {
    const l = lights[i],
      p = data.nearest[i];
    l.visible = i < lightCount;
    l.intensity = p
      ? lamp *
        (13.8 + 1.1 * Math.sin(4.7 * t + i * 1.33) + 0.75 * Math.cos(t * 9.3 + i)) *
        Math.max(0, 1 - p.d / 361)
      : 0;
    if (p) l.position.set(p.x, p.y, p.z);
  }
  const pane = realm.matCache.get(0x364842);
  if (pane) {
    pane.emissive.setRGB(1, 0.38, 0.078);
    pane.emissiveIntensity = lamp * 0.92;
  }
  const glass = realm.wallArt?.get('window');
  if (glass) {
    if (!glass.emissiveMap) {
      glass.emissiveMap = glass.map;
      glass.needsUpdate = true;
    }
    glass.emissive.setRGB(1, 0.48, 0.13);
    glass.emissiveIntensity = lamp * 2.05;
  }
}
function makeCountryMist(realm) {
  const geometry = new THREE.BufferGeometry(),
    positions = [],
    uv = [],
    indices = [];
  // Ribbons hang just above the river meadow. Their tapered ends fade inside the ground fog.
  for (let row = 0; row < 5; row++)
    for (let i = 0; i <= 110; i++) {
      const x = -WORLD_LIMIT + (i * PERIOD) / 110,
        z = streamZ(x) + Math.sin(x * 0.052 + row) * 3.8 + (row - 2) * 3.25;
      const h = ground(x, z) - 0.15;
      for (let j = 0; j < 2; j++) {
        positions.push(x, h + j * (1.1 + 0.7 * row), z + j * 0.55);
        uv.push(x * 0.035 + row * 0.51, j);
      }
      if (i) {
        const to = positions.length / 3 - 2;
        indices.push(to - 2, to - 1, to, to, to - 1, to + 1);
      }
    }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  const u = { t: { value: 0 }, alpha: { value: 0 }, tint: { value: realm.scene.fog.color } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    vertexShader: `varying vec2 coord; varying float travel; void main(){coord=uv;vec4 p=modelViewMatrix*vec4(position,1.);travel=length(p.xyz);gl_Position=projectionMatrix*p;}`,
    fragmentShader: `uniform vec3 tint;uniform float alpha,t; varying vec2 coord;varying float travel;
      void main(){float x=coord.x+.024*t;float p=.46+.21*sin(x*2.3+sin(x*.76))+.14*sin(x*6.1+coord.y*3.8);
      float fringe=1.-smoothstep(.12,1.,coord.y);
      gl_FragColor=vec4(tint,alpha*fringe*fringe*p*smoothstep(2.,11.,travel)*(1.-smoothstep(40.,80.,travel)));
      #include <colorspace_fragment>
      }`,
  });
  const group = new THREE.Group();
  realm.scene.add(group);
  for (let x = -1; x <= 1; x++) {
    const r = new THREE.Mesh(geometry, mat);
    r.position.x = x * PERIOD;
    group.add(r);
  }
  return { group, u };
}
// Filter a small local sky probe as dusk advances. A single reusable cube-UV target
// keeps the same material programs and avoids a sudden swap of every steel highlight.
function updateCountryReflections(realm, daylight, warm, storm) {
  const photograph = realm.environmentSource.image;
  if (!photograph) return;
  let probe = realm.reflectionProbe;
  if (!probe) {
    const cn = document.createElement('canvas');
    cn.width = 256;
    cn.height = 128;
    const ctx = cn.getContext('2d'),
      shade = ctx.createLinearGradient(0, 0, 0, 128);
    for (const [at, colour] of [
      [0, '#202e4c'],
      [0.43, '#344a60'],
      [0.51, '#536270'],
      [0.58, '#292c36'],
      [1, '#181d26'],
    ])
      shade.addColorStop(at, colour);
    const map = new THREE.CanvasTexture(cn);
    map.colorSpace = THREE.SRGBColorSpace;
    map.mapping = THREE.EquirectangularReflectionMapping;
    probe = realm.reflectionProbe = {
      ctx,
      shade,
      map,
      filter: new THREE.PMREMGenerator(realm.renderer),
      target: null,
      sky: -1,
      red: -1,
    };
  }
  const sky = Math.round(daylight * (1 - 0.29 * storm) * 24) / 24;
  const red = Math.round(warm * daylight * (1 - storm) * 8) / 8;
  if (probe.sky === sky && probe.red === red) return;
  probe.sky = sky;
  probe.red = red;
  const { ctx, shade, map } = probe;
  ctx.globalAlpha = 1;
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, 256, 128);
  ctx.globalAlpha = sky;
  ctx.drawImage(photograph, 0, 0, 256, 128);
  if (red > 0) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.45 * red;
    ctx.fillStyle = '#ffd3b1';
    ctx.fillRect(0, 0, 256, 128);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha = 1;
  map.needsUpdate = true;
  probe.target = probe.filter.fromEquirectangular(map, probe.target);
  realm.scene.environment = probe.target.texture;
}
function updateCountryAir(realm, s, t) {
  const a = countryAlmanac(s),
    u = realm.airUniforms,
    keys = countryPalette;
  let hi = 1;
  while (hi < keys.length - 1 && a.hour > keys[hi][0]) hi++;
  const low = keys[hi - 1],
    high = keys[hi],
    mix = terrainFade(low[0], high[0], a.hour);
  const storm = a.rain,
    altitude = ground(s.x, s.z);
  realm.air = a;
  const rise = ((a.hour - 6) * Math.PI) / 12,
    aspect = 0.33 * Math.sin(rise) - 0.1;
  u.sunny.value.set(Math.cos(rise), a.sunHeight, aspect).normalize();
  u.moon.value
    .set(
      -Math.cos(rise - 0.46),
      Math.max(-0.52, 0.4 - a.sunHeight * 0.5),
      -0.44 + 0.15 * Math.sin(rise * 0.55),
    )
    .normalize();
  const daylight = terrainFade(-0.24, 0.088, a.sunHeight);
  const key = u.lightDirection.value
    .copy(u.moon.value)
    .lerp(u.sunny.value, terrainFade(-0.13, 0.105, a.sunHeight));
  key.y = Math.max(0.12, key.y);
  key.normalize();
  const bright = 1 - terrainFade(0.12, 0.6, a.sunHeight),
    night = a.night;
  updateCountryReflections(realm, daylight, bright, storm);
  const colour = (where, i) => where.copy(low[i]).lerp(high[i], mix);
  colour(realm.scene.fog.color, 1);
  const gray = (realm.stormColour ||= new THREE.Color());
  gray.setRGB(0.028 + 0.21 * daylight, 0.05 + 0.22 * daylight, 0.073 + 0.235 * daylight);
  realm.scene.fog.color.lerp(gray, storm * 0.73);
  const damp = 1 - terrainFade(3, 24, Math.abs(wrapped(s.z) - streamZ(s.x)));
  const dawn = 1 - terrainFade(0.25, 2.9, Math.abs(a.hour - 6.15));
  realm.scene.fog.density =
    0.0042 + 0.0033 * storm + 0.0012 * night + 0.0015 * dawn * damp - 0.0008 * terrainFade(7, 26, altitude);
  realm.horizonHaze.value = 0.64 + 0.26 * storm;
  colour(realm.sun.color, 4);
  realm.sun.color.lerp(gray.setRGB(0.74, 0.81, 0.91), storm * 0.8);
  realm.sun.intensity = THREE.MathUtils.lerp(low[5], high[5], mix) * (1 - 0.75 * storm);
  colour(realm.skylight.color, 2);
  colour(realm.skylight.groundColor, 3);
  countryLeafBounce.value
    .copy(realm.skylight.color)
    .multiplyScalar((0.085 + 0.98 * daylight) * (1 - 0.17 * storm));
  realm.skylight.intensity = THREE.MathUtils.lerp(low[6], high[6], mix) * (1 + 0.18 * storm);
  realm.sun.position.copy(realm.sun.target.position).addScaledVector(key, 63);
  u.keyTint.value.copy(realm.sun.color);
  u.dim.value = night;
  u.wet.value = storm;
  u.daylight.value = daylight;
  u.twilight.value = bright;
  u.aurora.value = a.aurora;
  u.wind.value = t;
  u.mobile.value = prefs.quality === 'light' ? 1 : 0;
  u.waterAmbient.value.copy(realm.skylight.color).multiplyScalar(0.26 + 0.74 * daylight);
  u.waterLight.value.copy(realm.sun.color).multiplyScalar(0.39 + 0.77 * daylight);

  const lamp = Math.max(
    0.08 * storm,
    Math.min(1, night + 0.39 * (1 - terrainFade(-0.09, 0.17, a.sunHeight))),
  );
  lightSettlement(realm, s, t, lamp);
  realm.rain.visible = storm > 0.15;
  realm.rain.position.set(s.x, altitude + 4 - ((t * 7) % 4), s.z);
  realm.rain.geometry.setDrawRange(0, prefs.quality === 'light' ? 120 : 460);
  realm.rain.material.opacity = 0.29 * storm;
  realm.birds.visible = night < 0.66 && storm < 0.78;
  realm.motes.visible = storm < 0.68;
  if (realm.countryShafts) {
    for (const ray of realm.countryShafts) {
      ray.visible = prefs.quality !== 'light' && daylight > 0.15 && storm < 0.75;
      ray.rotation.order = 'YXZ';
      ray.rotation.set(0, Math.atan2(key.x, key.z) - Math.PI * 0.5, -Math.acos(Math.min(0.98, key.y)), 'YXZ');
    }
    const shafts = realm.countryShafts[0].material;
    shafts.color.copy(realm.sun.color);
    shafts.opacity = (0.02 + 0.12 * bright) * daylight * (1 - storm);
  }
  const mist = (realm.countryMist ||= makeCountryMist(realm));
  mist.group.position.z = PERIOD * Math.round(s.z / PERIOD);
  mist.group.visible = prefs.quality !== 'light' && damp > 0.02;
  mist.u.alpha.value = (0.16 + 0.41 * dawn + 0.2 * night + 0.24 * storm) * damp;
  mist.u.t.value = t;
}

function lightCountryRoom(realm, scene, s, t) {
  const now = countrySeconds(s);
  const slot = Math.floor(now / (prefs.quality === 'light' ? 36 : 21));
  if (scene.userData.lightSlot !== slot) {
    scene.userData.lightSlot = slot;
    updateCountryAir(realm, s, t);
    for (const draw of scene.userData.windowViews || []) draw();
  }
  const day = scene.userData.day;
  if (day) {
    day.userData.noon ??= day.intensity;
    const u = realm.airUniforms;
    day.intensity = day.userData.noon * (0.13 + 0.88 * u.daylight.value) * (1 - 0.29 * u.wet.value);
    day.color.copy(realm.sun.color);
  }
}

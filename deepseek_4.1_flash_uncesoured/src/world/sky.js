// Небо, солнце, луна, звёзды, туман и погода (дождь, гроза).
import * as THREE from 'three';
import { G, SETTINGS, emit, isNight } from '../core/state.js';
import { clamp, lerp, smoothstep } from '../core/mathutil.js';

let sky, sun, moon, stars, rain, hemi, ambient;
let rainCount = 0;
const DAY_LEN = 1800; // секунд игрового времени в сутках при speed=1 (40× ускорение)

export function initSky(scene) {
  // купол
  const geo = new THREE.SphereGeometry(2400, 32, 20);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      uTop: { value: new THREE.Color(0x2a5a9a) },
      uMid: { value: new THREE.Color(0x9fc0dd) },
      uBot: { value: new THREE.Color(0xd8c9a8) },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color(0xffd090) },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uBot; uniform vec3 uSunDir; uniform vec3 uSunColor;
      varying vec3 vDir;
      void main(){
        float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 col = mix(uBot, mix(uMid, uTop, smoothstep(0.5, 1.0, h)), smoothstep(0.42, 0.62, h));
        float sun = pow(max(dot(normalize(vDir), normalize(uSunDir)), 0.0), 12.0);
        col += uSunColor * sun * 0.8;
        float glow = pow(max(dot(normalize(vDir), normalize(uSunDir)), 0.0), 2.5);
        col += uSunColor * glow * 0.18;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  sky = new THREE.Mesh(geo, mat);
  sky.frustumCulled = false;
  scene.add(sky);

  sun = new THREE.DirectionalLight(0xfff0d0, 4.6);
  sun.position.set(200, 300, 100);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const d = 120;
  sun.shadow.camera.left = -d; sun.shadow.camera.right = d;
  sun.shadow.camera.top = d; sun.shadow.camera.bottom = -d;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 600;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);

  hemi = new THREE.HemisphereLight(0xbfd4ea, 0x4a5a3a, 2.2);
  scene.add(hemi);
  ambient = new THREE.AmbientLight(0x404860, 0.9);
  scene.add(ambient);

  // луна
  moon = new THREE.Mesh(new THREE.SphereGeometry(28, 16, 12), new THREE.MeshBasicMaterial({ color: 0xf0ead0 }));
  moon.frustumCulled = false;
  scene.add(moon);

  // звёзды
  const starGeo = new THREE.BufferGeometry();
  const n = 900;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI * 0.5;
    const r = 2100;
    pos[i * 3] = Math.cos(a) * Math.cos(e) * r;
    pos[i * 3 + 1] = Math.sin(e) * r;
    pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 6, sizeAttenuation: true, transparent: true, opacity: 0 }));
  stars.frustumCulled = false;
  scene.add(stars);

  // дождь
  const rn = 2600;
  const rgeo = new THREE.BufferGeometry();
  const rpos = new Float32Array(rn * 3);
  for (let i = 0; i < rn; i++) {
    rpos[i * 3] = (Math.random() - 0.5) * 90;
    rpos[i * 3 + 1] = Math.random() * 40;
    rpos[i * 3 + 2] = (Math.random() - 0.5) * 90;
  }
  rgeo.setAttribute('position', new THREE.BufferAttribute(rpos, 3));
  rain = new THREE.Points(rgeo, new THREE.PointsMaterial({ color: 0x9fc4e8, size: 0.5, transparent: true, opacity: 0.5 }));
  rain.frustumCulled = false;
  rain.visible = false;
  scene.add(rain);
  rainCount = rn;

  G.sky = { sky, sun, moon, stars, rain, hemi, ambient };
  applyWeather();
}

export function updateSky(dt) {
  if (!G.sky) return;
  // время суток
  G.time.seconds += dt * (G.time.speed || 40);
  const dayLen = 86400;
  if (G.time.seconds >= dayLen) {
    G.time.seconds -= dayLen;
    G.time.day++;
    emit('time:day', { day: G.time.day });
    // интерес по вкладу
    if (G.economy && G.economy.state) { /* заглушка */ }
    emit('game:newday', {});
  }
  const t = G.time.seconds / dayLen;
  // 06:00 — восход (t=0.25), 12:00 — зенит (t=0.5), 18:00 — закат (t=0.75)
  const ang = (t - 0.25) * Math.PI * 2;
  const sunDir = new THREE.Vector3(Math.cos(ang) * 0.85, Math.sin(ang), 0.38).normalize();
  sun.position.copy(sunDir).multiplyScalar(300);
  sun.target.position.set(G.player ? G.player.pos.x : 0, 0, G.player ? G.player.pos.z : 0);
  sun.target.updateMatrixWorld();
  sun.position.add(sun.target.position);
  moon.position.copy(sunDir).multiplyScalar(-2000);
  const night = clamp(-sunDir.y * 2.2 + 0.25, 0, 1);
  const dayF = clamp(sunDir.y * 1.8 + 0.35, 0, 1);
  sun.intensity = clamp(0.4 + dayF * 4.6, 0.35, 5.2) * (G.weather && G.weather.rain > 0.4 ? 0.5 : 1);
  sun.color.setHSL(lerp(0.08, 0.13, dayF), lerp(0.7, 0.35, dayF), lerp(0.45, 0.72, dayF));
  hemi.intensity = lerp(0.5, 2.4, dayF);
  ambient.intensity = lerp(0.3, 0.95, dayF);
  const fogColor = new THREE.Color().setHSL(lerp(0.62, 0.55, dayF), lerp(0.3, 0.35, dayF), lerp(0.08, 0.62, dayF));
  if (G.weather.rain > 0.2) fogColor.lerp(new THREE.Color(0x5a6470), G.weather.rain * 0.6);
  G.fogColor = fogColor;
  G.fogDensity = (SETTINGS.viewDist ? clamp(2.6 / SETTINGS.viewDist, 0.0009, 0.004) : 0.0022) * (1 + G.weather.rain * 1.2);
  G.scene.fog = G.scene.fog || new THREE.FogExp2(fogColor.getHex(), G.fogDensity);
  G.scene.fog.color.copy(fogColor);
  G.scene.fog.density = G.fogDensity;
  G.scene.background = null;
  if (sky) {
    sky.material.uniforms.uSunDir.value.copy(sunDir);
    sky.material.uniforms.uSunColor.value.copy(sun.color);
    sky.material.uniforms.uTop.value.setHSL(lerp(0.65, 0.58, dayF), lerp(0.5, 0.55, dayF), lerp(0.04, 0.34, dayF));
    sky.material.uniforms.uMid.value.setHSL(lerp(0.62, 0.56, dayF), lerp(0.35, 0.4, dayF), lerp(0.06, 0.6, dayF));
    sky.material.uniforms.uBot.value.setHSL(lerp(0.66, 0.09, dayF), lerp(0.3, 0.5, dayF), lerp(0.05, 0.7, dayF));
    sky.position.set(G.camera.position.x, 0, G.camera.position.z);
  }
  if (stars) stars.material.opacity = night * 0.9;
  if (stars) stars.position.set(G.camera.position.x, 0, G.camera.position.z);
  // погода
  updateWeather(dt);
}

function updateWeather(dt) {
  const w = G.weather;
  w.timer = (w.timer || 60) - dt;
  if (w.timer <= 0) {
    w.timer = 240 + Math.random() * 600;
    const r = Math.random();
    w.target = r < 0.22 ? (r < 0.06 ? 0.9 : 0.45) : 0;
    if (w.target > 0.6 && Math.random() < 0.5) G.audio.play('thunder', { vol: 0.5 });
  }
  w.rain = lerp(w.rain, w.target || 0, dt * 0.15);
  if (rain) {
    rain.visible = w.rain > 0.05;
    if (rain.visible) {
      const arr = rain.geometry.attributes.position.array;
      for (let i = 0; i < rainCount; i++) {
        arr[i * 3 + 1] -= (24 + (i % 7)) * dt * (0.6 + w.rain);
        if (arr[i * 3 + 1] < 0) {
          arr[i * 3 + 1] = 40 + Math.random() * 6;
          arr[i * 3] = (Math.random() - 0.5) * 90;
          arr[i * 3 + 2] = (Math.random() - 0.5) * 90;
        }
      }
      rain.geometry.attributes.position.needsUpdate = true;
      rain.position.set(G.camera.position.x, G.camera.position.y - 20, G.camera.position.z);
      rain.material.opacity = 0.25 + w.rain * 0.4;
      rain.material.size = 0.35 + w.rain * 0.4;
    }
  }
  applyWeather();
}
function applyWeather() {
  if (G.weather.rain > 0.3 && G.audio.ready && !G._rainSound) {
    G._rainSound = true;
  }
}

export function skyLightFactor() {
  const t = G.time.seconds / 86400;
  const elevation = Math.sin((t - 0.25) * Math.PI * 2);
  return clamp(0.22 + Math.max(0, elevation) * 1.15, 0.16, 1.2);
}
export function isNightNow() { return isNight(); }
void DAY_LEN; void smoothstep;

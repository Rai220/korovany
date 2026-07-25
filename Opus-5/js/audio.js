// Простые звуки на WebAudio — без файлов, чтобы всё лежало на GitHub Pages одной папкой.
let ctx = null;
let master = null;
let enabled = true;

export function initAudio() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) { enabled = false; return; }
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.32;
  master.connect(ctx.destination);
}

export function resumeAudio() {
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

function tone(freq, dur, type = 'square', vol = 0.5, slide = 0) {
  if (!enabled || !ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, ctx.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), ctx.currentTime + dur);
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0008, ctx.currentTime + dur);
  o.connect(g);
  g.connect(master);
  o.start();
  o.stop(ctx.currentTime + dur + 0.02);
}

function noise(dur, vol = 0.4, filterFreq = 1200) {
  if (!enabled || !ctx) return;
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = filterFreq;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start();
}

const SOUNDS = {
  swing: () => noise(0.16, 0.28, 2600),
  hit: () => { noise(0.12, 0.5, 900); tone(160, 0.1, 'square', 0.25, -60); },
  shot: () => tone(720, 0.12, 'triangle', 0.3, -420),
  arrow: () => noise(0.09, 0.22, 3400),
  hurt: () => { tone(220, 0.22, 'sawtooth', 0.35, -140); noise(0.2, 0.35, 700); },
  dismember: () => { noise(0.4, 0.6, 500); tone(90, 0.5, 'sawtooth', 0.4, -40); },
  die: () => { tone(300, 0.5, 'sawtooth', 0.35, -240); noise(0.5, 0.4, 600); },
  gold: () => { tone(980, 0.09, 'square', 0.25); setTimeout(() => tone(1320, 0.12, 'square', 0.22), 70); },
  ui: () => tone(660, 0.06, 'square', 0.16),
  quest: () => { tone(520, 0.14, 'triangle', 0.3); setTimeout(() => tone(780, 0.22, 'triangle', 0.28), 120); },
  jump: () => tone(420, 0.09, 'square', 0.14, 180),
  horn: () => { tone(180, 0.7, 'sawtooth', 0.35, 40); setTimeout(() => tone(240, 0.8, 'sawtooth', 0.3, 20), 260); },
};

export function sfx(name) {
  const f = SOUNDS[name];
  if (f) { try { f(); } catch (e) { /* звук не критичен */ } }
}

export function setAudioEnabled(v) { enabled = v; }

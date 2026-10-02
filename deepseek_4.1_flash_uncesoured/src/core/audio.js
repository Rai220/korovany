// Процедурный звук на WebAudio: удары, шаги, природа, музыка. Без файлов.
import { G, SETTINGS } from './state.js';

export const Audio2 = {
  ctx: null, master: null, musicGain: null, ambGain: null, sfxGain: null,
  ready: false, zone: 1, _ambNodes: [], _musicTimer: 0, _stepTimer: 0, _lastStep: 0,
  noiseBuf: null,

  init() {
    if (this.ready) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch (e) { return; }
    this.master = this.ctx.createGain();
    this.master.gain.value = SETTINGS.volume;
    this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = 0.9; this.sfxGain.connect(this.master);
    this.ambGain = this.ctx.createGain(); this.ambGain.gain.value = 0.5; this.ambGain.connect(this.master);
    this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = 0.32; this.musicGain.connect(this.master);
    this.noiseBuf = this._noise(2);
    this.ready = true;
    this.setVolume(SETTINGS.volume);
    this.startAmbient();
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  setVolume(v) { if (this.master) this.master.gain.value = v; },

  _noise(sec) {
    const len = Math.floor(this.ctx.sampleRate * sec);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  },

  _pos(x, z) {
    if (!G.camera) return { gain: 1, pan: 0 };
    const cam = G.camera;
    const dx = x - cam.position.x, dz = z - cam.position.z;
    const d = Math.hypot(dx, dz);
    const gain = Math.max(0, 1 - d / 90) ** 1.4;
    const fwd = { x: -Math.sin(0), z: -Math.cos(0) };
    const right = { x: Math.cos(cam.rotation.y), z: -Math.sin(cam.rotation.y) };
    const pan = Math.max(-1, Math.min(1, (dx * right.x + dz * right.z) / Math.max(8, d * 1.2)));
    void fwd;
    return { gain, pan };
  },

  // ---------- базовые генераторы ----------
  tone({ freq = 440, dur = 0.15, type = 'sine', vol = 0.4, pan = 0, slide = 0, delay = 0, curve = 'exp' }) {
    if (!this.ready) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const p = this.ctx.createStereoPanner();
    osc.type = type; osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + Math.min(0.02, dur * 0.2));
    if (curve === 'exp') g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    else g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    p.pan.value = pan;
    osc.connect(g); g.connect(p); p.connect(this.sfxGain);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  },
  noise({ dur = 0.2, vol = 0.4, pan = 0, filter = 1200, q = 1, type = 'lowpass', delay = 0 }) {
    if (!this.ready) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = filter; f.Q.value = q;
    const g = this.ctx.createGain();
    const p = this.ctx.createStereoPanner(); p.pan.value = pan;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(p); p.connect(this.sfxGain);
    src.start(t0); src.stop(t0 + dur + 0.05);
  },

  // ---------- игровые звуки ----------
  play(name, opts = {}) {
    if (!this.ready || !SETTINGS.music) return;
    const pos = opts.pos ? this._pos(opts.pos.x, opts.pos.z) : { gain: 1, pan: 0 };
    if (opts.pos && pos.gain <= 0.02) return;
    const v = (opts.vol ?? 1) * pos.gain, pan = pos.pan;
    const r = (a, b) => a + Math.random() * (b - a);
    switch (name) {
      case 'swing': this.noise({ dur: 0.16, vol: 0.22 * v, pan, filter: r(900, 1800), type: 'bandpass', q: 0.8 }); break;
      case 'swing_heavy': this.noise({ dur: 0.26, vol: 0.3 * v, pan, filter: r(500, 900), type: 'bandpass' }); break;
      case 'hit_flesh':
        this.noise({ dur: 0.13, vol: 0.5 * v, pan, filter: 420, q: 0.7 });
        this.tone({ freq: r(120, 180), dur: 0.12, type: 'triangle', vol: 0.28 * v, pan, slide: -60 });
        break;
      case 'hit_bone':
        this.noise({ dur: 0.1, vol: 0.4 * v, pan, filter: 2200, type: 'bandpass', q: 2 });
        this.tone({ freq: 700, dur: 0.08, type: 'square', vol: 0.14 * v, pan });
        break;
      case 'hit_metal':
        this.tone({ freq: r(1200, 1900), dur: 0.22, type: 'square', vol: 0.16 * v, pan, slide: -400 });
        this.noise({ dur: 0.12, vol: 0.3 * v, pan, filter: 3000, type: 'highpass' });
        break;
      case 'block':
        this.tone({ freq: 300, dur: 0.16, type: 'sawtooth', vol: 0.18 * v, pan, slide: -120 });
        this.noise({ dur: 0.16, vol: 0.28 * v, pan, filter: 1800, type: 'bandpass' });
        break;
      case 'bow':
        this.tone({ freq: 220, dur: 0.2, type: 'triangle', vol: 0.24 * v, pan, slide: 420 });
        this.noise({ dur: 0.1, vol: 0.16 * v, pan, filter: 2600, type: 'highpass' });
        break;
      case 'arrow_hit': this.noise({ dur: 0.09, vol: 0.4 * v, pan, filter: 1500, type: 'bandpass', q: 3 }); break;
      case 'sever':
        this.noise({ dur: 0.3, vol: 0.5 * v, pan, filter: 700, q: 1.4 });
        this.tone({ freq: 160, dur: 0.3, type: 'sawtooth', vol: 0.2 * v, pan, slide: -80 });
        break;
      case 'hurt':
        this.tone({ freq: r(240, 340), dur: 0.24, type: 'sawtooth', vol: 0.24 * v, pan, slide: -120 });
        break;
      case 'scream':
        this.tone({ freq: r(420, 560), dur: 0.7, type: 'sawtooth', vol: 0.3 * v, pan, slide: -220 });
        this.tone({ freq: r(620, 760), dur: 0.6, type: 'triangle', vol: 0.14 * v, pan, slide: -180, delay: 0.04 });
        break;
      case 'death':
        this.tone({ freq: 200, dur: 1.1, type: 'sawtooth', vol: 0.26 * v, pan, slide: -150 });
        break;
      case 'step_grass': this.noise({ dur: 0.09, vol: 0.12 * v, pan, filter: r(1400, 2600), type: 'bandpass' }); break;
      case 'step_dirt': this.noise({ dur: 0.1, vol: 0.14 * v, pan, filter: r(500, 900), type: 'bandpass' }); break;
      case 'step_stone': this.noise({ dur: 0.07, vol: 0.13 * v, pan, filter: r(900, 1600), type: 'bandpass' }); break;
      case 'step_wood': this.tone({ freq: r(160, 240), dur: 0.08, type: 'triangle', vol: 0.12 * v, pan }); break;
      case 'step_water': this.noise({ dur: 0.22, vol: 0.2 * v, pan, filter: 900, type: 'lowpass' }); break;
      case 'coin': this.tone({ freq: 1400, dur: 0.1, type: 'triangle', vol: 0.16 * v, pan });
        this.tone({ freq: 2100, dur: 0.14, type: 'triangle', vol: 0.12 * v, pan, delay: 0.05 }); break;
      case 'ui': this.tone({ freq: 620, dur: 0.06, type: 'triangle', vol: 0.12 * v }); break;
      case 'ui_open': this.tone({ freq: 320, dur: 0.16, type: 'triangle', vol: 0.14 * v, slide: 160 }); break;
      case 'levelup':
        [523, 659, 784, 1046].forEach((f, i) => this.tone({ freq: f, dur: 0.4, type: 'triangle', vol: 0.16 * v, delay: i * 0.1 }));
        break;
      case 'quest':
        [392, 523, 659].forEach((f, i) => this.tone({ freq: f, dur: 0.5, type: 'sine', vol: 0.18 * v, delay: i * 0.12 }));
        break;
      case 'bandage': this.noise({ dur: 0.35, vol: 0.16 * v, filter: 2200, type: 'bandpass' }); break;
      case 'drink': this.tone({ freq: 300, dur: 0.2, type: 'sine', vol: 0.2 * v, slide: 260 }); break;
      case 'wheel': this.tone({ freq: 90, dur: 0.4, type: 'sawtooth', vol: 0.1 * v, slide: 30 }); break;
      case 'cow': this.tone({ freq: 150, dur: 0.9, type: 'sawtooth', vol: 0.22 * v, pan, slide: -40 });
        this.tone({ freq: 96, dur: 0.8, type: 'triangle', vol: 0.16 * v, pan, delay: 0.05 }); break;
      case 'horse': this.tone({ freq: 420, dur: 0.4, type: 'sawtooth', vol: 0.16 * v, pan, slide: -180 }); break;
      case 'crow': this.tone({ freq: 900, dur: 0.2, type: 'square', vol: 0.1 * v, pan, slide: -300 });
        this.tone({ freq: 800, dur: 0.2, type: 'square', vol: 0.09 * v, pan, delay: 0.25, slide: -300 }); break;
      case 'wolf': this.tone({ freq: 340, dur: 1.3, type: 'sawtooth', vol: 0.16 * v, pan, slide: 140 }); break;
      case 'thunder': this.noise({ dur: 2.4, vol: 0.34 * v, filter: 320, type: 'lowpass' }); break;
      case 'gate': this.noise({ dur: 1.1, vol: 0.3 * v, pan, filter: 700, type: 'lowpass' });
        this.tone({ freq: 110, dur: 1.2, type: 'sawtooth', vol: 0.14 * v, pan }); break;
      case 'fire': this.noise({ dur: 0.5, vol: 0.1 * v, pan, filter: 1400, type: 'bandpass', q: 0.6 }); break;
      case 'craft': this.tone({ freq: 260, dur: 0.12, type: 'square', vol: 0.18 * v, pan });
        this.tone({ freq: 190, dur: 0.18, type: 'square', vol: 0.14 * v, pan, delay: 0.16 }); break;
      case 'prosthetic': this.tone({ freq: 500, dur: 0.2, type: 'square', vol: 0.14 * v });
        this.noise({ dur: 0.25, vol: 0.2 * v, filter: 2400, type: 'highpass' }); break;
      case 'snap': this.tone({ freq: 900, dur: 0.07, type: 'square', vol: 0.2 * v, slide: -400 }); break;
      default: this.tone({ freq: 440, dur: 0.1, type: 'sine', vol: 0.12 * v });
    }
  },

  // ---------- окружение ----------
  startAmbient() {
    if (!this.ready || this._ambNodes.length) return;
    // ветер
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
    const g = this.ctx.createGain(); g.gain.value = 0.09;
    src.connect(f); f.connect(g); g.connect(this.ambGain);
    src.start();
    this._ambNodes.push(src, g, f);
    // «сверчки» ночью и птицы днём — планировщик ниже
  },
  setZone(zone) { this.zone = zone; },
  update(dt) {
    if (!this.ready) return;
    // случайные звуки природы
    this._ambTimer = (this._ambTimer || 0) - dt;
    if (this._ambTimer <= 0) {
      this._ambTimer = 2 + Math.random() * 6;
      const night = (G.time.seconds / 3600) % 24;
      const isNight = night < 5.5 || night > 21;
      if (isNight) this.play('wolf', { vol: 0.5 });
      else if (this.zone === 3) this.play('crow', { vol: 0.6 });
      else if (this.zone === 2) this.play('crow', { vol: 0.4 });
      else if (Math.random() < 0.3) this.play('cow', { vol: 0.4 });
    }
    // музыка: редкие арпеджио
    this._musicTimer -= dt;
    if (this._musicTimer <= 0) {
      this._musicTimer = 6 + Math.random() * 12;
      if (SETTINGS.music) {
        const scales = { 1: [392, 440, 494, 587, 659], 2: [349, 392, 466, 523, 587], 3: [440, 523, 587, 659, 784], 4: [311, 349, 415, 466, 622] };
        const sc = scales[this.zone] || scales[1];
        const root = sc[Math.floor(Math.random() * sc.length)];
        const n = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) {
          const f = root * (Math.random() < 0.3 ? 2 : 1);
          this.tone({ freq: f, dur: 1.6, type: 'sine', vol: 0.09, delay: i * 0.34, pan: (Math.random() - 0.5) * 0.6 });
          this.tone({ freq: f / 2, dur: 2.2, type: 'triangle', vol: 0.05, delay: i * 0.34 });
        }
      }
    }
    // шаги игрока
    const p = G.player;
    if (p && p.moving && p.onGround && !G.paused) {
      this._stepTimer -= dt * (p.sprinting ? 1.5 : 1);
      if (this._stepTimer <= 0) {
        this._stepTimer = p.crawling ? 0.55 : (p.sprinting ? 0.28 : 0.42);
        const mat = p.groundMaterial || 'dirt';
        this.play('step_' + mat, { vol: p.sneaking ? 0.35 : 0.8 });
      }
    }
  },
};
export const AudioSys = Audio2;
G.audio = Audio2;

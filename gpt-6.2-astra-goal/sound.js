'use strict';
const music = ['road-song', 'pursuit'].map((name) => {
  const a = new Audio('./assets/' + name + '.mp3');
  a.preload = 'none';
  a.loop = true;
  a.volume = 0;
  return a;
});
let scoreMix = 0,
  stepBeat = 0,
  birdTime = 0;
function scoreStart() {
  if (soundOn)
    for (const a of music) {
      if (a.paused) a.play().catch(() => {});
    }
}
function scoreStop() {
  music.forEach((a) => a.pause());
}
function scoreCue(cue) {
  if (!soundOn) return;
  if (cue === 'chapter') {
    tone(220, 1.1, 'sine', 0.04);
    tone(330, 0.95, 'triangle', 0.028);
  }
  if (cue === 'parry') {
    tone(1300, 0.48, 'triangle', 0.08, 760);
    tone(1840, 0.33, 'sine', 0.04, 1480);
  }
  if (cue === 'bow') {
    noiseFoley(0.08, 1800, 0.12);
    tone(420, 0.17, 'triangle', 0.05, 108);
  }
  if (cue === 'impact') {
    noiseFoley(0.11, 620, 0.17);
    tone(110, 0.12, 'triangle', 0.08, 50);
  }
}
let noiseBank;
function noiseFoley(duration, cutoff, volume) {
  if (!soundOn || !audioCtx) return;
  const ctx = audioCtx;
  if (!noiseBank) {
    noiseBank = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBank.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource(),
    f = ctx.createBiquadFilter(),
    amp = ctx.createGain();
  src.buffer = noiseBank;
  f.type = 'lowpass';
  f.frequency.value = cutoff;
  src.connect(f).connect(amp).connect(ctx.destination);
  amp.gain.setValueAtTime(Math.max(0.0001, volume * prefs.effects), ctx.currentTime);
  amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  src.start(0, Math.random() * 0.4);
  src.stop(ctx.currentTime + duration);
}
function soundscape(dt, moving, sprinting) {
  if (!soundOn) return;
  const danger = game.actors.some((a) => a.hp > 0 && a.team === 'hostile' && distance(game, a) < 17);
  scoreMix += (Number(danger) - scoreMix) * Math.min(1, dt * (danger ? 1.3 : 0.24));
  music[0].volume = prefs.music * 0.52 * (1 - scoreMix);
  music[1].volume = prefs.music * 0.57 * scoreMix;
  stepBeat -= dt;
  birdTime -= dt;
  if (moving && stepBeat <= 0 && game.air <= 0.05) {
    stepBeat = sprinting ? 0.32 : 0.49;
    const stone = zoneAt(game.x, game.z) === 1;
    noiseFoley(0.11, stone ? 1750 : 760, 0.11);
    tone(82, 0.09, 'sine', 0.065, 45);
  }
  if (birdTime < 0 && !danger) {
    birdTime = 6 + Math.random() * 10;
    const h = 1250 + Math.random() * 430;
    tone(h, 0.17, 'sine', 0.018, h * 1.35);
    noiseFoley(0.8, 520, 0.035);
  }
}

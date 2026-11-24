'use strict';

// These loops share a tonic, with a different metre and ensemble for each activity.
// Only the incoming and outgoing parts need to play during a cue change.
const scoreTracks = Object.fromEntries(
  [
    ['road', 'salt-road', 40, 6, 60 / (84 * 3)],
    ['battle', 'fifth-hoof', 32, 10, 60 / (148 * 2)],
    ['fair', 'crossing-at-dawn', 48, 6, 60 / (112 * 3)],
    ['mill', 'mill-archive', 32, 6, 60 / (87 * 2)],
  ].map(([key, file, bars, pulses, pulseDuration]) => [
    key,
    {
      url: './assets/music/' + file + '.mp3',
      bar: pulses * pulseDuration,
      seconds: bars * pulses * pulseDuration,
      offset: 0,
      level: 0,
      target: 0,
      started: 0,
      lastUsed: 0,
      node: null,
      gain: null,
      buffer: null,
      loading: null,
      media: null,
      native: location.protocol === 'file:',
      playPending: false,
      retryAfter: 0,
    },
  ]),
);
let scoreMode = '',
  scoreTimer = 0,
  scoreIntent = 'road',
  scoreLastTick = 0;
let scoreLastDanger = -Infinity,
  scoreLastFair = -Infinity,
  scoreAudible = '';
let stepBeat = 0;

function scoreScene(now) {
  if (scoreMode === 'menu' || !active || !game) return 'road';
  if (game.delivery || ($('dialog').open && document.querySelector('#dialog-body .cow-office')))
    return 'fair';
  if (game.inside || game.health <= 0) return 'mill';
  if (!$('dialog').open) {
    if (game.actors.some((a) => a.hp > 0 && a.team === 'hostile' && distance(game, a) < 17))
      scoreLastDanger = now;
    if (game.wagon && distance(game, game.wagon) < 10) scoreLastFair = now;
  }
  if (now - scoreLastDanger < 3200) return 'battle';
  if (now - scoreLastFair < 2200) return 'fair';
  return 'road';
}

function scoreFreeDeck(track) {
  if (track.node) {
    track.offset = (track.offset + Math.max(0, audioCtx.currentTime - track.started)) % track.buffer.duration;
    track.node.onended = null;
    track.node.stop();
    track.node.disconnect();
    track.gain.disconnect();
    track.node = track.gain = null;
  }
  if (track.media) {
    track.offset = Number.isFinite(track.media.currentTime) ? track.media.currentTime : 0;
    track.media.pause();
    track.media.volume = 0;
  }
  track.level = track.target = 0;
}

function scoreSilence() {
  clearInterval(scoreTimer);
  scoreTimer = 0;
  stopScoreAir();
  for (const track of Object.values(scoreTracks)) scoreFreeDeck(track);
  scoreAudible = '';
}

function scoreNative(track) {
  if (!track.media) {
    track.media = new Audio(track.url);
    track.media.loop = true;
    track.media.volume = 0;
    track.media.preload = 'auto';
  }
  if (!track.media.paused || track.playPending || performance.now() < track.retryAfter) return;
  track.playPending = true;
  track.media
    .play()
    .catch(() => {
      track.retryAfter = performance.now() + 3500;
    })
    .finally(() => {
      track.playPending = false;
      if (!scoreMode || !soundOn || document.hidden) track.media.pause();
    });
}

function scorePrepare(track) {
  if (!audioCtx || track.native) {
    scoreNative(track);
    return;
  }
  if (track.buffer && !track.node) {
    const node = audioCtx.createBufferSource(),
      gain = audioCtx.createGain();
    node.buffer = track.buffer;
    node.loop = true;
    node.loopEnd = Math.min(track.buffer.duration, track.seconds);
    gain.gain.value = 0;
    node.connect(gain).connect(audioCtx.destination);
    // Re-enter on a downbeat after a change of ensemble.
    track.offset = (Math.floor(track.offset / track.bar + 0.5) * track.bar) % track.buffer.duration;
    track.started = audioCtx.currentTime;
    node.start(0, track.offset);
    track.node = node;
    track.gain = gain;
    return;
  }
  if (track.node || track.loading) return;
  track.loading = fetch(track.url)
    .then((response) => {
      if (!response.ok) throw Error('Music ' + response.status);
      return response.arrayBuffer();
    })
    .then((bytes) => audioCtx.decodeAudioData(bytes))
    .then((buffer) => {
      if (!scoreMode || !soundOn || document.hidden) return;
      track.buffer = buffer;
      track.lastUsed = performance.now();
    })
    .catch(() => {
      // Local file restrictions and older codecs can still permit ordinary media playback.
      track.native = true;
    })
    .finally(() => {
      track.loading = null;
    });
}

function scoreRefresh() {
  if (!scoreMode || !soundOn || document.hidden) return;
  const now = performance.now(),
    dt = Math.min(0.4, Math.max(0.01, (now - scoreLastTick) / 1000));
  scoreLastTick = now;
  scoreIntent = scoreScene(now);
  const duck = typeof realmVoice !== 'undefined' && realmVoice.active;
  scoreAir(duck);
  const ceiling =
    Math.max(0, Math.min(1, Number(prefs.music) || 0)) *
    (duck ? 0.23 : 0.72) *
    (active && $('dialog').open && !document.querySelector('#dialog-body .cow-office') ? 0.76 : 1);
  const next = scoreTracks[scoreIntent];
  if (ceiling > 0.0001) {
    scorePrepare(next);
    if (next.native || !audioCtx) {
      if (next.media && !next.media.paused && next.media.readyState >= 2) scoreAudible = scoreIntent;
    } else if (next.node) scoreAudible = scoreIntent;
  }
  const immediateMute = Number(prefs.music) <= 0;
  for (const [key, track] of Object.entries(scoreTracks)) {
    const target = key === scoreAudible ? ceiling : 0;
    const time = duck && target < track.level ? 0.14 : target ? 0.65 : 0.48;
    const mix = immediateMute ? 1 : 1 - Math.exp(-dt / time);
    track.level += (target - track.level) * mix;
    if (track.gain && track.target !== target) {
      const param = track.gain.gain;
      param.cancelScheduledValues(audioCtx.currentTime);
      if (immediateMute) param.setValueAtTime(0, audioCtx.currentTime);
      else param.setTargetAtTime(target, audioCtx.currentTime, time);
    }
    track.target = target;
    if (track.media) track.media.volume = Math.min(1, Math.max(0, track.level));
    if (
      (track.node || (track.media && !track.media.paused)) &&
      track.level < 0.001 &&
      target === 0 &&
      (key !== scoreIntent || immediateMute)
    )
      scoreFreeDeck(track);
    if (target > 0) track.lastUsed = now;
    // Release inactive PCM buffers once a rapid return to their scene becomes unlikely.
    if (!track.node && track.buffer && key !== scoreIntent && now - track.lastUsed > 9000)
      track.buffer = null;
  }
}

function scoreStart(mode = 'play') {
  if (!soundOn) return;
  if (!scoreMode || mode !== scoreMode) {
    scoreLastDanger = scoreLastFair = -Infinity;
    scoreLastTick = performance.now() - 100;
  }
  scoreMode = mode;
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state !== 'running') audioCtx.resume().catch(() => {});
  } catch {}
  for (const track of Object.values(scoreTracks)) track.retryAfter = 0;
  if (!scoreTimer) scoreTimer = setInterval(scoreRefresh, 100);
  scoreRefresh();
}

function scoreStop() {
  scoreMode = '';
  scoreSilence();
  for (const track of Object.values(scoreTracks)) track.buffer = null;
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) scoreSilence();
  else if (scoreMode && soundOn) scoreStart(scoreMode);
});
window.addEventListener('pagehide', scoreSilence);
window.addEventListener('pageshow', () => {
  if (scoreMode && soundOn && !document.hidden) scoreStart(scoreMode);
});
window.addEventListener('realmvoicechange', scoreRefresh);
for (const action of ['pointerdown', 'keydown'])
  document.addEventListener(
    action,
    () => {
      if (
        scoreMode &&
        soundOn &&
        (audioCtx?.state === 'suspended' ||
          Object.values(scoreTracks).some((track) => track.retryAfter > performance.now()))
      )
        scoreStart(scoreMode);
    },
    { passive: true },
  );
// Transient body and overtone are shaped independently so a hoof, a blade and a boot
// have different attacks. Small stereo positions are relative to the listener.
function resonantFoley(pitch, tail, volume, endPitch = pitch, delay = 0, pan = 0) {
  if (!soundOn || !audioCtx || !prefs.effects) return;
  const ctx = audioCtx,
    at = ctx.currentTime + delay;
  const osc = ctx.createOscillator(),
    gain = ctx.createGain(),
    place = ctx.createStereoPanner();
  osc.frequency.setValueAtTime(pitch, at);
  osc.frequency.exponentialRampToValueAtTime(endPitch, at + tail);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.00011, volume * prefs.effects), at + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + tail);
  place.pan.value = pan;
  osc.connect(gain).connect(place).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + tail + 0.009);
}

function scoreCue(cue) {
  if (!soundOn) return;
  if (cue === 'chapter') {
    for (const [pitch, delay, pan] of [
      [293.66, 0, -0.22],
      [440, 0.12, 0.1],
      [587.33, 0.25, 0.31],
    ]) {
      resonantFoley(pitch, 0.71, 0.046, pitch, delay, pan);
      resonantFoley(pitch * 2.97, 0.25, 0.014, pitch * 2.97, delay, pan);
    }
  } else if (cue === 'parry') {
    noiseFoley(0.048, 4600, 0.19, 0.14);
    for (const [f, decay, v] of [
      [890, 0.35, 0.1],
      [1490, 0.46, 0.065],
      [2325, 0.19, 0.043],
      [3500, 0.09, 0.025],
    ])
      resonantFoley(f, decay, v, f * 0.988, 0, 0.17);
  } else if (cue === 'bow') {
    noiseFoley(0.063, 2680, 0.12, -0.22);
    resonantFoley(228, 0.14, 0.1, 110, 0.003, -0.27);
    resonantFoley(470, 0.093, 0.046, 218, 0.004, -0.24);
  } else if (cue === 'impact') {
    noiseFoley(0.096, 1300, 0.22, 0.14);
    resonantFoley(108, 0.15, 0.15, 56);
    resonantFoley(262, 0.085, 0.045, 151, 0.006, 0.12);
  }
}

let noiseBank;
function noiseFoley(duration, cutoff, volume, pan = 0, delay = 0) {
  if (!soundOn || !audioCtx || !prefs.effects) return;
  const ctx = audioCtx;
  if (!noiseBank) {
    noiseBank = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
    const d = noiseBank.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource(),
    f = ctx.createBiquadFilter(),
    amp = ctx.createGain(),
    place = ctx.createStereoPanner();
  const at = ctx.currentTime + delay;
  src.buffer = noiseBank;
  f.type = 'lowpass';
  f.frequency.value = cutoff;
  place.pan.value = pan;
  src.connect(f).connect(amp).connect(place).connect(ctx.destination);
  amp.gain.setValueAtTime(0.0001, at);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.00011, volume * prefs.effects), at + 0.0035);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  src.start(at, Math.random() * 0.4);
  src.stop(at + duration + 0.003);
}

let stepSide = 1;
function soundscape(dt, moving, sprinting) {
  if (!soundOn) return;
  stepBeat -= dt;
  if (moving && stepBeat <= 0 && game.air <= 0.05) {
    stepBeat = sprinting ? 0.32 : 0.49;
    stepSide *= -1;
    const stone = zoneAt(game.x, game.z) === 1;
    const wet = creekDepth(game.x, game.z) > 0.32;
    const pan = stepSide * 0.13;
    noiseFoley(wet ? 0.18 : 0.073, wet ? 2630 : stone ? 1850 : 900, wet ? 0.18 : 0.15, pan);
    noiseFoley(0.105, wet ? 1340 : stone ? 980 : 520, 0.063, pan, 0.044);
    resonantFoley(stone ? 107 : 82, 0.078, 0.097, 48, 0, pan);
  }
}

let lastHoofMark = 0;
function harnessFoley(s, travel) {
  const mark = Math.floor(travel / 0.48);
  if (mark === lastHoofMark) return;
  lastHoofMark = mark;
  if (!soundOn || s.inside) return;
  const cow = bovineOffice(),
    d = distance(s, cow),
    gain = 1 - Math.min(1, d / 21);
  if (gain < 0.02) return;
  const lateral =
    (wrapped(cow.x - s.x) * Math.cos(s.yaw) - wrapped(cow.z - s.z) * Math.sin(s.yaw)) / Math.max(1, d);
  const pan = Math.max(-0.87, Math.min(0.87, lateral * 0.7 + (mark % 2 ? 0.1 : -0.1)));
  const hard = zoneAt(cow.x, cow.z) === 1;
  noiseFoley(0.049, hard ? 2210 : 1340, 0.16 * gain, pan);
  resonantFoley(mark % 2 ? 343 : 292, 0.065, 0.064 * gain, 254, 0, pan);
  resonantFoley(115, 0.088, 0.1 * gain, 61, 0.003, pan);
  if (mark % 4 === 0) {
    resonantFoley(782, 0.31, 0.044 * gain, 764, 0.035, pan);
    resonantFoley(1321, 0.19, 0.021 * gain, 1309, 0.036, pan);
  }
}

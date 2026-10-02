// Ввод: клавиатура, мышь с захватом указателя, тач-управление.
import { G } from './state.js';

const ACTIONS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  jump: ['Space'],
  crouch: ['ControlLeft', 'ControlRight', 'KeyZ'],
  attack: ['Mouse0'],
  block: ['Mouse2'],
  interact: ['KeyE'],
  switchWeapon: ['KeyR'],
  quick1: ['Digit1'], quick2: ['Digit2'], quick3: ['Digit3'], quick4: ['Digit4'],
  bandage: ['KeyF'],
  wheelchair: ['KeyG'],
  view: ['KeyV'],
  torch: ['KeyL'],
  sheath: ['KeyX'],
  hold: ['KeyH'],
  attackOrder: ['KeyY'],
  squad: ['KeyT'],
  inventory: ['KeyI'],
  character: ['KeyC'],
  journal: ['KeyJ'],
  map: ['KeyM'],
  pause: ['Escape'],
  quicksave: ['F5'],
  quickload: ['F9'],
  debug: ['F3'],
  photo: ['KeyP'],
};

export const Input = {
  enabled: true,
  isTouch: false,
  locked: false,
  down: new Set(),
  pressedSet: new Set(),
  releasedSet: new Set(),
  mouse: { dx: 0, dy: 0, wheel: 0, buttons: new Set() },
  touch: { moveX: 0, moveY: 0, lookDx: 0, lookDy: 0, active: false, buttons: new Set() },
  _codeToActions: new Map(),

  init(canvas) {
    this.canvas = canvas;
    for (const [action, codes] of Object.entries(ACTIONS)) {
      for (const c of codes) {
        if (!this._codeToActions.has(c)) this._codeToActions.set(c, []);
        this._codeToActions.get(c).push(action);
      }
    }
    window.addEventListener('keydown', (e) => {
      if (e.repeat) { return; }
      if (isTypingTarget(e.target)) return;
      if (['Space', 'F5', 'F9', 'Tab'].includes(e.code)) e.preventDefault();
      this.down.add(e.code);
      this.pressedSet.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
      this.releasedSet.add(e.code);
    });
    window.addEventListener('blur', () => { this.down.clear(); this.mouse.buttons.clear(); });

    canvas.addEventListener('mousedown', (e) => {
      if (G.uiOpen || G.paused) return;
      this.mouse.buttons.add('Mouse' + e.button);
      this.pressedSet.add('Mouse' + e.button);
      if (!this.locked && !this.isTouch) this.requestLock();
    });
    window.addEventListener('mouseup', (e) => {
      this.mouse.buttons.delete('Mouse' + e.button);
      this.releasedSet.add('Mouse' + e.button);
    });
    window.addEventListener('contextmenu', (e) => { if (G.running && !G.uiOpen) e.preventDefault(); });
    window.addEventListener('mousemove', (e) => {
      if (this.locked) {
        this.mouse.dx += e.movementX || 0;
        this.mouse.dy += e.movementY || 0;
      }
    });
    window.addEventListener('wheel', (e) => { if (this.locked) this.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) this.down.clear();
    });
    document.addEventListener('pointerlockerror', () => { this.locked = false; });

    this._initTouch(canvas);
  },

  requestLock() {
    if (!this.canvas || this.isTouch) return;
    const tryLock = (opts) => {
      try {
        const p = opts ? this.canvas.requestPointerLock(opts) : this.canvas.requestPointerLock();
        return p && p.catch ? p : null;
      } catch (e) { return null; }
    };
    const p = tryLock({ unadjustedMovement: true });
    if (p) p.catch(() => { const q = tryLock(); if (q) q.catch(() => {}); });
  },
  releaseLock() { if (document.pointerLockElement) document.exitPointerLock(); },

  // ------------------------- тач -------------------------
  _initTouch(canvas) {
    const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 1;
    if (isTouchDevice) { this.isTouch = true; }
    const stick = document.getElementById('touch-stick');
    const knob = document.getElementById('touch-stick-knob');
    if (stick) {
      let stickId = null, cx = 0, cy = 0;
      const R = 46;
      const start = (e) => {
        const t = e.changedTouches[0]; stickId = t.identifier;
        const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
        this.touch.active = true; move(e);
      };
      const move = (e) => {
        for (const t of e.changedTouches) {
          if (t.identifier !== stickId) continue;
          let dx = t.clientX - cx, dy = t.clientY - cy;
          const len = Math.hypot(dx, dy);
          if (len > R) { dx = (dx / len) * R; dy = (dy / len) * R; }
          this.touch.moveX = dx / R; this.touch.moveY = dy / R;
          if (knob) knob.style.transform = `translate(${dx}px,${dy}px)`;
        }
        e.preventDefault();
      };
      const end = (e) => {
        for (const t of e.changedTouches) if (t.identifier === stickId) {
          stickId = null; this.touch.moveX = 0; this.touch.moveY = 0; this.touch.active = false;
          if (knob) knob.style.transform = '';
        }
      };
      stick.addEventListener('touchstart', start, { passive: false });
      stick.addEventListener('touchmove', move, { passive: false });
      stick.addEventListener('touchend', end); stick.addEventListener('touchcancel', end);
    }
    if (canvas) {
      let lookId = null, lx = 0, ly = 0;
      canvas.addEventListener('touchstart', (e) => {
        for (const t of e.changedTouches) {
          if (t.clientX > window.innerWidth * 0.35 && lookId === null) {
            lookId = t.identifier; lx = t.clientX; ly = t.clientY;
          }
        }
      }, { passive: true });
      canvas.addEventListener('touchmove', (e) => {
        for (const t of e.changedTouches) {
          if (t.identifier !== lookId) continue;
          this.touch.lookDx += (t.clientX - lx) * 2.2;
          this.touch.lookDy += (t.clientY - ly) * 2.2;
          lx = t.clientX; ly = t.clientY;
        }
        e.preventDefault();
      }, { passive: false });
      const endLook = (e) => { for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null; };
      canvas.addEventListener('touchend', endLook); canvas.addEventListener('touchcancel', endLook);
    }
    document.querySelectorAll('[data-touch]').forEach((btn) => {
      const act = btn.dataset.touch;
      const press = (e) => {
        e.preventDefault();
        this.touch.buttons.add(act);
        const code = 'Touch' + act;
        this.pressedSet.add(code);
        if (act === 'block') this.mouse.buttons.add('Mouse2');
      };
      const rel = () => {
        this.touch.buttons.delete(act);
        const code = 'Touch' + act;
        this.releasedSet.add(code);
        if (act === 'block') this.mouse.buttons.delete('Mouse2');
      };
      btn.addEventListener('touchstart', press, { passive: false });
      btn.addEventListener('touchend', rel); btn.addEventListener('touchcancel', rel);
    });
    if (this.isTouch) {
      const tc = document.getElementById('touch-controls');
      if (tc) tc.classList.remove('hidden');
    }
  },

  // ------------------------- API -------------------------
  isDownAction(name) {
    if (!this.enabled) return false;
    const codes = ACTIONS[name];
    if (!codes) return false;
    for (const c of codes) if (this.down.has(c) || (c.startsWith('Mouse') && this.mouse.buttons.has(c))) return true;
    if (this.isTouch) {
      if (name === 'attack' && this.touch.buttons.has('attack')) return true;
      if (name === 'jump' && this.touch.buttons.has('jump')) return true;
      if (name === 'interact' && this.touch.buttons.has('interact')) return true;
      if (name === 'block' && this.touch.buttons.has('block')) return true;
      if (name === 'switchWeapon' && this.touch.buttons.has('switch')) return true;
      if (name === 'bandage' && this.touch.buttons.has('bandage')) return true;
      if (name === 'sprint' && Math.hypot(this.touch.moveX, this.touch.moveY) > 0.85) return true;
    }
    return false;
  },
  pressed(name) {
    const codes = ACTIONS[name];
    if (!codes) return false;
    for (const c of codes) if (this.pressedSet.has(c)) return true;
    if (this.isTouch) {
      if (name === 'attack' && this.pressedSet.has('Touch' + 'attack')) return true;
      if (name === 'interact' && this.pressedSet.has('Touchinteract')) return true;
      if (name === 'switchWeapon' && this.pressedSet.has('Touchswitch')) return true;
      if (name === 'jump' && this.pressedSet.has('Touchjump')) return true;
      if (name === 'bandage' && this.pressedSet.has('Touchbandage')) return true;
    }
    return false;
  },
  released(name) {
    const codes = ACTIONS[name];
    if (!codes) return false;
    for (const c of codes) if (this.releasedSet.has(c)) return true;
    return false;
  },
  moveVector() {
    let f = 0, s = 0;
    if (this.isDownAction('forward')) f += 1;
    if (this.isDownAction('back')) f -= 1;
    if (this.isDownAction('right')) s += 1;
    if (this.isDownAction('left')) s -= 1;
    if (this.isTouch && this.touch.active) { s += this.touch.moveX; f += -this.touch.moveY; }
    const len = Math.hypot(f, s);
    if (len > 1) { f /= len; s /= len; }
    return { f, s };
  },
  consumeMouse() {
    const dx = this.mouse.dx + (this.isTouch ? this.touch.lookDx : 0);
    const dy = this.mouse.dy + (this.isTouch ? this.touch.lookDy : 0);
    return { dx, dy };
  },
  endFrame() {
    this.pressedSet.clear();
    this.releasedSet.clear();
    this.mouse.dx = 0; this.mouse.dy = 0; this.mouse.wheel = 0;
    this.touch.lookDx = 0; this.touch.lookDy = 0;
  },
  clear() { this.down.clear(); this.mouse.buttons.clear(); this.pressedSet.clear(); },
};

function isTypingTarget(t) {
  return t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA');
}
export { ACTIONS };

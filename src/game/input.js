// ===== INPUT HANDLER =====

const KEY_MAP = {
  'ArrowUp': [0, -1], 'ArrowDown': [0, 1], 'ArrowLeft': [-1, 0], 'ArrowRight': [1, 0],
  'w': [0, -1], 's': [0, 1], 'a': [-1, 0], 'd': [1, 0],
  'W': [0, -1], 'S': [0, 1], 'A': [-1, 0], 'D': [1, 0],
};
const SWIPE_THRESHOLD = 20;

export class Input {
  constructor() {
    this._callbacks = { move: null, undo: null, restart: null, escape: null };
    this._touchStart = null;
    this._enabled = true;
    this._keyHandler = null;
    this._keyUpHandler = null;
    this._touchCanvas = null;
    this._touchStartHandler = null;
    this._touchEndHandler = null;
    this._heldDir = null; // currently held movement direction
  }

  on(event, callback) { this._callbacks[event] = callback; }
  setEnabled(enabled) {
    this._enabled = enabled;
    if (!enabled) this._heldDir = null;
  }

  // Called each game frame — fires move if a direction key is held
  pollHeld() {
    if (this._enabled && this._heldDir) {
      this._callbacks.move?.(this._heldDir[0], this._heldDir[1]);
    }
  }

  bindKeyboard() {
    this._keyHandler = (e) => {
      if (!this._enabled) return;
      const dir = KEY_MAP[e.key];
      if (dir) {
        e.preventDefault();
        // On first press fire immediately; also update held dir
        if (!e.repeat) this._callbacks.move?.(dir[0], dir[1]);
        this._heldDir = dir;
        return;
      }
      if (e.key === 'z' || e.key === 'Z' || e.key === 'e' || e.key === 'E') { e.preventDefault(); if (!e.repeat) this._callbacks.undo?.(); return; }
      if (e.key === 'r' || e.key === 'R') { e.preventDefault(); if (!e.repeat) this._callbacks.restart?.(); return; }
      if (e.key === 'Escape') { e.preventDefault(); if (!e.repeat) this._callbacks.escape?.(); return; }
    };
    this._keyUpHandler = (e) => {
      if (KEY_MAP[e.key] && this._heldDir === KEY_MAP[e.key]) {
        this._heldDir = null;
      }
    };
    document.addEventListener('keydown', this._keyHandler);
    document.addEventListener('keyup', this._keyUpHandler);
  }

  bindTouch(canvas) {
    this._touchCanvas = canvas;
    this._touchStartHandler = (e) => {
      if (!this._enabled) return;
      e.preventDefault();
      const t = e.touches[0];
      this._touchStart = { x: t.clientX, y: t.clientY };
    };
    this._touchEndHandler = (e) => {
      if (!this._enabled || !this._touchStart) return;
      e.preventDefault();
      const t = e.changedTouches[0];
      const dx = t.clientX - this._touchStart.x;
      const dy = t.clientY - this._touchStart.y;
      const adx = Math.abs(dx), ady = Math.abs(dy);
      if (Math.max(adx, ady) >= SWIPE_THRESHOLD) {
        if (adx > ady) this._callbacks.move?.(dx > 0 ? 1 : -1, 0);
        else this._callbacks.move?.(0, dy > 0 ? 1 : -1);
      }
      this._touchStart = null;
    };
    canvas.addEventListener('touchstart', this._touchStartHandler, { passive: false });
    canvas.addEventListener('touchend', this._touchEndHandler, { passive: false });
  }

  destroy() {
    if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
    if (this._keyUpHandler) document.removeEventListener('keyup', this._keyUpHandler);
    if (this._touchCanvas && this._touchStartHandler) {
      this._touchCanvas.removeEventListener('touchstart', this._touchStartHandler);
      this._touchCanvas.removeEventListener('touchend', this._touchEndHandler);
    }
  }
}
